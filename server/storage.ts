import crypto from 'crypto';
import { db } from "./db";
import { users, cards, userCards, gachaLogs, pushSubscriptions, notificationPreferences, partnershipRequests } from "@shared/schema";
import type { User, InsertUser, Card, UserCard, UserCardWithDetails, PushSubscription, NotificationPreference, PartnershipRequest } from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";

// Temporary in-memory storage for email verification tokens (pre-registration)
const tempEmailTokens = new Map<string, { email: string; token: string; expiresAt: Date }>();

// Track pre-verified emails in registration flow
const preVerifiedEmails = new Map<string, { expiresAt: Date }>();

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
  // Partner methods
  pairPartner(userId: number, partnerId: number): Promise<User>;
  getPartner(userId: number): Promise<User | undefined>;
  sendPartnershipRequest(fromUserId: number, toUserId: number): Promise<PartnershipRequest>;
  getPendingPartnershipRequests(userId: number): Promise<PartnershipRequest[]>;
  respondToPartnershipRequest(requestId: number, accept: boolean): Promise<User | null>;
  getUserCardCount(userId: number): Promise<number>;
  getPublicUserInfo(userId: number): Promise<{ id: number; username: string; avatarUrl: string | null; gender: string | null; cardCount: number } | null>;
  // Push notification methods
  subscribeToPushNotifications(userId: number, subscription: any, platform: string): Promise<PushSubscription>;
  unsubscribeFromPushNotifications(userId: number, endpoint: string): Promise<boolean>;
  getUserPushSubscriptions(userId: number): Promise<PushSubscription[]>;
  getAllPushSubscriptions(): Promise<PushSubscription[]>;
  getNotificationPreferences(userId: number): Promise<NotificationPreference | undefined>;
  updateNotificationPreferences(userId: number, preferences: Partial<NotificationPreference>): Promise<NotificationPreference>;
  // Email methods
  setEmailVerificationToken(userId: number, email: string): Promise<{ token: string; expiresAt: Date }>;
  setTempEmailVerificationToken(email: string): Promise<{ token: string; expiresAt: Date }>;
  getTempEmailToken(token: string): { email: string; token: string; expiresAt: Date } | null;
  clearTempEmailToken(token: string): void;
  markEmailAsPreVerified(email: string): void;
  isEmailPreVerified(email: string): boolean;
  clearPreVerifiedEmail(email: string): void;
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
      where: eq(userCards.status, 'active'),
      with: { card: true, user: true },
    });
    
    console.log(`[getActiveCards] Found ${items.length} cards with status='active'`);
    
    // Filter in application code to avoid timezone issues with database comparison
    const filtered = items.filter(item => {
      if (!item.expiresAt) {
        console.log(`[getActiveCards] Skipping card ${item.id} - no expiresAt`);
        return false;
      }
      const expiresTime = new Date(item.expiresAt).getTime();
      const nowTime = now.getTime();
      const isStillActive = expiresTime > nowTime;
      console.log(`[getActiveCards] Card ${item.id} (${item.card.name}): expiresAt=${new Date(item.expiresAt).toISOString()}, now=${now.toISOString()}, diff=${expiresTime - nowTime}ms, active=${isStillActive}`);
      return isStillActive;
    });
    
    console.log(`[getActiveCards] Returning ${filtered.length} active cards`);
    return filtered;
  }

  async useCard(userCardId: number): Promise<UserCardWithDetails> {
    const uc = await db.query.userCards.findFirst({
      where: eq(userCards.id, userCardId),
      with: { card: true, user: true },
    });
    if (!uc) throw new Error("Card not found");

    const activatedAt = new Date();
    const expiresAt = new Date(activatedAt.getTime() + uc.card.durationMinutes * 60000);

    console.log(`[useCard] Setting card ${userCardId} (${uc.card.name}):`, {
      activatedAt: activatedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      durationMinutes: uc.card.durationMinutes,
      timestampDiff: expiresAt.getTime() - activatedAt.getTime()
    });

    await db.update(userCards)
      .set({ status: 'active', activatedAt, expiresAt })
      .where(eq(userCards.id, userCardId));

    // Return the card with the newly calculated timestamps
    return {
      ...uc,
      status: 'active',
      activatedAt,
      expiresAt,
    };
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

  // Partner methods
  async pairPartner(userId: number, partnerId: number): Promise<User> {
    // Verify both users exist
    const user = await this.getUser(userId);
    const partner = await this.getUser(partnerId);
    
    if (!user || !partner) {
      throw new Error("User atau Partner tidak ditemukan");
    }

    if (userId === partnerId) {
      throw new Error("Tidak bisa pair dengan diri sendiri");
    }

    // Update both users to pair with each other
    await db.update(users).set({ partnerId }).where(eq(users.id, userId));
    await db.update(users).set({ partnerId: userId }).where(eq(users.id, partnerId));

    return db.select().from(users).where(eq(users.id, userId)).then(rows => rows[0]);
  }

  async getPartner(userId: number): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user || !user.partnerId) return undefined;
    return this.getUser(user.partnerId);
  }

  async sendPartnershipRequest(fromUserId: number, toUserId: number): Promise<PartnershipRequest> {
    // Check if users exist
    const fromUser = await this.getUser(fromUserId);
    const toUser = await this.getUser(toUserId);
    
    if (!fromUser || !toUser) {
      throw new Error("User tidak ditemukan");
    }

    if (fromUserId === toUserId) {
      throw new Error("Tidak bisa pair dengan diri sendiri");
    }

    // Check if already partners
    if (fromUser.partnerId === toUserId) {
      throw new Error("Sudah menjadi partner");
    }

    // Check if request already exists
    const existing = await db.select().from(partnershipRequests)
      .where(and(
        eq(partnershipRequests.fromUserId, fromUserId),
        eq(partnershipRequests.toUserId, toUserId),
        eq(partnershipRequests.status, 'pending')
      ));

    if (existing.length > 0) {
      throw new Error("Permintaan partnership sudah ada");
    }

    const [request] = await db.insert(partnershipRequests)
      .values({ fromUserId, toUserId, status: 'pending' })
      .returning();

    return request;
  }

  async getPendingPartnershipRequests(userId: number): Promise<PartnershipRequest[]> {
    const requests = await db.select().from(partnershipRequests)
      .where(and(
        eq(partnershipRequests.toUserId, userId),
        eq(partnershipRequests.status, 'pending')
      ));
    return requests;
  }

  async respondToPartnershipRequest(requestId: number, accept: boolean): Promise<User | null> {
    const { partnershipRequests: prTable } = db._.schema;
    
    // Get the request
    const [request] = await db.select().from(partnershipRequests)
      .where(eq(partnershipRequests.id, requestId));

    if (!request) {
      throw new Error("Permintaan tidak ditemukan");
    }

    if (request.status !== 'pending') {
      throw new Error("Permintaan sudah diproses");
    }

    if (accept) {
      // Update both users to pair with each other
      await db.update(users)
        .set({ partnerId: request.toUserId })
        .where(eq(users.id, request.fromUserId));

      await db.update(users)
        .set({ partnerId: request.fromUserId })
        .where(eq(users.id, request.toUserId));

      // Mark request as accepted
      await db.update(partnershipRequests)
        .set({ status: 'accepted', respondedAt: new Date() })
        .where(eq(partnershipRequests.id, requestId));

      return this.getUser(request.fromUserId) || null;
    } else {
      // Mark request as declined
      await db.update(partnershipRequests)
        .set({ status: 'declined', respondedAt: new Date() })
        .where(eq(partnershipRequests.id, requestId));

      return null;
    }
  }

  async getUserCardCount(userId: number): Promise<number> {
    const items = await db.query.userCards.findMany({
      where: and(
        eq(userCards.userId, userId),
        eq(userCards.status, 'inventory')
      ),
    });
    return items.length;
  }

  async getPublicUserInfo(userId: number): Promise<{ id: number; username: string; avatarUrl: string | null; gender: string | null; cardCount: number } | null> {
    const user = await this.getUser(userId);
    if (!user) return null;

    const cardCount = await this.getUserCardCount(userId);

    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      gender: user.gender,
      cardCount
    };
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
      where: eq(userCards.status, 'active'),
      with: { card: true, user: true },
    });
    
    // Filter in application code to find expired cards
    return items.filter(item => {
      if (!item.expiresAt) return false;
      const expiresTime = new Date(item.expiresAt).getTime();
      const nowTime = now.getTime();
      return expiresTime <= nowTime; // Less than or equal (expired)
    });
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

  async setTempEmailVerificationToken(email: string): Promise<{ token: string; expiresAt: Date }> {
    // Generate 6-digit token with uppercase letters and numbers
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const token = Array.from(crypto.randomBytes(6))
      .map(byte => chars[byte % chars.length])
      .join('');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    // Store in temporary map
    tempEmailTokens.set(token, { email, token, expiresAt });

    // Clean up expired tokens periodically
    const now = new Date();
    for (const [key, value] of tempEmailTokens.entries()) {
      if (value.expiresAt < now) {
        tempEmailTokens.delete(key);
      }
    }

    console.log(`[Storage] Temp email verification token created for ${email}: ${token}`);
    return { token, expiresAt };
  }

  getTempEmailToken(token: string): { email: string; token: string; expiresAt: Date } | null {
    const data = tempEmailTokens.get(token);
    if (!data) return null;

    // Check expiration
    if (data.expiresAt < new Date()) {
      tempEmailTokens.delete(token);
      return null;
    }

    return data;
  }

  clearTempEmailToken(token: string): void {
    tempEmailTokens.delete(token);
  }

  markEmailAsPreVerified(email: string): void {
    // Mark email as pre-verified, expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    preVerifiedEmails.set(email.toLowerCase(), { expiresAt });
    console.log(`[Storage] Email marked as pre-verified: ${email}`);
  }

  isEmailPreVerified(email: string): boolean {
    const data = preVerifiedEmails.get(email.toLowerCase());
    if (!data) return false;

    // Check expiration
    if (data.expiresAt < new Date()) {
      preVerifiedEmails.delete(email.toLowerCase());
      return false;
    }

    return true;
  }

  clearPreVerifiedEmail(email: string): void {
    preVerifiedEmails.delete(email.toLowerCase());
  }
}

export const storage = new DatabaseStorage();