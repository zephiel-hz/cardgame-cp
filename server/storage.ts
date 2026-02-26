import { db } from "./db";
import { users, cards, userCards, gachaLogs } from "@shared/schema";
import type { User, InsertUser, Card, UserCard, UserCardWithDetails } from "@shared/schema";
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
  createUser(user: InsertUser): Promise<User>;
  getCards(): Promise<Card[]>;
  getInventory(userId: number): Promise<UserCardWithDetails[]>;
  getActiveCards(): Promise<UserCardWithDetails[]>;
  useCard(userCardId: number): Promise<UserCardWithDetails>;
  getTodayGachaCount(userId: number): Promise<number>;
  addGachaLog(userId: number): Promise<void>;
  addCardToInventory(userId: number, cardId: number): Promise<UserCardWithDetails>;
}

export class DatabaseStorage implements IStorage {
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getCards(): Promise<Card[]> {
    return await db.select().from(cards);
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
}

export const storage = new DatabaseStorage();