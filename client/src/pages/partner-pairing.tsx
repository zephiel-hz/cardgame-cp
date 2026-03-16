import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Heart, Users, Copy, Check, Search, User as UserIcon, Inbox, Trash2, AlertCircle, ChevronDown } from "lucide-react";
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

interface RemovalRequest {
  id: number;
  initiatorId: number;
  partnerId: number;
  initiatorAccepted: boolean;
  partnerAccepted: boolean | null;
  reason: string | null;
  rejectionReason: string | null;
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
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [removalRequests, setRemovalRequests] = useState<RemovalRequest[]>([]);
  const [removalReason, setRemovalReason] = useState("");
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);
  const [pendingRejectionRequestId, setPendingRejectionRequestId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showForceDeleteDialog, setShowForceDeleteDialog] = useState(false);
  const [pendingForceDeleteRequestId, setPendingForceDeleteRequestId] = useState<number | null>(null);
  const [showDangerZone, setShowDangerZone] = useState(false);

  // Function to refetch removal requests
  const refetchRemovalRequests = async () => {
    if (!user) return;
    try {
      const url = api.auth.getPendingRemovals.path.replace(":userId", String(user.id));
      console.log("🔄 Refetching removal requests from:", url);
      
      const removalRes = await fetch(url);
      if (removalRes.ok) {
        const removals = await removalRes.json();
        console.log("🔄 Refetched removal requests:", JSON.stringify(removals, null, 2));
        setRemovalRequests(removals);
      } else {
        console.error("🔄 Error response:", removalRes.status, await removalRes.text());
      }
    } catch (error) {
      console.error("Failed to refetch removal requests:", error);
    }
  };

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

        // Get pending removal requests
        const removalRes = await fetch(
          api.auth.getPendingRemovals.path.replace(":userId", String(user.id))
        );
        if (removalRes.ok) {
          const removals = await removalRes.json();
          setRemovalRequests(removals);
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

  const handleInitiateRemoval = async () => {
    if (!user) return;
    
    // Validate reason
    if (!removalReason.trim()) {
      toast({
        variant: "destructive",
        title: "❌ Alasan Wajib Diisi",
        description: "Jelaskan alasan Anda ingin menghapus partnership sebelum mengirim permintaan.",
      });
      return;
    }

    setIsLoading(true);
    try {
      const payload = { userId: user.id, reason: removalReason.trim() };
      console.log("📤 Sending removal request with payload:", JSON.stringify(payload, null, 2));
      console.log("✅ Reason value:", payload.reason, "Type:", typeof payload.reason);
      
      const res = await fetch(api.auth.initiateRemoval.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast({
          title: "📨 Permintaan Terkirim",
          description: "Permintaan penghapusan partnership telah dikirim ke partner Anda. Tunggu konfirmasi mereka.",
        });
        setShowRemoveDialog(false);
        setRemovalReason("");
        // Refetch to sync state
        await refetchRemovalRequests();
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

  const handleRespondRemovalRequest = async (requestId: number, accept: boolean, rejectionReasonText?: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch(api.auth.respondToRemoval.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          requestId, 
          accept, 
          userId: user.id,
          rejectionReason: rejectionReasonText
        }),
      });

      if (res.ok) {
        toast({
          title: accept ? "✨ Partnership Dihapus" : "❌ Permintaan Ditolak",
          description: accept 
            ? "Partnership telah dihapus. Anda sekarang bebas mencari partner lain." 
            : "Permintaan penghapusan partnership ditolak dengan alasan.",
        });
        setRemovalRequests(removalRequests.filter(r => r.id !== requestId));
        
        if (accept) {
          // Refresh partner info
          setExistingPartner(null);
        }
        
        // Refetch to ensure state sync
        await refetchRemovalRequests();
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

  const handleInitiateRejection = (requestId: number) => {
    setPendingRejectionRequestId(requestId);
    setRejectionReason("");
    setShowRejectionDialog(true);
  };

  const handleConfirmRejection = async () => {
    if (!rejectionReason.trim()) {
      toast({
        variant: "destructive",
        title: "❌ Alasan Wajib Diisi",
        description: "Jelaskan alasan Anda menolak penghapusan partnership.",
      });
      return;
    }

    if (pendingRejectionRequestId) {
      setShowRejectionDialog(false);
      await handleRespondRemovalRequest(pendingRejectionRequestId, false, rejectionReason);
      setPendingRejectionRequestId(null);
      setRejectionReason("");
    }
  };

  const handleForceDeletePartnership = async (requestId: number) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(api.auth.forceDeletePartnership.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, userId: user.id }),
      });

      if (res.ok) {
        toast({
          title: "🚨 Partnership Dihapus",
          description: "Partnership telah dihapus tanpa persetujuan partner.",
        });
        setRemovalRequests(removalRequests.filter(r => r.id !== requestId));
        setExistingPartner(null);
        setShowForceDeleteDialog(false);
        setPendingForceDeleteRequestId(null);
        // Refetch to ensure state sync
        await refetchRemovalRequests();
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

        {/* Existing Removal Requests */}
        {removalRequests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 bg-white dark:bg-gray-900 p-4 rounded-2xl border-2 border-red-200 dark:border-red-900/30 mx-2 mb-6"
          >
            <h4 className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={18} /> Permintaan Penghapusan Partnership
            </h4>

            {removalRequests.map((request) => {
              const isInitiator = user?.id === request.initiatorId;
              const isRejected = request.status === 'rejected';
              const isCompleted = request.status === 'completed' || request.status === 'force_deleted';
              
              console.log("🔍 Rendering request:", {
                id: request.id,
                initiatorId: request.initiatorId,
                partnerId: request.partnerId,
                status: request.status,
                rejectionReason: request.rejectionReason,
                isInitiator,
                isRejected,
                currentUserId: user?.id
              });
              
              if (isInitiator) {
                // Show for the user who initiated the removal request
                if (isRejected) {
                  // Rejection - show rejection reason and force delete button
                  return (
                    <div key={request.id} className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl space-y-3">
                      <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                        ❌ Permintaan Ditolak
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Partner Anda menolak permintaan penghapusan partnership.
                      </p>
                      
                      {request.rejectionReason && (
                        <div className="bg-red-100 dark:bg-red-900/40 p-3 rounded-lg border-l-4 border-red-500">
                          <p className="text-xs font-semibold text-red-900 dark:text-red-200 mb-1">
                            💬 Alasan Penolakan:
                          </p>
                          <p className="text-sm text-red-800 dark:text-red-300 italic whitespace-pre-wrap">
                            "{request.rejectionReason}"
                          </p>
                        </div>
                      )}
                      
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                        <p className="font-semibold mb-2">⚠️ Opsi Anda:</p>
                        <p className="text-xs">Jika Anda tidak puas dengan alasan penolakan ini, Anda dapat menghapus partnership tanpa persetujuan.</p>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setRemovalRequests(removalRequests.filter(r => r.id !== request.id))}
                          variant="outline"
                          className="flex-1 rounded-lg"
                        >
                          💭 Terima Penolakan
                        </Button>
                        <Button
                          onClick={() => {
                            setPendingForceDeleteRequestId(request.id);
                            setShowForceDeleteDialog(true);
                          }}
                          disabled={isLoading}
                          className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 text-white"
                        >
                          🚨 Hapus Paksa
                        </Button>
                      </div>
                    </div>
                  );
                } else {
                  // Pending - waiting for partner response
                  return (
                    <div key={request.id} className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl space-y-3">
                      <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                        ⏳ Menunggu Konfirmasi Partner
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Permintaan penghapusan partnership sedang menunggu respons dari partner.
                      </p>
                      
                      {request.reason && (
                        <div className="bg-blue-100 dark:bg-blue-900/40 p-3 rounded-lg border-l-4 border-blue-500">
                          <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">
                            💬 Alasan Anda:
                          </p>
                          <p className="text-sm text-blue-800 dark:text-blue-300 italic whitespace-pre-wrap">
                            "{request.reason}"
                          </p>
                        </div>
                      )}
                    </div>
                  );
                }
              } else if (!isRejected && !isCompleted) {
                // Show for the partner receiving the removal request (only if still pending)
                return (
                  <div key={request.id} className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl space-y-3">
                    <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                      ⚠️ Partner Anda meminta untuk menghapus partnership
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {existingPartner?.username} ingin mengakhiri partnership. Apakah Anda setuju?
                    </p>
                    
                    {request.reason && (
                      <div className="bg-red-100 dark:bg-red-900/40 p-3 rounded-lg border-l-4 border-red-500">
                        <p className="text-xs font-semibold text-red-900 dark:text-red-200 mb-1">
                          💬 Alasan yang diberikan:
                        </p>
                        <p className="text-sm text-red-800 dark:text-red-300 italic whitespace-pre-wrap">
                          "{request.reason}"
                        </p>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleInitiateRejection(request.id)}
                        disabled={isLoading}
                        variant="outline"
                        className="flex-1 rounded-lg"
                      >
                        ❌ Tolak Penghapusan
                      </Button>
                      <Button
                        onClick={() => handleRespondRemovalRequest(request.id, true)}
                        disabled={isLoading}
                        className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 text-white"
                      >
                        ✅ Setuju Hapus
                      </Button>
                    </div>
                  </div>
                );
              }
            })}
          </motion.div>
        )}

        {/* Rejection Reason Dialog */}
        {showRejectionDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowRejectionDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <h3 className="text-xl font-bold text-foreground">
                💬 Alasan Penolakan
              </h3>
              <p className="text-sm text-muted-foreground">
                Jelaskan mengapa Anda menolak penghapusan partnership ini. Alasan ini akan dilihat oleh partner Anda.
              </p>
              
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Contoh: Saya masih ingin melanjutkan partnership karena..."
                className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/50"
                rows={4}
              />
              
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowRejectionDialog(false)}
                  variant="outline"
                  className="flex-1 rounded-lg"
                >
                  Batal
                </Button>
                <Button
                  onClick={handleConfirmRejection}
                  disabled={isLoading || !rejectionReason.trim()}
                  className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Mengirim..." : "Tolak"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showForceDeleteDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowForceDeleteDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border-2 border-red-200 dark:border-red-900/50"
            >
              <h3 className="text-xl font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                🚨 Hapus Partnership Paksa
              </h3>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 space-y-3">
                <p className="text-sm text-red-900 dark:text-red-100">
                  <strong>⚠️ Perhatian:</strong> Anda akan menghapus partnership tanpa persetujuan partner!
                </p>
                <ul className="text-xs text-red-800 dark:text-red-200 space-y-2 ml-4 list-disc">
                  <li>Partnership akan dihapus secara permanen</li>
                  <li>Partner tidak dapat membatalkan keputusan ini</li>
                  <li>Semua data partnership akan hilang</li>
                </ul>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Apakah Anda yakin ingin melanjutkan?
              </p>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowForceDeleteDialog(false)}
                  variant="outline"
                  className="flex-1 rounded-lg"
                >
                  Batal
                </Button>
                <Button
                  onClick={() => {
                    if (pendingForceDeleteRequestId !== null) {
                      handleForceDeletePartnership(pendingForceDeleteRequestId);
                    }
                  }}
                  disabled={isLoading || pendingForceDeleteRequestId === null}
                  className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Menghapus..." : "Hapus Paksa"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="bg-white dark:bg-gray-900 backdrop-blur-md p-8 rounded-3xl shadow-2xl dark:border dark:border-gray-800 space-y-6 mx-2"
        >
          <div className="flex flex-col items-center gap-4">
            <Avatar className="w-32 h-32 border-4 border-pink-200 dark:border-pink-600/30 shadow-xl">
              <AvatarImage src={existingPartner.avatarUrl || undefined} />
              <AvatarFallback className="bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 text-4xl font-bold">
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

            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  📊 Jumlah Kartu
                </p>
                <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                  {existingPartner.cardCount}
                </p>
              </div>
              <div className="bg-pink-50 dark:bg-pink-900/15 rounded-2xl p-4">
                <p className="text-xs font-semibold text-pink-900 dark:text-pink-200 mb-2">
                  ✨ Status
                </p>
                <p className="text-sm font-bold text-pink-600 dark:text-pink-400">
                  Berpasangan
                </p>
              </div>
            </div>

            <div className="bg-pink-50 dark:bg-pink-900/20 p-4 rounded-xl w-full">
              <p className="text-xs text-pink-800 dark:text-pink-200 text-center">
                ❤️ Kalian sudah berpasangan. Nikmati pengalaman bermain bersama!
              </p>
            </div>

            {/* Danger Zone - Collapsible */}
            <div className="border-2 border-red-200 dark:border-red-900/30 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowDangerZone(!showDangerZone)}
                className="w-full px-4 py-3 flex items-center justify-between bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
              >
                <span className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                  ⚠️ Zona Berbahaya
                </span>
                <ChevronDown
                  size={20}
                  className={`text-red-600 dark:text-red-400 transition-transform ${
                    showDangerZone ? 'rotate-180' : ''
                  }`}
                />
              </button>
              
              {showDangerZone && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 py-4 bg-red-50/50 dark:bg-red-900/5 space-y-3 border-t border-red-200 dark:border-red-900/30"
                >
                  <p className="text-xs text-red-700 dark:text-red-300">
                    Tindakan di sini tidak dapat dibatalkan. Gunakan dengan hati-hati!
                  </p>
                  <Button
                    onClick={() => setShowRemoveDialog(true)}
                    className="w-full h-10 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold"
                  >
                    <Trash2 size={16} className="mr-2" /> Hapus Partnership
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Remove Partnership Confirmation Dialog */}
        {showRemoveDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowRemoveDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white dark:bg-background rounded-2xl p-6 max-w-sm mx-auto\shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="inline-block p-3 bg-red-100 dark:bg-red-900/30 rounded-2xl mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  Hapus Partnership?
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Anda akan mengirim permintaan penghapusan partnership ke <strong>{existingPartner.username}</strong>. Partner harus menyetujui terlebih dahulu sebelum partnership dihapus.
                </p>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                  ⚠️ Proses ini memerlukan persetujuan dari kedua pihak agar adil.
                </div>
              </div>
              
              <div className="mb-4">
                <Label htmlFor="removal-reason" className="text-sm font-semibold block mb-2">
                  💬 Alasan Penghapusan <span className="text-red-500">*</span>
                </Label>
                <textarea
                  id="removal-reason"
                  value={removalReason}
                  onChange={(e) => setRemovalReason(e.target.value)}
                  placeholder="Jelaskan alasan Anda ingin menghapus partnership ini..."
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Partner akan melihat alasan ini saat menerima permintaan
                </p>
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowRemoveDialog(false)}
                  variant="outline"
                  className="flex-1 rounded-lg"
                >
                  Batal
                </Button>
                <Button
                  onClick={handleInitiateRemoval}
                  disabled={isLoading || !removalReason.trim()}
                  className="flex-1 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Mengirim..." : "Ya, Hapus"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
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
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <UserIcon size={18} className="text-pink-500" />
            <Label className="text-xs font-semibold text-foreground">
              ID Pengguna Anda
            </Label>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-gray-50 dark:bg-gray-800 px-4 py-3 rounded-xl font-mono font-bold text-lg text-pink-600 dark:text-pink-400 flex items-center border border-gray-200 dark:border-gray-700">
              {user?.id}
            </div>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={handleCopyUserId}
              className="px-4 rounded-xl hover:bg-pink-50 dark:hover:bg-gray-800"
            >
              {copied ? (
                <Check size={20} className="text-green-600" />
              ) : (
                <Copy size={20} />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
            <span>📋</span> <span>Bagikan ID ini ke partner untuk diterima</span>
          </p>
        </motion.div>

        {/* Search User Section */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3 bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Search size={18} className="text-pink-500" />
            <Label htmlFor="partner-id" className="text-xs font-semibold text-foreground">
              Cari Partner
            </Label>
          </div>
          <div className="flex gap-2">
            <Input
              id="partner-id"
              type="number"
              value={partnerUserId}
              onChange={(e) => setPartnerUserId(e.target.value)}
              placeholder="Masukkan ID partner"
              className="h-12 rounded-xl border-gray-200 dark:border-gray-700 focus:border-pink-500 focus:ring-pink-500/20 bg-gray-50 dark:bg-gray-800"
            />
            <Button
              onClick={handleSearchUser}
              disabled={isSearching}
              className="px-6 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 shadow-md shadow-pink-500/30 text-white"
            >
              <Search size={20} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <span>💡</span> <span>Masukkan ID untuk preview profil partner sebelum mengirim permintaan</span>
          </p>
        </motion.div>

        {/* Preview User Section */}
        {previewUser && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 p-5 rounded-2xl border-2 border-pink-200 dark:border-pink-900/30 shadow-lg shadow-pink-500/10"
          >
            <div className="flex gap-4 mb-4">
              <Avatar className="w-20 h-20 shrink-0 border-2 border-pink-200 dark:border-pink-400/30 shadow-md">
                <AvatarImage src={previewUser.avatarUrl || undefined} />
                <AvatarFallback className="bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 font-bold text-lg">
                  {previewUser.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 flex flex-col justify-center">
                <h4 className="font-bold text-lg text-foreground">{previewUser.username}</h4>
                <p className="text-sm text-muted-foreground">
                  {previewUser.gender === 'male' ? '👦🏻 Laki-laki' : 
                   previewUser.gender === 'female' ? '👧🏻 Perempuan' : 
                   '🤷 Lainnya'} • ID: {previewUser.id}
                </p>
                <div className="mt-2 inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg w-fit">
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">📊 {previewUser.cardCount} kartu</span>
                </div>
              </div>
            </div>

            <Button
              onClick={handleSendPartnershipRequest}
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-semibold shadow-md shadow-pink-500/30"
            >
              {isLoading ? "⏳ Mengirim..." : "✨ Kirim Permintaan Partnership"}
            </Button>
          </motion.div>
        )}

        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3 bg-white dark:bg-gray-900 p-5 rounded-2xl border-2 border-pink-200 dark:border-pink-900/30 shadow-sm"
          >
            <h4 className="font-semibold text-pink-600 dark:text-pink-400 flex items-center gap-2">
              <Inbox size={20} /> Permintaan Masuk ({pendingRequests.length})
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

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-pink-50 dark:bg-gray-900 p-4 rounded-2xl border border-pink-200 dark:border-pink-900/30"
        >
          <p className="text-sm text-pink-900 dark:text-pink-300 flex items-start gap-2">
            <span className="text-base flex-shrink-0">💡</span>
            <span>
              <strong>Petunjuk:</strong> Bagikan ID Anda ke partner untuk diterima. Partner harus menerima permintaan Anda sebelum partnership resmi.
            </span>
          </p>
        </motion.div>
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
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white dark:bg-gray-900 p-4 rounded-xl flex items-center justify-between gap-3 border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-3 flex-1">
        <Avatar className="w-12 h-12 shrink-0 border-2 border-pink-200 dark:border-pink-600/30">
          <AvatarImage src={userInfo.avatarUrl || undefined} />
          <AvatarFallback className="bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 font-bold">
            {userInfo.username.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold text-foreground">{userInfo.username}</p>
          <p className="text-xs text-muted-foreground">📨 Ingin menjadi partner Anda</p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          onClick={() => onRespond(request.id, false)}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20"
        >
          Tolak
        </Button>
        <Button
          onClick={() => onRespond(request.id, true)}
          disabled={isLoading}
          size="sm"
          className="rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold shadow-md shadow-green-500/30"
        >
          ✅ Terima
        </Button>
      </div>
    </motion.div>
  );
}
