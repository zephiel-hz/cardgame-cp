import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Camera, Lock, User as UserIcon, Moon, Sun, Mail, CheckCircle, RefreshCw } from "lucide-react";
import { NotificationSettings } from "@/components/notification-settings";

export default function Profile() {
  const { user, login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect component mount - run ONCE on every mount
  useEffect(() => {
    console.log('[Profile] Component mounted, user:', { userId: user?.id, username: user?.username });
  }, []);

  // Log user state when it changes
  useEffect(() => {
    console.log('[Profile] User state changed:', { userId: user?.id, username: user?.username, email: user?.email });
  }, [user?.id, user?.username, user?.email]);

  const [username, setUsername] = useState(user?.username || "");
  const [pin, setPin] = useState("");
  const [baseAvatarUrl, setBaseAvatarUrl] = useState(user?.avatarUrl || "");
  const [displayAvatarUrl, setDisplayAvatarUrl] = useState(user?.avatarUrl ? `${user.avatarUrl}?t=${Date.now()}` : "");
  const [gender, setGender] = useState((user?.gender as any) || "other");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerificationInput, setShowVerificationInput] = useState(false);

  // Sync state when user changes - IMPORTANT for consistency after refresh/HMR
  useEffect(() => {
    if (user?.id) {
      console.log('[Profile] Syncing user state after load');
      setUsername(user.username || "");
      setBaseAvatarUrl(user.avatarUrl || "");
      setDisplayAvatarUrl(user.avatarUrl ? `${user.avatarUrl}?t=${Date.now()}` : "");
      setGender((user.gender as any) || "other");
    }
  }, [user?.id]); // Only resync when user ID changes

  // Sync avatar URL when user updates, with cache-busting
  useEffect(() => {
    if (user?.avatarUrl) {
      setBaseAvatarUrl(user.avatarUrl);
      setDisplayAvatarUrl(`${user.avatarUrl}?t=${Date.now()}`);
    }
  }, [user?.avatarUrl, user?.id]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.auth.updateProfile.path, {
        method: api.auth.updateProfile.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, ...data }),
      });
      if (!res.ok) throw new Error("Gagal memperbarui profil");
      return res.json();
    },
    onSuccess: (updatedUser) => {
      login(updatedUser);
      queryClient.invalidateQueries({ queryKey: [api.activeCards.list.path] });
      toast({ title: "Berhasil", description: "Profil diperbarui!" });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    },
  });

  const updateEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch(api.auth.updateEmail.path, {
        method: api.auth.updateEmail.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, email }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Gagal memperbarui email");
      }
      return res.json();
    },
    onSuccess: () => {
      setShowVerificationInput(true);
      setNewEmail("");
      toast({ 
        title: "Email dikirim", 
        description: "Periksa email kamu untuk kode verifikasi" 
      });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch(api.auth.verifyEmail.path, {
        method: api.auth.verifyEmail.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error("Kode verifikasi tidak valid atau sudah kadaluarsa");
      return res.json();
    },
    onSuccess: (updatedUser) => {
      login(updatedUser);
      setShowVerificationInput(false);
      setVerificationCode("");
      queryClient.invalidateQueries({ queryKey: [api.activeCards.list.path] });
      toast({ 
        title: "Berhasil", 
        description: "Email berhasil diverifikasi!" 
      });
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "Gagal", description: error.message });
    },
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onerror = () => {
        setIsUploadingAvatar(false);
        toast({
          variant: "destructive",
          title: "Gagal",
          description: "Gagal membaca file",
        });
      };
      reader.onload = async (event) => {
        try {
          const base64 = event.target?.result as string;
          
          const res = await fetch(api.auth.uploadAvatar.path, {
            method: api.auth.uploadAvatar.method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: String(user?.id),
              filename: file.name,
              data: base64,
            }),
          });

          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || "Gagal mengunggah foto");
          }

          const data = await res.json();
          // Store base URL without timestamp
          setBaseAvatarUrl(data.avatarUrl);
          // Display URL with cache-busting timestamp
          const urlWithTimestamp = `${data.avatarUrl}?t=${Date.now()}`;
          setDisplayAvatarUrl(urlWithTimestamp);
          toast({ title: "Berhasil", description: "Foto berhasil diunggah!" });
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Gagal",
            description: error.message || "Gagal mengunggah foto",
          });
        } finally {
          setIsUploadingAvatar(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      setIsUploadingAvatar(false);
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message || "Gagal membaca file",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: any = {};
    if (username !== user?.username) updates.username = username;
    if (pin) updates.pin = pin;
    if (baseAvatarUrl !== user?.avatarUrl) updates.avatarUrl = baseAvatarUrl;
    if (gender !== user?.gender) updates.gender = gender;
    
    if (Object.keys(updates).length > 0) {
      updateProfileMutation.mutate(updates);
    }
  };

  return !user ? (
    <div className="pb-10 space-y-6">
      <div className="px-2">
        <h2 className="text-2xl font-bold text-foreground">Kustomisasi Profil</h2>
        <p className="text-muted-foreground text-sm font-medium mt-1">Memuat data profil...</p>
      </div>
    </div>
  ) : (
    <div className="pb-10 space-y-6">
      <div className="px-2">
        <h2 className="text-2xl font-bold text-foreground">Kustomisasi Profil</h2>
        <p className="text-muted-foreground text-sm font-medium mt-1">
          Ubah tampilan, keamanan, dan notifikasi profilmu
        </p>
      </div>

      <Card className="border-none shadow-xl bg-white dark:bg-gradient-to-br dark:from-purple-900/95 dark:to-purple-800/95 backdrop-blur-md rounded-3xl overflow-hidden dark:border-pink-400/20">
        <CardHeader className="pb-2">
          <div className="flex flex-col items-center gap-4">
            <div 
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Avatar className="w-24 h-24 border-4 border-primary/20 shadow-xl">
                <AvatarImage src={displayAvatarUrl} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploadingAvatar ? (
                  <Loader2 className="text-white w-6 h-6 animate-spin" />
                ) : (
                  <Camera className="text-white w-6 h-6" />
                )}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <div className="text-center">
              <CardTitle className="text-xl">{user?.username || "Loading..."}</CardTitle>
              <CardDescription>ID Pengguna: #{user?.id || "..."}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <UserIcon size={16} className="text-primary" /> Nama Panggilan
              </Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="rounded-xl border-primary/20 focus:border-primary focus:ring-primary/20"
                placeholder="Masukkan nama baru"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Camera size={16} className="text-primary" /> Foto Profil
              </Label>
              <div className="text-sm text-muted-foreground bg-primary/5 rounded-lg p-3 border border-primary/10">
                Klik foto profil di atas untuk mengubah foto dari galeri atau penyimpanan file.
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin" className="flex items-center gap-2">
                <Lock size={16} className="text-primary" /> PIN Baru
              </Label>
              <Input
                id="pin"
                name="pin"
                type="password"
                maxLength={4}
                autoComplete="new-password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="rounded-xl border-primary/20 focus:border-primary focus:ring-primary/20"
                placeholder="Kosongkan jika tidak ingin diubah"
              />
              <p className="text-[10px] text-muted-foreground">PIN harus berupa 4 digit angka.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newEmail" className="flex items-center gap-2">
                <Mail size={16} className="text-primary" /> Email untuk Notifikasi
              </Label>
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/10 space-y-3">
                {user?.email && user?.emailVerified ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="text-green-500" size={16} />
                      <span className="text-sm font-medium">{user.email}</span>
                    </div>
                    <span className="text-xs bg-green-500/20 text-green-700 px-2 py-1 rounded">Terverifikasi</span>
                  </div>
                ) : user?.email ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="text-yellow-500" size={16} />
                      <span className="text-sm">{user.email}</span>
                    </div>
                    <span className="text-xs bg-yellow-500/20 text-yellow-700 px-2 py-1 rounded">Menunggu verifikasi</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Belum ada email</p>
                )}
              </div>

              {showVerificationInput ? (
                <div className="space-y-2">
                  <label htmlFor="verificationCode" className="text-sm text-muted-foreground">Masukkan kode verifikasi dari email</label>
                  <div className="flex gap-2">
                    <Input
                      id="verificationCode"
                      name="verificationCode"
                      type="text"
                      autoComplete="off"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      className="rounded-xl border-primary/20 focus:border-primary focus:ring-primary/20"
                      placeholder="Kode verifikasi"
                    />
                    <Button
                      type="button"
                      onClick={() => user?.id && verifyEmailMutation.mutate(verificationCode)}
                      disabled={verifyEmailMutation.isPending || !verificationCode || !user?.id}
                      className="rounded-xl px-6"
                    >
                      {verifyEmailMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Verifikasi"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    id="newEmail"
                    name="newEmail"
                    type="email"
                    autoComplete="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="rounded-xl border-primary/20 focus:border-primary focus:ring-primary/20"
                    placeholder="Masukkan email baru"
                  />
                  <Button
                    type="button"
                    onClick={() => user?.id && updateEmailMutation.mutate(newEmail)}
                    disabled={updateEmailMutation.isPending || !newEmail || !user?.id}
                    className="rounded-xl px-6"
                  >
                    {updateEmailMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Daftarkan"
                    )}
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Jenis Kelamin</Label>
              <Select value={gender} onValueChange={setGender} name="gender">
                <SelectTrigger id="gender" className="rounded-xl border-primary/20 focus:border-primary focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">👦🏻 Laki-laki</SelectItem>
                  <SelectItem value="female">👧🏻 Perempuan</SelectItem>
                  <SelectItem value="other">🤷 Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="w-full rounded-2xl py-6 font-bold text-lg shadow-lg shadow-primary/20 mt-4"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Perubahan"
              )}
            </Button>

            <Button
              type="button"
              onClick={toggleTheme}
              variant="outline"
              className="w-full rounded-2xl py-6 font-bold text-lg border-border hover:bg-muted transition-all"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="mr-2 h-5 w-5" />
                  Ganti ke Mode Terang
                </>
              ) : (
                <>
                  <Moon className="mr-2 h-5 w-5" />
                  Ganti ke Mode Gelap
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <NotificationSettings />
    </div>
  );
}
