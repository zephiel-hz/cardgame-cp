import crypto from 'crypto';
import { db } from "./db";
import { pool } from "./db";
import { users, cards, userCards, gachaLogs, pushSubscriptions, notificationPreferences, partnershipRequests, partnershipRemovalRequests, messages } from "@shared/schema";
import type { User, InsertUser, Card, UserCard, UserCardWithDetails, PushSubscription, NotificationPreference, PartnershipRequest, PartnershipRemovalRequest, Message } from "@shared/schema";
import { eq, and, gte, or, ne } from "drizzle-orm";

// Temporary in-memory storage for email verification tokens (pre-registration)
const tempEmailTokens = new Map<string, { email: string; token: string; expiresAt: Date }>();

// Track pre-verified emails in registration flow
const preVerifiedEmails = new Map<string, { expiresAt: Date }>();

// PIN Encryption Utility Functions
const PIN_ITERATIONS = 100000;
const PIN_KEYLEN = 64;
const PIN_DIGEST = 'sha256';

function generatePinSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function hashPin(pin: string, salt: string): string {
  const hash = crypto.pbkdf2Sync(pin, salt, PIN_ITERATIONS, PIN_KEYLEN, PIN_DIGEST);
  return hash.toString('hex');
}

function encryptPin(pin: string): string {
  const salt = generatePinSalt();
  const hash = hashPin(pin, salt);
  return `${salt}:${hash}`;
}

