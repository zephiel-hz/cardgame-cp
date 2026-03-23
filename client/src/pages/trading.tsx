import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useTrades, useInitiateTrade, useRespondToTrade, UseCancelTrade, useTradeHistory } from '../hooks/use-trades';
import { useInventory } from '../hooks/use-cards';
import { useAuth } from '../lib/auth-context';
import { useWebSocketTrades } from '../hooks/use-websocket';
import { useToast } from '../hooks/use-toast';
import { CardDisplay } from '../components/card-display';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Checkbox } from '../components/ui/checkbox';
import { Repeat2, Check, X, Clock, AlertCircle, Zap } from 'lucide-react';
import { api } from '@shared/routes';

// Tier display mapping
const tierDisplayMap: Record<string, string> = {
  'N': 'Common',
  'R': 'Rare',
  'SR': 'Epic',
  'SSR': 'SSR',
};

// Reverse mapping: display name to code
const tierDisplayToCodeMap: Record<string, string> = {
  'Common': 'N',
  'Rare': 'R',
  'Epic': 'SR',
  'SSR': 'SSR',
  // Also support lowercase variants if stored in database
  'common': 'N',
  'rare': 'R',
  'epic': 'SR',
  'ssr': 'SSR',
};

// Tier names in Indonesian
const tierNameMap: Record<string, string> = {
  'N': 'Umum',
  'R': 'Langka',
  'SR': 'Epik',
  'SSR': 'Legendaris',
};

// Tier order for sorting (highest to lowest)
const tierOrderMap: Record<string, number> = {
  'SSR': 0,
  'SR': 1,
  'R': 2,
  'N': 3,
};

// Normalize tier value to standard code
const normalizeTier = (tier: string | undefined): string => {
  if (!tier) return 'N';
  // If it's a display name, convert to code
  if (tierDisplayToCodeMap[tier]) return tierDisplayToCodeMap[tier];
  // If it's already a code, return it
  if (['N', 'R', 'SR', 'SSR'].includes(tier)) return tier;
  // Default fallback
  return 'N';
};

