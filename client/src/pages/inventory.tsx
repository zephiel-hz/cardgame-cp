import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Inbox, Search, X, Filter, Sparkles, Clock, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useInventory, useUseCard } from "@/hooks/use-cards";
import { CardDisplay } from "@/components/card-display";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatDuration } from "@/lib/utils";
import type { User } from "@shared/schema";

interface GroupedCard {
  card: any;
  count: number;
  firstUserCardId: number;
  isNew: boolean;
}

export default function Inventory() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: cards, isLoading } = useInventory(user?.id);
  const useCard = useUseCard();
  
  // Fetch partner info
  const { data: partner } = useQuery({
    queryKey: ['partner', user?.id],
    queryFn: async (): Promise<User | null> => {
      if (!user?.id) return null;
      try {
        const response = await fetch(buildUrl(api.auth.getPartner.path, { userId: user.id }));
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    },
    enabled: !!user?.id,
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "tier-desc" | "tier-asc" | "duration">("name");
  const [selectedCardForDetail, setSelectedCardForDetail] = useState<any>(null);
  const [selectedUserCardId, setSelectedUserCardId] = useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmingUserCardId, setConfirmingUserCardId] = useState<number | null>(null);

  const handleUseCard = async (userCardId: number, cardName: string) => {
    try {
      await useCard.mutateAsync(userCardId);
      toast({
        title: t('inventory.cardTitle'),
        description: t('inventory.cardUsed', { cardName }),
        className: "bg-green-500 text-white border-none",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t('inventory.cardError'),
        description: error.message,
      });
    }
  };

  const tierOrder = { common: 0, rare: 1, epic: 2, legendary: 3, ssr: 4 };

  // Check if card is new (less than 2 hours old)
  const isNewCard = (createdAt: any) => {
    if (!createdAt) return false;
    try {
      const cardDate = new Date(createdAt);
      if (isNaN(cardDate.getTime())) return false;
      const now = new Date();
      const diffMinutes = (now.getTime() - cardDate.getTime()) / (1000 * 60);
      // Only mark as new if created in last 2 hours
      return diffMinutes < 120 && diffMinutes > 0;
    } catch (e) {
      return false;
    }
  };

  const filteredAndSortedCards = useMemo(() => {
    if (!cards) return [];

    // Group cards by cardId
    const groupedMap = new Map<number, GroupedCard>();
    
    cards.forEach((userCard) => {
      const cardId = userCard.card.id;
      if (!groupedMap.has(cardId)) {
        groupedMap.set(cardId, {
          card: userCard.card,
          count: 0,
          firstUserCardId: userCard.id,
          isNew: isNewCard(userCard.createdAt),
        });
      }
      const grouped = groupedMap.get(cardId)!;
      grouped.count++;
      // Update to most recent card's ID if the current one is newer
      if (userCard.createdAt && (!cards.find(c => c.id === grouped.firstUserCardId)?.createdAt || 
          new Date(userCard.createdAt) > new Date(cards.find(c => c.id === grouped.firstUserCardId)!.createdAt))) {
        grouped.firstUserCardId = userCard.id;
      }
      // Mark as new if any copy is new
      if (isNewCard(userCard.createdAt)) {
        grouped.isNew = true;
      }
    });

    let filtered = Array.from(groupedMap.values()).filter((grouped) => {
      const matchesSearch = grouped.card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            grouped.card.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTier = !selectedTier || grouped.card.tier.toLowerCase() === selectedTier.toLowerCase();
      return matchesSearch && matchesTier;
    });

    filtered.sort((a, b) => {
      if (sortBy === "name") {
        return a.card.name.localeCompare(b.card.name);
      } else if (sortBy === "tier-desc") {
        const tierA = tierOrder[a.card.tier.toLowerCase() as keyof typeof tierOrder] || 0;
        const tierB = tierOrder[b.card.tier.toLowerCase() as keyof typeof tierOrder] || 0;
        return tierB - tierA; // Descending (highest first)
      } else if (sortBy === "tier-asc") {
        const tierA = tierOrder[a.card.tier.toLowerCase() as keyof typeof tierOrder] || 0;
        const tierB = tierOrder[b.card.tier.toLowerCase() as keyof typeof tierOrder] || 0;
        return tierA - tierB; // Ascending (lowest first)
      } else if (sortBy === "duration") {
        return b.card.durationMinutes - a.card.durationMinutes;
      }
      return 0;
    });

    return filtered;
  }, [cards, searchQuery, selectedTier, sortBy]);

  const uniqueTiers = useMemo(() => {
    if (!cards) return [];
    const tiers = new Set(cards.map(c => c.card.tier.toLowerCase()));
    return Array.from(tiers).sort((a, b) => 
      (tierOrder[a as keyof typeof tierOrder] || 0) - (tierOrder[b as keyof typeof tierOrder] || 0)
    );
  }, [cards]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary"></div>
      </div>
    );
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="pb-16">
      {/* Header Section */}
      <div className="mb-8 px-2">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-1">{t('inventory.title')}</h2>
            <p className="text-muted-foreground text-sm font-medium">
              {t('inventory.subtitle')}
            </p>
          </div>
          <div className="text-center bg-gradient-to-br from-pink-500/10 to-pink-400/5 rounded-xl px-4 py-3 border border-pink-500/20">
            <p className="text-2xl font-bold text-pink-500">{cards?.length || 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('inventory.cards')}</p>
          </div>
        </div>
      </div>

      {!cards || cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-pink-50 dark:bg-gradient-to-br dark:from-purple-800/30 dark:to-purple-700/30 backdrop-blur-sm rounded-3xl p-10 border border-dashed border-pink-300 dark:border-pink-400/30 mt-10">
          <div className="w-20 h-20 bg-pink-200 dark:bg-purple-700/50 rounded-full flex items-center justify-center mb-4">
            <Inbox className="w-10 h-10 text-pink-600 dark:text-pink-300" />
          </div>
          <h3 className="font-bold text-xl mb-2 text-pink-900 dark:text-pink-200">{t('inventory.empty')}</h3>
          <p className="text-center text-pink-700 dark:text-pink-200/70">{t('inventory.emptyMessage')}</p>
        </div>
      ) : (
        <>
          {/* Search and Filter Bar */}
          <div className="space-y-4 mb-6 px-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder={t('inventory.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-secondary/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 placeholder-muted-foreground text-foreground"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Tier Filter Row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <button
                onClick={() => setSelectedTier(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  !selectedTier
                    ? "bg-pink-500 text-white"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                {t('inventory.all')}
              </button>
              {uniqueTiers.map((tier) => (
                <button
                  key={tier}
                  onClick={() => setSelectedTier(tier)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 capitalize ${
                    selectedTier === tier
                      ? "bg-pink-500 text-white"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>

            {/* Sort Dropdown Row */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">{t('inventory.sortLabel')}</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "name" | "tier-desc" | "tier-asc" | "duration")}
                className="flex-1 px-4 py-2 rounded-full text-sm font-medium bg-pink-500/10 border-2 border-pink-500/30 text-foreground focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              >
                <option value="name">{t('inventory.sort.nameAZ')}</option>
                <option value="tier-desc">{t('inventory.sort.tierHighest')}</option>
                <option value="tier-asc">{t('inventory.sort.tierLowest')}</option>
                <option value="duration">{t('inventory.sort.duration')}</option>
              </select>
            </div>

            {/* Results count */}
            {searchQuery || selectedTier ? (
              <p className="text-sm text-muted-foreground px-1">
                {t('inventory.found', { count: filteredAndSortedCards.length })}
              </p>
            ) : null}
          </div>

          {/* Cards Grid */}
          {filteredAndSortedCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center bg-secondary/50 rounded-2xl p-12 mt-8 px-2">
              <Search className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground text-center">{t('inventory.noResults')}</p>
            </div>
          ) : (
            <motion.div 
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 gap-5 px-2"
            >
              {filteredAndSortedCards.map((grouped) => (
                <motion.div key={grouped.card.id} variants={item} className="h-full">
                  <div className="relative w-full">
                    {/* Stack layers for duplicates */}
                    {grouped.count > 1 && (
                      <>
                        <div className="absolute -bottom-1 -left-1 right-0 aspect-square bg-foreground/5 rounded-2xl -z-10" />
                        <div className="absolute -bottom-2 -left-2 right-0 aspect-square bg-foreground/3 rounded-2xl -z-20" />
                      </>
                    )}
                    
                    {/* Main Card Container */}
                    <div className="relative aspect-square flex flex-col w-full">
                      {/* Badge Baru - Top Left Corner Ribbon */}
                      {grouped.isNew && (
                        <div className="absolute -top-0.5 -left-0.5 bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-2.5 py-1 rounded-br-lg text-xs font-bold flex items-center gap-1 shadow-lg z-20">
                          <Sparkles className="w-3 h-3" />
                          {t('inventory.new')}
                        </div>
                      )}
                      
                      {/* Duplicate Counter */}
                      {grouped.count > 1 && (
                        <div className="absolute -top-2 -right-2 bg-gradient-to-br from-pink-500 to-pink-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg z-20 border-2 border-background">
                          {grouped.count}
                        </div>
                      )}
                      
                      <CardDisplay card={grouped.card} className="h-full" onClick={() => {
                      setSelectedCardForDetail(grouped.card);
                      setSelectedUserCardId(grouped.firstUserCardId);
                    }}>
                      {/* Button removed - moved to detail modal */}
                    </CardDisplay>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </>
      )}

      {/* Card Detail Modal */}
      <Dialog open={!!selectedCardForDetail} onOpenChange={(open) => !open && setSelectedCardForDetail(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl">{selectedCardForDetail && t(`cards.card_${selectedCardForDetail.id}.name`, { defaultValue: selectedCardForDetail.name })}</DialogTitle>
            <DialogDescription>
              {t('game.tier')}: {selectedCardForDetail?.tier} • {t('inventory.durationLabel')}: {selectedCardForDetail && formatDuration(selectedCardForDetail.durationMinutes)}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center gap-2">
            <span className="inline-block px-3 py-1 bg-pink-500/10 border border-pink-500/30 text-pink-600 dark:text-pink-400 rounded-full text-sm font-bold uppercase">
              {selectedCardForDetail?.tier}
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium">
              <Clock className="w-4 h-4" />
              {selectedCardForDetail && formatDuration(selectedCardForDetail.durationMinutes)}
            </span>
          </div>
          
          <div className="space-y-4 py-4">
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">{t('inventory.description')}</h4>
              <p className="text-base text-foreground leading-relaxed">
                {selectedCardForDetail && t(`cards.card_${selectedCardForDetail.id}.description`, { defaultValue: selectedCardForDetail.description })}
              </p>
            </div>

            {!partner && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">
                  {t('inventory.partnerRequired')}
                </p>
              </div>
            )}

            <div className="bg-secondary/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">
                {t('inventory.infoTip', { duration: selectedCardForDetail ? formatDuration(selectedCardForDetail.durationMinutes) : 'N/A' })}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setShowConfirmDialog(true);
              setConfirmingUserCardId(selectedUserCardId);
            }}
            disabled={useCard.isPending || !partner}
            className="w-full bg-gradient-to-r from-pink-500 to-pink-400 hover:from-pink-400 hover:to-pink-300 text-white font-bold py-2 rounded-lg shadow-lg shadow-pink-500/30 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mb-3"
          >
            {useCard.isPending && useCard.variables === selectedUserCardId ? t('common.processing') : t('inventory.use')}
          </button>

          <button
            onClick={() => {
              setSelectedCardForDetail(null);
              setSelectedUserCardId(null);
            }}
            className="w-full bg-gradient-to-r from-pink-500 to-pink-400 hover:from-pink-400 hover:to-pink-300 text-white font-bold py-2 rounded-lg shadow-lg shadow-pink-500/30 transition-transform active:scale-95"
          >
            {t('inventory.close')}
          </button>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl">{t('inventory.confirmation')}</DialogTitle>
            <DialogDescription>
              {t('inventory.confirmUseCard')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              ⚠️ {t('inventory.cardWarning', { duration: selectedCardForDetail ? formatDuration(selectedCardForDetail.durationMinutes) : 'N/A' })}
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowConfirmDialog(false);
                setConfirmingUserCardId(null);
              }}
              className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-foreground font-bold py-2 rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={async () => {
                if (confirmingUserCardId) {
                  await handleUseCard(confirmingUserCardId, selectedCardForDetail?.name);
                  setShowConfirmDialog(false);
                  setConfirmingUserCardId(null);
                  setSelectedCardForDetail(null);
                  setSelectedUserCardId(null);
                }
              }}
              disabled={useCard.isPending}
              className="flex-1 bg-gradient-to-r from-pink-500 to-pink-400 hover:from-pink-400 hover:to-pink-300 text-white font-bold py-2 rounded-lg shadow-lg shadow-pink-500/30 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {useCard.isPending ? t('common.processing') : t('inventory.confirmButton')}
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
