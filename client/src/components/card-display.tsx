import React from "react";
import { motion } from "framer-motion";
import { Clock, Sparkles, Shield, Zap, Heart } from "lucide-react";
import type { Card } from "@shared/schema";
import { cn } from "@/lib/utils";

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

export function CardDisplay({ card, className, onClick, children }: CardDisplayProps) {
  const tierClass = `tier-${card.tier.toLowerCase()}`;
  const Icon = tierIcons[card.tier.toLowerCase() as keyof typeof tierIcons] || Sparkles;

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative flex flex-col justify-between p-5 rounded-3xl border-2 transition-all duration-300",
        tierClass,
        className
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="px-3 py-1 bg-white/40 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider">
          {card.tier}
        </div>
        <div className="flex items-center gap-1 text-xs font-bold px-2 py-1 bg-white/40 backdrop-blur-md rounded-full">
          <Clock className="w-3 h-3" />
          {card.durationMinutes}m
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
        <div className="w-16 h-16 rounded-full bg-white/40 backdrop-blur-md flex items-center justify-center mb-4 shadow-inner">
          <Icon className="w-8 h-8 opacity-80" />
        </div>
        <h3 className="text-xl font-bold mb-2 leading-tight drop-shadow-sm">{card.name}</h3>
        <p className="text-sm opacity-90 leading-relaxed font-medium px-2">{card.description}</p>
      </div>

      {children && <div className="mt-4">{children}</div>}
      
      {/* Glossy overlay effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 rounded-3xl pointer-events-none" />
    </motion.div>
  );
}
