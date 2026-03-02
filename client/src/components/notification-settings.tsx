import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Bell, AlertCircle } from "lucide-react";
import { api } from "@shared/routes";

export function NotificationSettings() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isIOSPWA, setIsIOSPWA] = useState(false);
  const [preferences, setPreferences] = useState({
    cardUsed: true,
    cardExpired: true,
    cardDropped: true,
    promotions: false,
  });
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(false);

  // Check if browser supports push notifications and detect iOS PWA
  useEffect(() => {
    // Detect iOS PWA (installed on home screen)
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isPWA = (window.navigator as any).standalone === true || 
                  document.referrer.includes('android-app://') ||
                  (window.matchMedia('(display-mode: standalone)').matches);
    
    setIsIOSPWA(isIOSSafari && isPWA);

    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);

    if (supported && user) {
      registerServiceWorker();
      checkSubscriptionStatus();
      loadPreferences();
    }
  }, [user]);

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

  const loadPreferences = async () => {
    if (!user) return;
    try {
      const res = await fetch(api.notifications.preferences.path.replace(':userId', String(user.id)));
      if (res.ok) {
        const prefs = await res.json();
        setPreferences(prefs);
      }
    } catch (error) {
      console.error('[Push] Error loading preferences:', error);
    }
  };

  const subscribe = async () => {
    if (!isSupported || !user) {
      toast({
        variant: "destructive",
        title: "Tidak Didukung",
        description: "Browser Anda tidak mendukung push notifications",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Request notification permission
      if (Notification.permission === "denied") {
        toast({
          variant: "destructive",
          title: "Izin Ditolak",
          description: "Anda telah menolak izin notifikasi. Silakan ubah di pengaturan browser.",
        });
        setIsLoading(false);
        return;
      }

      if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          toast({
            variant: "destructive",
            title: "Izin Ditolak",
            description: "Anda menolak izin notifikasi",
          });
          setIsLoading(false);
          return;
        }
      }

      // Get VAPID public key from server
      const vapidResponse = await fetch('/api/notifications/vapid-key');
      const vapidData = await vapidResponse.json();
      const vapidPublicKey = vapidData.vapidPublicKey;

      if (!vapidPublicKey || vapidPublicKey === 'EXAMPLE_PUBLIC_KEY') {
        throw new Error('Push notifications belum dikonfigurasi di server. Hubungi admin.');
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as any,
      });

      // Send subscription to server
      const response = await fetch(api.notifications.subscribe.path, {
        method: api.notifications.subscribe.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          subscription: subscription.toJSON(),
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal mendaftar push notifications");
      }

      setIsSubscribed(true);
      toast({
        title: "Berhasil",
        description: "Anda akan menerima notifikasi sekarang",
      });
    } catch (error: any) {
      console.error('[Push] Subscription error:', error);
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message || "Gagal mengaktifkan push notifications",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          endpoint: subscription.endpoint,
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal membatalkan push notifications");
      }

      // Unsubscribe from service worker
      await subscription.unsubscribe();

      setIsSubscribed(false);
      toast({
        title: "Berhasil",
        description: "Anda tidak akan menerima notifikasi lagi",
      });
    } catch (error: any) {
      console.error('[Push] Unsubscribe error:', error);
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message || "Gagal membatalkan push notifications",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreferences = async (newPrefs: any) => {
    if (!user) return;

    setIsLoadingPrefs(true);
    try {
      const res = await fetch(api.notifications.updatePreferences.path, {
        method: api.notifications.updatePreferences.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          ...newPrefs,
        }),
      });

      if (!res.ok) {
        throw new Error("Gagal mengubah preferensi");
      }

      setPreferences(newPrefs);
      toast({
        title: "Berhasil",
        description: "Preferensi notifikasi diperbarui",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message,
      });
    } finally {
      setIsLoadingPrefs(false);
    }
  };

  if (!isSupported) {
    // iOS PWA installed but no Web Push API support
    if (isIOSPWA) {
      return (
        <Card className="border-none shadow-xl bg-white dark:bg-gradient-to-br dark:from-purple-900/95 dark:to-purple-800/95 backdrop-blur-md rounded-3xl overflow-hidden dark:border-pink-400/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-pink-400" />
              <div>
                <CardTitle className="text-pink-100">Notifikasi</CardTitle>
                <CardDescription className="text-pink-200/70">PWA mode - Limited support</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-purple-700/30 border border-blue-200 dark:border-pink-400/30 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-blue-900 dark:text-pink-200">✅ Notifikasi Tersedia!</h3>
              <p className="text-sm text-blue-800 dark:text-pink-200/80">
                Anda telah install aplikasi ini di home screen iOS. Notifikasi akan terkirim saat Anda membuka aplikasi.
              </p>
              <div className="text-xs text-blue-700 dark:text-pink-200/70 space-y-2">
                <p>📲 <strong>Untuk notifikasi otomatis:</strong></p>
                <p>1. Buka Settings → Notifications</p>
                <p>2. Cari "Card Game" atau nama browser Anda</p>
                <p>3. Enable "Allow Notifications"</p>
              </div>
            </div>
            
            <div className="bg-amber-50 dark:bg-purple-700/20 border border-amber-200 dark:border-pink-400/20 rounded-lg p-4">
              <p className="text-xs text-amber-800 dark:text-pink-200/70">
                💡 iOS Safari tidak support Web Push API. Notifikasi akan ditampilkan saat Anda aktif menggunakan aplikasi.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Android or other browsers without Push support
    return (
      <Card className="border-none shadow-xl bg-white dark:bg-gradient-to-br dark:from-purple-900/95 dark:to-purple-800/95 backdrop-blur-md rounded-3xl overflow-hidden dark:border-pink-400/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-pink-400 dark:text-pink-400" />
            <CardTitle className="text-pink-900 dark:text-pink-100">Notifikasi</CardTitle>
          </div>
          <CardDescription className="text-pink-700 dark:text-pink-200/70">Browser tidak mendukung push notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Update browser Anda atau gunakan Chrome / Firefox untuk mendapatkan push notifications.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-xl bg-white dark:bg-gradient-to-br dark:from-purple-900/95 dark:to-purple-800/95 backdrop-blur-md rounded-3xl overflow-hidden dark:border-pink-400/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-pink-400" />
          <div>
            <CardTitle className="text-pink-900 dark:text-pink-100">Notifikasi Push</CardTitle>
            <CardDescription className="text-pink-700 dark:text-pink-200/70">Kelola preferensi notifikasi push</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Subscription Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Push Notifications</h3>
              <p className="text-sm text-muted-foreground">
                {isSubscribed ? "✅ Aktif - Anda akan menerima notifikasi" : "⭕ Tidak aktif - Enable untuk menerima notifikasi"}
              </p>
            </div>
            <Button
              onClick={isSubscribed ? unsubscribe : subscribe}
              disabled={isLoading}
              variant={isSubscribed ? "destructive" : "default"}
              className="rounded-xl"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : isSubscribed ? (
                "Matikan"
              ) : (
                "Aktifkan Notifikasi"
              )}
            </Button>
          </div>
        </div>

        {/* Preferences */}
        {isSubscribed && (
          <div className="space-y-4 border-t pt-6">
            <h3 className="font-semibold">Jenis Notifikasi</h3>

            <div className="flex items-center justify-between">
              <Label htmlFor="card-used" className="font-normal cursor-pointer">
                Saat ada pengguna gunakan kartu
              </Label>
              <Switch
                id="card-used"
                checked={preferences.cardUsed}
                onCheckedChange={(checked) => {
                  const newPrefs = { ...preferences, cardUsed: checked };
                  setPreferences(newPrefs);
                  updatePreferences(newPrefs);
                }}
                disabled={isLoadingPrefs}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="card-expired" className="font-normal cursor-pointer">
                Saat kartu kadaluarsa
              </Label>
              <Switch
                id="card-expired"
                checked={preferences.cardExpired}
                onCheckedChange={(checked) => {
                  const newPrefs = { ...preferences, cardExpired: checked };
                  setPreferences(newPrefs);
                  updatePreferences(newPrefs);
                }}
                disabled={isLoadingPrefs}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="card-dropped" className="font-normal cursor-pointer">
                Saat mendapat kartu baru (gacha)
              </Label>
              <Switch
                id="card-dropped"
                checked={preferences.cardDropped}
                onCheckedChange={(checked) => {
                  const newPrefs = { ...preferences, cardDropped: checked };
                  setPreferences(newPrefs);
                  updatePreferences(newPrefs);
                }}
                disabled={isLoadingPrefs}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="promotions" className="font-normal cursor-pointer">
                Promo & update aplikasi
              </Label>
              <Switch
                id="promotions"
                checked={preferences.promotions}
                onCheckedChange={(checked) => {
                  const newPrefs = { ...preferences, promotions: checked };
                  setPreferences(newPrefs);
                  updatePreferences(newPrefs);
                }}
                disabled={isLoadingPrefs}
              />
            </div>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-muted-foreground bg-primary/5 rounded-lg p-3 border border-primary/10">
          💡 Push notifications hanya bekerja di HTTPS (production) atau localhost. Di mobile, pastikan browser sudah allow notifikasi di settings.
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
