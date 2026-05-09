import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, Sparkles, Shield, Zap, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Card } from "@shared/schema";
import { cn, formatDuration } from "@/lib/utils";

interface CardDisplayProps {
  card: Card;
  className?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

const tierIcons = {
  common: Shield,
  rare: Heart,
  epic: Zap,
  legendary: Sparkles,
};

const tierStyles = {
  common: "tier-common",
  rare: "tier-rare",
  epic: "tier-epic",
  legendary: "tier-legendary",
  ssr: "tier-ssr bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 border-purple-500 shadow-2xl shadow-purple-500/50 text-white",
};

export function CardDisplay({ card, className, onClick, children }: CardDisplayProps) {
  const { t } = useTranslation();
  
  const cardName = useMemo(() => t(`cards.card_${card.id}.name`, { defaultValue: card.name }), [card.id, card.name, t]);
  const cardDescription = useMemo(() => t(`cards.card_${card.id}.description`, { defaultValue: card.description }), [card.id, card.description, t]);
  
  const tierLower = card.tier.toLowerCase();
  const isSSR = tierLower === 'ssr';
  const styleKey = isSSR ? 'ssr' : (tierStyles[tierLower as keyof typeof tierStyles] ? tierLower : 'common');
  const Icon = tierIcons[tierLower as keyof typeof tierIcons] || Sparkles;

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative flex flex-col justify-between p-2 rounded-2xl border-2 transition-all duration-300 overflow-hidden h-full",
        tierStyles[styleKey as keyof typeof tierStyles],
        className
      )}
    >
      <style>{`
        @keyframes shimmer {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        
        .tier-ssr {
          background: linear-gradient(45deg, #ec4899, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6, #ec4899);
          background-size: 300% 300%;
          animation: shimmer 3s ease infinite;
          position: relative;
          overflow: hidden;
        }
        
        .tier-ssr::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 100%);
          pointer-events: none;
        }
      `}</style>
      <div className="flex justify-between items-start mb-1 relative z-10 gap-1">
        <div className="px-1.5 py-0.5 bg-foreground/10 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-widest">
          {card.tier}
        </div>
        <div className="flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 bg-foreground/10 backdrop-blur-md rounded-full">
          <Clock className="w-3 h-3" />
          {formatDuration(card.durationMinutes)}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center py-1 relative z-10">
        <div className="w-10 h-10 rounded-full bg-foreground/10 backdrop-blur-md flex items-center justify-center mb-1 shadow-inner">
          <Icon className="w-5 h-5 opacity-80" />
        </div>
        <h3 className="text-xs font-bold mb-0.5 leading-tight drop-shadow-sm line-clamp-2">{cardName}</h3>
        <p className="text-xs opacity-80 leading-snug font-medium px-1 line-clamp-1">{cardDescription}</p>
      </div>

      {children && <div className="mt-auto relative z-10">{children}</div>}
      
      {/* Glossy overlay effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 rounded-3xl pointer-events-none" />
    </motion.div>
  );
}
