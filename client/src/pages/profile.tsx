import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Camera, Lock, User as UserIcon } from "lucide-react";

export default function Profile() {
  const { user, login } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState(user?.username || "");
  const [pin, setPin] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
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
          throw new Error("Gagal mengunggah foto");
        }

        const data = await res.json();
        setAvatarUrl(data.avatarUrl);
        toast({ title: "Berhasil", description: "Foto berhasil diunggah!" });
      };
      reader.readAsDataURL(file);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updates: any = {};
    if (username !== user?.username) updates.username = username;
    if (pin) updates.pin = pin;
    if (avatarUrl !== user?.avatarUrl) updates.avatarUrl = avatarUrl;
    
    if (Object.keys(updates).length > 0) {
      updateProfileMutation.mutate(updates);
    }
  };

  return (
    <div className="pb-10 space-y-6">
      <div className="px-2">
        <h2 className="text-2xl font-bold text-foreground">Kustomisasi Profil</h2>
        <p className="text-muted-foreground text-sm font-medium mt-1">
          Ubah tampilan dan keamanan profilmu
        </p>
      </div>

      <Card className="border-none shadow-xl bg-white/80 backdrop-blur-md rounded-3xl overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex flex-col items-center gap-4">
            <div 
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Avatar className="w-24 h-24 border-4 border-primary/20 shadow-xl">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {user?.username.charAt(0).toUpperCase()}
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
              <CardTitle className="text-xl">{user?.username}</CardTitle>
              <CardDescription>ID Pengguna: #{user?.id}</CardDescription>
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
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="rounded-xl border-primary/20 focus:border-primary focus:ring-primary/20"
                placeholder="Kosongkan jika tidak ingin diubah"
              />
              <p className="text-[10px] text-muted-foreground">PIN harus berupa 4 digit angka.</p>
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
