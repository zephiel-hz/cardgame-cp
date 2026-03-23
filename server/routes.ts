import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, WS_EVENTS } from "@shared/routes";
import { emailNotificationService } from "./email-notifications";
import { z } from "zod";
import { WebSocketServer, WebSocket } from "ws";
import fs from "fs";
import path from "path";
import { uploadImageToR2 } from "./storage-r2";
import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let registerRoutesCallCount = 0;

// Use /tmp for avatar storage in Vercel serverless (read-only filesystem)
// Use public/avatars for local development
const uploadDir = process.env.NODE_ENV === "production" 
  ? path.join("/tmp", "avatars")
  : path.resolve(process.cwd(), "public/avatars");

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (err) {
    console.warn(`[routes] Could not create upload directory at ${uploadDir}:`, err);
  }
}

console.log(`[routes] Using avatar upload directory: ${uploadDir}`);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerRoutesCallCount++;
  console.log(`[registerRoutes] Initializing routes (call #${registerRoutesCallCount})`);
  
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Map to track user ID to WebSocket connection
  const userConnections = new Map<number, WebSocket>();

  // Broadcast helper
  const broadcast = (type: string, payload: any) => {
    const message = JSON.stringify({ type, payload });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Send message to specific user
  const sendToUser = (userId: number, type: string, payload: any) => {
    console.log(`[sendToUser] Attempting to send ${type} to user ${userId}`);
    const ws = userConnections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log(`[sendToUser] ✅ User ${userId} is connected, sending message`);
      ws.send(JSON.stringify({ type, payload }));
    } else {
      console.log(`[sendToUser] ❌ User ${userId} is NOT connected (WebSocket state: ${ws?.readyState ?? 'not found'})`);
    }
  };

  // WebSocket connection handler
  wss.on('connection', (ws: WebSocket) => {
    console.log('[WebSocket] New client connected');
    let userId: number | null = null;

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        // First message should be user identification
        if (message.type === 'IDENTIFY_USER' && typeof message.userId === 'number') {
          userId = message.userId as number;
          if (userId !== null) {
            userConnections.set(userId, ws);
            console.log(`[WebSocket] User ${userId} identified`);
            ws.send(JSON.stringify({ type: 'IDENTIFIED', userId }));
          }
        }
      } catch (err) {
        console.error('[WebSocket] Error processing message:', err);
      }
    });

    ws.on('close', () => {
      if (userId) {
        userConnections.delete(userId);
        console.log(`[WebSocket] User ${userId} disconnected`);
      }
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Error:', err);
    });
  });

  console.log("[registerRoutes] Starting to register routes...");
  console.log("[registerRoutes] api.auth.login.path:", api.auth.login.path);

  console.log("[registerRoutes] About to register POST /api/auth/register...");
  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      const existing = await storage.getUserByUsername(input.username);
      if (existing) {
        return res.status(409).json({ message: "Username sudah digunakan" });
      }
      
      // Check if email is pre-verified from registration flow
      const emailVerified = input.email ? storage.isEmailPreVerified(input.email) : false;
      
      const newUser = await storage.createUser({
        username: input.username,
        pin: input.pin,
        gender: input.gender || 'other',
        email: input.email,
        emailVerified: emailVerified,
      });
      
      // Clean up pre-verified email
      if (input.email && emailVerified) {
        storage.clearPreVerifiedEmail(input.email);
      }
      
      res.status(200).json(newUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  console.log("[registerRoutes] Registered POST /api/auth/register");

  console.log("[registerRoutes] About to register POST /api/auth/login...");
  app.post(api.auth.login.path, async (req, res) => {
    try {
      console.log("[DEBUG:login] Login request received:", req.body);
      const input = api.auth.login.input.parse(req.body);
      let user = await storage.getUserByUsername(input.username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (!storage.verifyUserPin(user, input.pin)) {
        return res.status(401).json({ message: "Invalid PIN" });
      }
      res.status(200).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(404).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  console.log("[registerRoutes] Registered POST /api/auth/login");

  // E2EE: Setup encryption (store public key)
  console.log("[registerRoutes] About to register POST /api/auth/setup-e2ee...");
  app.post("/api/auth/setup-e2ee", async (req, res) => {
    try {
      console.log("[E2EE] setup-e2ee endpoint called with body:", req.body);
      const { userId, publicKey } = req.body;
      
      if (!userId || !publicKey) {
        return res.status(400).json({ message: "userId and publicKey required" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Store public key
      await storage.updateUser(userId, { publicKey });
      
      console.log(`[E2EE] ✓ Public key stored for user ${userId}, length: ${publicKey.length}`);
      res.status(200).json({ success: true, message: "E2EE setup complete" });
    } catch (err: any) {
      console.error("[E2EE] Setup error:", err);
      res.status(500).json({ message: "Failed to setup E2EE" });
    }
  });
  console.log("[registerRoutes] Registered POST /api/auth/setup-e2ee");

  // E2EE: Get partner's public key
  console.log("[registerRoutes] About to register GET /api/auth/public-key/:userId...");
  app.get("/api/auth/public-key/:userId", async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      console.log("[E2EE] public-key endpoint called for userId:", userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        console.log("[E2EE] User not found for ID:", userId);
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!user.publicKey) {
        console.log("[E2EE] User found but no public key set for userId:", userId);
        return res.status(404).json({ message: "User has not setup E2EE yet" });
      }
      
      console.log(`[E2EE] ✓ Returning public key for user ${userId}, length: ${user.publicKey.length}`);
      res.status(200).json({ publicKey: user.publicKey });
    } catch (err: any) {
      console.error("[E2EE] Get public key error:", err);
      res.status(500).json({ message: "Failed to get public key" });
    }
  });
  console.log("[registerRoutes] Registered GET /api/auth/public-key/:userId");

  // E2EE: Reset encryption keys (for debugging/testing)
  app.post("/api/auth/reset-e2ee/:userId", async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Clear public key from database - forces regeneration on next login
      await storage.updateUser(userId, { publicKey: null });
      
      console.log(`[E2EE] ✓ Reset E2EE keys for user ${userId}`);
      res.status(200).json({ 
        success: true, 
        message: "E2EE keys reset. Please log out and log back in to regenerate.",
        userId
      });
    } catch (err: any) {
      console.error("[E2EE] Reset error:", err);
      res.status(500).json({ message: "Failed to reset E2EE keys" });
    }
  });
  console.log("[registerRoutes] Registered POST /api/auth/reset-e2ee/:userId");

  app.patch(api.auth.updateProfile.path, async (req, res) => {
    try {
      const { userId, oldPin, ...updates } = api.auth.updateProfile.input.parse(req.body);
      
      // If PIN is being changed, validate the old PIN
      if (updates.pin && oldPin) {
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User tidak ditemukan" });
        }
        // Validate old PIN matches
        if (user.pin !== oldPin) {
          return res.status(400).json({ message: "PIN Lama tidak sesuai" });
        }
      }
      
      const updatedUser = await storage.updateUser(userId, updates);
      res.status(200).json(updatedUser);
    } catch (err: any) {
      console.error("[updateProfile] Error:", err);
      res.status(400).json({ message: err.message || "Failed to update profile" });
    }
  });

  app.get(api.auth.listUsers.path, async (req, res) => {
    try {
      console.log("[DEBUG:listUsers] Request received");
      const allUsers = await storage.getAllUsers();
      console.log("[DEBUG:listUsers] Got users:", allUsers.length, "users");
      res.status(200).json(allUsers);
    } catch (err) {
      console.error("[DEBUG:listUsers] Error:", err);
      res.status(500).json({ message: "Failed to fetch users", error: String(err) });
    }
  });

  app.post(api.auth.uploadAvatar.path, async (req, res) => {
    try {
      const { userId, filename, data } = req.body;
      
      if (!userId || !data) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
      const base64Data = data.replace(/^data:image\/[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      console.log(`[Avatar] === UPLOAD START ===`);
      console.log(`[Avatar] userId: ${userId} (type: ${typeof userId})`);
      console.log(`[Avatar] Incoming size: ${buffer.length} bytes`);

      try {
        // === INLINE AVATAR UPLOAD LOGIC (Consistent Naming) ===
        
        // Initialize S3 client for R2
        const s3Client = new S3Client({
          region: "auto",
          endpoint: process.env.CF_R2_ENDPOINT,
          credentials: {
            accessKeyId: process.env.CF_R2_ACCESS_KEY_ID || "",
            secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY || "",
          },
        });
        
        const BUCKET_NAME = process.env.CF_R2_BUCKET_NAME || "chat-images";
        const PUBLIC_URL_BASE = process.env.CF_R2_PUBLIC_URL || "https://images.example.com";

        // Compress image using sharp (512×512, webp format)
        console.log(`[Avatar] Compressing avatar for user ${userId}...`);
        const compressedBuffer = await sharp(buffer)
          .rotate() // Auto-rotate based on EXIF
          .resize(512, 512, {
            fit: "cover",
            withoutEnlargement: true,
          })
          .toFormat("webp", {
            quality: 85,
            progressive: true,
          })
          .toBuffer();

        console.log(`[Avatar] Compressed: ${buffer.length} → ${compressedBuffer.length} bytes`);

        // === KEY: Generate CONSISTENT filename based on userId ===
        const consistentFilename = `avatars/user-${userId}.webp`;
        console.log(`[Avatar] ⭐️ CONSISTENT FILENAME: ${consistentFilename}`);

        // Upload to R2 (will overwrite if filename already exists)
        console.log(`[Avatar] Uploading to R2...`);
        await s3Client.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: consistentFilename,
            Body: compressedBuffer,
            ContentType: "image/webp",
            CacheControl: "public, max-age=86400", // 24 hour cache
          })
        );

        // Construct public URL
        const avatarUrl = `${PUBLIC_URL_BASE}/${consistentFilename}`;
        console.log(`[Avatar] ✅ Avatar uploaded: ${avatarUrl}`);

        // Store R2 URL in database (not base64)
        await storage.updateUser(Number(userId), { 
          avatarUrl: avatarUrl,
          avatarData: null // Clear old base64 data
        });

        console.log(`[Avatar] ✅ URL saved to database`);
        console.log(`[Avatar] === UPLOAD END ===`);
        res.status(200).json({ avatarUrl });
      } catch (uploadErr: any) {
        console.error("[Avatar] Upload error:", uploadErr);
        return res.status(500).json({ message: "Failed to upload avatar: " + uploadErr.message });
      }
    } catch (err: any) {
      console.error("[Avatar] Handler error:", err);
      res.status(500).json({ message: "Server error: " + (err.message || "Unknown error") });
    }
  });

  // DELETE avatar
  app.delete(api.auth.deleteAvatar.path, async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      console.log(`[Avatar] === DELETE START ===`);
      console.log(`[Avatar] userId: ${userId}`);

      try {
        // Clear avatar URL from database
        await storage.updateUser(Number(userId), { 
          avatarUrl: null,
          avatarData: null
        });

        console.log(`[Avatar] ✅ Avatar deleted from database for user ${userId}`);
        console.log(`[Avatar] === DELETE END ===`);
        res.status(200).json({ message: "Avatar deleted successfully" });
      } catch (deleteErr: any) {
        console.error("[Avatar] Delete error:", deleteErr);
        return res.status(500).json({ message: "Failed to delete avatar: " + deleteErr.message });
      }
    } catch (err: any) {
      console.error("[Avatar] Delete handler error:", err);
      res.status(500).json({ message: "Server error: " + (err.message || "Unknown error") });
    }
  });

  // Redirect to R2 URL for avatar
  app.get('/api/avatars/:userId', async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const user = await storage.getUser(userId);
      
      if (!user || !user.avatarUrl) {
        // Return 404 if no avatar
        return res.status(404).json({ message: "Avatar not found" });
      }

      // If avatarUrl starts with http, it's an R2 URL - redirect to it
      if (user.avatarUrl.startsWith("http")) {
        console.log(`[Avatar] Redirecting to R2 for user ${userId}`);
        return res.redirect(user.avatarUrl);
      }

      // Fallback: if old base64 data exists, serve it (backwards compatibility)
      if (user.avatarData) {
        console.log(`[Avatar] Serving base64 avatar for user ${userId} (legacy)`);
        const avatarBuffer = Buffer.from(user.avatarData, 'base64');
        res.set('Content-Type', 'image/jpeg');
        res.set('Content-Length', String(avatarBuffer.length));
        res.set('Cache-Control', 'public, max-age=2592000');
        return res.send(avatarBuffer);
      }

      // No avatar found
      res.status(404).json({ message: "Avatar not found" });
    } catch (err) {
      console.error("[Avatar] Serve error:", err);
      res.status(500).json({ message: "Failed to serve avatar" });
    }
  });

  // Email routes
  app.post(api.auth.updateEmail.path, async (req, res) => {
    try {
      const { userId, email } = api.auth.updateEmail.input.parse(req.body);
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(409).json({ message: "Email sudah terdaftar" });
      }

      // Generate verification token
      const { token } = await storage.setEmailVerificationToken(userId, email);
      
      // Send verification email
      const sent = await emailNotificationService.sendVerificationEmail(userId, email, token);
      
      if (sent) {
        res.status(200).json({ 
          success: true, 
          message: "Email verifikasi telah dikirim. Silakan cek inbox Anda." 
        });
      } else {
        res.status(200).json({ 
          success: false, 
          message: "Gagal mengirim email verifikasi. Email sudah disimpan tapi perlu verifikasi manual." 
        });
      }
    } catch (err: any) {
      console.error('[Email] Update email error:', err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Gagal mengupdate email" });
    }
  });

  app.post(api.auth.verifyEmail.path, async (req, res) => {
    try {
      const { token } = api.auth.verifyEmail.input.parse(req.body);
      
      console.log('[Email] verifyEmail called with token:', token);
      
      // Check if it's a temporary email token (pre-registration or email change)
      const tempEmailData = storage.getTempEmailToken(token);
      if (tempEmailData) {
        console.log('[Email] Temp email token found for:', tempEmailData.email, 'userId:', tempEmailData.userId);
        
        // Email change flow: userId is present in the token
        if (tempEmailData.userId) {
          try {
            console.log('[Email] Processing email change for userId:', tempEmailData.userId);
            
            // Get the current user
            const user = await storage.getUser(tempEmailData.userId);
            if (!user) {
              return res.status(404).json({ 
                success: false, 
                message: "User tidak ditemukan" 
              });
            }
            
            // Update user's email and mark as verified
            console.log('[Email] Updating user email from', user.email, 'to', tempEmailData.email);
            const updatedUser = await storage.updateUser(tempEmailData.userId, {
              email: tempEmailData.email,
              emailVerified: true,
              emailVerificationToken: null,
              emailVerificationExpiresAt: null,
            });
            
            // Clear the temporary token
            storage.clearTempEmailToken(token);
            
            console.log('[Email] Email change successful, returning updated user:', { id: updatedUser.id, username: updatedUser.username, email: updatedUser.email, emailVerified: updatedUser.emailVerified });
            
            // Return full user object for frontend to sync state
            return res.status(200).json(updatedUser);
          } catch (updateErr: any) {
            console.error('[Email] Error updating user email:', updateErr);
            return res.status(500).json({ 
              success: false, 
              message: "Gagal mengubah email" 
            });
          }
        } else {
          // Pre-registration flow: no userId, just mark email as pre-verified
          console.log('[Email] Temp email token verified for pre-registration:', tempEmailData.email);
          storage.markEmailAsPreVerified(tempEmailData.email);
          storage.clearTempEmailToken(token);
          return res.status(200).json({ 
            success: true, 
            message: "Email berhasil diverifikasi",
            email: tempEmailData.email,
            isPreRegistration: true
          });
        }
      }

      // Check if it's a registered user's email verification token
      const verifiedUser = await storage.verifyEmail(token);
      
      console.log('[Email] verifyEmail result:', verifiedUser ? { id: verifiedUser.id, username: verifiedUser.username, email: verifiedUser.email, emailVerified: verifiedUser.emailVerified } : null);
      
      if (verifiedUser) {
        res.status(200).json(verifiedUser);
      } else {
        res.status(400).json({ 
          success: false, 
          message: "Link verifikasi tidak valid atau sudah kadaluarsa" 
        });
      }
    } catch (err: any) {
      console.error('[Email] Verify email error:', err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Gagal memverifikasi email" });
    }
  });

  app.post(api.auth.sendRegistrationEmail.path, async (req, res) => {
    try {
      console.log('[Email] sendRegistrationEmail called with body:', req.body);
      const { email: emailInput, userId } = api.auth.sendRegistrationEmail.input.parse(req.body);
      
      let email = emailInput;
      
      // If userId is provided, fetch the user's current email from database
      if (userId && !emailInput) {
        console.log('[Email] Fetching user email for userId:', userId);
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User tidak ditemukan" });
        }
        if (!user.email) {
          return res.status(400).json({ message: "User belum memiliki email" });
        }
        email = user.email;
        console.log('[Email] User email found:', email);
      }
      
      if (!email) {
        return res.status(400).json({ message: "Email tidak valid" });
      }
      
      console.log('[Email] Email parsed:', email);
      
      // Check if email already exists (only for new registrations)
      // For email change requests (with userId), we skip this check
      if (!userId) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          console.log('[Email] Email already registered:', email);
          return res.status(409).json({ message: "Email sudah terdaftar" });
        }
      }

      // Generate verification token (pass userId for email change flows)
      console.log('[Email] Generating temp token for:', email);
      const { token } = await storage.setTempEmailVerificationToken(email, userId || undefined);
      console.log('[Email] Token generated:', token.substring(0, 10) + '...');
      
      // Send verification email
      console.log('[Email] Sending verification email to:', email);
      const sent = await emailNotificationService.sendVerificationEmail(userId || 0, email, token);
      console.log('[Email] Email sent result:', sent);
      
      if (sent) {
        res.status(200).json({ 
          success: true, 
          message: "Email verifikasi telah dikirim. Silakan cek inbox Anda." 
        });
      } else {
        res.status(200).json({ 
          success: false, 
          message: "Gagal mengirim email verifikasi. Coba lagi nanti." 
        });
      }
    } catch (err: any) {
      console.error('[Email] Send registration email error:', err);
      console.error('[Email] Error stack:', err.stack);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Gagal mengirim email verifikasi: " + (err.message || "Unknown error") });
    }
  });

  app.post(api.auth.pairPartner.path, async (req, res) => {
    try {
      const input = api.auth.pairPartner.input.parse(req.body);
      const pairedUser = await storage.pairPartner(input.userId, input.partnerId);
      res.status(200).json({ success: true, message: "Partner berhasil dipasangkan", user: pairedUser });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err.message.includes("tidak ditemukan")) {
        return res.status(404).json({ message: err.message });
      }
      res.status(400).json({ message: err.message || "Gagal pasang partner" });
    }
  });

  app.get(api.auth.getPartner.path, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const partner = await storage.getPartner(userId);
      res.status(200).json(partner || null);
    } catch (err: any) {
      res.status(500).json({ message: "Gagal mengambil data partner" });
    }
  });

  app.get(api.auth.getUserInfo.path, async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const userInfo = await storage.getPublicUserInfo(userId);
      res.status(200).json(userInfo || null);
    } catch (err: any) {
      res.status(500).json({ message: "Gagal mengambil data user" });
    }
  });

  app.post(api.auth.sendPartnershipRequest.path, async (req, res) => {
    try {
      const { userId, partnerId } = api.auth.sendPartnershipRequest.input.parse(req.body);
      const request = await storage.sendPartnershipRequest(userId, partnerId);
      res.status(200).json({ success: true, message: "Permintaan partnership terkirim" });
    } catch (err: any) {
      if (err.message.includes("sudah")) {
        return res.status(409).json({ message: err.message });
      }
      res.status(400).json({ message: err.message || "Gagal mengirim permintaan partnership" });
    }
  });

  app.get(api.auth.getPendingRequests.path, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const requests = await storage.getPendingPartnershipRequests(userId);
      res.status(200).json(requests);
    } catch (err: any) {
      res.status(500).json({ message: "Gagal mengambil data permintaan" });
    }
  });

  app.post(api.auth.respondToPartnershipRequest.path, async (req, res) => {
    try {
      const { requestId, accept } = api.auth.respondToPartnershipRequest.input.parse(req.body);
      const result = await storage.respondToPartnershipRequest(requestId, accept);
      res.status(200).json({ 
        success: true, 
        message: accept ? "Partnership diterima" : "Partnership ditolak"
      });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Gagal memproses permintaan" });
    }
  });

  app.post(api.auth.initiateRemoval.path, async (req, res) => {
    try {
      console.log("📨 Remove partnership request body:", JSON.stringify(req.body, null, 2));
      
      const { userId, reason } = api.auth.initiateRemoval.input.parse(req.body);
      
      console.log("✅ Parsed input - userId:", userId, "reason:", reason, "reason type:", typeof reason);
      console.log("✅ Reason is empty?", !reason, "Trimmed empty?", !reason?.trim());
      
      await storage.initiatePartnershipRemoval(userId, reason);
      res.status(200).json({ 
        success: true, 
        message: "Permintaan penghapusan partnership telah dikirim ke partner Anda"
      });
    } catch (err: any) {
      console.error("❌ Error in remove partnership:", err.message);
      res.status(400).json({ message: err.message || "Gagal menginisiasi penghapusan partnership" });
    }
  });

  app.get(api.auth.getPendingRemovals.path, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      console.log("📥 Getting pending removal requests for user:", userId);
      
      const requests = await storage.getPendingRemovalRequests(userId);
      
      // Map snake_case to camelCase for API response
      const mappedRequests = requests.map(req => ({
        id: req.id,
        initiatorId: req.initiatorId,
        partnerId: req.partnerId,
        initiatorAccepted: req.initiatorAccepted,
        partnerAccepted: req.partnerAccepted,
        reason: req.reason,
        rejectionReason: req.rejectionReason, // Map rejection_reason -> rejectionReason
        status: req.status,
        createdAt: req.createdAt,
        respondedAt: req.respondedAt,
      }));
      
      console.log("📤 Sending removal requests:", JSON.stringify(mappedRequests, null, 2));
      res.status(200).json(mappedRequests);
    } catch (err: any) {
      console.error("❌ Error fetching removal requests:", err.message);
      res.status(400).json({ message: err.message || "Gagal mengambil data permintaan penghapusan" });
    }
  });

  app.post(api.auth.respondToRemoval.path, async (req, res) => {
    try {
      const { requestId, accept, userId, rejectionReason } = api.auth.respondToRemoval.input.parse(req.body);
      
      if (!accept && (!rejectionReason || rejectionReason.trim().length === 0)) {
        return res.status(400).json({ message: "Alasan penolakan wajib diisi" });
      }
      
      await storage.respondToRemovalRequest(requestId, accept, userId, rejectionReason);
      res.status(200).json({ 
        success: true, 
        message: accept ? "Partnership telah dihapus" : "Permintaan penghapusan partnership ditolak dengan alasan"
      });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Gagal memproses permintaan penghapusan" });
    }
  });

  app.post(api.auth.forceDeletePartnership.path, async (req, res) => {
    try {
      const { requestId, userId } = api.auth.forceDeletePartnership.input.parse(req.body);
      await storage.forceDeletePartnership(requestId, userId);
      res.status(200).json({ 
        success: true, 
        message: "Partnership telah dihapus tanpa persetujuan partner"
      });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Gagal melakukan force delete" });
    }
  });

  app.get(api.gacha.status.path, async (req, res) => {
    const userId = Number(req.params.userId);
    const count = await storage.getTodayGachaCount(userId);
    const remainingPulls = Math.max(0, 2 - count);
    
    // Calculate next reset time (6 AM or 6 PM WIB)
    const now = new Date();
    const wibTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const wibHour = wibTime.getUTCHours();
    
    const nextResetWib = new Date(wibTime);
    nextResetWib.setUTCMinutes(0, 0, 0);
    if (wibHour < 6) {
      nextResetWib.setUTCHours(6);
    } else if (wibHour < 18) {
      nextResetWib.setUTCHours(18);
    } else {
      nextResetWib.setUTCDate(nextResetWib.getUTCDate() + 1);
      nextResetWib.setUTCHours(6);
    }
    const nextResetTime = new Date(nextResetWib.getTime() - 7 * 60 * 60 * 1000);
    
    res.status(200).json({ remainingPulls, nextResetTime: nextResetTime.toISOString() });
  });

  app.post(api.gacha.pull.path, async (req, res) => {
    try {
      const input = api.gacha.pull.input.parse(req.body);
      
      // Validate user exists
      const user = await storage.getUser(input.userId);
      if (!user) {
        return res.status(400).json({ message: "User tidak ditemukan" });
      }
      
      const count = await storage.getTodayGachaCount(input.userId);
      if (count >= 2) {
        return res.status(200).json({ success: false, remainingPulls: 0, message: "Gacha limit reached for this period" });
      }

      // Perform Gacha logic
      const allCards = await storage.getCards();
      if (allCards.length === 0) {
        return res.status(200).json({ success: false, remainingPulls: 2 - count, message: "No cards available" });
      }

      const r = Math.random() * 100;
      let targetTier = 'Common';
      if (r < 10) targetTier = 'SSR';       // 0-10% = 10%
      else if (r < 25) targetTier = 'Epic'; // 10-25% = 15%
      else if (r < 50) targetTier = 'Rare'; // 25-50% = 25%
      // else 50% Common

      let tierCards = allCards.filter(c => c.tier === targetTier);
      if (tierCards.length === 0) tierCards = allCards; // fallback
      
      const pulledCard = tierCards[Math.floor(Math.random() * tierCards.length)];

      await storage.addGachaLog(input.userId);
      const userCard = await storage.addCardToInventory(input.userId, pulledCard.id);
      
      // Notify partner about new card via email (non-blocking with retry logic)
      // Only send notification for SSR cards
      // Fire and forget with retry mechanism
      (async () => {
        try {
          // Only notify partner for SSR cards
          if (pulledCard.tier === 'SSR') {
            const partner = await storage.getPartner(input.userId);
            
            if (partner && partner.email && partner.emailVerified) {
              const user = await storage.getUser(input.userId);
              
              let retries = 3;
              let lastError: Error | null = null;
              
              while (retries > 0) {
                try {
                  await emailNotificationService.notifyNewCardEmail(
                    partner.email,
                    user?.username || 'Partner',
                    pulledCard.tier
                  );
                  console.log('[Email] New card notification sent successfully');
                  break;
                } catch (err) {
                  lastError = err instanceof Error ? err : new Error(String(err));
                  retries--;
                  if (retries > 0) {
                    // Wait before retrying (exponential backoff: 1s, 2s, 4s)
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, 3 - retries) * 1000));
                    console.log(`[Email] Retrying notification (${retries} attempts remaining)...`);
                  }
                }
              }
              
              if (lastError) {
                console.error('[Email] Failed to send new card notification after retries:', lastError);
              }
            }
          }
        } catch (error) {
          console.error('[Notifications] Error in background notification task:', error);
        }
      })(); // IIFE executed immediately without awaiting

      res.status(200).json({ success: true, card: userCard, remainingPulls: 2 - (count + 1) });
    } catch (err: any) {
      console.error('[Gacha] Error:', err);
      const message = err.message || "Invalid request";
      res.status(400).json({ message });
    }
  });

  app.get(api.inventory.list.path, async (req, res) => {
    const userId = Number(req.params.userId);
    const items = await storage.getInventory(userId);
    res.status(200).json(items);
  });

  app.post(api.inventory.use.path, async (req, res) => {
    try {
      const input = api.inventory.use.input.parse(req.body);
      const usedCard = await storage.useCard(input.userCardId);
      
      console.log(`[Card] User ${usedCard.userId} used card:`, usedCard.card.name);
      
      // Broadcast via WS
      broadcast(WS_EVENTS.CARD_USED, {
        cardName: usedCard.card.name,
        userName: usedCard.user.username
      });

      // Send email notification to partner about card being used (non-blocking with retry)
      (async () => {
        try {
          const partner = await storage.getPartner(usedCard.userId);
          
          if (partner && partner.email && partner.emailVerified) {
            let retries = 3;
            let lastError: Error | null = null;
            
            while (retries > 0) {
              try {
                await emailNotificationService.notifyCardUsedEmail(
                  partner.email,
                  usedCard.user.username,
                  usedCard.card.name,
                  usedCard.card.description,
                  usedCard.card.tier,
                  usedCard.card.durationMinutes
                );
                console.log('[Email] Card used notification sent successfully');
                break;
              } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                retries--;
                if (retries > 0) {
                  await new Promise(resolve => setTimeout(resolve, Math.pow(2, 3 - retries) * 1000));
                  console.log(`[Email] Retrying card used notification (${retries} attempts remaining)...`);
                }
              }
            }
            
            if (lastError) {
              console.error('[Email] Failed to send card used notification after retries:', lastError);
            }
          }
        } catch (error) {
          console.error('[Notifications] Error in card used notification task:', error);
        }
      })();

      res.status(200).json(usedCard);
    } catch (err) {
      res.status(400).json({ message: "Failed to use card" });
    }
  });

  app.get(api.activeCards.list.path, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      
      console.log(`[Active Cards] User ${userId} requesting active cards`);
      
      // Verify user has a partner (requirement to enable this feature)
      const partner = await storage.getPartner(userId);
      
      if (!partner) {
        console.log(`[Active Cards] User ${userId} has no partner, returning 403`);
        return res.status(403).json({ message: "Anda harus memiliki partner untuk menggunakan fitur kartu aktif" });
      }
      
      console.log(`[Active Cards] User ${userId} is partnered with ${partner.id} (${partner.username})`);
      
      // Get ALL active cards (both user's and partner's)
      const allActiveCards = await storage.getActiveCards();
      console.log(`[Active Cards] Got ${allActiveCards.length} total active cards from storage`);
      
      // Filter to include both user's own cards AND partner's cards
      const relevantCards = allActiveCards.filter(card => {
        const isUserCard = card.userId === userId;
        const isPartnerCard = card.userId === partner.id;
        const isRelevant = isUserCard || isPartnerCard;
        console.log(`[Active Cards] Card ${card.id} (${card.card.name}): userId=${card.userId}, user=${userId}, partner=${partner.id}, include=${isRelevant}`);
        return isRelevant;
      });
      
      console.log(`[Active Cards] User ${userId} has ${relevantCards.length} relevant active cards (including partner's)`);
      res.json(relevantCards);
    } catch (err) {
      console.error('[Active Cards] Error:', err);
      res.status(500).json({ message: 'Failed to fetch active cards' });
    }
  });

  // Legacy redirect for old endpoint (without userId)
  app.get('/api/active-cards', (req, res) => {
    res.status(400).json({ 
      message: 'Missing userId parameter. Use /api/active-cards/:userId instead' 
    });
  });

  // Check for expired cards and send notifications
  app.post('/api/cards/check-expiry', async (req, res) => {
    try {
      const now = new Date();
      
      // Get all active cards
      const activeCards = await storage.getActiveCards();
      
      // Filter for cards that are about to expire (within next 5 minutes)
      const expiringCards = activeCards.filter(card => {
        const timeUntilExpiry = (card.expiresAt?.getTime() ?? 0) - now.getTime();
        const minutesUntilExpiry = timeUntilExpiry / 60000;
        return minutesUntilExpiry > 0 && minutesUntilExpiry <= 5;
      });

      // Note: Expiry warnings are now sent via email only

      res.json({ 
        checked: activeCards.length, 
        expiring: expiringCards.length 
      });
    } catch (err: any) {
      console.error('[Card] Check expiry error:', err);
      res.status(500).json({ message: 'Failed to check card expiry' });
    }
  });

  // Get a single card by ID
  app.get('/api/cards/:cardId', async (req, res) => {
    try {
      const cardId = Number(req.params.cardId);
      if (isNaN(cardId)) {
        return res.status(400).json({ message: "Invalid card ID" });
      }
      
      const cards = await storage.getCards();
      const card = cards.find(c => c.id === cardId);
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      res.json(card);
    } catch (err: any) {
      console.error('[Card] Get card error:', err);
      res.status(500).json({ message: 'Failed to get card' });
    }
  });

  // Handle expired cards - for when app requests to clean up expired cards
  app.post('/api/cards/handle-expired', async (req, res) => {
    try {
      const expiredCards = await storage.handleExpiredCards();

      // Send email notifications for expired cards to partners (non-blocking with retry)
      for (const card of expiredCards) {
        (async () => {
          try {
            const partner = await storage.getPartner(card.userId);
            
            if (partner && partner.email && partner.emailVerified) {
              let retries = 3;
              let lastError: Error | null = null;
              
              while (retries > 0) {
                try {
                  await emailNotificationService.notifyCardExpiredEmail(partner.email);
                  console.log('[Email] Card expired notification sent successfully');
                  break;
                } catch (err) {
                  lastError = err instanceof Error ? err : new Error(String(err));
                  retries--;
                  if (retries > 0) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, 3 - retries) * 1000));
                    console.log(`[Email] Retrying card expired notification (${retries} attempts remaining)...`);
                  }
                }
              }
              
              if (lastError) {
                console.error('[Email] Failed to send card expired notification after retries:', lastError);
              }
            }
          } catch (error) {
            console.error('[Notifications] Error in card expired notification task:', error);
          }
        })();
      }

      res.json({ 
        processed: expiredCards.length,
        message: `${expiredCards.length} expired cards handled`
      });
    } catch (err) {
      console.error('[Handle Expired] Error:', err);
      res.status(500).json({ message: 'Failed to handle expired cards' });
    }
  });

  // Seed database in background (don't block route registration)
  // Fire and forget with error logging
  // DISABLED temporarily - causing connection timeout
  // seedDatabase()
  //   .then(() => console.log("[ROUTES] seedDatabase completed"))
  //   .catch(err => console.error("[ROUTES] seedDatabase error:", err));

  // Test Email Endpoint (Development only)
  if (process.env.NODE_ENV === "development") {
    // Database check and fix endpoint
    app.get("/api/db-check", async (req, res) => {
      try {
        const { db } = await import("./db");
        
        console.log("[DB-CHECK] Checking database schema...");
        
        // Check if last_activity_at column exists
        const columnCheck = await db.execute(`
          SELECT column_name, data_type
          FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'last_activity_at'
        `);
        
        const columnExists = columnCheck.rows && columnCheck.rows.length > 0;
        console.log("[DB-CHECK] Column exists:", columnExists);
        
        if (!columnExists) {
          console.log("[DB-CHECK] Column last_activity_at not found! Adding it now...");
          try {
            await db.execute(
              `ALTER TABLE "users" ADD COLUMN "last_activity_at" timestamp NOT NULL DEFAULT now()`
            );
            console.log("[DB-CHECK] Column added successfully!");
          } catch (addErr: any) {
            console.error("[DB-CHECK] Error adding column:", addErr);
            throw addErr;
          }
        }
        
        // Check how many users have NULL values
        const nullCheck = await db.execute(
          `SELECT COUNT(*) as count FROM "users" WHERE "last_activity_at" IS NULL`
        );
        
        const nullCount = Number(nullCheck.rows?.[0]?.count || 0);
        console.log(`[DB-CHECK] Users with NULL last_activity_at: ${nullCount}`);
        
        if (nullCount > 0) {
          console.log("[DB-CHECK] Updating NULL records...");
          await db.execute(
            `UPDATE "users" SET "last_activity_at" = NOW() WHERE "last_activity_at" IS NULL`
          );
          console.log("[DB-CHECK] Records updated!");
        }
        
        // Get all columns in users table
        const allColumns = await db.execute(`
          SELECT column_name, data_type
          FROM information_schema.columns 
          WHERE table_name = 'users'
          ORDER BY ordinal_position
        `);
        
        res.status(200).json({
          success: true,
          columnExists,
          nullCount,
          columns: allColumns.rows || []
        });
      } catch (err) {
        console.error("[DB-CHECK] Error:", err);
        res.status(500).json({
          error: "Database check failed",
          details: err instanceof Error ? err.message : String(err)
        });
      }
    });

    // Emergency endpoint to fix user activity timestamps (development only)
    app.post("/api/fix-activity-timestamps", async (req, res) => {
      try {
        const { db } = await import("./db");
        const { users } = await import("@shared/schema");
        
        console.log("[FIX] Starting to fix activity timestamps...");
        
        // Update all users with NULL lastActivityAt to current time
        const result = await db.execute(
          'UPDATE "users" SET "last_activity_at" = NOW() WHERE "last_activity_at" IS NULL'
        );
        
        console.log("[FIX] Fixed activity timestamps");
        res.status(200).json({ 
          success: true, 
          message: "Activity timestamps updated for all users with NULL values"
        });
      } catch (err) {
        console.error("[FIX] Error:", err);
        res.status(500).json({ 
          error: "Failed to fix timestamps",
          details: err instanceof Error ? err.message : String(err)
        });
      }
    });

    app.post("/api/test-email", async (req, res) => {
      try {
        const { email, subject, message } = req.body;
        
        if (!email) {
          return res.status(400).json({ error: "Email address required" });
        }

        console.log(`[Email Test] Sending test email to ${email}...`);
        
        const result = await emailNotificationService.sendTestEmail(
          email,
          subject || "Test Email",
          message || "This is a test email from Card Game APP"
        );

        if (result) {
          return res.status(200).json({ 
            success: true, 
            message: `Test email sent to ${email}` 
          });
        } else {
          return res.status(500).json({ 
            error: "Email service not configured",
            smtp: {
              host: process.env.SMTP_HOST,
              port: process.env.SMTP_PORT,
              user: process.env.SMTP_USER ? "✓ Set" : "✗ Not set",
            }
          });
        }
      } catch (err) {
        console.error("[Email Test] Error:", err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        return res.status(500).json({ 
          error: "Failed to send test email",
          details: errorMsg
        });
      }
    });
  }

  console.log("[registerRoutes] Routes registered successfully");

  // ============= CHAT ENDPOINTS =============
  app.post(api.chat.sendMessage.path, async (req, res) => {
    try {
      console.log('[Chat] sendMessage endpoint called');
      console.log('[Chat] Request content length:', (req.body.content || '').length);
      console.log('[Chat] Content preview (first 200 chars):', (req.body.content || '').substring(0, 200));
      
      const input = api.chat.sendMessage.input.parse(req.body);
      console.log('[Chat] Parsed input successfully');
      
      // Verify sender exists and recipient exists
      const sender = await storage.getUser(input.senderId);
      const recipient = await storage.getUser(input.recipientId);
      
      if (!sender || !recipient) {
        console.log('[Chat] ❌ Sender or recipient not found');
        return res.status(404).json({ message: "Sender or recipient not found" });
      }

      console.log(`[Chat] ✅ Sender: ${sender.username} (${input.senderId}), Recipient: ${recipient.username} (${input.recipientId})`);

      // Check if the content is an image and handle R2 upload
      let finalContent = input.content;
      try {
        const parsed = JSON.parse(input.content);
        console.log('[Chat] Content parsed as JSON, type:', parsed.type);
        
        if (parsed.type === "image" && parsed.data) {
          console.log('[Chat] 🖼️  Image detected, uploading to Cloudflare R2...');
          try {
            const imageUrl = await uploadImageToR2(parsed.data, parsed.mimeType);
            // Replace base64 with R2 URL
            finalContent = JSON.stringify({
              type: "image",
              url: imageUrl,
              mimeType: parsed.mimeType,
            });
            console.log('[Chat] ✓ Image uploaded to R2:', imageUrl);
          } catch (uploadError) {
            console.error('[Chat] ❌ R2 upload failed:', uploadError);
            console.error('[Chat] Error details:', (uploadError as Error).message);
            // Fall back to storing base64 if R2 upload fails
            console.log('[Chat] Falling back to base64 storage');
          }
        } else {
          console.log('[Chat] Not an image, storing as text message');
        }
      } catch (parseErr) {
        // Not JSON, continue with original content
        console.log('[Chat] Content is not JSON, treating as text message');
      }

      // Save message to database
      const message = await storage.sendMessage(input.senderId, input.recipientId, finalContent, input.replyToId);
      console.log('[Chat] Message saved to DB:', message.id);

      // Update sender's activity timestamp
      await storage.updateUserActivity(input.senderId);
      
      // Send real-time notification via WebSocket if recipient is online
      console.log(`[Chat] Sending WebSocket notification to recipient ${input.recipientId}`);
      sendToUser(input.recipientId, WS_EVENTS.MESSAGE_RECEIVED, {
        id: message.id,
        senderId: message.senderId,
        recipientId: message.recipientId,
        content: message.content,
        replyToId: message.replyToId || null,
        isRead: message.isRead,
        createdAt: message.createdAt,
        readAt: message.readAt,
        senderUsername: sender.username,
      });

      res.status(200).json({ 
        success: true, 
        message: {
          id: message.id,
          senderId: message.senderId,
          recipientId: message.recipientId,
          content: message.content,
          replyToId: message.replyToId || null,
          isRead: message.isRead,
          createdAt: message.createdAt,
        }
      });
    } catch (err) {
      console.error('[Chat] Error in sendMessage:', err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(400).json({ message: "Failed to send message" });
    }
  });

  app.get(api.chat.getMessages.path, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      const partnerId = Number(req.params.partnerId);

      if (isNaN(userId) || isNaN(partnerId)) {
        return res.status(400).json({ message: "Invalid user IDs" });
      }

      const messages_list = await storage.getMessages(userId, partnerId);
      res.status(200).json(messages_list);
    } catch (err) {
      console.error("[Chat] Error fetching messages:", err);
      res.status(400).json({ message: "Failed to fetch messages" });
    }
  });

  app.post(api.chat.markAsRead.path, async (req, res) => {
    try {
      const input = api.chat.markAsRead.input.parse(req.body);
      
      // Get message to find out who the recipient is (the reader)
      const message = await storage.getMessageById(input.messageId);
      if (message) {
        // Update reader's activity timestamp
        await storage.updateUserActivity(message.recipientId);
      }
      
      const success = await storage.markMessageAsRead(input.messageId);
      
      // Broadcast MESSAGE_READ event to all connected clients
      if (success && message) {
        broadcast(WS_EVENTS.MESSAGE_READ, {
          messageId: input.messageId,
          readBy: message.recipientId,
          readAt: new Date().toISOString(),
        });
        console.log(`[Chat] Broadcast MESSAGE_READ for message ${input.messageId}`);
      }
      
      res.status(200).json({ success });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(400).json({ message: "Failed to mark message as read" });
    }
  });

  // Get unread message count for user
  app.get(api.chat.getUnreadCount.path, async (req, res) => {
    try {
      const userId = Number(req.params.userId);

      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const unreadCount = await storage.getUnreadMessageCount(userId);
      res.status(200).json({ unreadCount });
    } catch (err) {
      console.error("[Chat] Error fetching unread count:", err);
      res.status(400).json({ message: "Failed to fetch unread count" });
    }
  });

  app.get(api.chat.getUnreadCount.path, async (req, res) => {
    try {
      const userId = Number(req.params.userId);

      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const unreadCount = await storage.getUnreadMessageCount(userId);
      res.status(200).json({ unreadCount });
    } catch (err) {
      console.error("[Chat] Error fetching unread count:", err);
      res.status(400).json({ message: "Failed to fetch unread count" });
    }
  });

  // Add message reaction
  app.post(api.chat.addReaction.path, async (req, res) => {
    try {
      const input = api.chat.addReaction.input.parse(req.body);
      const reaction = await storage.addMessageReaction(input.messageId, input.userId, input.emoji);
      
      // Update user's activity timestamp
      await storage.updateUserActivity(input.userId);
      
      // Broadcast reaction added event
      broadcast(WS_EVENTS.REACTION_ADDED, {
        messageId: input.messageId,
        userId: input.userId,
        emoji: input.emoji,
      });
      
      res.status(200).json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("[Chat] Error adding reaction:", err);
      res.status(400).json({ message: "Failed to add reaction" });
    }
  });

  // Get message reactions
  app.get(api.chat.getReactions.path, async (req, res) => {
    try {
      const messageId = Number(req.params.messageId);

      if (isNaN(messageId)) {
        return res.status(400).json({ message: "Invalid message ID" });
      }

      const reactions = await storage.getMessageReactions(messageId);
      res.status(200).json({ reactions });
    } catch (err) {
      console.error("[Chat] Error fetching reactions:", err);
      res.status(400).json({ message: "Failed to fetch reactions" });
    }
  });

  // Remove message reaction
  app.delete(api.chat.removeReaction.path, async (req, res) => {
    try {
      const messageId = Number(req.params.messageId);
      const userId = Number(req.params.userId);

      if (isNaN(messageId) || isNaN(userId)) {
        return res.status(400).json({ message: "Invalid message ID or user ID" });
      }

      const success = await storage.removeMessageReaction(messageId, userId);
      
      if (!success) {
        return res.status(404).json({ message: "Reaction not found" });
      }

      // Broadcast reaction removed event
      broadcast(WS_EVENTS.REACTION_REMOVED, {
        messageId,
        userId,
      });

      res.status(200).json({ success: true });
    } catch (err) {
      console.error("[Chat] Error removing reaction:", err);
      res.status(400).json({ message: "Failed to remove reaction" });
    }
  });

  // Delete message
  app.delete(api.chat.deleteMessage.path, async (req, res) => {
    try {
      const messageId = Number(req.params.messageId);

      if (isNaN(messageId)) {
        return res.status(400).json({ message: "Invalid message ID" });
      }

      const message = await storage.getMessageById(messageId);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Only allow deletion by the sender
      if (message.senderId !== parseInt(req.body.userId || '0')) {
        return res.status(403).json({ message: "You can only delete your own messages" });
      }

      const success = await storage.deleteMessage(messageId);
      
      if (!success) {
        return res.status(404).json({ message: "Message not found" });
      }

      res.status(200).json({ success: true });
    } catch (err) {
      console.error("[Chat] Error deleting message:", err);
      res.status(400).json({ message: "Failed to delete message" });
    }
  });

  app.get(api.chat.getUserStatus.path, async (req, res) => {
    try {
      const userId = Number(req.params.userId);

      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const lastActivityAt = user.lastActivityAt ? new Date(user.lastActivityAt) : null;
      const now = new Date();
      let isOnline = false;
      let lastSeenText = "Online"; // Default to Online if no activity tracked yet

      if (lastActivityAt) {
        const diffMs = now.getTime() - lastActivityAt.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        // Consider online if activity within last 5 minutes
        if (diffMinutes < 5) {
          isOnline = true;
          lastSeenText = "Online";
        } else if (diffMinutes < 60) {
          lastSeenText = `${diffMinutes} min ago`;
        } else if (diffHours < 24) {
          lastSeenText = `${diffHours} h ago`;
        } else if (diffDays === 1) {
          lastSeenText = "yesterday";
        } else if (diffDays < 7) {
          lastSeenText = `${diffDays}d ago`;
        } else {
          lastSeenText = "Offline";
        }
      } else {
        // No activity tracked means user just created or never had activity tracking
        // Assume they're online
        isOnline = true;
      }

      res.status(200).json({ 
        isOnline,
        lastSeenText,
        lastActivityAt
      });
    } catch (err) {
      console.error("[Chat] Error getting user status:", err);
      res.status(400).json({ message: "Failed to get user status" });
    }
  });

  // E2EE: Debug endpoint to test messages and keys
  app.get("/api/debug/e2ee-status", async (req, res) => {
    try {
      const user16 = await storage.getUser(16);
      const user17 = await storage.getUser(17);

      const messages = await ((req as any).db || storage).query(`
        SELECT id, sender_id, recipient_id, LENGTH(content) as len, SUBSTRING(content, 1, 50) as preview
        FROM messages 
        WHERE (sender_id = 16 AND recipient_id = 17) OR (sender_id = 17 AND recipient_id = 16)
        ORDER BY id DESC
        LIMIT 5
      `);

      res.status(200).json({
        user16: {
          id: 16,
          username: user16?.username,
          hasPublicKey: !!user16?.publicKey,
          publicKeyLength: user16?.publicKey?.length || 0,
          publicKeyPreview: user16?.publicKey?.substring(0, 30) || null,
        },
        user17: {
          id: 17,
          username: user17?.username,
          hasPublicKey: !!user17?.publicKey,
          publicKeyLength: user17?.publicKey?.length || 0,
          publicKeyPreview: user17?.publicKey?.substring(0, 30) || null,
        },
        debug: "Check localStorage on client for user_keypair_16 and user_keypair_17",
      });
    } catch (err) {
      console.error("[E2EE Debug]", err);
      res.status(500).json({ error: String(err) });
    }
  });

  // ============ CARD TRADING ENDPOINTS ============
  
  // POST /api/trades/propose - Initiate a trade
  app.post(api.trades.propose.path, async (req, res) => {
    try {
      const input = api.trades.propose.input.parse(req.body);
      
      // Verify users are partners
      const initiator = await storage.getUser(input.initiatorId);
      if (!initiator || initiator.partnerId !== input.recipientId) {
        return res.status(400).json({ success: false, message: "Users are not partners or user not found" });
      }
      
      // Create trade proposal
      const trade = await storage.proposeTrade(input.initiatorId, input.recipientId, input.offeringCardIds, input.message);
      
      // Notify recipient via WebSocket
      sendToUser(input.recipientId, WS_EVENTS.TRADE_OFFER_RECEIVED, {
        tradeId: trade.id,
        initiatorId: trade.initiatorId,
        initiatorUsername: initiator.username,
        offeringCardCount: input.offeringCardIds.length,
        message: trade.message,
        createdAt: trade.createdAt,
        expiresAt: trade.expiresAt,
      });
      
      res.status(200).json({ success: true, trade });
    } catch (err: any) {
      console.error("[Trade] Propose error:", err);
      res.status(400).json({ success: false, message: err.message || "Failed to propose trade" });
    }
  });
  
  // GET /api/trades/pending/:userId - Get pending trades for user
  app.get(api.trades.pending.path, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const trades = await storage.getPendingTrades(userId);
      res.status(200).json(trades);
    } catch (err: any) {
      console.error("[Trade] Get pending error:", err);
      res.status(500).json({ message: "Failed to get pending trades" });
    }
  });
  
  // POST /api/trades/respond - Accept or reject a trade
  app.post(api.trades.respond.path, async (req, res) => {
    try {
      const input = api.trades.respond.input.parse(req.body);
      
      const trade = await storage.getTradeById(input.tradeId);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }
      
      if (trade.recipientId !== input.recipientId) {
        return res.status(403).json({ message: "Not authorized to respond to this trade" });
      }
      
      const updatedTrade = await storage.respondToTrade(input.tradeId, input.accept, input.offeringCardIds);
      
      if (input.accept) {
        // Notify initiator that trade was accepted
        sendToUser(trade.initiatorId, WS_EVENTS.TRADE_ACCEPTED, {
          tradeId: updatedTrade.id,
          recipientOfferingCardCount: (input.offeringCardIds || []).length,
          status: updatedTrade.status,
        });
        
        // Complete the trade immediately
        await storage.completeTrade(input.tradeId);
        
        // Calculate card counts from card data
        let initiatorCardCount = 0;
        try {
          if (trade.initiatorOfferingCardData) {
            const cardData = JSON.parse(trade.initiatorOfferingCardData);
            initiatorCardCount = cardData.length;
          }
        } catch (err) {
          console.error('[Trade] Error parsing initiator card data:', err);
        }
        
        const recipientCardCount = (input.offeringCardIds || []).length;
        
        // Notify both parties that trade is complete
        sendToUser(trade.initiatorId, WS_EVENTS.TRADE_COMPLETED, {
          tradeId: input.tradeId,
          initiatorCardCount: initiatorCardCount,
          recipientCardCount: recipientCardCount,
        });
        
        sendToUser(input.recipientId, WS_EVENTS.TRADE_COMPLETED, {
          tradeId: input.tradeId,
          initiatorCardCount: initiatorCardCount,
          recipientCardCount: recipientCardCount,
        });
        
        res.status(200).json({ success: true, message: "Trade completed successfully" });
      } else {
        // Notify initiator that trade was rejected
        sendToUser(trade.initiatorId, WS_EVENTS.TRADE_REJECTED, {
          tradeId: updatedTrade.id,
          status: updatedTrade.status,
        });
        
        res.status(200).json({ success: true, message: "Trade rejected" });
      }
    } catch (err: any) {
      console.error("[Trade] Respond error:", err);
      if (err.message.includes("expired")) {
        return res.status(409).json({ message: err.message });
      }
      res.status(400).json({ message: err.message || "Failed to respond to trade" });
    }
  });
  
  // POST /api/trades/cancel - Cancel a pending trade
  app.post(api.trades.cancel.path, async (req, res) => {
    try {
      const input = api.trades.cancel.input.parse(req.body);
      
      const trade = await storage.getTradeById(input.tradeId);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }
      
      // Only initiator or recipient can cancel
      if (trade.initiatorId !== input.userId && trade.recipientId !== input.userId) {
        return res.status(403).json({ message: "Not authorized to cancel this trade" });
      }
      
      const cancelledTrade = await storage.cancelTrade(input.tradeId);
      
      // Notify the other party
      const otherUserId = trade.initiatorId === input.userId ? trade.recipientId : trade.initiatorId;
      sendToUser(otherUserId, WS_EVENTS.TRADE_CANCELLED, {
        tradeId: cancelledTrade.id,
        cancelledBy: input.userId,
        status: cancelledTrade.status,
      });
      
      res.status(200).json({ success: true, message: "Trade cancelled" });
    } catch (err: any) {
      console.error("[Trade] Cancel error:", err);
      res.status(400).json({ message: err.message || "Failed to cancel trade" });
    }
  });
  
  // GET /api/trades/history/:userId - Get trade history
  app.get(api.trades.history.path, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const history = await storage.getTradeHistory(userId, 50);
      res.status(200).json(history);
    } catch (err: any) {
      console.error("[Trade] History error:", err);
      res.status(500).json({ message: "Failed to get trade history" });
    }
  });
  
  console.log("[registerRoutes] Routes registered successfully");
  
  return httpServer;
}

