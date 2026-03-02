import React from "react";
import { motion } from "framer-motion";
import { Clock, Sparkles, Shield, Zap, Heart } from "lucide-react";
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
        "relative flex flex-col justify-between p-5 rounded-3xl border-2 transition-all duration-300",
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
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="px-3 py-1 bg-foreground/10 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">
          {card.tier}
        </div>
        <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-foreground/10 backdrop-blur-md rounded-full">
          <Clock className="w-3 h-3" />
          {formatDuration(card.durationMinutes)}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center py-4 relative z-10">
        <div className="w-16 h-16 rounded-full bg-foreground/10 backdrop-blur-md flex items-center justify-center mb-4 shadow-inner">
          <Icon className="w-8 h-8 opacity-80" />
        </div>
        <h3 className="text-xl font-bold mb-2 leading-tight drop-shadow-sm">{card.name}</h3>
        <p className="text-sm opacity-90 leading-relaxed font-medium px-2">{card.description}</p>
      </div>

      {children && <div className="mt-4 relative z-10">{children}</div>}
      
      {/* Glossy overlay effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 rounded-3xl pointer-events-none" />
    </motion.div>
  );
}
