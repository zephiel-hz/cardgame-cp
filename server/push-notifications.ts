// @ts-ignore - web-push types not available
import webpush from 'web-push';
import { storage } from './storage';

// Configure web push
// In production, get these from environment variables
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'EXAMPLE_PUBLIC_KEY';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'EXAMPLE_PRIVATE_KEY';

if (vapidPublicKey && vapidPrivateKey && vapidPublicKey !== 'EXAMPLE_PUBLIC_KEY') {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@cardgame.local',
    vapidPublicKey,
    vapidPrivateKey
  );
  console.log('[Push] Web push configured successfully');
} else {
  console.warn('[Push] WARNING: VAPID keys not configured! Push notifications will not work.');
  console.warn('[Push] Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.');
}

export interface NotificationPayload {
  title: string;
  body: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  requireInteraction?: boolean;
}

export class PushNotificationService {
  /**
   * Send push notification to specific user
   */
  async notifyUser(userId: number, payload: NotificationPayload): Promise<{ success: number; failed: number }> {
    const subscriptions = await storage.getUserPushSubscriptions(userId);
    
    if (subscriptions.length === 0) {
      console.log(`[Push] No active subscriptions for user ${userId}`);
      return { success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            auth: subscription.auth,
            p256dh: subscription.p256dh,
          },
        };

        await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
        success++;
        
        // Update last used
        await storage.getUserPushSubscriptions(userId);
        console.log(`[Push] Notification sent to user ${userId}`);
      } catch (error: any) {
        failed++;
        console.error(`[Push] Failed to send notification to user ${userId}:`, error.message);

        // If subscription is invalid/expired, mark as inactive
        if (error.statusCode === 410 || error.statusCode === 404) {
          await storage.unsubscribeFromPushNotifications(userId, subscription.endpoint);
          console.log(`[Push] Removed invalid subscription for user ${userId}`);
        }
      }
    }

    return { success, failed };
  }

  /**
   * Send push notification to multiple users
   */
  async notifyUsers(userIds: number[], payload: NotificationPayload): Promise<{ totalSuccess: number; totalFailed: number }> {
    console.log(`[Push] Sending notification to ${userIds.length} users:`, userIds);
    let totalSuccess = 0;
    let totalFailed = 0;

    for (const userId of userIds) {
      const result = await this.notifyUser(userId, payload);
      totalSuccess += result.success;
      totalFailed += result.failed;
    }

    console.log(`[Push] Notification batch result - Success: ${totalSuccess}, Failed: ${totalFailed}`);
    return { totalSuccess, totalFailed };
  }

  /**
   * Send broadcast notification to all subscribed users with specific preferences
   */
  async broadcastNotification(
    payload: NotificationPayload,
    preferenceFilter?: (prefs: any) => boolean
  ): Promise<{ totalSuccess: number; totalFailed: number }> {
    const subscriptions = await storage.getAllPushSubscriptions();
    const uniqueUserIds = [...new Set(subscriptions.map(s => s.userId))];

    let totalSuccess = 0;
    let totalFailed = 0;

    for (const userId of uniqueUserIds) {
      // Check preferences if filter provided
      if (preferenceFilter) {
        const prefs = await storage.getNotificationPreferences(userId);
        if (!prefs || !preferenceFilter(prefs)) {
          continue;
        }
      }

      const result = await this.notifyUser(userId, payload);
      totalSuccess += result.success;
      totalFailed += result.failed;
    }

    return { totalSuccess, totalFailed };
  }

  /**
   * Notify all other users when a card is used
   * Notifikasi: "Partnermu menggunakan kartu #tiercard, durasi kartu 12 menit/jam"
   */
  async notifyCardUsed(
    userId: number,
    userName: string,
    cardName: string,
    cardTier: string,
    durationMinutes: number = 60,
    otherUserIds?: number[]
  ): Promise<void> {
    const targetUserIds = otherUserIds || [];
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    let durationText = '';
    
    if (hours > 0 && minutes > 0) {
      durationText = `${hours} jam ${minutes} menit`;
    } else if (hours > 0) {
      durationText = `${hours} jam`;
    } else {
      durationText = `${minutes} menit`;
    }

    const payload: NotificationPayload = {
      title: '🎴 Kartu Digunakan!',
      body: `Partnermu menggunakan kartu #${cardTier}, durasi kartu ${durationText}`,
      tag: 'card_used',
      icon: '/pwa-icon-192.svg',
      badge: '/pwa-icon-192.svg',
      data: {
        type: 'card_used',
        userName,
        cardName,
        cardTier,
        durationMinutes,
        url: '/active-cards',
      },
    };

    if (targetUserIds.length > 0) {
      await this.notifyUsers(targetUserIds, payload);
    }
  }

  /**
   * Notify user when partner's card expired
   * Notifikasi: "Durasi kartu yang digunakan partnermu telah habis"
   */
  async notifyCardExpiredNotif(userId: number): Promise<void> {
    const payload: NotificationPayload = {
      title: '⏰ Kartu Kadaluarsa',
      body: 'Durasi kartu yang digunakan partnermu telah habis',
      tag: 'card_expired_partner',
      icon: '/pwa-icon-192.svg',
      badge: '/pwa-icon-192.svg',
      data: {
        type: 'card_expired_partner',
        url: '/active-cards',
      },
    };

    await this.notifyUser(userId, payload);
  }

  /**
   * Notify user when they get a new card from gacha
   * Notifikasi: "Partnermu mendapatkan kartu common/rare/ssr"
   */
  async notifyNewCard(userId: number, cardTier: string): Promise<void> {
    const payload: NotificationPayload = {
      title: '🎁 Kartu Baru!',
      body: `Partnermu mendapatkan kartu ${cardTier}`,
      tag: 'new_card',
      icon: '/pwa-icon-192.svg',
      badge: '/pwa-icon-192.svg',
      data: {
        type: 'new_card',
        cardTier,
        url: '/inventory',
      },
    };

    await this.notifyUser(userId, payload);
  }

  /**
   * Notify user when their card is about to expire
   */
  async notifyCardExpiring(userId: number, cardName: string, expiresAt: Date): Promise<void> {
    const timeUntilExpiry = expiresAt.getTime() - Date.now();
    const minutesUntilExpiry = Math.floor(timeUntilExpiry / 60000);

    const payload: NotificationPayload = {
      title: '⏰ Kartu Segera Kadaluarsa!',
      body: `Kartu "${cardName}" akan kadaluarsa dalam ${minutesUntilExpiry} menit`,
      tag: 'card_expiring',
      icon: '/pwa-icon-192.svg',
      badge: '/pwa-icon-192.svg',
      requireInteraction: true,
      data: {
        type: 'card_expiring',
        url: '/active-cards',
      },
    };

    await this.notifyUser(userId, payload);
  }

  /**
   * Notify user when their card expired
   */
  async notifyCardExpired(userId: number, cardName: string): Promise<void> {
    const payload: NotificationPayload = {
      title: '❌ Kartu Kadaluarsa',
      body: `Kartu "${cardName}" telah kadaluarsa dan tidak bisa digunakan lagi`,
      tag: 'card_expired',
      icon: '/pwa-icon-192.svg',
      badge: '/pwa-icon-192.svg',
      data: {
        type: 'card_expired',
        url: '/inventory',
      },
    };

    await this.notifyUser(userId, payload);
  }

  /**
   * Get VAPID public key for client registration
   */
  getVapidPublicKey(): string {
    return vapidPublicKey;
  }

  /**
   * Check if push notifications are configured
   */
  isConfigured(): boolean {
    return vapidPublicKey !== 'EXAMPLE_PUBLIC_KEY' && vapidPrivateKey !== 'EXAMPLE_PRIVATE_KEY';
  }
}

export const pushNotificationService = new PushNotificationService();
