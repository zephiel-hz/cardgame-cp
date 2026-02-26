import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Heart, Stars } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (username: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      
      if (!res.ok) throw new Error("Gagal login");
      
      const user = await res.json();
      login(user);
      setLocation("/gacha");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Oops!",
        description: "Gagal masuk ke aplikasi.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-20 left-10 text-primary/20 animate-pulse"><Heart size={48} /></div>
      <div className="absolute bottom-40 right-10 text-accent/30 animate-bounce" style={{ animationDuration: '3s' }}><Stars size={64} /></div>
      <div className="absolute top-40 right-20 text-secondary/40 rotate-12"><Heart size={32} /></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, type: "spring" }}
        className="w-full max-w-sm space-y-12 z-10"
      >
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white shadow-xl shadow-primary/20 mb-4">
            <Heart className="w-12 h-12 text-primary fill-primary" />
          </div>
          <h1 className="text-4xl font-extrabold text-foreground tracking-tight">Gacha LDR</h1>
          <p className="text-muted-foreground font-medium text-lg">Kumpulkan kartu dan gunakan untuk pasanganmu! 💕</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => handleLogin("Priatna")}
            disabled={isLoading}
            className="w-full relative group overflow-hidden rounded-3xl p-[2px] bg-gradient-to-r from-blue-400 to-indigo-500 shadow-xl shadow-blue-500/20 transition-transform active:scale-95"
          >
            <div className="bg-white/90 backdrop-blur-md rounded-[22px] px-6 py-4 group-hover:bg-white/80 transition-colors flex items-center justify-center gap-3">
              <span className="text-xl font-bold text-blue-900">Masuk sebagai Priatna</span>
              <span className="text-2xl">👦🏻</span>
            </div>
          </button>

          <button
            onClick={() => handleLogin("Cia")}
            disabled={isLoading}
            className="w-full relative group overflow-hidden rounded-3xl p-[2px] bg-gradient-to-r from-pink-400 to-rose-500 shadow-xl shadow-pink-500/20 transition-transform active:scale-95"
          >
            <div className="bg-white/90 backdrop-blur-md rounded-[22px] px-6 py-4 group-hover:bg-white/80 transition-colors flex items-center justify-center gap-3">
              <span className="text-xl font-bold text-pink-900">Masuk sebagai Cia</span>
              <span className="text-2xl">👧🏻</span>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
