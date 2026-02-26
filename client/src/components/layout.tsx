import React from "react";
import { Link, useLocation } from "wouter";
import { Gift, LayoutGrid, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();

  const tabs = [
    { href: "/gacha", icon: Gift, label: "Gacha" },
    { href: "/inventory", icon: LayoutGrid, label: "Koleksi" },
    { href: "/active", icon: Zap, label: "Aktif" },
  ];

  // If not logged in, don't show the nav
  if (!user) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto relative shadow-2xl overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between bg-white/50 backdrop-blur-md sticky top-0 z-20 border-b border-white/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-white font-bold text-lg shadow-md shadow-primary/20">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Hai, Sayang!</p>
            <p className="font-bold text-foreground leading-none">{user.username}</p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-6 hide-scrollbar">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-white shadow-[0_-10px_40px_rgba(0,0,0,0.05)] px-6 py-4 z-20 rounded-t-3xl">
        <div className="flex justify-between items-center">
          {tabs.map((tab) => {
            const isActive = location === tab.href;
            const Icon = tab.icon;
            return (
              <Link key={tab.href} href={tab.href} className="flex-1 flex flex-col items-center">
                <div 
                  className={cn(
                    "flex flex-col items-center gap-1.5 transition-all duration-300",
                    isActive ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground hover:scale-105"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-2xl transition-colors duration-300",
                    isActive ? "bg-primary/10 shadow-inner" : "bg-transparent"
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
