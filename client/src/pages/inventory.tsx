import React from "react";
import { motion } from "framer-motion";
import { Inbox } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useInventory, useUseCard } from "@/hooks/use-cards";
import { CardDisplay } from "@/components/card-display";
import { useToast } from "@/hooks/use-toast";

export default function Inventory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: cards, isLoading } = useInventory(user?.id);
  const useCard = useUseCard();

  const handleUseCard = async (userCardId: number, cardName: string) => {
    try {
      await useCard.mutateAsync(userCardId);
      toast({
        title: "Kartu Aktif!",
        description: `Kamu telah menggunakan kartu: ${cardName}`,
        className: "bg-green-500 text-white border-none",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message,
      });
    }
  };

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
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="pb-10">
      <div className="mb-6 px-2">
        <h2 className="text-2xl font-bold text-foreground">Koleksi Kartumu</h2>
        <p className="text-muted-foreground text-sm font-medium mt-1">
          Gunakan kartu ini untuk meminta sesuatu dari pasanganmu!
        </p>
      </div>

      {!cards || cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-pink-50 dark:bg-gradient-to-br dark:from-purple-800/30 dark:to-purple-700/30 backdrop-blur-sm rounded-3xl p-10 border border-dashed border-pink-300 dark:border-pink-400/30 mt-10">
          <div className="w-20 h-20 bg-pink-200 dark:bg-purple-700/50 rounded-full flex items-center justify-center mb-4">
            <Inbox className="w-10 h-10 text-pink-600 dark:text-pink-300" />
          </div>
          <h3 className="font-bold text-xl mb-2 text-pink-900 dark:text-pink-200">Koleksi Kosong</h3>
          <p className="text-center text-pink-700 dark:text-pink-200/70">Ayo pergi ke tab Gacha untuk menarik kartu baru!</p>
        </div>
      ) : (
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-5"
        >
          {cards.map((userCard) => (
            <motion.div key={userCard.id} variants={item}>
              <CardDisplay card={userCard.card}>
                <button
                  onClick={() => handleUseCard(userCard.id, userCard.card.name)}
                  disabled={useCard.isPending}
                  className="w-full mt-2 bg-gradient-to-r from-pink-500 to-pink-400 hover:from-pink-400 hover:to-pink-300 text-white font-bold py-3 rounded-xl shadow-md shadow-pink-500/30 transition-transform active:scale-95 border border-pink-300/50"
                >
                  {useCard.isPending && useCard.variables === userCard.id ? "Mengaktifkan..." : "Gunakan Sekarang"}
                </button>
              </CardDisplay>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
