import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Sparkles, PackageOpen } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useGachaStatus, usePullGacha } from "@/hooks/use-gacha";
import { CardDisplay } from "@/components/card-display";
import type { UserCardWithDetails } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Gacha() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: status, isLoading: statusLoading } = useGachaStatus(user?.id);
  const pullGacha = usePullGacha();
  
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
        <div className="flex items-center justify-between px-6 py-3 bg-gradient-to-r from-purple-800/50 to-purple-700/50 rounded-2xl shadow-sm border border-pink-400/30 backdrop-blur-sm">
          <span className="font-semibold text-pink-200">Sisa Tarikan:</span>
          <span className="font-bold text-xl text-pink-400">{statusLoading ? "-" : remaining}/2</span>
        </div>

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
    </div>
  );
}
