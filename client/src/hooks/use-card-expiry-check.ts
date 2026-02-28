import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

/**
 * Hook to periodically check for expired cards and trigger notifications
 * Runs every 60 seconds to check for expiring cards (within 5 minutes)
 */
export function useCardExpiryCheck() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Check for expired cards when component mounts
    checkExpiredCards();

    // Check for expiring cards every 60 seconds
    const expiringInterval = setInterval(() => {
      checkExpiringCards();
    }, 60000);

    // Handle expired cards every 5 minutes
    const expiredInterval = setInterval(() => {
      checkExpiredCards();
    }, 5 * 60000);

    return () => {
      clearInterval(expiringInterval);
      clearInterval(expiredInterval);
    };
  }, [user]);

  const checkExpiringCards = async () => {
    try {
      const response = await fetch('/api/cards/check-expiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[Expiry Check] Found ${data.expiring} expiring cards`);
      }
    } catch (error) {
      console.error('[Expiry Check] Failed:', error);
    }
  };

  const checkExpiredCards = async () => {
    try {
      const response = await fetch('/api/cards/handle-expired', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.processed > 0) {
          console.log(`[Expired Cards] Handled ${data.processed} expired cards and sent notifications`);
        }
      }
    } catch (error) {
      console.error('[Expired Cards] Failed:', error);
    }
  };

  return { checkExpiringCards, checkExpiredCards };
}
