import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, WS_EVENTS } from "@shared/routes";
import { pushNotificationService } from "./push-notifications";
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
      const allUsers = await storage.getAllUsers();
      res.status(200).json(allUsers);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch users" });
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
      res.set('Content-Length', avatarBuffer.length);
      res.set('Cache-Control', 'public, max-age=2592000'); // Cache for 30 days
      res.send(avatarBuffer);
    } catch (err) {
      console.error("[Avatar] Serve error:", err);
      res.status(500).json({ message: "Failed to serve avatar" });
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
      
      // Send gacha pull notification to user
      const userPayload = {
        title: '🎉 Kartu Baru!',
        body: `Selamat! Anda mendapat kartu "${pulledCard.name}" tier ${pulledCard.tier}`,
        tag: 'gacha_pull',
        icon: '/pwa-icon-192.svg',
        badge: '/pwa-icon-192.svg',
        data: {
          type: 'gacha_pull',
          cardId: pulledCard.id,
          cardName: pulledCard.name,
          cardTier: pulledCard.tier,
          url: '/inventory',
        },
      };
      
      await pushNotificationService.notifyUser(input.userId, userPayload).catch(err => {
        console.error('[Push] Failed to send gacha notification:', err);
      });
      
      // Notify partner about new card
      try {
        const allUsers = await storage.getAllUsers();
        const partnerIds = allUsers
          .filter(u => u.id !== input.userId)
          .map(u => u.id);
        
        if (partnerIds.length > 0) {
          await pushNotificationService.notifyNewCard(partnerIds[0], pulledCard.tier).catch(err => {
            console.error('[Push] Failed to send new card notification to partner:', err);
          });
        }
      } catch (error) {
        console.error('[Push] Error notifying partner:', error);
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

      // Send notification to other users about card being used
      try {
        const allUsers = await storage.getAllUsers();
        const otherUserIds = allUsers
          .filter(u => u.id !== usedCard.userId)
          .map(u => u.id);
        
        console.log(`[Push] Notifying other users about card used. Total users: ${allUsers.length}, Notifying: ${otherUserIds.length}`);
        
        if (otherUserIds.length > 0) {
          await pushNotificationService.notifyCardUsed(
            usedCard.userId,
            usedCard.user.username,
            usedCard.card.name,
            usedCard.card.tier,
            60, // default 60 minutes
            otherUserIds
          ).catch(err => {
            console.error('[Push] Failed to send card used notification:', err);
          });
        }
      } catch (error) {
        console.error('[Push] Error sending card used notifications:', error);
      }

      res.status(200).json(usedCard);
    } catch (err) {
      res.status(400).json({ message: "Failed to use card" });
    }
  });

  app.get(api.activeCards.list.path, async (req, res) => {
    try {
      const items = await storage.getActiveCards();
      res.json(items);
    } catch (err) {
      console.error('[Active Cards] Error:', err);
      res.status(500).json({ message: 'Failed to fetch active cards' });
    }
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

      // Send expiry warning notifications
      for (const card of expiringCards) {
        if (card.expiresAt) {
          await pushNotificationService.notifyCardExpiring(
            card.userId,
            card.card.name,
            card.expiresAt
          ).catch(err => {
            console.error('[Push] Failed to send expiry warning:', err);
          });
        }
      }

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

      // Send expiry notifications for each expired card to partner
      for (const card of expiredCards) {
        // Notify all other users that partner's card has expired
        try {
          const allUsers = await storage.getAllUsers();
          const otherUserIds = allUsers
            .filter(u => u.id !== card.userId)
            .map(u => u.id);
          
          if (otherUserIds.length > 0) {
            for (const partnerUserId of otherUserIds) {
              await pushNotificationService.notifyCardExpiredNotif(partnerUserId).catch(err => {
                console.error('[Push] Failed to send card expired notification:', err);
              });
            }
          }
        } catch (error) {
          console.error('[Push] Error sending card expired notifications:', error);
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

  // Push Notifications Routes
  app.get('/api/notifications/vapid-key', (req, res) => {
    const { pushNotificationService } = require('./push-notifications');
    res.json({ vapidPublicKey: pushNotificationService.getVapidPublicKey() });
  });

  app.post(api.notifications.subscribe.path, async (req, res) => {
    try {
      const { userId, subscription } = req.body;
      
      if (!userId || !subscription) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Get platform from user agent
      const userAgent = req.headers['user-agent'] || '';
      let platform = 'web';
      if (userAgent.includes('Android')) platform = 'android';
      else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) platform = 'ios';

      await storage.subscribeToPushNotifications(userId, subscription, platform);
      
      res.json({ success: true, message: 'Subscribed to push notifications' });
    } catch (err: any) {
      console.error('[Push] Subscribe error:', err);
      res.status(500).json({ message: err.message || 'Failed to subscribe' });
    }
  });

  app.post(api.notifications.unsubscribe.path, async (req, res) => {
    try {
      const { userId, endpoint } = req.body;
      
      if (!userId || !endpoint) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const success = await storage.unsubscribeFromPushNotifications(userId, endpoint);
      
      res.json({ success });
    } catch (err: any) {
      console.error('[Push] Unsubscribe error:', err);
      res.status(500).json({ message: err.message || 'Failed to unsubscribe' });
    }
  });

  app.get(api.notifications.preferences.path, async (req, res) => {
    try {
      const userId = Number(req.params.userId);
      
      const prefs = await storage.getNotificationPreferences(userId);
      
      if (!prefs) {
        return res.json({
          cardUsed: true,
          cardExpired: true,
          cardDropped: true,
          promotions: false,
        });
      }

      res.json({
        cardUsed: prefs.cardUsed,
        cardExpired: prefs.cardExpired,
        cardDropped: prefs.cardDropped,
        promotions: prefs.promotions,
      });
    } catch (err: any) {
      console.error('[Push] Get preferences error:', err);
      res.status(500).json({ message: err.message || 'Failed to get preferences' });
    }
  });

  app.patch(api.notifications.updatePreferences.path, async (req, res) => {
    try {
      const { userId, ...preferences } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: 'Missing userId' });
      }

      await storage.updateNotificationPreferences(userId, preferences);
      
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Push] Update preferences error:', err);
      res.status(500).json({ message: err.message || 'Failed to update preferences' });
    }
  });

  // Seed Data Trigger
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const cards = await storage.getCards();
  if (cards.length === 0) {
    const { db } = await import("./db");
    const { cards: cardsSchema, users } = await import("@shared/schema");
    
    // Seed users
    const userCount = await db.select().from(users);
    if (userCount.length === 0) {
      await db.insert(users).values([
        { username: 'Priatna', pin: '1010' }, 
        { username: 'Cia', pin: '0412' }
      ]);
    }

    // Seed cards
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
  }
}
