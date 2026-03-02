import React, { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  expiresAt: string | Date;
  onExpire?: () => void;
  className?: string;
}

export function CountdownTimer({ expiresAt, onExpire, className }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);
  const [isWarning, setIsWarning] = useState(false);

  useEffect(() => {
    const targetDate = new Date(expiresAt).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance <= 0) {
        setTimeLeft("00:00:00");
        setIsWarning(false);
        if (!isExpired) {
          setIsExpired(true);
          onExpire?.();
        }
        return;
      }

      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      // Check if expiring within next 5 minutes (300 seconds)
      setIsWarning(distance < 5 * 60 * 1000 && distance > 0);

      setTimeLeft(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, isExpired, onExpire]);

  return (
    <div className={cn(
      "flex items-center gap-2 font-mono font-medium px-3 py-1.5 rounded-full text-sm shadow-sm border transition-colors",
      isExpired 
        ? "bg-muted text-muted-foreground border-muted" 
        : isWarning
        ? "bg-pink-500/20 text-pink-300 border-pink-400/50 animate-pulse"
        : "bg-primary/10 text-primary border-primary/20",
      className
    )}>
      {isWarning ? (
        <AlertTriangle className="w-4 h-4" />
      ) : (
        <Clock className="w-4 h-4" />
      )}
      {isExpired ? "Waktu Habis" : timeLeft}
    </div>
  );
}
