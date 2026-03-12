import { useState, useEffect } from "react";

interface CountdownTime {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
}

export function useCountdown(targetTime: Date | string | undefined): CountdownTime | null {
  const [countdown, setCountdown] = useState<CountdownTime | null>(null);

  useEffect(() => {
    if (!targetTime) {
      setCountdown(null);
      return;
    }

    const target = typeof targetTime === "string" ? new Date(targetTime) : targetTime;

    const updateCountdown = () => {
      const now = new Date();
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown({ hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 });
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setCountdown({ hours, minutes, seconds, totalSeconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [targetTime]);

  return countdown;
}