function verifyPin(plainPin: string, encryptedPin: string): boolean {
  try {
    // Check if PIN is encrypted (contains ':')
    if (encryptedPin.includes(':')) {
      // New encrypted format
      const [salt, hash] = encryptedPin.split(':');
      if (!salt || !hash) return false;
      const testHash = hashPin(plainPin, salt);
      return testHash === hash;
    } else {
      // Backwards compatibility: Handle unencrypted PINs
      // If the stored PIN doesn't have ':' it's likely unencrypted (old format)
      const isMatch = plainPin === encryptedPin;
      // Auto-migrate: If matches, we'll let it through but it should be re-hashed on next profile update
      return isMatch;
    }
  } catch {
    return false;
  }
}

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
  initiatePartnershipRemoval(userId: number, reason: string): Promise<PartnershipRemovalRequest>;
  getPendingRemovalRequests(userId: number): Promise<PartnershipRemovalRequest[]>;
  respondToRemovalRequest(requestId: number, accept: boolean, respondingUserId: number, rejectionReason?: string): Promise<void>;
  forceDeletePartnership(requestId: number, userId: number): Promise<void>;
  getUserCardCount(userId: number): Promise<number>;
  getPublicUserInfo(userId: number): Promise<{ id: number; username: string; avatarUrl: string | null; gender: string | null; cardCount: number } | null>;
  // Push notification methods
  subscribeToPushNotifications(userId: number, subscription: any, platform: string): Promise<PushSubscription>;
  unsubscribeFromPushNotifications(userId: number, endpoint: string): Promise<boolean>;
  getUserPushSubscriptions(userId: number): Promise<PushSubscription[]>;
  getAllPushSubscriptions(): Promise<PushSubscription[]>;
  getNotificationPreferences(userId: number): Promise<NotificationPreference | undefined>;
  updateNotificationPreferences(userId: number, preferences: Partial<NotificationPreference>): Promise<NotificationPreference>;
  // PIN Verification method
  verifyUserPin(user: User, plainPin: string): boolean;
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
  // Chat methods
  sendMessage(senderId: number, recipientId: number, content: string): Promise<Message>;
  getMessages(userId1: number, userId2: number): Promise<Message[]>;
  markMessageAsRead(messageId: number): Promise<boolean>;
  getUnreadMessageCount(userId: number): Promise<number>;
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
    // Encrypt the PIN before storing
    const userData = {
      ...insertUser,
      pin: insertUser.pin ? encryptPin(insertUser.pin) : encryptPin("0000"),
    };
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    // Encrypt PIN if it's being updated
    const dataToUpdate = {
      ...updates,
      ...(updates.pin && { pin: encryptPin(updates.pin) }),
    };
    const [user] = await db.update(users).set(dataToUpdate).where(eq(users.id, id)).returning();
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

    // Check if user has a partner
    if (!uc.user.partnerId) {
      throw new Error("Kamu harus memiliki partner untuk menggunakan kartu");
    }

    const activatedAt = new Date();
    const baseDuration = uc.card.durationMinutes;
    
    // Check for existing active cards of the same type from the same user
    const existingActiveCards = await db.query.userCards.findMany({
      where: and(
        eq(userCards.userId, uc.userId),
        eq(userCards.cardId, uc.cardId),
        eq(userCards.status, 'active')
      ),
      with: { card: true, user: true },
    });
    
    console.log(`[useCard] Checking for stacking - Found ${existingActiveCards.length} existing active cards of same type`);
    
    let updatedCardId: number;
    let isStacking = false;
    
    if (existingActiveCards.length > 0) {
      // Stack the cards: extend the expiry of the oldest one and mark this new card as used
      const oldestCard = existingActiveCards[0];
      const oldExpiresAt = new Date(oldestCard.expiresAt || activatedAt);
      
      // New expiry = oldest card's expiry + new card's duration
      const newExpiresAt = new Date(oldExpiresAt.getTime() + baseDuration * 60000);
      
      console.log(`[useCard] STACKING detected! Card ID ${userCardId} (${uc.card.name}):`, {
        oldestCardId: oldestCard.id,
        oldExpiresAt: oldExpiresAt.toISOString(),
        newCardDuration: baseDuration,
        newExpiresAt: newExpiresAt.toISOString(),
        additionalTime: baseDuration,
        action: "Extended oldest card, consumed new card"
      });
      
      // Update the oldest card with extended expiry
      await db.update(userCards)
        .set({ expiresAt: newExpiresAt })
        .where(eq(userCards.id, oldestCard.id));
      
      // Mark the new card as USED (consumed in stacking)
      // This way we only show the extended active card, not duplicate records
      await db.update(userCards)
        .set({ status: 'used', activatedAt, expiresAt: newExpiresAt })
        .where(eq(userCards.id, userCardId));
      
      updatedCardId = oldestCard.id;
      isStacking = true;
    } else {
      // No existing cards of same type, just activate normally
      const expiresAt = new Date(activatedAt.getTime() + baseDuration * 60000);
      
      console.log(`[useCard] No stacking - Setting card ${userCardId} (${uc.card.name}):`, {
        activatedAt: activatedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        durationMinutes: baseDuration,
        timestampDiff: expiresAt.getTime() - activatedAt.getTime()
      });

      await db.update(userCards)
        .set({ status: 'active', activatedAt, expiresAt })
        .where(eq(userCards.id, userCardId));
      
      updatedCardId = userCardId;
    }

    // Refetch from database to ensure we return exact DB state (no stale data)
    const finalCard = await db.query.userCards.findFirst({
      where: eq(userCards.id, updatedCardId),
      with: { card: true, user: true },
    });
    
    if (!finalCard) throw new Error("Failed to fetch updated card");
    
    console.log(`[useCard] Returning card - stacking: ${isStacking}, expiresAt: ${finalCard.expiresAt?.toISOString()}`);
    return finalCard;
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

    // Check if sender already has a partner
    if (fromUser.partnerId !== null) {
      throw new Error("Anda sudah memiliki partner");
    }

    // Check if recipient already has a partner
    if (toUser.partnerId !== null) {
      throw new Error("User tersebut sudah memiliki partner");
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

  async initiatePartnershipRemoval(userId: number, reason: string): Promise<PartnershipRemovalRequest> {
    // Get user's current partner
    const user = await this.getUser(userId);
    if (!user || !user.partnerId) {
      throw new Error("User tidak memiliki partner");
    }

    // Validate reason is not empty
    if (!reason || reason.trim().length === 0) {
      throw new Error("Alasan penghapusan partnership wajib diisi");
    }

    const trimmedReason = reason.trim();
    console.log("Creating removal request with reason:", trimmedReason);

    // Check if there's already a pending removal request
    const existing = await db.select().from(partnershipRemovalRequests)
      .where(and(
        eq(partnershipRemovalRequests.initiatorId, userId),
        eq(partnershipRemovalRequests.partnerId, user.partnerId),
        eq(partnershipRemovalRequests.status, 'pending')
      ));

    if (existing.length > 0) {
      throw new Error("Sudah ada permintaan penghapusan partnership yang menunggu");
    }

    // Use raw SQL to ensure reason is inserted correctly
    try {
      const result = await pool.query(
        `INSERT INTO partnership_removal_requests (
          initiator_id, 
          partner_id, 
          initiator_accepted, 
          partner_accepted, 
          reason, 
          status, 
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
        `,
        [userId, user.partnerId, true, false, trimmedReason, 'pending']
      );

      if (result.rows.length === 0) {
        throw new Error("Failed to create removal request");
      }

      const row = result.rows[0];
      // Map snake_case to camelCase
      return {
        id: row.id,
        initiatorId: row.initiator_id,
        partnerId: row.partner_id,
        initiatorAccepted: row.initiator_accepted,
        partnerAccepted: row.partner_accepted,
        reason: row.reason,
        rejectionReason: row.rejection_reason,
        status: row.status,
        createdAt: row.created_at,
        respondedAt: row.responded_at,
      };
    } catch (error: any) {
      console.error("Error creating removal request:", error);
      throw error;
    }
  }

  async getPendingRemovalRequests(userId: number): Promise<PartnershipRemovalRequest[]> {
    // Get removal requests where:
    // 1. User is the partner AND status is pending (needs to respond), OR
    // 2. User is the initiator (to see status: pending, rejected, completed, force_deleted)
    const requests = await db.select().from(partnershipRemovalRequests)
      .where(
        or(
          and(
            eq(partnershipRemovalRequests.partnerId, userId),
            ne(partnershipRemovalRequests.status, 'force_deleted')
          ),
          eq(partnershipRemovalRequests.initiatorId, userId)
        )
      );

    console.log("📋 Removal requests for user", userId, ":", requests);
    
    return requests;
  }

  async respondToRemovalRequest(requestId: number, accept: boolean, respondingUserId: number, rejectionReason?: string): Promise<void> {
    const [request] = await db.select().from(partnershipRemovalRequests)
      .where(eq(partnershipRemovalRequests.id, requestId));

    if (!request) {
      throw new Error("Permintaan penghapusan partnership tidak ditemukan");
    }

    if (request.partnerId !== respondingUserId) {
      throw new Error("Anda tidak berhak merespons permintaan ini");
    }

    if (request.status !== 'pending') {
      throw new Error("Permintaan sudah diproses");
    }

    if (accept) {
      // Both users accepted, so remove partnership
      await db.update(users)
        .set({ partnerId: null })
        .where(eq(users.id, request.initiatorId));

      await db.update(users)
        .set({ partnerId: null })
        .where(eq(users.id, request.partnerId));

      // Mark as completed
      await db.update(partnershipRemovalRequests)
        .set({ partnerAccepted: true, status: 'completed', respondedAt: new Date() })
        .where(eq(partnershipRemovalRequests.id, requestId));
    } else {
      // Partner rejected, mark as rejected with reason
      if (!rejectionReason || rejectionReason.trim().length === 0) {
        throw new Error("Alasan penolakan wajib diisi");
      }

      // Use raw SQL for rejection reason to ensure it's set correctly
      const trimmedReason = rejectionReason.trim();
      console.log("💬 Saving rejection reason:", trimmedReason, "for request:", requestId);
      
      await pool.query(
        `UPDATE partnership_removal_requests 
         SET status = $1, rejection_reason = $2, responded_at = NOW()
         WHERE id = $3`,
        ['rejected', trimmedReason, requestId]
      );
      
      console.log("✅ Rejection reason saved successfully");
    }
  }

  async forceDeletePartnership(requestId: number, userId: number): Promise<void> {
    const [request] = await db.select().from(partnershipRemovalRequests)
      .where(eq(partnershipRemovalRequests.id, requestId));

    if (!request) {
      throw new Error("Permintaan penghapusan partnership tidak ditemukan");
    }

    if (request.initiatorId !== userId) {
      throw new Error("Hanya pihak yang memulai penghapusan yang bisa force delete");
    }

    if (request.status !== 'rejected') {
      throw new Error("Hanya bisa force delete jika permintaan telah ditolak");
    }

    // Force delete partnership without consent
    await db.update(users)
      .set({ partnerId: null })
      .where(eq(users.id, request.initiatorId));

    await db.update(users)
      .set({ partnerId: null })
      .where(eq(users.id, request.partnerId));

    // Mark as force_deleted using raw SQL
    await pool.query(
      `UPDATE partnership_removal_requests 
       SET status = $1, responded_at = NOW()
       WHERE id = $2`,
      ['force_deleted', requestId]
    );
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

  verifyUserPin(user: User, plainPin: string): boolean {
    return verifyPin(plainPin, user.pin);
  }

  async sendMessage(senderId: number, recipientId: number, content: string): Promise<Message> {
    const [message] = await db.insert(messages).values({
      senderId,
      recipientId,
      content,
      isRead: false,
    }).returning();
    return message;
  }

  async getMessages(userId1: number, userId2: number): Promise<Message[]> {
    const result = await db.query.messages.findMany({
      where: or(
        and(eq(messages.senderId, userId1), eq(messages.recipientId, userId2)),
        and(eq(messages.senderId, userId2), eq(messages.recipientId, userId1))
      ),
      orderBy: (msg) => messages.createdAt,
    });
    return result;
  }

  async markMessageAsRead(messageId: number): Promise<boolean> {
    await db.update(messages)
      .set({ 
        isRead: true,
        readAt: new Date()
      })
      .where(eq(messages.id, messageId));
    return true;
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
    const result = await db.query.messages.findMany({
      where: and(
        eq(messages.recipientId, userId),
        eq(messages.isRead, false)
      ),
    });
    return result.length;
  }
}

export const storage = new DatabaseStorage();