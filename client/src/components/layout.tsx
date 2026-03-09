import React from "react";
import { Link, useLocation } from "wouter";
import { Gift, LayoutGrid, Zap, User as UserIcon, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const tabs = [
    { href: "/gacha", icon: Gift, label: "Gacha" },
    { href: "/inventory", icon: LayoutGrid, label: "Koleksi" },
    { href: "/active", icon: Zap, label: "Aktif" },
    { href: "/profile", icon: UserIcon, label: "Profil" },
  ];

  // If not logged in, don't show the nav
  if (!user || !user.username) {
    return <div className="min-h-screen w-full bg-background flex flex-col">{children}</div>;
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden border-x border-border/10">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between bg-pink-100 dark:bg-gradient-to-r dark:from-purple-600 dark:to-purple-500 backdrop-blur-md shrink-0 z-20 border-b border-pink-300 dark:border-pink-400/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-400 to-pink-300 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-pink-600/40 overflow-hidden">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
            ) : (
              String(user.username).charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-xs text-pink-700 dark:text-pink-100 font-medium">Hai, Sayang!</p>
            <p className="font-bold text-pink-900 dark:text-white leading-none">{user.username}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => {
            logout();
            setLocation("/");
          }}
          className="rounded-full text-pink-700 dark:text-pink-100 hover:text-pink-900 dark:hover:text-pink-300 transition-colors"
        >
          <LogOut size={20} />
        </Button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 pt-6 pb-28 hide-scrollbar">
        {children}
      </main>

      {/* Bottom Navigation */}
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
    </div>
  );
}