async function seedDatabase() {
  try {
    console.log("[SEED] Starting database seeding...");
    const cards = await storage.getCards();
    console.log("[SEED] Cards count:", cards.length);
    
    if (cards.length === 0) {
      console.log("[SEED] No cards found, will seed database...");
      const { db } = await import("./db");
      const { cards: cardsSchema, users, userCards } = await import("@shared/schema");
      
      // Seed users
      try {
        const userCount = await db.select().from(users);
        console.log("[SEED] Users count before seeding:", userCount.length);
        
        if (userCount.length === 0) {
          console.log("[SEED] Inserting 2 users...");
          await db.insert(users).values([
            { username: 'kwahsotoo', pin: '1010' },
            { username: 'visimisi', pin: '5678' }
          ]);
          
          // Verify users were inserted
          const usersAfter = await db.select().from(users);
          console.log("[SEED] Users after insert:", usersAfter.length, usersAfter.map(u => u.username));
        }
      } catch (err) {
        console.error("[SEED] User seeding error:", err);
      }

      // Seed cards
      console.log("[SEED] Seeding cards...");
      await db.insert(cardsSchema).values([
        // Common
        { name: "Kartu PAP Random", tier: "Common", durationMinutes: 5, description: "Target wajib kirim foto selfie random saat itu juga!" },
        { name: "Kartu Mode Alien", tier: "Common", durationMinutes: 15, description: "Selama 15 menit, target balas chat wajib pakai tambahan kata aneh/typo." },
        { name: "Kartu Kirim Meme", tier: "Common", durationMinutes: 5, description: "Target wajib kirim 1 meme random/stiker paling jelek." },
        { name: "Kartu VN Konser Fals", tier: "Common", durationMinutes: 5, description: "Target wajib kirim VN nyanyi lagu anak-anak." },
        
        // Rare
        { name: "Kartu Boleh Marah 20 Menit", tier: "Rare", durationMinutes: 20, description: "Pengguna ngomel bebas, target cuma boleh bilang 'Iya, kamu bener'." },
        { name: "Kartu Aku Bosnya", tier: "Rare", durationMinutes: 30, description: "Selama 30 menit, target wajib panggil dengan sebutan 'Paduka/Bos'." },
        { name: "Kartu Ketik Pakai Hidung", tier: "Rare", durationMinutes: 5, description: "Target wajib ngetik 'Aku sayang banget sama kamu' pakai hidung tanpa hapus typo." },
        { name: "Kartu Pantun Maksa", tier: "Rare", durationMinutes: 30, description: "Untuk 5 chat ke depan (selama aktif), balas pesan pakai pantun." },
        
        // Epic
        { name: "Kartu Photo Challenge Ekstrem", tier: "Epic", durationMinutes: 120, description: "Target wajib kirim 10 foto pose kocak dalam 2 jam dengan caption lucu." },
        { name: "Kartu Panggilan Romantis Paksa", tier: "Epic", durationMinutes: 60, description: "Target harus dengarkan panggilan suara 1 jam penuh, boleh obrolan biasa." },
        { name: "Kartu Curhat Wajib Dengar", tier: "Epic", durationMinutes: 90, description: "Curhat sesuka hati selama 90 menit, target harus dengarkan dan membalas serius." },
        { name: "Kartu Surprise Date Plan", tier: "Epic", durationMinutes: 1440, description: "Rancang surprise date untuk 2 minggu, target gak perlu belanja tapi harus datang." },
        
        // SSR
        { name: "Kartu Pause Ngambek", tier: "SSR", durationMinutes: 5, description: "Target wajib langsung kirim foto senyum dan batal ngambek detik itu juga." },
        { name: "Kartu Ganti Nama Kontak", tier: "SSR", durationMinutes: 1440, description: "Tentukan nama kontak memalukan di HP target selama 24 jam. Wajib SS." },
        { name: "Kartu Jin Aladdin Virtual", tier: "SSR", durationMinutes: 60, description: "Minta tolong satu hal remeh dan target tidak boleh menolak." },
      ]);
      console.log("[SEED] Cards seeded successfully");
      
      // Seed user_cards (distribute cards to users)
      try {
        const { eq } = await import("drizzle-orm");
        const allUsers = await db.select().from(users);
        const commonCards = await db.select().from(cardsSchema).where(eq(cardsSchema.tier, "Common"));
        const rareCards = await db.select().from(cardsSchema).where(eq(cardsSchema.tier, "Rare"));
        
        console.log("[SEED] Distributing cards to users...");
        const userCardsToInsert: (typeof userCards.$inferInsert)[] = [];
        
        allUsers.forEach((user, userIndex) => {
          // Add 5 common cards (rotated)
          for (let i = 0; i < 5; i++) {
            const cardIndex = (userIndex * 5 + i) % commonCards.length;
            userCardsToInsert.push({
              userId: user.id,
              cardId: commonCards[cardIndex].id,
              status: "inventory"
            });
          }
          
          // Add 3 rare cards (rotated)
          for (let i = 0; i < 3; i++) {
            const cardIndex = (userIndex * 3 + i) % rareCards.length;
            userCardsToInsert.push({
              userId: user.id,
              cardId: rareCards[cardIndex].id,
              status: "inventory"
            });
          }
        });
        
        if (userCardsToInsert.length > 0) {
          await db.insert(userCards).values(userCardsToInsert);
          console.log("[SEED] ✅ User cards distributed:", userCardsToInsert.length, "cards");
        }
      } catch (err) {
        console.error("[SEED] User cards seeding error:", err);
      }
    } else {
      console.log("[SEED] Cards already exist, skipping seeding");
    }
  } catch (err) {
    console.error("[SEED] Error:", err);
  }
}
