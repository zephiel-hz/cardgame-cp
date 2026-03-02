import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { api } from '@shared/routes';

export function usePushNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if browser supports push notifications
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);

    if (supported) {
      // Register service worker
      registerServiceWorker();
      // Check subscription status
      checkSubscriptionStatus();
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        console.log('[Push] Service worker registered:', registration);
      }
    } catch (error) {
      console.error('[Push] Service worker registration failed:', error);
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      if (!('serviceWorker' in navigator) || !user) return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('[Push] Error checking subscription status:', error);
    }
  };

  const subscribe = useCallback(async () => {
    if (!isSupported || !user) {
      toast({
        variant: 'destructive',
        title: 'Tidak Didukung',
        description: 'Browser Anda tidak mendukung push notifications',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Request notification permission
      if (Notification.permission === 'denied') {
        toast({
          variant: 'destructive',
          title: 'Izin Ditolak',
          description: 'Anda telah menolak izin notifikasi. Silakan ubah di pengaturan browser.',
        });
        setIsLoading(false);
        return;
      }

      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast({
            variant: 'destructive',
            title: 'Izin Ditolak',
            description: 'Anda menolak izin notifikasi',
          });
          setIsLoading(false);
          return;
        }
      }

      // Get VAPID public key
      const vapidResponse = await fetch('/api/notifications/vapid-key');
      const { vapidPublicKey } = await vapidResponse.json();

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      // Send subscription to server
      const response = await fetch(api.notifications.subscribe.path, {
        method: api.notifications.subscribe.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          subscription: subscription.toJSON(),
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal mendaftar push notifications');
      }

      setIsSubscribed(true);
      toast({
        title: 'Berhasil',
        description: 'Anda akan menerima notifikasi sekarang',
      });
    } catch (error: any) {
      console.error('[Push] Subscription error:', error);
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: error.message || 'Gagal mengaktifkan push notifications',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported, toast]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported || !user) return;

    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setIsSubscribed(false);
        return;
      }

      // Send unsubscribe to server
      const response = await fetch(api.notifications.unsubscribe.path, {
        method: api.notifications.unsubscribe.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          endpoint: subscription.endpoint,
        }),
      });

      if (!response.ok) {
        throw new Error('Gagal membatalkan push notifications');
      }

      // Unsubscribe from service worker
      await subscription.unsubscribe();

      setIsSubscribed(false);
      toast({
        title: 'Berhasil',
        description: 'Anda tidak akan menerima notifikasi lagi',
      });
    } catch (error: any) {
      console.error('[Push] Unsubscribe error:', error);
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: error.message || 'Gagal membatalkan push notifications',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported, toast]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
