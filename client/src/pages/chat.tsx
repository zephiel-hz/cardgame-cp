import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ChatWindow } from "@/components/chat-window";
import { api, buildUrl } from "@shared/routes";
import type { User } from "@shared/schema";

export default function Chat() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

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
        <h3 className="font-bold text-xl mb-2 text-slate-900 dark:text-white">{t('common.noPartner')}</h3>
        <p className="text-center text-muted-foreground max-w-xs mb-6">
          {t('chat.selectPartnerToChat')}
        </p>
        <button
          onClick={() => setLocation('/partner-pairing')}
          className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-medium transition-colors"
        >
          {t('partnership.findPartner')}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white dark:bg-slate-950 flex flex-col md:items-center md:justify-center overflow-hidden">
      {/* Mobile: fullscreen, Desktop: flex centered */}
      <div className="w-full h-full md:w-auto md:h-auto md:max-w-2xl md:rounded-xl md:overflow-hidden md:border md:border-gray-200 md:dark:border-slate-700 md:shadow-lg md:bg-white md:dark:bg-slate-900">
        <ChatWindow
          userId={user.id}
          partnerId={partner.id}
          partnerName={partner.username}
          partnerData={partner}
          onBack={() => setLocation('/')}
        />
      </div>
    </div>
  );
}
