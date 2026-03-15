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


export default function Profile() {
  const { user, login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(user?.username || "");
  const [pin, setPin] = useState("");
  const [baseAvatarUrl, setBaseAvatarUrl] = useState(user?.avatarUrl || "");
  const [displayAvatarUrl, setDisplayAvatarUrl] = useState(user?.avatarUrl ? `${user.avatarUrl}?t=${Date.now()}` : "");
  const [gender, setGender] = useState((user?.gender as any) || "other");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerificationInput, setShowVerificationInput] = useState(false);

  // Detect component mount - run ONCE on every mount
  useEffect(() => {
    console.log('[Profile] Component mounted successfully, user:', user);
    return () => console.log('[Profile] Component unmounting');
  }, []);

  // Sync state when user changes - IMPORTANT for consistency after refresh/HMR
  useEffect(() => {
    if (user?.id && user?.username) {
      console.log('[Profile] Syncing user state:', { id: user.id, username: user.username });
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
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Kode verifikasi tidak valid atau sudah kadaluarsa");
      }
      return res.json();
    },
    onSuccess: (updatedUser) => {
      console.log('[Profile] verifyEmailMutation onSuccess, updatedUser:', updatedUser);
      console.log('[Profile] updatedUser fields:', updatedUser ? Object.keys(updatedUser) : 'null');
      
      // Ensure updatedUser has required fields before login
      if (updatedUser?.id && updatedUser?.username) {
        console.log('[Profile] Calling login with valid user:', { id: updatedUser.id, username: updatedUser.username });
        login(updatedUser);
        setShowVerificationInput(false);
        setVerificationCode("");
        queryClient.invalidateQueries({ queryKey: [api.activeCards.list.path] });
        toast({ 
          title: "Berhasil", 
          description: "Email berhasil diverifikasi!" 
        });
      } else {
        throw new Error(`Data user tidak lengkap dari server: id=${updatedUser?.id}, username=${updatedUser?.username}`);
      }
    },
    onError: (error: any) => {
      console.error('[Profile] verifyEmailMutation error:', error);
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
        <h2 className="text-3xl font-black text-foreground">🎀 Profil Saya</h2>
        <p className="text-muted-foreground text-sm font-medium mt-1">Memuat data profil...</p>
      </div>
    </div>
  ) : (
    <div className="pb-10 space-y-6">
      <div className="px-2">
        <h2 className="text-3xl font-black text-foreground">🎀 Profil Saya</h2>
        <p className="text-muted-foreground text-sm font-medium mt-1">
          Atur tampilan, keamanan, dan semua tentang dirimu
        </p>
      </div>

      {/* Avatar Section */}
      <Card className="border-none shadow-2xl bg-gradient-to-br from-pink-50 to-pink-100/50 dark:bg-gradient-to-br dark:from-purple-900/80 dark:via-purple-800/80 dark:to-pink-900/80 backdrop-blur-md rounded-3xl overflow-hidden dark:border dark:border-pink-400/30">
        <CardHeader className="pb-4 pt-6">
          <div className="flex flex-col items-center gap-5">
            <div 
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              title="Klik untuk mengubah foto profil"
            >
              <Avatar className="w-28 h-28 border-4 border-white dark:border-pink-300/50 shadow-2xl hover:shadow-pink-500/30 transition-all duration-300 ring-4 ring-pink-200/50 dark:ring-pink-500/30">
                <AvatarImage src={displayAvatarUrl} />
                <AvatarFallback className="bg-gradient-to-br from-pink-400 to-pink-600 text-white text-4xl font-bold">
                  {(user?.username && String(user.username).charAt(0).toUpperCase()) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm">
                {isUploadingAvatar ? (
                  <Loader2 className="text-white w-8 h-8 animate-spin" />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Camera className="text-white w-7 h-7" />
                    <span className="text-white text-xs font-bold">UBAH</span>
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-pink-500 dark:bg-pink-400 rounded-full p-2 shadow-lg border-2 border-white dark:border-purple-900">
                <Camera className="w-5 h-5 text-white" />
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
              <CardTitle className="text-2xl font-black text-foreground">{user?.username || "Loading..."}</CardTitle>
              <CardDescription className="text-xs font-semibold text-muted-foreground mt-1">ID Pengguna: #{user?.id || "..."}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3 pb-2 border-b border-pink-200/50 dark:border-pink-400/20">
              <Label htmlFor="username" className="flex items-center gap-2 font-bold text-foreground">
                <div className="bg-pink-200 dark:bg-pink-500/20 p-2 rounded-lg">
                  <UserIcon size={18} className="text-pink-600 dark:text-pink-300" />
                </div>
                Nama Panggilan
              </Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="rounded-2xl border-pink-200/50 dark:border-pink-400/30 focus:border-pink-500 focus:ring-pink-500/20 shadow-sm"
                placeholder="Masukkan nama baru"
              />
            </div>

            <div className="space-y-3 pb-2 border-b border-pink-200/50 dark:border-pink-400/20">
              <Label className="flex items-center gap-2 font-bold text-foreground">
                <div className="bg-pink-200 dark:bg-pink-500/20 p-2 rounded-lg">
                  <Camera size={18} className="text-pink-600 dark:text-pink-300" />
                </div>
                Foto Profil
              </Label>
              <div className="text-sm text-muted-foreground bg-pink-100/50 dark:bg-pink-500/10 rounded-xl p-4 border border-pink-200/50 dark:border-pink-400/30 font-medium">
                📸 Klik foto profil di atas untuk mengubah foto dari galeri
              </div>
            </div>

            <div className="space-y-3 pb-2 border-b border-pink-200/50 dark:border-pink-400/20">
              <Label htmlFor="pin" className="flex items-center gap-2 font-bold text-foreground">
                <div className="bg-pink-200 dark:bg-pink-500/20 p-2 rounded-lg">
                  <Lock size={18} className="text-pink-600 dark:text-pink-300" />
                </div>
                PIN Keamanan
              </Label>
              <Input
                id="pin"
                name="pin"
                type="password"
                maxLength={4}
                autoComplete="new-password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="rounded-2xl border-pink-200/50 dark:border-pink-400/30 focus:border-pink-500 focus:ring-pink-500/20 shadow-sm tracking-widest"
                placeholder="• • • •"
              />
              <p className="text-xs text-muted-foreground font-medium">🔐 PIN 4 digit angka • Kosongkan jika tidak ingin diubah</p>
            </div>

            <div className="space-y-3 pb-2 border-b border-pink-200/50 dark:border-pink-400/20">
              <Label htmlFor="gender" className="flex items-center gap-2 font-bold text-foreground">
                <div className="bg-pink-200 dark:bg-pink-500/20 p-2 rounded-lg">
                  <UserIcon size={18} className="text-pink-600 dark:text-pink-300" />
                </div>
                Jenis Kelamin
              </Label>
              <Select value={gender} onValueChange={setGender} name="gender">
                <SelectTrigger id="gender" className="rounded-2xl border-pink-200/50 dark:border-pink-400/30 focus:border-pink-500 focus:ring-pink-500/20 shadow-sm font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="male" className="font-medium">👦🏻 Laki-laki</SelectItem>
                  <SelectItem value="female" className="font-medium">👧🏻 Perempuan</SelectItem>
                  <SelectItem value="other" className="font-medium">🤷 Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Email Section */}
            <div className="space-y-3 pb-4 pt-2 border-b border-pink-200/50 dark:border-pink-400/20">
              <Label htmlFor="newEmail" className="flex items-center gap-2 font-bold text-foreground">
                <div className="bg-pink-200 dark:bg-pink-500/20 p-2 rounded-lg">
                  <Mail size={18} className="text-pink-600 dark:text-pink-300" />
                </div>
                Email untuk Notifikasi
              </Label>
              <div className="bg-pink-100/50 dark:bg-pink-500/10 rounded-xl p-4 border border-pink-200/50 dark:border-pink-400/30 space-y-3">
                {user?.email && user?.emailVerified ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-500/20 p-2 rounded-lg">
                        <CheckCircle className="text-green-600 dark:text-green-400" size={18} />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground block">{user.email}</span>
                        <span className="text-xs text-muted-foreground">Email terverifikasi</span>
                      </div>
                    </div>
                    <span className="text-xs bg-green-500/20 text-green-700 dark:text-green-400 px-3 py-1 rounded-lg font-bold">✓ Aktif</span>
                  </div>
                ) : user?.email ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-yellow-500/20 p-2 rounded-lg">
                        <RefreshCw className="text-yellow-600 dark:text-yellow-400" size={18} />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-foreground block">{user.email}</span>
                        <span className="text-xs text-muted-foreground">Menunggu verifikasi</span>
                      </div>
                    </div>
                    <span className="text-xs bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 px-3 py-1 rounded-lg font-bold">⏳ Pending</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground font-medium">🔔 Belum ada email • Tambahkan email untuk notifikasi</p>
                )}
              </div>

              {showVerificationInput ? (
                <div className="space-y-2 pt-3">
                  <label htmlFor="verificationCode" className="text-sm font-bold text-foreground block">Masukkan Kode Verifikasi</label>
                  <div className="flex gap-2">
                    <Input
                      id="verificationCode"
                      name="verificationCode"
                      type="text"
                      autoComplete="off"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      className="rounded-2xl border-pink-200/50 dark:border-pink-400/30 focus:border-pink-500 focus:ring-pink-500/20 shadow-sm"
                      placeholder="Masukan 6 karakter dari email"
                    />
                    <Button
                      type="button"
                      onClick={() => user?.id && verifyEmailMutation.mutate(verificationCode)}
                      disabled={verifyEmailMutation.isPending || !verificationCode || !user?.id}
                      className="rounded-2xl px-6 font-bold bg-green-600 hover:bg-green-700"
                    >
                      {verifyEmailMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "✓ Verifikasi"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 pt-3">
                  <Input
                    id="newEmail"
                    name="newEmail"
                    type="email"
                    autoComplete="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="rounded-2xl border-pink-200/50 dark:border-pink-400/30 focus:border-pink-500 focus:ring-pink-500/20 shadow-sm"
                    placeholder="nama@example.com"
                  />
                  <Button
                    type="button"
                    onClick={() => user?.id && updateEmailMutation.mutate(newEmail)}
                    disabled={updateEmailMutation.isPending || !newEmail || !user?.id}
                    className="rounded-2xl px-6 font-bold bg-blue-600 hover:bg-blue-700"
                  >
                    {updateEmailMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "📧 Daftarkan"
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4">
              <Button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="w-full rounded-2xl py-6 font-bold text-lg shadow-lg shadow-pink-500/20 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white transition-all"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    💾 Simpan Perubahan
                  </>
                )}
              </Button>

              <Button
                type="button"
                onClick={toggleTheme}
                variant="outline"
                className="w-full rounded-2xl py-6 font-bold text-lg border-pink-200 dark:border-pink-400/30 hover:bg-pink-50 dark:hover:bg-pink-500/10 transition-all"
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
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
