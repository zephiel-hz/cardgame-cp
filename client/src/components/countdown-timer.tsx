import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  expiresAt: string | Date;
  onExpire?: () => void;
  className?: string;
}

export function CountdownTimer({ expiresAt, onExpire, className }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const targetDate = new Date(expiresAt).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance <= 0) {
        setTimeLeft("00:00:00");
        if (!isExpired) {
          setIsExpired(true);
          onExpire?.();
        }
        return;
      }

      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

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
      "flex items-center gap-2 font-mono font-medium px-3 py-1.5 rounded-full text-sm shadow-sm",
      isExpired ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary border border-primary/20",
      className
    )}>
      <Clock className="w-4 h-4" />
      {isExpired ? "Waktu Habis" : timeLeft}
    </div>
  );
}
