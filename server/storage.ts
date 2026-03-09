import { db } from "./db";
import { users, cards, userCards, gachaLogs, pushSubscriptions, notificationPreferences } from "@shared/schema";
import type { User, InsertUser, Card, UserCard, UserCardWithDetails, PushSubscription, NotificationPreference } from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";

function getCurrentPeriodStart(): Date {
  const now = new Date();
  const wibTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const wibHour = wibTime.getUTCHours();
  
  const periodStartWib = new Date(wibTime);
  periodStartWib.setUTCMinutes(0, 0, 0);
  if (wibHour < 6) {
    periodStartWib.setUTCDate(periodStartWib.getUTCDate() - 1);
    periodStartWib.setUTCHours(18);
  } else if (wibHour < 18) {
    periodStartWib.setUTCHours(6);
  } else {
    periodStartWib.setUTCHours(18);
  }
  return new Date(periodStartWib.getTime() - 7 * 60 * 60 * 1000);
}

export interface IStorage {
  getUserByUsername(username: string): Promise<User | undefined>;
  getUser(id: number): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getCards(): Promise<Card[]>;
  getCard(id: number): Promise<Card | undefined>;
  getInventory(userId: number): Promise<UserCardWithDetails[]>;
  getActiveCards(): Promise<UserCardWithDetails[]>;
  useCard(userCardId: number): Promise<UserCardWithDetails>;
  getTodayGachaCount(userId: number): Promise<number>;
  addGachaLog(userId: number): Promise<void>;
  addCardToInventory(userId: number, cardId: number): Promise<UserCardWithDetails>;
  // Push notification methods
  subscribeToPushNotifications(userId: number, subscription: any, platform: string): Promise<PushSubscription>;
  unsubscribeFromPushNotifications(userId: number, endpoint: string): Promise<boolean>;
  getUserPushSubscriptions(userId: number): Promise<PushSubscription[]>;
  getAllPushSubscriptions(): Promise<PushSubscription[]>;
  getNotificationPreferences(userId: number): Promise<NotificationPreference | undefined>;
  updateNotificationPreferences(userId: number, preferences: Partial<NotificationPreference>): Promise<NotificationPreference>;
  // Email methods
  setEmailVerificationToken(userId: number, email: string): Promise<{ token: string; expiresAt: Date }>;
  verifyEmail(token: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getCards(): Promise<Card[]> {
    return await db.select().from(cards);
  }

  async getCard(id: number): Promise<Card | undefined> {
    const [card] = await db.select().from(cards).where(eq(cards.id, id));
    return card;
  }

  async getInventory(userId: number): Promise<UserCardWithDetails[]> {
    const items = await db.query.userCards.findMany({
      where: and(eq(userCards.userId, userId), eq(userCards.status, 'inventory')),
      with: { card: true, user: true },
    });
    return items;
  }

  async getActiveCards(): Promise<UserCardWithDetails[]> {
    const now = new Date();
    const items = await db.query.userCards.findMany({
      where: and(
        eq(userCards.status, 'active'),
        gte(userCards.expiresAt, now)
      ),
      with: { card: true, user: true },
    });
    return items;
  }

  async useCard(userCardId: number): Promise<UserCardWithDetails> {
    const uc = await db.query.userCards.findFirst({
      where: eq(userCards.id, userCardId),
      with: { card: true },
    });
    if (!uc) throw new Error("Card not found");

    const activatedAt = new Date();
    const expiresAt = new Date(activatedAt.getTime() + uc.card.durationMinutes * 60000);

    const [updated] = await db.update(userCards)
      .set({ status: 'active', activatedAt, expiresAt })
      .where(eq(userCards.id, userCardId))
      .returning();

    return db.query.userCards.findFirst({
      where: eq(userCards.id, updated.id),
      with: { card: true, user: true },
    }) as Promise<UserCardWithDetails>;
  }

  async getTodayGachaCount(userId: number): Promise<number> {
    const start = getCurrentPeriodStart();
    const logs = await db.select().from(gachaLogs).where(
      and(eq(gachaLogs.userId, userId), gte(gachaLogs.pulledAt, start))
    );
    return logs.length;
  }

  async addGachaLog(userId: number): Promise<void> {
    await db.insert(gachaLogs).values({ userId });
  }

  async addCardToInventory(userId: number, cardId: number): Promise<UserCardWithDetails> {
    const [inserted] = await db.insert(userCards).values({ userId, cardId, status: 'inventory' }).returning();
    return db.query.userCards.findFirst({
      where: eq(userCards.id, inserted.id),
      with: { card: true, user: true },
    }) as Promise<UserCardWithDetails>;
  }

  // Push notification methods
  async subscribeToPushNotifications(userId: number, subscription: any, platform: string = 'web'): Promise<PushSubscription> {
    const { endpoint, keys } = subscription;
    
    // Check if subscription already exists
    const existing = await db.select().from(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
    
    if (existing.length > 0) {
      // Update existing subscription
      const [updated] = await db.update(pushSubscriptions)
        .set({ 
          auth: keys.auth, 
          p256dh: keys.p256dh,
          isActive: true,
          lastUsedAt: new Date()
        })
        .where(eq(pushSubscriptions.endpoint, endpoint))
        .returning();
      return updated;
    }
    
    // Create new subscription
    const [created] = await db.insert(pushSubscriptions).values({
      userId,
      endpoint,
      auth: keys.auth,
      p256dh: keys.p256dh,
      platform,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    }).returning();
    
    // Create default notification preferences if not exists
    const hasPrefs = await db.select().from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    
    if (hasPrefs.length === 0) {
      await db.insert(notificationPreferences).values({ userId });
    }
    
    return created;
  }

  async unsubscribeFromPushNotifications(userId: number, endpoint: string): Promise<boolean> {
    const result = await db.update(pushSubscriptions)
      .set({ isActive: false })
      .where(and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.endpoint, endpoint)
      ));
    
    return result.rowCount ?? 0 > 0;
  }

