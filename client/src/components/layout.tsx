import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Gift, LayoutGrid, Zap, User as UserIcon, LogOut, Heart, ChevronDown, MessageCircle, Repeat2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { User } from "@shared/schema";
import { useTranslation } from "react-i18next";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch partner info
  const { data: partner } = useQuery({
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

  // Fetch unread message count
  const { data: unreadData } = useQuery({
    queryKey: ['unreadCount', user?.id],
    queryFn: async () => {
      if (!user?.id) return { unreadCount: 0 };
      try {
        const response = await fetch(buildUrl(api.chat.getUnreadCount.path, { userId: user.id }));
        if (!response.ok) return { unreadCount: 0 };
        return response.json();
      } catch {
        return { unreadCount: 0 };
      }
    },
    enabled: !!user?.id,
    // Refetch every 10 seconds to get real-time unread count
    refetchInterval: 10000,
  });

  const tabs = [
    { href: "/gacha", icon: Gift, label: t('common.navGacha') },
    { href: "/inventory", icon: LayoutGrid, label: t('common.navInventory') },
    { href: "/active", icon: Zap, label: t('common.navActive') },
    { href: "/partner-pairing", icon: Heart, label: t('common.navPartner') },
    { href: "/trading", icon: Repeat2, label: t('common.navTrade') },
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };

    if (isProfileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileDropdownOpen]);

  // If not logged in, don't show the nav
  if (!user || !user.username) {
    return <div className="min-h-screen w-full bg-background flex flex-col">{children}</div>;
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden border-x border-border/10">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between bg-gradient-to-r from-pink-100 via-pink-50 to-pink-100 dark:bg-gradient-to-r dark:from-purple-600 dark:via-purple-500 dark:to-pink-500 backdrop-blur-md shrink-0 z-20 border-b border-pink-200 dark:border-pink-400/40 shadow-sm dark:shadow-lg">
        {/* Profile Dropdown */}
        <div className="flex items-center gap-3 flex-1 relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
            className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity focus:outline-none"
            type="button"
          >
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-pink-500 dark:from-pink-400 dark:to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-pink-500/40 overflow-hidden border-2 border-white/50">
              {user.avatarUrl && user.id ? (
                <img src={`/api/avatars/${user.id}?t=${Date.now()}`} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                String(user.username).charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <p className="text-xs text-pink-600 dark:text-pink-200 font-bold tracking-wide">{t('common.greeting')}</p>
              <p className="font-bold text-pink-900 dark:text-white leading-none text-sm">{user.username}</p>
            </div>
          </button>

          {/* Dropdown Menu */}
          {isProfileDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-pink-200 dark:border-pink-400/20 overflow-hidden min-w-40 z-50">
              <button
                onClick={() => {
                  setLocation("/profile");
                  setIsProfileDropdownOpen(false);
                }}
                className="w-full px-4 py-3 text-left text-pink-900 dark:text-white hover:bg-pink-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 font-medium border-b border-pink-200 dark:border-pink-400/20"
              >
                <UserIcon size={18} />
                Profil
              </button>
              <button
                onClick={() => {
                  logout();
                  setLocation("/");
                  setIsProfileDropdownOpen(false);
                }}
                className="w-full px-4 py-3 text-left text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 font-medium"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Chat Button - Top Right */}
        {partner && user && (
          <Button
            onClick={() => {
              setLocation("/chat");
              // Invalidate unread count when opening chat
              queryClient.setQueryData(['unreadCount', user.id], { unreadCount: 0 });
            }}
            variant="outline"
            size="sm"
            className="gap-2 ml-3 relative"
            title="Chat dengan partner"
          >
            <div className="relative">
              <MessageCircle className="w-4 h-4" />
              {/* Unread badge */}
              {unreadData?.unreadCount && unreadData.unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
                  {unreadData.unreadCount > 99 ? '99+' : unreadData.unreadCount}
                </span>
              )}
            </div>
            <span className="hidden xs:inline text-xs">Chat</span>
          </Button>
        )}
      </header>

      {/* Main Content Area */}
      <main className={cn("flex-1 overflow-y-auto px-4 pt-6 hide-scrollbar", location !== "/chat" ? "pb-28" : "")}>
        {children}
      </main>

      {/* Bottom Navigation - Hidden on chat page */}
      {location !== "/chat" && (
        <nav className="shrink-0 bg-pink-100 dark:bg-gradient-to-r dark:from-purple-900 dark:to-purple-800 backdrop-blur-xl border-t border-pink-300 dark:border-pink-400/20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.2)] px-6 pt-3 pb-8 z-20 rounded-t-[2.5rem]">
          <div className="flex justify-between items-center gap-1">
            {tabs.map((tab) => {
              const isActive = location === tab.href;
              const Icon = tab.icon;
              return (
                <Link key={tab.href} href={tab.href} className="flex-1 flex flex-col items-center">
                  <div 
                    className={cn(
                      "flex flex-col items-center gap-1.5 transition-all duration-300",
                      isActive ? "text-pink-600 dark:text-pink-400 scale-110" : "text-pink-600 dark:text-pink-200 hover:text-pink-700 dark:hover:text-pink-100 hover:scale-105"
                    )}
                  >
                    <div className={cn(
                      "p-3 rounded-2xl transition-colors duration-300",
                      isActive ? "bg-pink-200 dark:bg-pink-500/20 shadow-inner dark:shadow-inner dark:shadow-pink-500/30" : "bg-transparent"
                    )}>
                      <Icon className={cn("w-6 h-6", isActive ? "stroke-[2.5px]" : "stroke-2")} />
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold tracking-wide",
                      isActive ? "opacity-100" : "opacity-70"
                    )}>
                      {tab.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
