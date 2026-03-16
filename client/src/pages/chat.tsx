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
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500"></div>
      </div>
    );
  }

  if (!partner || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white dark:bg-slate-950">
        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
          <MessageCircle className="w-10 h-10 text-blue-500" />
        </div>
        <h3 className="font-bold text-xl mb-2">No Partner Yet</h3>
        <p className="text-center text-muted-foreground max-w-xs mb-6">
          You need to pair with a partner first to use the messaging feature.
        </p>
        <button
          onClick={() => setLocation('/partner-pairing')}
          className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-medium transition-colors"
        >
          Find Partner
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-950 overflow-hidden">
      <ChatWindow
        userId={user.id}
        partnerId={partner.id}
        partnerName={partner.username}
        partnerData={partner}
        onBack={() => setLocation('/')}
      />
    </div>
  );
}
