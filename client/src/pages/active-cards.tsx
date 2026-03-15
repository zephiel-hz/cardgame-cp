import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ZapOff, Info, Zap, Clock, Users } from "lucide-react";
import { useActiveCards } from "@/hooks/use-cards";
import { CountdownTimer } from "@/components/countdown-timer";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface GroupedCard {
  cardId: number;
  cardName: string;
  cardTier: string;
  cardDescription: string;
  userId: number;
  userName: string;
  isMine: boolean;
  count: number;
  totalDuration: number;
  expiresAt: Date;
  items: any[];
}

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

  // Group cards by userId+cardId to implement stacking logic
  const groupedCards = useMemo(() => {
    if (!activeCards) return [];
    
    console.log('[groupedCards] Processing', activeCards.length, 'cards');
    const groups: Record<string, GroupedCard> = {};
    
    activeCards.forEach((uc) => {
      const key = `${uc.userId}-${uc.cardId}`;
      
      // Convert expiresAt to Date if it's a string
      const expiresAtDate = uc.expiresAt ? new Date(uc.expiresAt) : new Date();
      
      if (!groups[key]) {
        groups[key] = {
          cardId: uc.cardId,
          cardName: uc.card.name,
          cardTier: uc.card.tier,
          cardDescription: uc.card.description,
          userId: uc.userId,
          userName: uc.user.username,
          isMine: uc.userId === user?.id,
          count: 0,
          totalDuration: 0,
          expiresAt: expiresAtDate,
          items: [],
        };
      }
      groups[key].count++;
      groups[key].totalDuration += uc.card.durationMinutes;
      groups[key].items.push(uc);
      // Use the earliest expiring time as the group's expiry
      if (expiresAtDate < groups[key].expiresAt) {
        groups[key].expiresAt = expiresAtDate;
      }
    });
    
    const result = Object.values(groups).sort((a, b) => (a.expiresAt?.getTime() || 0) - (b.expiresAt?.getTime() || 0));
    console.log('[groupedCards] Grouped into', result.length, 'groups:', result.map(g => ({ cardName: g.cardName, count: g.count, totalDuration: g.totalDuration })));
    return result;
  }, [activeCards, user?.id]);

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
    <div className="pb-10 px-2">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Zap className="text-yellow-500 fill-yellow-500 w-8 h-8" />
          Status Saat Ini
        </h2>
        <p className="text-muted-foreground text-sm font-medium mt-1">
          Kartu yang sedang aktif dan pantang dilanggar! 😤
        </p>
      </div>

      {!groupedCards || groupedCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-gradient-to-br from-pink-50 to-pink-100/50 dark:from-purple-900/20 dark:to-pink-900/20 backdrop-blur-sm rounded-3xl p-16 border border-dashed border-pink-300 dark:border-pink-400/30 mt-10">
          <div className="w-20 h-20 bg-pink-200 dark:bg-pink-700/50 rounded-full flex items-center justify-center mb-4 animate-pulse">
            <ZapOff className="w-10 h-10 text-pink-600 dark:text-pink-300" />
          </div>
          <h3 className="font-bold text-2xl mb-2 text-pink-900 dark:text-pink-200">Aman Sentosa</h3>
          <p className="text-center text-pink-700 dark:text-pink-200/70 max-w-xs">Tidak ada kartu yang sedang aktif saat ini. Saatnya menggunakan kartu mu! 🎯</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {groupedCards.map((groupedCard, idx) => {
              const tierClass = `tier-${groupedCard.cardTier.toLowerCase()}`;
              
              // Ensure we have at least one item
              if (!groupedCard.items || groupedCard.items.length === 0) {
                console.warn('[ActiveCards] Card group missing items:', groupedCard);
                return null;
              }
              
              // Calculate actual stacking based on time duration
              // If activated + actual duration > base duration, it means cards are stacked
              const firstCard = groupedCard.items[0];
              const baseCardDuration = firstCard.card.durationMinutes;
              const activatedTime = firstCard.activatedAt ? new Date(firstCard.activatedAt).getTime() : new Date().getTime();
              // groupedCard.expiresAt is already a Date (converted in useMemo)
              const expiresTime = groupedCard.expiresAt instanceof Date ? groupedCard.expiresAt.getTime() : new Date(groupedCard.expiresAt).getTime();
              const actualDurationMs = expiresTime - activatedTime;
              const actualDurationMinutes = Math.round(actualDurationMs / 60000);
              
              console.log(`[Card Display] ${firstCard.card.name}:`, {
                baseCardDuration,
                activatedTime: new Date(activatedTime).toISOString(),
                expiresTime: new Date(expiresTime).toISOString(),
                actualDurationMinutes,
              });
              
              // Calculate elapsed time and remaining time
              const now = new Date().getTime();
              const elapsedMs = now - activatedTime;
              const remainingMs = expiresTime - now;
              
              // Calculate progress percentage (0-100)
              // Initial progress: how much has already elapsed
              const initialProgressPercent = Math.max(0, Math.min(100, (elapsedMs / actualDurationMs) * 100));
              
              // Remaining time in seconds for animation duration
              const remainingSeconds = Math.max(0, remainingMs / 1000);
              
              // Calculate how many cards are stacked based on duration ratio
              const stackCountEstimate = Math.round(actualDurationMinutes / baseCardDuration);
              const isStacked = stackCountEstimate > 1;
              const bonusMinutes = actualDurationMinutes - baseCardDuration;
              
              console.log(`[Stacking] ${firstCard.card.name}: stackCount=${stackCountEstimate}, isStacked=${isStacked}, bonus=${bonusMinutes}m`);
              
              return (
                <motion.div
                  key={`${groupedCard.userId}-${groupedCard.cardId}`}
                  initial={{ opacity: 0, x: -30, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8, x: -20 }}
                  transition={{ delay: idx * 0.05, type: "spring", stiffness: 300, damping: 30 }}
                  className={cn(
                    "rounded-2xl p-1 overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300",
                    groupedCard.isMine 
                      ? "bg-gradient-to-r from-pink-500/80 via-rose-400/80 to-pink-400/80 hover:from-pink-500 hover:via-rose-400 hover:to-pink-400" 
                      : "bg-gradient-to-r from-blue-500/80 via-indigo-500/80 to-purple-500/80 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500"
                  )}
                >
                  <div className="bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:to-slate-800 rounded-xl p-5 h-full relative border border-pink-200/50 dark:border-slate-700/50">
                    {/* Stack Badge */}
                    {isStacked && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-3 -right-3 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full w-10 h-10 flex items-center justify-center text-white font-bold text-sm shadow-lg ring-2 ring-white dark:ring-slate-900 z-10"
                      >
                        ×{stackCountEstimate}
                      </motion.div>
                    )}

                    {/* User Badge */}
                    <motion.div
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className={cn(
                        "absolute -top-2 left-4 px-3 py-1 rounded-full text-xs font-bold text-white shadow-md flex items-center gap-1",
                        groupedCard.isMine 
                          ? "bg-gradient-to-r from-pink-600 to-rose-500" 
                          : "bg-gradient-to-r from-blue-600 to-indigo-600"
                      )}
                    >
                      <Users className="w-3 h-3" />
                      {groupedCard.userName}
                    </motion.div>

                    <div className="flex justify-between items-start mb-4 mt-3">
                      <div className="flex-1 pr-2">
                        <h3 className="font-bold text-lg text-foreground leading-tight">{groupedCard.cardName}</h3>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className={cn("text-xs font-bold px-2.5 py-1 rounded-full", tierClass)}>
                            {groupedCard.cardTier}
                          </span>
                          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/50 dark:to-blue-800/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700/50">
                            ⏱️ {actualDurationMinutes}m
                          </span>
                          {isStacked && (
                            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/50 dark:to-amber-800/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700/50 flex items-center gap-1">
                              <span className="text-lg">✨</span>
                              <span className="font-bold">+{bonusMinutes}m</span> stacked
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/40 dark:bg-slate-700/30 p-3 rounded-lg mb-4 flex items-start gap-2 border border-border/30">
                      <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground leading-snug mb-1">{groupedCard.cardDescription}</p>
                        <p className="text-xs text-muted-foreground font-semibold">
                          {isStacked ? (
                            <span className="text-amber-700 dark:text-amber-400">
                              Base: {baseCardDuration}m → Total: {actualDurationMinutes}m (×{stackCountEstimate} stacked) ✨
                            </span>
                          ) : (
                            <>Duration: {actualDurationMinutes}m</>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {groupedCard.expiresAt && remainingSeconds > 0 && (
                      <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Progres</span>
                          <span className="text-xs font-semibold text-muted-foreground">
                            Total: {actualDurationMinutes}m
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-muted/50 dark:bg-slate-700/50 rounded-full overflow-hidden border border-border/30">
                          <motion.div
                            initial={{ width: `${100 - initialProgressPercent}%` }}
                            animate={{ width: "0%" }}
                            transition={{ duration: Math.max(remainingSeconds, 0.1), linear: true }}
                            className={cn(
                              "h-full rounded-full bg-gradient-to-r",
                              groupedCard.isMine
                                ? "from-pink-500 to-rose-400"
                                : "from-blue-500 to-indigo-500"
                            )}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center border-t border-border/30 pt-4">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Sisa Waktu
                      </span>
                      {groupedCard.expiresAt && (
                        <CountdownTimer 
                          expiresAt={groupedCard.expiresAt instanceof Date ? groupedCard.expiresAt.toISOString() : groupedCard.expiresAt} 
                          onExpire={handleExpire}
                          className={groupedCard.isMine ? "bg-pink-500/20 text-pink-400 border-pink-500/30 font-semibold" : "bg-blue-500/20 text-blue-400 border-blue-500/30 font-semibold"}
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
