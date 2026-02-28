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
  const [preferences, setPreferences] = useState({
    cardUsed: true,
    cardExpired: true,
    cardDropped: true,
    promotions: false,
  });
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(false);

  // Check if browser supports push notifications
  useEffect(() => {
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
    return (
      <Card className="border-none shadow-xl bg-white/80 backdrop-blur-md rounded-3xl overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <CardTitle>Notifikasi</CardTitle>
          </div>
          <CardDescription>Browser tidak mendukung push notifications</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-none shadow-xl bg-white/80 backdrop-blur-md rounded-3xl overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          <div>
            <CardTitle>Notifikasi</CardTitle>
            <CardDescription>Kelola preferensi notifikasi push</CardDescription>
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
