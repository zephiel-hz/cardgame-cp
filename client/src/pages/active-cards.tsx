import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ZapOff, Info } from "lucide-react";
import { useActiveCards } from "@/hooks/use-cards";
import { CountdownTimer } from "@/components/countdown-timer";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export default function ActiveCards() {
  const { user } = useAuth();
  const { data: activeCards, isLoading, error } = useActiveCards(user?.id);
  const queryClient = useQueryClient();

  console.log('[ActiveCards] Rendering:', { userId: user?.id, isLoading, error: error?.message, cardCount: activeCards?.length });

  const handleExpire = () => {
    // Refresh list when a timer naturally expires
    setTimeout(() => {
      // Invalidate ALL active cards queries to ensure consistency
      queryClient.invalidateQueries({ queryKey: [api.activeCards.list.path] });
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pb-10">
        <div className="flex flex-col items-center justify-center bg-yellow-50 dark:bg-gradient-to-br dark:from-yellow-800/20 dark:to-yellow-700/20 backdrop-blur-sm rounded-3xl p-10 border border-dashed border-yellow-300 dark:border-yellow-400/30 mt-10">
          <div className="w-20 h-20 bg-yellow-200 dark:bg-yellow-700/50 rounded-full flex items-center justify-center mb-4">
            <ZapOff className="w-10 h-10 text-yellow-600 dark:text-yellow-300" />
          </div>
          <h3 className="font-bold text-xl mb-2 text-yellow-900 dark:text-yellow-200">Belum Ada Partner</h3>
          <p className="text-center text-yellow-700 dark:text-yellow-200/70">Kamu harus memiliki partner terlebih dahulu untuk melihat kartu aktif mereka.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <div className="mb-6 px-2">
        <h2 className="text-2xl font-bold text-foreground">Status Saat Ini</h2>
        <p className="text-muted-foreground text-sm font-medium mt-1">
          Kartu yang sedang aktif dan pantang dilanggar! 😤
        </p>
      </div>

      {!activeCards || activeCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-pink-50 dark:bg-gradient-to-br dark:from-purple-800/30 dark:to-purple-700/30 backdrop-blur-sm rounded-3xl p-10 border border-dashed border-pink-300 dark:border-pink-400/30 mt-10">
          <div className="w-20 h-20 bg-pink-200 dark:bg-purple-700/50 rounded-full flex items-center justify-center mb-4">
            <ZapOff className="w-10 h-10 text-pink-600 dark:text-pink-300" />
          </div>
          <h3 className="font-bold text-xl mb-2 text-pink-900 dark:text-pink-200">Aman Sentosa</h3>
          <p className="text-center text-pink-700 dark:text-pink-200/70">Tidak ada kartu yang sedang aktif saat ini.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {activeCards.map((uc) => {
              const isMine = uc.userId === user?.id;
              const tierClass = `tier-${uc.card.tier.toLowerCase()}`;
              
              return (
                <motion.div
                  key={uc.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={cn(
                    "rounded-3xl p-1 overflow-hidden shadow-lg",
                    isMine ? "bg-gradient-to-r from-primary to-rose-400" : "bg-gradient-to-r from-blue-400 to-indigo-500"
                  )}
                >
                  <div className="bg-white dark:bg-gradient-to-br dark:from-purple-800 dark:to-purple-700 rounded-[22px] p-5 h-full relative border border-pink-200 dark:border-pink-400/20">
                    {/* Badge user */}
                    <div className={cn(
                      "absolute -top-3 -right-2 px-4 py-1 rounded-full text-xs font-bold text-white shadow-md transform rotate-3",
                      isMine ? "bg-gradient-to-r from-pink-500 to-pink-400" : "bg-gradient-to-r from-purple-600 to-purple-500"
                    )}>
                      Dipakai oleh {uc.user.username}
                    </div>

                    <div className="flex justify-between items-start mb-4 mt-2">
                      <div>
                        <h3 className="font-bold text-xl text-foreground leading-tight">{uc.card.name}</h3>
                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block", tierClass)}>
                          {uc.card.tier}
                        </span>
                      </div>
                    </div>

                    <div className="bg-muted/50 p-3 rounded-xl mb-4 flex items-start gap-2 border border-border/50">
                      <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-sm font-medium text-foreground">{uc.card.description}</p>
                    </div>

                    <div className="flex justify-between items-center border-t border-border pt-4">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sisa Waktu</span>
                      {uc.expiresAt && (
                        <CountdownTimer 
                          expiresAt={uc.expiresAt} 
                          onExpire={handleExpire}
                          className={isMine ? "bg-pink-500/20 text-pink-300 border-pink-500/30" : "bg-purple-500/20 text-purple-300 border-purple-500/30"}
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
