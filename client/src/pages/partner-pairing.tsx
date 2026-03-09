import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Heart, Users, Copy, Check, Search, User as UserIcon, Inbox } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { User } from "@shared/schema";

interface UserInfo {
  id: number;
  username: string;
  avatarUrl: string | null;
  gender: string | null;
  cardCount: number;
}

interface PendingRequest {
  id: number;
  fromUserId: number;
  toUserId: number;
  status: string;
  createdAt: Date | null;
}

export default function PartnerPairing() {
  const [, setLocation] = useLocation();
  const { user, login } = useAuth();
  const { toast } = useToast();
  
  const [partnerUserId, setPartnerUserId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [existingPartner, setExistingPartner] = useState<UserInfo | null>(null);
  const [isCheckingPartner, setIsCheckingPartner] = useState(true);
  const [previewUser, setPreviewUser] = useState<UserInfo | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Check if user already has a partner and get pending requests
  useEffect(() => {
    if (!user) return;
    
    const checkPartner = async () => {
      try {
        const partnerRes = await fetch(api.auth.getPartner.path.replace(":userId", String(user.id)));
        if (partnerRes.ok) {
          const partner = await partnerRes.json();
          if (partner) {
            const partnerInfo = await fetch(
              api.auth.getUserInfo.path.replace(":id", String(partner.id))
            ).then(r => r.json());
            setExistingPartner(partnerInfo);
          }
        }

        // Get pending requests
        const requestsRes = await fetch(
          api.auth.getPendingRequests.path.replace(":userId", String(user.id))
        );
        if (requestsRes.ok) {
          const requests = await requestsRes.json();
          setPendingRequests(requests);
        }
      } catch (error) {
        console.error("Failed to check partner:", error);
      } finally {
        setIsCheckingPartner(false);
      }
    };

    checkPartner();
  }, [user]);

  const handleCopyUserId = () => {
    if (user) {
      navigator.clipboard.writeText(String(user.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSearchUser = async () => {
    if (!partnerUserId.trim()) {
      toast({
        title: "Error",
        description: "Masukkan ID partner",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(
        api.auth.getUserInfo.path.replace(":id", partnerUserId)
      );
      if (res.ok) {
        const userInfo = await res.json();
        if (userInfo) {
          setPreviewUser(userInfo);
        } else {
          toast({
            title: "User tidak ditemukan",
            description: "ID user tidak valid",
            variant: "destructive",
          });
          setPreviewUser(null);
        }
      } else {
        toast({
          title: "User tidak ditemukan",
          description: "ID user tidak valid",
          variant: "destructive",
        });
        setPreviewUser(null);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message || "Error mencari user",
      });
      setPreviewUser(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendPartnershipRequest = async () => {
    if (!previewUser || !user) return;

    setIsLoading(true);
    try {
      const res = await fetch(api.auth.sendPartnershipRequest.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          partnerId: previewUser.id,
        }),
      });

      if (res.ok) {
        toast({
          title: "✨ Permintaan Terkirim!",
          description: `Permintaan partnership ke ${previewUser.username} telah terkirim. Tunggu konfirmasi mereka.`,
        });
        setPartnerUserId("");
        setPreviewUser(null);
      } else {
        const error = await res.json();
        toast({
          variant: "destructive",
          title: "Gagal",
          description: error.message || "Gagal mengirim permintaan",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRespondRequest = async (requestId: number, accept: boolean) => {
    setIsLoading(true);
    try {
      const res = await fetch(api.auth.respondToPartnershipRequest.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, accept }),
      });

      if (res.ok) {
        toast({
          title: accept ? "✨ Diterima!" : "Ditolak",
          description: accept 
            ? "Partnership berhasil dikonfirmasi!" 
            : "Partnership request ditolak",
        });
        setPendingRequests(pendingRequests.filter(r => r.id !== requestId));
        
        if (accept) {
          // Refresh partner info
          const partnerRes = await fetch(
            api.auth.getPartner.path.replace(":userId", String(user?.id))
          );
          if (partnerRes.ok) {
            const partner = await partnerRes.json();
            const partnerInfo = await fetch(
              api.auth.getUserInfo.path.replace(":id", String(partner.id))
            ).then(r => r.json());
            setExistingPartner(partnerInfo);
          }
        }
      } else {
        const error = await res.json();
        toast({
          variant: "destructive",
          title: "Gagal",
          description: error.message,
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingPartner) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <div className="text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-block"
          >
            <Heart className="w-12 h-12 text-pink-500 fill-pink-500" />
          </motion.div>
          <p className="mt-4 text-muted-foreground">Memeriksa partner...</p>
        </div>
      </div>
    );
  }

  // Show existing partner profile
  if (existingPartner) {
    return (
      <div className="pb-10">
        <div className="mb-6 px-2">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Heart size={28} className="text-pink-500 fill-pink-500" /> Partner Anda
          </h2>
          <p className="text-muted-foreground text-sm font-medium mt-1">
            Informasi profil partner yang berpasangan dengan Anda 💕
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="bg-white dark:bg-gradient-to-br dark:from-purple-900/95 dark:to-purple-800/95 backdrop-blur-md p-8 rounded-3xl shadow-2xl dark:border dark:border-pink-400/20 space-y-6 mx-2"
        >
          <div className="flex flex-col items-center gap-4">
            <Avatar className="w-32 h-32 border-4 border-pink-500/20 shadow-xl">
              <AvatarImage src={existingPartner.avatarUrl || undefined} />
              <AvatarFallback className="bg-pink-500/10 text-pink-500 text-4xl font-bold">
                {existingPartner.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="text-center">
              <h3 className="text-2xl font-bold text-foreground">
                {existingPartner.username}
              </h3>
              <p className="text-muted-foreground text-sm mt-1">
                {existingPartner.gender === 'male' ? '👦🏻 Laki-laki' : 
                 existingPartner.gender === 'female' ? '👧🏻 Perempuan' : 
                 '🤷 Lainnya'}
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 w-full">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-2">
                📊 Jumlah Kartu
              </p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {existingPartner.cardCount}
              </p>
            </div>

            <div className="bg-pink-50 dark:bg-pink-900/20 p-3 rounded-lg w-full">
              <p className="text-xs text-pink-800 dark:text-pink-200 text-center">
                ❤️ Kalian sudah berpasangan. Nikmati pengalaman bermain bersama!
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <div className="mb-6 px-2">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Heart size={28} className="text-pink-500 fill-pink-500" /> Pasang Partner
        </h2>
        <p className="text-muted-foreground text-sm font-medium mt-1">
          Pasangkan dengan partner Anda untuk berbagi notifikasi 💕
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, type: "spring" }}
        className="space-y-4 px-2"
      >
        {/* Your ID Section */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 p-4 rounded-xl">
          <Label className="text-xs font-semibold text-blue-900 dark:text-blue-200 block mb-2">
            ID Pengguna Anda
          </Label>
          <div className="flex gap-2">
            <div className="flex-1 bg-white dark:bg-background px-3 py-2 rounded-lg font-mono font-bold text-blue-600 dark:text-blue-400">
              {user?.id}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleCopyUserId}
              className="px-3"
            >
              {copied ? (
                <Check size={18} className="text-green-600" />
              ) : (
                <Copy size={18} />
              )}
            </Button>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
            📋 Bagikan ID ini ke partner Anda
          </p>
        </div>

        {/* Search User Section */}
        <div className="space-y-3">
          <Label htmlFor="partner-id" className="text-xs font-semibold">
            Cari Partner
          </Label>
          <div className="flex gap-2">
            <Input
              id="partner-id"
              type="number"
              value={partnerUserId}
              onChange={(e) => setPartnerUserId(e.target.value)}
              placeholder="Masukkan ID partner"
              className="h-12 rounded-xl border-primary/20 focus:border-primary focus:ring-primary/20"
            />
            <Button
              onClick={handleSearchUser}
              disabled={isSearching}
              className="px-6 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              <Search size={18} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            🔍 Masukkan ID untuk preview profil partner sebelum mengirim permintaan
          </p>
        </div>

        {/* Preview User Section */}
        {previewUser && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gradient-to-br dark:from-purple-900/50 dark:to-purple-800/50 p-4 rounded-xl border-2 border-pink-300 dark:border-pink-400/30"
          >
            <div className="flex gap-4 items-start">
              <Avatar className="w-16 h-16 shrink-0">
                <AvatarImage src={previewUser.avatarUrl || undefined} />
                <AvatarFallback className="bg-pink-500/10 text-pink-500 font-bold">
                  {previewUser.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <h4 className="font-bold text-foreground">{previewUser.username}</h4>
                <p className="text-xs text-muted-foreground">
                  {previewUser.gender === 'male' ? '👦🏻' : 
                   previewUser.gender === 'female' ? '👧🏻' : 
                   '🤷'} ID: {previewUser.id}
                </p>
                <p className="text-sm mt-1 text-blue-600 dark:text-blue-400">
                  📊 {previewUser.cardCount} kartu
                </p>
              </div>
            </div>

            <Button
              onClick={handleSendPartnershipRequest}
              disabled={isLoading}
              className="w-full mt-4 h-11 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-semibold shadow-md shadow-pink-500/30"
            >
              {isLoading ? "Mengirim..." : "✨ Kirim Permintaan Partnership"}
            </Button>
          </motion.div>
        )}

        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-200 dark:border-yellow-900/30"
          >
            <h4 className="font-semibold text-yellow-900 dark:text-yellow-200 flex items-center gap-2">
              <Inbox size={18} /> Permintaan Masuk ({pendingRequests.length})
            </h4>

            {pendingRequests.map((request) => (
              <PendingRequestItem
                key={request.id}
                request={request}
                onRespond={handleRespondRequest}
                isLoading={isLoading}
              />
            ))}
          </motion.div>
        )}

        <div className="bg-pink-50 dark:bg-pink-900/20 p-3 rounded-lg">
          <p className="text-xs text-pink-800 dark:text-pink-200">
            💡 <strong>Petunjuk:</strong> Bagikan ID Anda ke partner untuk diterima. Partner yang lain harus menerima permintaan Anda sebelum partnership resmi.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function PendingRequestItem({
  request,
  onRespond,
  isLoading,
}: {
  request: PendingRequest;
  onRespond: (requestId: number, accept: boolean) => void;
  isLoading: boolean;
}) {
  const [userInfo, setUserInfo] = React.useState<UserInfo | null>(null);

  React.useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await fetch(
          api.auth.getUserInfo.path.replace(":id", String(request.fromUserId))
        );
        if (res.ok) {
          setUserInfo(await res.json());
        }
      } catch (error) {
        console.error("Failed to fetch user info:", error);
      }
    };
    fetchUserInfo();
  }, [request.fromUserId]);

  if (!userInfo) return null;

  return (
    <div className="bg-white dark:bg-purple-900/30 p-3 rounded-lg flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-1">
        <Avatar className="w-10 h-10 shrink-0">
          <AvatarImage src={userInfo.avatarUrl || undefined} />
          <AvatarFallback className="bg-pink-500/10 text-pink-500 text-sm font-bold">
            {userInfo.username.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold text-foreground">{userInfo.username}</p>
          <p className="text-xs text-muted-foreground">Ingin menjadi partner Anda</p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          onClick={() => onRespond(request.id, false)}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="rounded-lg"
        >
          Tolak
        </Button>
        <Button
          onClick={() => onRespond(request.id, true)}
          disabled={isLoading}
          size="sm"
          className="rounded-lg bg-green-500 hover:bg-green-600"
        >
          Terima
        </Button>
      </div>
    </div>
  );
}
