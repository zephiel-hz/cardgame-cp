import React, { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Heart, Stars, Lock, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [pin, setPin] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !pin) return;

    setIsLoading(true);
    try {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: selectedUser, pin }),
      });
      
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Gagal login");
      }
      
      login(data);
      setLocation("/gacha");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Oops!",
        description: error.message || "Gagal masuk ke aplikasi.",
      });
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-pink-50 to-background flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-20 left-10 text-primary/20 animate-pulse"><Heart size={48} /></div>
      <div className="absolute bottom-40 right-10 text-accent/30 animate-bounce" style={{ animationDuration: '3s' }}><Stars size={64} /></div>
      <div className="absolute top-40 right-20 text-secondary/40 rotate-12"><Heart size={32} /></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, type: "spring" }}
        className="w-full max-w-sm space-y-8 z-10"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white shadow-xl shadow-primary/20 mb-2">
            <Heart className="w-10 h-10 text-primary fill-primary" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Gacha LDR</h1>
          <p className="text-muted-foreground font-medium text-sm">Masuk untuk kumpulkan kartu kejutan! 💕</p>
        </div>

        {!selectedUser ? (
          <div className="space-y-4">
            <button
              onClick={() => setSelectedUser("Priatna")}
              className="w-full relative group overflow-hidden rounded-3xl p-[2px] bg-gradient-to-r from-blue-400 to-indigo-500 shadow-xl shadow-blue-500/20 transition-transform active:scale-95"
            >
              <div className="bg-white/90 backdrop-blur-md rounded-[22px] px-6 py-4 group-hover:bg-white/80 transition-colors flex items-center justify-center gap-3">
                <span className="text-lg font-bold text-blue-900">👦🏻 Masuk Priatna</span>
              </div>
            </button>

            <button
              onClick={() => setSelectedUser("Cia")}
              className="w-full relative group overflow-hidden rounded-3xl p-[2px] bg-gradient-to-r from-pink-400 to-rose-500 shadow-xl shadow-pink-500/20 transition-transform active:scale-95"
            >
              <div className="bg-white/90 backdrop-blur-md rounded-[22px] px-6 py-4 group-hover:bg-white/80 transition-colors flex items-center justify-center gap-3">
                <span className="text-lg font-bold text-pink-900">👧🏻 Masuk Cia</span>
              </div>
            </button>
          </div>
        ) : (
          <motion.form 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={handleLogin} 
            className="bg-white/80 backdrop-blur-md p-8 rounded-[2.5rem] shadow-2xl border border-white space-y-6"
          >
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-foreground">Halo, {selectedUser}!</h2>
              <p className="text-xs text-muted-foreground">Masukkan 4 digit PIN kamu</p>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40 w-5 h-5" />
                <Input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="PIN"
                  className="pl-12 h-14 text-center text-2xl tracking-[1em] font-bold rounded-2xl border-primary/20 focus:border-primary focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={isLoading || pin.length < 4}
                className="w-full py-4 rounded-2xl font-bold text-white shadow-lg bg-gradient-to-r from-primary to-rose-500 hover:shadow-primary/40 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:pointer-events-none transition-all"
              >
                {isLoading ? "Memverifikasi..." : "Masuk Sekarang"}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setSelectedUser(null);
                  setPin("");
                }}
                className="w-full text-sm font-semibold text-muted-foreground hover:text-primary transition-colors py-2"
              >
                Bukan kamu? Kembali
              </button>
            </div>
          </motion.form>
        )}
      </motion.div>
    </div>
  );
}
