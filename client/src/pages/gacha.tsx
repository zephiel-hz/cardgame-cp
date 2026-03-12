import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Sparkles, PackageOpen, Clock, Gift, Info } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useGachaStatus, usePullGacha } from "@/hooks/use-gacha";
import { useCountdown } from "@/hooks/use-countdown";
import { CardDisplay } from "@/components/card-display";
import type { UserCardWithDetails } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Gacha() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: status, isLoading: statusLoading } = useGachaStatus(user?.id);
  const pullGacha = usePullGacha();
  const countdown = useCountdown(status?.nextResetTime);
  
  const [pulledCard, setPulledCard] = useState<UserCardWithDetails | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);

  const handlePull = async () => {
    if (!user || pullGacha.isPending) return;
    
    setPulledCard(null);
    setIsFlipping(true);
    
    try {
      const result = await pullGacha.mutateAsync(user.id);
      
      if (result.success && result.card) {
        // Trigger flip animation
        setTimeout(() => {
          setPulledCard(result.card!);
          setIsFlipping(false);
          
          // Confetti for rare+ cards
          if (['Epic', 'Legendary'].includes(result.card!.card.tier)) {
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#FF69B4', '#FFD700', '#87CEEB']
            });
          }
        }, 800);
      } else {
        setIsFlipping(false);
        toast({
          title: "Gagal",
          description: result.message || "Tidak bisa menarik kartu",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      setIsFlipping(false);
      toast({
        title: "Oops!",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const remaining = status?.remainingPulls ?? 0;
  const canPull = remaining > 0 && !pullGacha.isPending;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-160px)] pb-10">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
          Gacha Harian <Sparkles className="text-accent fill-accent" />
        </h2>
        <p className="text-muted-foreground font-medium">
          Dapatkan kartu kejutan untuk pasanganmu!
        </p>
      </div>

      {/* Status Cards */}
      <div className="w-full max-w-md mb-8 px-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Remaining Pulls */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-pink-100 to-pink-50 dark:from-pink-950/50 dark:to-pink-900/30 rounded-xl p-4 border border-pink-300 dark:border-pink-400/30"
          >
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-5 h-5 text-pink-600 dark:text-pink-400" />
              <span className="text-xs font-semibold text-pink-900 dark:text-pink-200">Sisa Tarikan</span>
            </div>
            <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">
              {statusLoading ? "-" : status?.remainingPulls ?? 0}/2
            </div>
          </motion.div>

          {/* Time to Reset */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-950/50 dark:to-purple-900/30 rounded-xl p-4 border border-purple-300 dark:border-purple-400/30"
          >
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-semibold text-purple-900 dark:text-purple-200">Reset Dalam</span>
            </div>
            {countdown && countdown.totalSeconds > 0 ? (
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 font-mono">
                {String(countdown.hours).padStart(2, "0")}:{String(countdown.minutes).padStart(2, "0")}:{String(countdown.seconds).padStart(2, "0")}
              </div>
            ) : (
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">--:--:--</div>
            )}
          </motion.div>
        </div>
      </div>

      <div className="w-full max-w-xs aspect-[3/4] perspective-1000 mb-10">
        <AnimatePresence mode="wait">
          {!pulledCard ? (
            <motion.div
              key="pack"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                rotateY: isFlipping ? 180 : 0
              }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.6, type: "spring" }}
              className="w-full h-full transform-style-3d relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500 to-pink-400 rounded-[2rem] shadow-2xl shadow-pink-500/30 flex flex-col items-center justify-center border-4 border-pink-300 backface-hidden">
                <PackageOpen className="w-24 h-24 text-white mb-4 drop-shadow-md" />
                <div className="text-white font-bold text-2xl tracking-widest bg-pink-400/30 px-6 py-2 rounded-full backdrop-blur-sm">
                  ? ? ?
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="card"
              initial={{ rotateY: -180, scale: 0.8, opacity: 0 }}
              animate={{ rotateY: 0, scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
              className="w-full h-full"
            >
              <CardDisplay card={pulledCard.card} className="w-full h-full shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full max-w-xs space-y-4">
        <button
          onClick={handlePull}
          disabled={!canPull}
          className={`w-full py-4 rounded-2xl font-bold text-xl text-white shadow-xl transition-all duration-300 ${
            canPull 
              ? "bg-gradient-to-r from-primary to-rose-500 hover:shadow-primary/40 active:scale-95" 
              : "bg-muted text-muted-foreground shadow-none opacity-70 cursor-not-allowed transform-none"
          }`}
        >
          {pullGacha.isPending || isFlipping ? "Membuka..." : "Tarik Kartu Sekarang"}
        </button>
        
        {pulledCard && (
          <button
            onClick={() => setPulledCard(null)}
            className="w-full py-3 rounded-2xl font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            Tarik Lagi
          </button>
        )}
      </div>

      {/* Info Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="w-full max-w-md mt-8 px-4"
      >
        <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-300 dark:border-blue-700/50">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-blue-900 dark:text-blue-100">Informasi Gacha</h3>
          </div>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-2">
            <li><span className="font-semibold">Reset Gacha:</span> Pukul 06:00 & 18:00 WIB</li>
            <li><span className="font-semibold">Tarikan/Periode:</span> Maksimal 2x per periode</li>
            <li className="pt-2 border-t border-blue-200 dark:border-blue-700">
              <span className="font-semibold block mb-1">Komposisi Rate:</span>
              <div className="ml-2 space-y-1">
                <div>🌟 SSR: 10%</div>
                <div>⚡ Epic: 15%</div>
                <div>💙 Rare: 25%</div>
                <div>⚪ Common: 50%</div>
              </div>
            </li>
            <li className="pt-2 border-t border-blue-200 dark:border-blue-700">
              <span className="font-semibold">SSR Notification:</span> Pasanganmu akan mendapat notifikasi jika kamu mendapatkan kartu SSR
            </li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
}
