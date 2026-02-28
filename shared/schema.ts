import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
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

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  endpoint: text("endpoint").notNull().unique(),
  auth: text("auth").notNull(), // base64 encoded auth key
  p256dh: text("p256dh").notNull(), // base64 encoded p256dh key
  userAgent: text("user_agent"),
  platform: text("platform").default("web"), // 'web', 'android', 'ios'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
});

export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).unique().notNull(),
  cardUsed: boolean("card_used").default(true),
  cardExpired: boolean("card_expired").default(true),
  cardDropped: boolean("card_dropped").default(true),
  promotions: boolean("promotions").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;

export type UserCardWithDetails = UserCard & { card: Card; user: User };

export const insertUserSchema = createInsertSchema(users);
export const insertCardSchema = createInsertSchema(cards);
export const insertUserCardSchema = createInsertSchema(userCards);
export const insertGachaLogSchema = createInsertSchema(gachaLogs);
export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions);
export const insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences);
