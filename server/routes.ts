import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api, WS_EVENTS } from "@shared/routes";
import { z } from "zod";
import { WebSocketServer, WebSocket } from "ws";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, "../public/avatars");

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

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

      // Generate a unique filename
      const ext = path.extname(filename);
      const timestamp = Date.now();
      const uniqueFilename = `avatar_${userId}_${timestamp}${ext}`;
      const filePath = path.join(uploadDir, uniqueFilename);

      // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
      const base64Data = data.replace(/^data:image\/[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      // Save file
      try {
        fs.writeFileSync(filePath, buffer);
      } catch (writeErr: any) {
        console.error("File write error:", writeErr);
        return res.status(400).json({ message: "Failed to save file: " + writeErr.message });
      }

      // Return the avatar URL
      const avatarUrl = `/avatars/${uniqueFilename}`;
      res.status(200).json({ avatarUrl });
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      res.status(500).json({ message: "Server error: " + (err.message || "Unknown error") });
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

      res.status(200).json({ success: true, card: userCard, remainingPulls: 2 - (count + 1) });
    } catch (err) {
      res.status(400).json({ message: "Invalid request" });
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
      
      // Broadcast via WS
      broadcast(WS_EVENTS.CARD_USED, {
        cardName: usedCard.card.name,
        userName: usedCard.user.username
      });

      res.status(200).json(usedCard);
    } catch (err) {
      res.status(400).json({ message: "Failed to use card" });
    }
  });

  app.get(api.activeCards.list.path, async (req, res) => {
    const items = await storage.getActiveCards();
    res.status(200).json(items);
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