  async getUserPushSubscriptions(userId: number): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, userId),
        eq(pushSubscriptions.isActive, true)
      ));
  }

  async getAllPushSubscriptions(): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions)
      .where(eq(pushSubscriptions.isActive, true));
  }

  async getNotificationPreferences(userId: number): Promise<NotificationPreference | undefined> {
    const [prefs] = await db.select().from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return prefs;
  }

  async updateNotificationPreferences(userId: number, preferences: Partial<NotificationPreference>): Promise<NotificationPreference> {
    const existing = await this.getNotificationPreferences(userId);
    
    if (!existing) {
      // Create new preferences
      const [created] = await db.insert(notificationPreferences)
        .values({ userId, ...preferences })
        .returning();
      return created;
    }
    
    // Update existing
    const [updated] = await db.update(notificationPreferences)
      .set({ ...preferences, updatedAt: new Date() })
      .where(eq(notificationPreferences.userId, userId))
      .returning();
    
    return updated;
  }

  async getExpiredCards(): Promise<UserCardWithDetails[]> {
    const now = new Date();
    const items = await db.query.userCards.findMany({
      where: and(
        eq(userCards.status, 'active'),
        gte(now, userCards.expiresAt)
      ),
      with: { card: true, user: true },
    });
    return items;
  }

  async markCardAsExpired(userCardId: number): Promise<UserCardWithDetails> {
    const uc = await db.query.userCards.findFirst({
      where: eq(userCards.id, userCardId),
      with: { card: true, user: true },
    });
    if (!uc) throw new Error("Card not found");

    const [updated] = await db.update(userCards)
      .set({ status: 'used' })
      .where(eq(userCards.id, userCardId))
      .returning();

    return { ...updated, card: uc.card, user: uc.user };
  }

  async handleExpiredCards(): Promise<UserCardWithDetails[]> {
    const expiredCards = await this.getExpiredCards();
    
    // Mark all expired cards as used
    for (const card of expiredCards) {
      await this.markCardAsExpired(card.id);
    }
    
    return expiredCards;
  }

  async setEmailVerificationToken(userId: number, email: string): Promise<{ token: string; expiresAt: Date }> {
    // Generate 6-digit verification code for user entry
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    await db.update(users)
      .set({
        email,
        emailVerificationToken: verificationCode,
        emailVerificationExpiresAt: expiresAt,
        emailVerified: false,
      })
      .where(eq(users.id, userId));

    return { token: verificationCode, expiresAt };
  }

  async verifyEmail(token: string): Promise<User | null> {
    const now = new Date();
    
    const user = await db.query.users.findFirst({
      where: eq(users.emailVerificationToken, token),
    });

    if (!user) {
      console.log('[Storage] Email verification token not found');
      return null;
    }

    if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < now) {
      console.log('[Storage] Email verification token expired');
      return null;
    }

    await db.update(users)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      })
      .where(eq(users.id, user.id));

    console.log(`[Storage] Email verified for user ${user.id}`);
    
    // Return updated user
    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    
    return updatedUser || null;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
}

export const storage = new DatabaseStorage();