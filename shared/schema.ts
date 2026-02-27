import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  pin: text("pin").notNull().default("0000"),
  avatarUrl: text("avatar_url"),
  gender: text("gender").default("other"), // 'male', 'female', 'other'
});

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tier: text("tier").notNull(), 
  durationMinutes: integer("duration_minutes").notNull(),
  description: text("description").notNull(),
});

export const userCards = pgTable("user_cards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  cardId: integer("card_id").references(() => cards.id).notNull(),
  status: text("status").notNull().default("inventory"), // 'inventory', 'active', 'used'
  activatedAt: timestamp("activated_at"),
  expiresAt: timestamp("expires_at"),
});

export const gachaLogs = pgTable("gacha_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  pulledAt: timestamp("pulled_at").defaultNow().notNull(),
});

export const userCardsRelations = relations(userCards, ({ one }) => ({
  user: one(users, {
    fields: [userCards.userId],
    references: [users.id],
  }),
  card: one(cards, {
    fields: [userCards.cardId],
    references: [cards.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type UserCard = typeof userCards.$inferSelect;
export type GachaLog = typeof gachaLogs.$inferSelect;

export type UserCardWithDetails = UserCard & { card: Card; user: User };

export const insertUserSchema = createInsertSchema(users);
export const insertCardSchema = createInsertSchema(cards);
export const insertUserCardSchema = createInsertSchema(userCards);
export const insertGachaLogSchema = createInsertSchema(gachaLogs);
