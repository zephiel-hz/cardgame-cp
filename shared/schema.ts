import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  pin: text("pin").notNull().default("0000"),
  avatarUrl: text("avatar_url"),
  avatarData: text("avatar_data"), // Store avatar as base64 string in database (persisted forever)
  gender: text("gender").default("other"), // 'male', 'female', 'other'
  email: text("email").unique(),
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpiresAt: timestamp("email_verification_expires_at"),
  partnerId: integer("partner_id").references(() => users.id), // Partner relationship (nullable)
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  publicKey: text("public_key"), // E2EE public key (base64)
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  viewedAsNew: boolean("viewed_as_new").default(true), // Restored from DB to prevent deletion
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

export const partnershipRequests = pgTable("partnership_requests", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").references(() => users.id).notNull(),
  toUserId: integer("to_user_id").references(() => users.id).notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'accepted', 'declined'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
});

export const partnershipRemovalRequests = pgTable("partnership_removal_requests", {
  id: serial("id").primaryKey(),
  initiatorId: integer("initiator_id").references(() => users.id).notNull(), // User yang memulai penghapusan
  partnerId: integer("partner_id").references(() => users.id).notNull(), // Partner mereka
  initiatorAccepted: boolean("initiator_accepted").default(true).notNull(), // Initiator sudah setuju
  partnerAccepted: boolean("partner_accepted").default(false), // Partner menerima/tolak
  reason: text("reason").notNull(), // Alasan menghapus partnership (wajib diisi)
  rejectionReason: text("rejection_reason"), // Alasan penolakan dari partner (jika ditolak)
  status: text("status").notNull().default("pending"), // 'pending', 'completed', 'rejected', 'force_deleted'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  recipientId: integer("recipient_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  replyToId: integer("reply_to_id").references(() => messages.id),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
});

export const messageReactions = pgTable("message_reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => messages.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cardTrades = pgTable("card_trades", {
  id: serial("id").primaryKey(),
  initiatorId: integer("initiator_id").references(() => users.id).notNull(),
  recipientId: integer("recipient_id").references(() => users.id).notNull(),
  initiatorOfferingCardIds: text("initiator_offering_card_ids").notNull(), // JSON stringified array of card IDs
  initiatorOfferingCardData: text("initiator_offering_card_data"), // JSON stringified array of card objects with userCardId and cardId
  recipientOfferingCardIds: text("recipient_offering_card_ids"), // JSON stringified array of card IDs or null until response
  recipientOfferingCardData: text("recipient_offering_card_data"), // JSON stringified array of card objects with userCardId and cardId
  message: text("message"),
  status: text("status").notNull().default("pending"), // 'pending', 'accepted', 'rejected', 'cancelled', 'completed', 'expired'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at").notNull(),
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
export type PartnershipRequest = typeof partnershipRequests.$inferSelect;
export type PartnershipRemovalRequest = typeof partnershipRemovalRequests.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type MessageReaction = typeof messageReactions.$inferSelect;
export type CardTrade = typeof cardTrades.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type UserCardWithDetails = UserCard & { card: Card; user: User };

export const insertUserSchema = createInsertSchema(users);
export const insertCardSchema = createInsertSchema(cards);
export const insertUserCardSchema = createInsertSchema(userCards);
export const insertGachaLogSchema = createInsertSchema(gachaLogs);
export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions);
export const insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences);
export const insertPartnershipRequestSchema = createInsertSchema(partnershipRequests);
export const insertPartnershipRemovalRequestSchema = createInsertSchema(partnershipRemovalRequests);
export const insertMessageSchema = createInsertSchema(messages);
export const insertMessageReactionSchema = createInsertSchema(messageReactions);
export const insertCardTradeSchema = createInsertSchema(cardTrades);