// Safe JSON parse helper
const safeJsonParse = (str: string | null | undefined, fallback: any = []) => {
  if (!str || typeof str !== 'string') return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

export default function Trading() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: myCards = [], isLoading: cardsLoading } = useInventory(user?.id);
  const { data: tradeRequests = [] } = useTrades(user?.id);
  const { data: tradeHistory = [] } = useTradeHistory(user?.id);
  
  const initiateTrade = useInitiateTrade(user?.id);
  const respondTrade = useRespondToTrade(user?.id);
  const cancelTrade = UseCancelTrade(user?.id);

  // Initiate trade state
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [selectedCards, setSelectedCards] = useState<Record<number, number>>({}); // cardId -> quantity
  const [tradeMessage, setTradeMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [quantityPickerCard, setQuantityPickerCard] = useState<any>(null); // For quantity modal
  const [quantityValue, setQuantityValue] = useState(1);
  const [quantityPickerContext, setQuantityPickerContext] = useState<'initiate' | 'respond'>('initiate'); // Track which tab

  // Respond trade state
  const [selectedTradeToRespond, setSelectedTradeToRespond] = useState<any>(null);
  const [respondingCards, setRespondingCards] = useState<Record<number, number>>({}); // cardId -> quantity

  // WebSocket listener untuk trade completion
  useWebSocketTrades(
    (payload) => {
      toast({
        title: "✅ Pertukaran Selesai!",
        description: `Pertukaran kartu dengan ${partner?.username} berhasil diselesaikan!`,
        className: "bg-green-600 text-white border-none rounded-2xl shadow-xl",
      });
    },
    (payload) => {
      toast({
        title: "❌ Pertukaran Dibatalkan",
        description: `Pertukaran kartu dengan ${partner?.username} telah dibatalkan.`,
        className: "bg-red-600 text-white border-none rounded-2xl shadow-xl",
      });
    }
  );

  // Get partner info
  const { data: partner } = useQuery({
    queryKey: ['partner', user?.id],
    queryFn: async () => {
      if (!user?.partnerId) return null;
      const response = await fetch(`/api/auth/user/${user.partnerId}`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!user?.partnerId,
  });

  if (!user) return null;

  // Check if user has a partner
  if (!user.partnerId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Belum Ada Mitra</h1>
          <p className="text-muted-foreground text-center max-w-sm">
            Buat mitra dulu sebelum bisa tukar kartu. Cari mitra di halaman Mitra!
          </p>
        </motion.div>
      </div>
    );
  }

  const handleSelectCard = (userCard: any) => {
    // Open quantity picker modal
    setQuantityPickerCard(userCard);
    setQuantityPickerContext('initiate');
    const currentQty = selectedCards[userCard.card.id] || 0;
    const availableQty = myCards.filter(c => c.card?.id === userCard.card.id).length;
    setQuantityValue(currentQty > 0 ? currentQty : 1);
  };

  const handleSelectCardForRespond = (userCard: any) => {
    // Open quantity picker modal for responding to trade
    setQuantityPickerCard(userCard);
    setQuantityPickerContext('respond');
    const currentQty = respondingCards[userCard.card.id] || 0;
    const availableQty = myCards.filter(c => c.card?.id === userCard.card.id).length;
    setQuantityValue(currentQty > 0 ? currentQty : 1);
  };

  const handleConfirmQuantity = () => {
    if (!quantityPickerCard) return;
    
    if (quantityPickerContext === 'initiate') {
      if (quantityValue === 0) {
        // Remove card
        const newSelected = { ...selectedCards };
        delete newSelected[quantityPickerCard.card.id];
        setSelectedCards(newSelected);
      } else {
        // Set quantity
        setSelectedCards(prev => ({
          ...prev,
          [quantityPickerCard.card.id]: quantityValue
        }));
      }
    } else {
      // respond context
      if (quantityValue === 0) {
        // Remove card
        const newResponding = { ...respondingCards };
        delete newResponding[quantityPickerCard.card.id];
        setRespondingCards(newResponding);
      } else {
        // Set quantity
        setRespondingCards(prev => ({
          ...prev,
          [quantityPickerCard.card.id]: quantityValue
        }));
      }
    }
    setQuantityPickerCard(null);
  };

  // Calculate total selected cards count (sum of all quantities)
  const totalSelectedCards = Object.values(selectedCards).reduce((sum, qty) => sum + qty, 0);

  const handleInitiateTrade = async () => {
    if (totalSelectedCards === 0) {
      alert('Please select at least one card to trade');
      return;
    }

    // Expand quantities into individual card IDs
    const expandedCardIds: number[] = [];
    Object.entries(selectedCards).forEach(([cardId, qty]) => {
      const numCardId = parseInt(cardId);
      const cardsWithThisId = myCards.filter(c => c.card?.id === numCardId);
      for (let i = 0; i < qty && i < cardsWithThisId.length; i++) {
        expandedCardIds.push(cardsWithThisId[i].id);
      }
    });

    await initiateTrade.mutateAsync({
      recipientId: user.partnerId!,
      offeringCardIds: expandedCardIds,
      message: tradeMessage || undefined,
    });

    // Reset state
    setSelectedCards({});
    setTradeMessage('');
    setStep('select');
    setIsConfirmModalOpen(false);
  };

  const handleRespondTrade = async (accept: boolean) => {
    if (!selectedTradeToRespond) return;

    if (accept && totalSelectedCards === 0) {
      alert('Please select at least one card to offer in exchange');
      return;
    }

    // Expand quantities into individual card IDs
    const expandedCardIds: number[] = [];
    Object.entries(respondingCards).forEach(([cardId, qty]) => {
      const numCardId = parseInt(cardId);
      const cardsWithThisId = myCards.filter(c => c.card?.id === numCardId);
      for (let i = 0; i < qty && i < cardsWithThisId.length; i++) {
        expandedCardIds.push(cardsWithThisId[i].id);
      }
    });

    await respondTrade.mutateAsync({
      tradeId: selectedTradeToRespond.id,
      accept,
      offeringCardIds: accept ? expandedCardIds : [],
    });

    setSelectedTradeToRespond(null);
    setRespondingCards({});
  };

  const pendingReceived = tradeRequests.filter(t => t.recipientId === user.id && t.status === 'pending');
  const pendingSent = tradeRequests.filter(t => t.initiatorId === user.id && t.status === 'pending');

  // Filtered and sorted cards
  const filteredCards = useMemo(() => {
    const filtered = myCards.filter(card => {
      const matchesSearch = searchQuery === '' || card.card?.name.toLowerCase().includes(searchQuery.toLowerCase());
      const normalizedCardTier = normalizeTier(card.card?.tier);
      const matchesTier = tierFilter === null || normalizedCardTier === tierFilter;
      return matchesSearch && matchesTier;
    });
    
    // Sort by tier (SSR → SR → R → N)
    return filtered.sort((a, b) => {
      const tierA = tierOrderMap[normalizeTier(a.card?.tier)] ?? 999;
      const tierB = tierOrderMap[normalizeTier(b.card?.tier)] ?? 999;
      return tierA - tierB;
    });
  }, [myCards, searchQuery, tierFilter]);

  // Group cards by their cardId (stacking)
  const stackedCards = useMemo(() => {
    const groupMap = new Map<number, any[]>();
    filteredCards.forEach(userCard => {
      const cardId = userCard.card?.id;
      if (!groupMap.has(cardId)) {
        groupMap.set(cardId, []);
      }
      groupMap.get(cardId)!.push(userCard);
    });
    return Array.from(groupMap.values()).map(group => ({
      cardId: group[0].card.id,
      card: group[0].card,
      count: group.length,
      userCards: group
    }));
  }, [filteredCards]);

  const tiers = ['N', 'R', 'SR', 'SSR'];

  // Extract all card IDs from all received trades for batch fetching
  const allReceivedCardIds = useMemo(() => {
    return pendingReceived.flatMap(trade => {
      const cardData = safeJsonParse(trade.initiatorOfferingCardData) as any[];
      return cardData.map((cd: any) => cd.cardId);
    });
  }, [pendingReceived]);

  // Fetch all offered cards at once
  const { data: allOfferedCards = [] } = useQuery({
    queryKey: ['trades', 'offered-cards', allReceivedCardIds.join(',')],
    queryFn: async () => {
      if (allReceivedCardIds.length === 0) return [];
      try {
        const responses = await Promise.all(
          allReceivedCardIds.map(cardId =>
            fetch(`/api/cards/${cardId}`).then(r => r.ok ? r.json() : null)
          )
        );
        return responses.filter(Boolean);
      } catch {
        return [];
      }
    },
    enabled: allReceivedCardIds.length > 0,
  });

  // Create a map of cardId -> card for quick lookup
  const cardMap = useMemo(() => {
    const map: Record<number, any> = {};
    allOfferedCards.forEach(card => {
      map[card.id] = card;
    });
    return map;
  }, [allOfferedCards]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <div className="border-b bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 backdrop-blur-sm">
        <div className="container max-w-4xl mx-auto py-8 px-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-4"
          >
            <div className="p-3 rounded-lg bg-blue-500/20 border border-blue-500/30">
              <Repeat2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Tukar Kartu
            </h1>
          </motion.div>

          {partner && (
            <Alert className="bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                Terhubung dengan <strong className="text-blue-900 dark:text-blue-100">{partner.username}</strong>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-4xl mx-auto py-6 px-4 pb-24">
        <Tabs defaultValue="initiate" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="initiate" className="flex items-center gap-2">
              Tukar
              {pendingSent.length > 0 && (
                <Badge variant="secondary" className="ml-2">{pendingSent.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="received" className="flex items-center gap-2">
              Permintaan
              {pendingReceived.length > 0 && (
                <Badge variant="destructive" className="ml-2">{pendingReceived.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">Riwayat</TabsTrigger>
          </TabsList>

          {/* INITIATE TRADE TAB */}
          <TabsContent value="initiate" className="space-y-6">
            <AnimatePresence mode="wait">
              {step === 'select' ? (
                <motion.div
                  key="select"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <Card className="border-0 shadow-lg">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-2xl">Pilih Kartu untuk Ditukar</CardTitle>
                      <CardDescription className="text-base">
                        Pilih kartu dari koleksimu ({myCards.length} tersedia)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pb-32">
                      {/* Selection Counter */}
                      <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border border-blue-200 dark:border-blue-800">
                        <span className="font-semibold">
                          {totalSelectedCards} kartu dipilih ({Object.keys(selectedCards).length} tipe)
                        </span>
                        {totalSelectedCards > 0 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500 text-white text-sm font-bold"
                          >
                            <Check className="w-4 h-4" /> Siap
                          </motion.div>
                        )}
                      </div>

                      {/* Search and Filter */}
                      <div className="space-y-3">
                        <Input
                          placeholder="Cari nama kartu..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-10"
                        />
                        <div className="flex gap-2 flex-wrap">
                          {tiers.map(tier => (
                            <Button
                              key={tier}
                              variant={tierFilter === tier ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setTierFilter(tierFilter === tier ? null : tier)}
                              className="capitalize"
                              title={`Filter ${tierDisplayMap[tier]}`}
                            >
                              {tierDisplayMap[tier]}
                            </Button>
                          ))}
                          {(searchQuery || tierFilter) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSearchQuery(''); setTierFilter(null); }}
                            >
                              Reset
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Cards Grid */}
                      {cardsLoading ? (
                        <div className="flex justify-center py-12">
                          <div className="text-muted-foreground">Memuat koleksi...</div>
                        </div>
                      ) : filteredCards.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <AlertCircle className="w-12 h-12 text-muted-foreground mb-3 opacity-50" />
                          <div className="text-muted-foreground">
                            {myCards.length === 0 ? 'Belum ada kartu. Tarik di Gacha dulu!' : 'Kartu tidak ditemukan'}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <AnimatePresence>
                            {stackedCards.map((stacked, idx) => {
                              const isSelected = selectedCards[stacked.cardId] || 0;
                              return (
                                <motion.div
                                  key={stacked.cardId}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  transition={{ delay: idx * 0.05 }}
                                >
                                  <div className={`relative h-full rounded-2xl border-2 transition-all ${
                                    isSelected ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-950' : ''
                                  }`}>
                                    <CardDisplay
                                      card={stacked.card}
                                      className="h-full cursor-pointer"
                                      onClick={() => handleSelectCard(stacked.userCards[0])}
                                    >
                                      {/* Stacking count badge */}
                                      <div className="absolute top-2 right-2 bg-gray-800 dark:bg-gray-700 text-white px-2 py-1 rounded-full text-xs font-bold">
                                        ×{stacked.count}
                                      </div>
                                      
                                      {/* Selected quantity display */}
                                      {isSelected > 0 && (
                                        <motion.div
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          className="absolute bottom-2 left-2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1"
                                        >
                                          <Check className="w-4 h-4" />
                                          {isSelected}
                                        </motion.div>
                                      )}
                                    </CardDisplay>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-2xl">Pastikan Penawaranmu</CardTitle>
                      <CardDescription>Cek dulu sebelum kirim ke {partner?.username}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 pb-24">
                      {/* Cards Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                        <div className="p-6 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 border border-blue-200 dark:border-blue-800">
                          <h3 className="font-bold text-lg mb-4 text-blue-900 dark:text-blue-100">Kartu yang Kamu Tawarkan:</h3>
                          <div className="grid grid-cols-2 gap-3">
                            {selectedCards.map(cardId => {
                              const card = myCards.find(c => c.id === cardId);
                              return (
                                <motion.div
                                  key={cardId}
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                >
                                  <CardDisplay card={card?.card} className="h-[140px]" />
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Message Display */}
                      {tradeMessage && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
                        >
                          <div className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-2">Pesan:</div>
                          <p className="text-sm text-blue-900 dark:text-blue-100 italic">"{tradeMessage}"</p>
                        </motion.div>
                      )}

                      {/* Info Alert */}
                      <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                        <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <AlertDescription className="text-amber-800 dark:text-amber-200">
                          {partner?.username} akan memilih kartu apa yang mau ditukar balik. Nanti terserah kamu terima atau tolak!
                        </AlertDescription>
                      </Alert>

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-4">
                        <Button
                          variant="outline"
                          onClick={() => setStep('select')}
                          size="lg"
                          className="flex-1"
                        >
                          ← Kembali
                        </Button>
                        <Button
                          onClick={handleInitiateTrade}
                          disabled={initiateTrade.isPending}
                          size="lg"
                          className="flex-1"
                        >
                          {initiateTrade.isPending ? 'Mengirim...' : '✉️ Kirim'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pending Sent Trades */}
            <AnimatePresence>
              {pendingSent.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card className="border-0 shadow-lg border-l-4 border-l-orange-500">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Clock className="w-5 h-5 text-orange-500" />
                        Menunggu ({pendingSent.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {pendingSent.map((trade, idx) => {
                        const offeringCardIds = safeJsonParse(trade.initiatorOfferingCardIds);
                        const expiresAt = new Date(trade.expiresAt);
                        const timeLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

                        return (
                          <motion.div
                            key={trade.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="p-4 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20"
                          >
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex-1">
                                <div className="font-semibold">Tawaran ke {partner?.username}</div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {offeringCardIds.length} kartu
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge variant="outline" className="whitespace-nowrap">
                                  {timeLeft}h lagi
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => cancelTrade.mutateAsync(trade.id)}
                                  disabled={cancelTrade.isPending}
                                  className="text-xs mt-2 text-red-500 hover:text-red-600"
                                >
                                  Batalkankan
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* RECEIVED TRADES TAB */}
          <TabsContent value="received" className="space-y-6">
            {pendingReceived.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="border-0 shadow-lg">
                  <CardContent className="py-16 text-center">
                    <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-40" />
                    <p className="text-muted-foreground text-lg">
                      Tidak ada tawaran masuk. {partner?.username} belum menawarkan kartu!
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="space-y-6">
                <AnimatePresence>
                  {pendingReceived.map((trade, idx) => {
                    const offeringCardIds = safeJsonParse(trade.initiatorOfferingCardIds) as number[];
                    const offeringCardData = safeJsonParse(trade.initiatorOfferingCardData) as any[];
                    const respondingSuccess = respondingCards.length > 0;

                    // Get cards using the map (no useQuery here)
                    const offeredCards = offeringCardData
                      .map((cd: any) => cardMap[cd.cardId])
                      .filter(Boolean);

                    return (
                      <motion.div
                        key={trade.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: idx * 0.1 }}
                      >
                        <Card className="border-0 shadow-lg border-l-4 border-l-green-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <CardTitle className="text-lg">
                                  {partner?.username} tawar {offeringCardIds.length} kartu
                                </CardTitle>
                                {trade.message && (
                                  <CardDescription className="mt-2 text-base italic text-muted-foreground">
                                    "{trade.message}"
                                  </CardDescription>
                                )}
                              </div>
                              <Badge variant="default" className="bg-green-500">Baru</Badge>
                            </div>
                          </CardHeader>

                          {selectedTradeToRespond?.id !== trade.id ? (
                            <CardContent>
                              <div className="space-y-4">
                                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                                  <h4 className="font-semibold mb-3 text-green-900 dark:text-green-100">Kartu yang ditawar:</h4>
                                  <div className="grid grid-cols-2 gap-3">
                                    {offeredCards.length > 0 ? (
                                      offeredCards.map((card, cardIdx) => (
                                        <motion.div
                                          key={`${trade.id}-${card.id}`}
                                          initial={{ scale: 0 }}
                                          animate={{ scale: 1 }}
                                          transition={{ delay: cardIdx * 0.05 }}
                                        >
                                          <CardDisplay card={card} className="h-[140px]" />
                                        </motion.div>
                                      ))
                                    ) : (
                                      <div className="col-span-2 py-8 text-center text-muted-foreground">
                                        Memuat kartu...
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  onClick={() => setSelectedTradeToRespond(trade)}
                                  size="lg"
                                  className="w-full"
                                >
                                  Lihat & Pilih Kardumu →
                                </Button>
                              </div>
                            </CardContent>
                          ) : (
                            <CardContent className="space-y-4">
                              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                                <h4 className="font-semibold mb-3 text-blue-900 dark:text-blue-100">Pilih penawaran Anda ({Object.values(respondingCards).reduce((a,b) => a+b, 0)} dipilih):</h4>
                                <div className="grid grid-cols-2 gap-4 max-h-80 overflow-y-auto pr-2">
                                  {stackedCards.map((stacked, stackIdx) => {
                                    const respondingQty = respondingCards[stacked.cardId] || 0;
                                    return (
                                      <motion.div
                                        key={stacked.cardId}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        transition={{ delay: stackIdx * 0.02 }}
                                      >
                                        <div className={`relative h-full rounded-2xl border-2 transition-all ${
                                          respondingQty ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-950' : ''
                                        }`}>
                                          <CardDisplay
                                            card={stacked.card}
                                            className="h-full cursor-pointer"
                                            onClick={() => handleSelectCardForRespond(stacked.userCards[0])}
                                          >
                                            {/* Stacking count */}
                                            <div className="absolute top-2 right-2 bg-gray-800 dark:bg-gray-700 text-white px-2 py-1 rounded-full text-xs font-bold">
                                              ×{stacked.count}
                                            </div>
                                            
                                            {respondingQty > 0 && (
                                              <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className="absolute bottom-2 left-2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1"
                                              >
                                                <Check className="w-4 h-4" />
                                                {respondingQty}
                                              </motion.div>
                                            )}
                                          </CardDisplay>
                                        </div>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="flex gap-3 pt-4">
                                <Button
                                  variant="outline"
                                  onClick={() => setSelectedTradeToRespond(null)}
                                  className="flex-1"
                                >
                                  Kembali
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => handleRespondTrade(false)}
                                  disabled={respondTrade.isPending}
                                  className="flex-1"
                                >
                                  <X className="w-4 h-4 mr-2" /> Tolak
                                </Button>
                                <Button
                                  onClick={() => handleRespondTrade(true)}
                                  disabled={Object.values(respondingCards).reduce((a,b) => a+b, 0) === 0 || respondTrade.isPending}
                                  className="flex-1"
                                >
                                  <Check className="w-4 h-4 mr-2" /> Terima
                                </Button>
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          {/* HISTORY TAB */}
          <TabsContent value="history" className="space-y-6">
            {tradeHistory.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="border-0 shadow-lg">
                  <CardContent className="py-16 text-center">
                    <Repeat2 className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-40" />
                    <p className="text-muted-foreground text-lg">
                      Tidak ada riwayat pertukaran. Pertukaran pertama Anda akan muncul di sini!
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {tradeHistory.map((trade, idx) => {
                    const isInitiator = trade.initiatorId === user.id;
                    const initiatorCardData = safeJsonParse(trade.initiatorOfferingCardData, []);
                    const recipientCardData = safeJsonParse(trade.recipientOfferingCardData, []);
                    const offeredCardCount = isInitiator ? initiatorCardData.length : recipientCardData.length;
                    const receivedCardCount = isInitiator ? recipientCardData.length : initiatorCardData.length;
                    
                    // Determine status styling
                    const isSuccess = trade.status === 'completed';
                    const isCancelled = trade.status === 'cancelled' || trade.status === 'rejected';
                    
                    const cardBg = isSuccess 
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-l-4 border-l-green-500'
                      : 'bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border-l-4 border-l-red-500 opacity-75';
                    
                    const statusLabel = isSuccess ? 'Sukses' : 'Batal';
                    const statusBadgeClass = isSuccess 
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700';
                    const statusIcon = isSuccess ? '✓' : '✗';
                    
                    return (
                      <motion.div
                        key={trade.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <Card className={`border-0 shadow-lg ${cardBg}`}>
                          <CardContent className="py-4">
                            <div className="space-y-2">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="font-semibold text-md">
                                    {isInitiator ? '📤 Dikirim ke' : '📥 Diterima dari'} {partner?.username}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                    <span>{new Date(trade.completedAt || trade.createdAt).toLocaleDateString()}</span>
                                    {isSuccess && (
                                      <>
                                        <span>•</span>
                                        <span>{offeredCardCount} ditawarkan • {receivedCardCount} diterima</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <Badge variant="default" className={statusBadgeClass}>
                                  {statusIcon} {statusLabel}
                                </Badge>
                              </div>
                              
                              {trade.message && (
                                <div className="text-sm bg-white/50 dark:bg-black/20 p-2 rounded text-muted-foreground italic">
                                  "{trade.message}"
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating Action Button */}
      {step === 'select' && totalSelectedCards > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed inset-x-0 bottom-32 z-50 flex justify-center px-4"
        >
          <Button
            onClick={() => setIsConfirmModalOpen(true)}
            size="lg"
            className="w-full max-w-sm h-12 text-base font-semibold shadow-xl"
          >
            Lanjutkan dengan {totalSelectedCards} kartu →
          </Button>
        </motion.div>
      )}

      {/* Quantity Picker Modal */}
      <Dialog open={!!quantityPickerCard} onOpenChange={(open) => !open && setQuantityPickerCard(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl">Pilih Jumlah Kartu</DialogTitle>
            <DialogDescription className="text-base">
              {quantityPickerCard?.card?.name} - Tersedia: {quantityPickerCard ? myCards.filter(c => c.card?.id === quantityPickerCard.card.id).length : 0}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Card Preview */}
            {quantityPickerCard && (
              <div className="flex justify-center">
                <CardDisplay card={quantityPickerCard.card} className="h-48 w-32" />
              </div>
            )}

            {/* Quantity Input */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">Berapa kartu?</label>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantityValue(Math.max(0, quantityValue - 1))}
                  className="w-12 h-12"
                >
                  −
                </Button>
                <input
                  type="number"
                  value={quantityValue}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    const available = quantityPickerCard ? myCards.filter(c => c.card?.id === quantityPickerCard.card.id).length : 0;
                    setQuantityValue(Math.min(Math.max(0, val), available));
                  }}
                  className="flex-1 h-12 px-4 text-center text-2xl font-bold border-2 border-border rounded-lg"
                  min="0"
                  max={quantityPickerCard ? myCards.filter(c => c.card?.id === quantityPickerCard.card.id).length : 0}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const available = quantityPickerCard ? myCards.filter(c => c.card?.id === quantityPickerCard.card.id).length : 0;
                    setQuantityValue(Math.min(quantityValue + 1, available));
                  }}
                  className="w-12 h-12"
                >
                  +
                </Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setQuantityValue(0);
                  handleConfirmQuantity();
                }}
                className="flex-1 h-11 text-red-600 hover:text-red-700"
              >
                Hapus
              </Button>
              <Button
                onClick={handleConfirmQuantity}
                className="flex-1 h-11"
              >
                Pilih
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Trade Modal */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Konfirmasi Pertukaran Kartu</DialogTitle>
            <DialogDescription className="text-base">
              Cek kartu dan tulis pesan (opsional)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Selected Cards Preview */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-foreground">Kartu yang Ditawarkan ({totalSelectedCards}):</label>
              <div className="grid grid-cols-2 gap-4 max-h-64 overflow-y-auto pr-2">
                {Object.entries(selectedCards).map(([cardId, quantity]) => {
                  const numCardId = parseInt(cardId);
                  const userCard = myCards.find(c => c.card?.id === numCardId);
                  return userCard ? (
                    <motion.div 
                      key={cardId}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="rounded-xl overflow-hidden border-2 border-border shadow-lg hover:shadow-xl transition-shadow relative"
                    >
                      <CardDisplay card={userCard.card} className="h-40 w-full" />
                      <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                        ×{quantity}
                      </div>
                    </motion.div>
                  ) : null;
                })}
              </div>
            </div>

            {/* Message Input */}
            <div className="space-y-3 pt-2 border-t border-border">
              <label className="text-sm font-semibold text-foreground">Pesan (opsional)</label>
              <Textarea
                placeholder="Tulis pesan... (misal: 'Ini kartu favoritku!' atau biarkan kosong)"
                value={tradeMessage}
                onChange={(e) => setTradeMessage(e.target.value)}
                maxLength={500}
                className="resize-none min-h-24 text-sm rounded-lg"
                rows={3}
              />
              <div className="text-xs text-muted-foreground text-right">
                {tradeMessage.length}/500
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsConfirmModalOpen(false)}
                className="flex-1 h-11"
              >
                Batal
              </Button>
              <Button
                onClick={handleInitiateTrade}
                className="flex-1 h-11"
                disabled={initiateTrade.isPending}
              >
                {initiateTrade.isPending ? 'Mengirim...' : '✉️ Kirim Tawaran'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
