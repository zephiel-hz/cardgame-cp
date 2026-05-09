import { db } from "./server/db.ts";
import { cards, userCards } from "./shared/schema.ts";
import { config } from "dotenv";

config({ path: ".env.local" });

async function resetCards() {
  try {
    console.log("[RESET] Starting cards reset...");
    
    // First delete all user_cards (they reference cards)
    console.log("[RESET] Deleting user cards...");
    await db.delete(userCards);
    console.log("[RESET] ✅ Deleted all user cards");
    
    // Delete all existing cards
    console.log("[RESET] Deleting card definitions...");
    await db.delete(cards);
    console.log("[RESET] ✅ Deleted all old cards");
    
    // Re-insert fresh card data
    console.log("[RESET] Seeding new cards...");
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
    
    console.log("[RESET] ✅ Seeded 15 new cards successfully");
    console.log("[RESET] All cards reset complete!");
    
    process.exit(0);
  } catch (err) {
    console.error("[RESET] Error:", err);
    process.exit(1);
  }
}

resetCards();
