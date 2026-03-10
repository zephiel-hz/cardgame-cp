import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, WS_EVENTS } from "@shared/routes";
import { emailNotificationService } from "./email-notifications";
import { z } from "zod";
import { WebSocketServer, WebSocket } from "ws";
import fs from "fs";
import path from "path";

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
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Broadcast helper
  const broadcast = (type: string, payload: any) => {
    const message = JSON.stringify({ type, payload });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

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

  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      let user = await storage.getUserByUsername(input.username);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.pin !== input.pin) {
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

  app.patch(api.auth.updateProfile.path, async (req, res) => {
    try {
      const { userId, ...updates } = api.auth.updateProfile.input.parse(req.body);
      const user = await storage.updateUser(userId, updates);
      res.status(200).json(user);
    } catch (err) {
      res.status(400).json({ message: "Failed to update profile" });
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
      
      if (!userId || !filename || !data) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
      const base64Data = data.replace(/^data:image\/[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      // Limit avatar size to 500KB
      const MAX_AVATAR_SIZE = 500 * 1024;
      if (buffer.length > MAX_AVATAR_SIZE) {
        return res.status(400).json({ 
          message: `Avatar terlalu besar. Maksimal ${MAX_AVATAR_SIZE / 1024}KB` 
        });
      }

      console.log(`[Avatar] Storing avatar for user ${userId}, size: ${buffer.length} bytes`);

      // Store avatar data in database as base64 string (persisted forever in Neon PostgreSQL)
      try {
        await storage.updateUser(Number(userId), { 
          avatarUrl: `/api/avatars/${userId}`,
          avatarData: base64Data // Store as base64 string for easier portability
        });
      } catch (dbErr: any) {
        console.error("[Avatar] Database update error:", dbErr);
        return res.status(500).json({ message: "Gagal menyimpan avatar: " + dbErr.message });
      }

      // Return the avatar URL
      const avatarUrl = `/api/avatars/${userId}`;
      res.status(200).json({ avatarUrl });
    } catch (err: any) {
      console.error("[Avatar] Upload error:", err);
      res.status(500).json({ message: "Server error: " + (err.message || "Unknown error") });
    }
  });

  // Serve avatar data from database
  app.get('/api/avatars/:userId', async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const user = await storage.getUser(userId);
      
      if (!user || !user.avatarData) {
        // Return placeholder if no avatar
        return res.status(404).json({ message: "Avatar not found" });
      }

      // Convert base64 string back to buffer
      const avatarBuffer = Buffer.from(user.avatarData, 'base64');

      res.set('Content-Type', 'image/jpeg');
      res.set('Content-Length', String(avatarBuffer.length));
      res.set('Cache-Control', 'public, max-age=2592000'); // Cache for 30 days
      res.send(avatarBuffer);
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
      
      // Check if it's a temporary email token (pre-registration)
      const tempEmailData = storage.getTempEmailToken(token);
      if (tempEmailData) {
        // Store the verified email in a session or return it for the register form
        console.log('[Email] Temp email token verified for:', tempEmailData.email);
        // Mark as pre-verified so register endpoint knows it's verified
        storage.markEmailAsPreVerified(tempEmailData.email);
        storage.clearTempEmailToken(token);
        return res.status(200).json({ 
          success: true, 
          message: "Email berhasil diverifikasi",
          email: tempEmailData.email,
          isPreRegistration: true
        });
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
      const { email } = api.auth.sendRegistrationEmail.input.parse(req.body);
      console.log('[Email] Email parsed:', email);
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        console.log('[Email] Email already registered:', email);
        return res.status(409).json({ message: "Email sudah terdaftar" });
      }

      // Generate verification token
      console.log('[Email] Generating temp token for:', email);
      const { token } = await storage.setTempEmailVerificationToken(email);
      console.log('[Email] Token generated:', token.substring(0, 10) + '...');
      
      // Send verification email
      console.log('[Email] Sending verification email to:', email);
      const sent = await emailNotificationService.sendVerificationEmail(0, email, token);
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

  app.get(api.gacha.status.path, async (req, res) => {
    const userId = Number(req.params.userId);
    const count = await storage.getTodayGachaCount(userId);
    const remainingPulls = Math.max(0, 2 - count);
    res.status(200).json({ remainingPulls });
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
      if (r < 10) targetTier = 'SSR';
      else if (r < 40) targetTier = 'Rare'; // 10% to 40% = 30%
      // else 60% Common

      let tierCards = allCards.filter(c => c.tier === targetTier);
      if (tierCards.length === 0) tierCards = allCards; // fallback
      
      const pulledCard = tierCards[Math.floor(Math.random() * tierCards.length)];

      await storage.addGachaLog(input.userId);
      const userCard = await storage.addCardToInventory(input.userId, pulledCard.id);
      
      // Notify partner about new card via email
      try {
        const partner = await storage.getPartner(input.userId);
        
        if (partner && partner.email && partner.emailVerified) {
          const user = await storage.getUser(input.userId);
          await emailNotificationService.notifyNewCardEmail(
            partner.email,
            user?.username || 'Partner',
            pulledCard.tier
          ).catch(err => {
            console.error('[Email] Failed to send new card notification:', err);
          });
        }
      } catch (error) {
        console.error('[Notifications] Error notifying partner:', error);
      }

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

      // Send email notification to partner about card being used
      try {
        const partner = await storage.getPartner(usedCard.userId);
        
        if (partner && partner.email && partner.emailVerified) {
          await emailNotificationService.notifyCardUsedEmail(
            partner.email,
            usedCard.user.username,
            usedCard.card.name,
            usedCard.card.description,
            usedCard.card.tier,
            usedCard.card.durationMinutes
          ).catch(err => {
            console.error('[Email] Failed to send card used notification to partner:', err);
          });
        }
      } catch (error) {
        console.error('[Notifications] Error sending card used email notifications:', error);
      }

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
    } catch (err) {
      console.error('[Check Expiry] Error:', err);
      res.status(500).json({ message: 'Failed to check expiry' });
    }
  });

  // Handle expired cards - for when app requests to clean up expired cards
  app.post('/api/cards/handle-expired', async (req, res) => {
    try {
      const expiredCards = await storage.handleExpiredCards();

      // Send email notifications for expired cards to partners
      for (const card of expiredCards) {
        try {
          const partner = await storage.getPartner(card.userId);
          
          if (partner && partner.email && partner.emailVerified) {
            await emailNotificationService.notifyCardExpiredEmail(partner.email).catch(err => {
              console.error('[Email] Failed to send card expired notification to partner:', err);
            });
          }
        } catch (error) {
          console.error('[Notifications] Error sending card expired email notifications:', error);
        }
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

  // Seed Data Trigger
  try {
    console.log("[ROUTES] About to call seedDatabase...");
    await seedDatabase();
    console.log("[ROUTES] seedDatabase completed");
  } catch (err) {
    console.error("[ROUTES] seedDatabase error:", err);
  }

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
            { username: 'kwahsotoo', pin: '1234' },
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
