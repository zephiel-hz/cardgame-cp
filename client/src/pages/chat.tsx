import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ChatWindow } from "@/components/chat-window";
import { api, buildUrl } from "@shared/routes";
import type { User } from "@shared/schema";

export default function Chat() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Fetch partner info
  const { data: partner, isLoading } = useQuery({
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-accent"></div>
      </div>
    );
  }

  if (!partner || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="w-20 h-20 bg-pink-200 dark:bg-pink-700/50 rounded-full flex items-center justify-center mb-4">
          <MessageCircle className="w-10 h-10 text-pink-600 dark:text-pink-300" />
        </div>
        <h3 className="font-bold text-xl mb-2">Tidak Ada Partner</h3>
        <p className="text-center text-muted-foreground max-w-xs">
          Kamu harus memiliki partner terlebih dahulu untuk menggunakan chat.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-10 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <MessageCircle className="w-8 h-8 text-blue-500" />
          Chat dengan {partner.username}
        </h1>
        <p className="text-muted-foreground text-sm font-medium mt-1">
          💬 Real-time messaging dengan partner mu
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <ChatWindow
          userId={user.id}
          partnerId={partner.id}
          partnerName={partner.username}
        />
      </div>
    </div>
  );
}
