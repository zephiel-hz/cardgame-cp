import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Heart, Stars, Lock, User as UserIcon, UserPlus, X, Mail, CheckCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { User } from "@shared/schema";

interface SavedAccount {
  id: number;
  username: string;
  gender: string;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [showSavedAccounts, setShowSavedAccounts] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<SavedAccount | null>(null);
  
  // Login form state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPin, setLoginPin] = useState("");
  
  // Register form state
  const [regUsername, setRegUsername] = useState("");
  const [regPin, setRegPin] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regGender, setRegGender] = useState("other");
  const [regEmailVerified, setRegEmailVerified] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");

  // Load saved accounts on mount
  useEffect(() => {
    const saved = localStorage.getItem("gacha_saved_accounts");
    if (saved) {
      try {
        setSavedAccounts(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved accounts:", e);
      }
    }
  }, []);

  const savAccountForLater = (user: User) => {
    const savedAccounts = localStorage.getItem("gacha_saved_accounts");
    let accounts: SavedAccount[] = [];
    
    if (savedAccounts) {
      try {
        accounts = JSON.parse(savedAccounts);
      } catch (e) {
        console.error("Failed to parse saved accounts:", e);
      }
    }

    // Check if account already saved
    const exists = accounts.find(a => a.id === user.id);
    if (!exists) {
      accounts.push({
        id: user.id,
        username: user.username,
        gender: user.gender || "other",
      });
      localStorage.setItem("gacha_saved_accounts", JSON.stringify(accounts));
      setSavedAccounts(accounts);
    }
  };

  const removeSavedAccount = (accountId: number) => {
    const filtered = savedAccounts.filter(a => a.id !== accountId);
    localStorage.setItem("gacha_saved_accounts", JSON.stringify(filtered));
    setSavedAccounts(filtered);
  };

  const getGenderEmoji = (gender?: string): string => {
    switch (gender) {
      case "male":
        return "👦🏻";
      case "female":
        return "👧🏻";
      default:
        return "🤷";
    }
  };

  const getGradient = (gender?: string): string => {
    switch (gender) {
      case "male":
        return "from-blue-400 to-indigo-500 shadow-blue-500/20";
      case "female":
        return "from-pink-400 to-rose-500 shadow-pink-500/20";
      default:
        return "from-pink-400 to-pink-500 shadow-pink-500/20";
    }
  };

  const handleSavedAccountLogin = async (account: SavedAccount) => {
    setSelectedAccount(account);
    setLoginUsername(account.username);
    setShowSavedAccounts(false);
  };

  const handleSendVerificationCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail.trim()) {
      toast({
        title: "Error",
        description: "Isi email terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('[Login] Sending verification email to:', regEmail);
      const response = await fetch(api.auth.sendRegistrationEmail.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: regEmail.trim(),
        }),
      });

      console.log('[Login] Response status:', response.status);
      console.log('[Login] Response headers:', Object.fromEntries(response.headers));
      
      let data;
      const contentType = response.headers.get("content-type") || "";

      try {
        // Always try to parse as JSON first
        if (response.status === 204) {
          // No content
          data = {};
        } else if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          // Fallback: try to parse as text first
          const text = await response.text();
          console.log('[Login] Response text:', text);
          
          if (text.trim() === "") {
            data = {};
          } else {
            try {
              data = JSON.parse(text);
            } catch {
              console.error("[Login] Failed to parse response as JSON:", text);
              throw new Error(`Invalid server response: ${text.substring(0, 100)}`);
            }
          }
        }
      } catch (parseErr) {
        console.error('[Login] Parse error:', parseErr);
        throw parseErr;
      }

      console.log('[Login] Parsed data:', data);

      if (response.ok) {
        setVerificationSent(true);
        toast({
          title: "Success",
          description: "Kode verifikasi dikirim ke email Anda",
        });
      } else {
        toast({
          title: "Error",
          description: data?.message || "Gagal mengirim kode verifikasi",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("[Login] Send verification error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal mengirim kode verifikasi",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationToken.trim()) {
      toast({
        title: "Error",
        description: "Isi token verifikasi dari email Anda",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(api.auth.verifyEmail.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: verificationToken.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setRegEmailVerified(true);
        setVerificationToken("");
        setVerificationSent(false);
        toast({
          title: "Success",
          description: "Email berhasil diverifikasi. Silakan lengkapi data dan buat akun.",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.message || "Token verifikasi salah atau kadaluarsa",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Verify email error:", error);
      toast({
        title: "Error",
        description: "Gagal memverifikasi email",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPin.trim()) {
      toast({
        title: "Error",
        description: "Isi username dan PIN",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(api.auth.login.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: loginUsername.trim(),
          pin: loginPin.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        login(data);
        savAccountForLater(data);
        setLocation("/");
      } else {
        const error = await response.json();
        toast({
          title: "Login Gagal",
          description: error.message || "Username atau PIN salah",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Error",
        description: "Gagal login. Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername.trim() || !regPin.trim() || !regGender) {
      toast({
        title: "Error",
        description: "Isi semua field yang diperlukan",
        variant: "destructive",
      });
      return;
    }

    if (regPin.length < 4) {
      toast({
        title: "Error",
        description: "PIN minimal 4 digit",
        variant: "destructive",
      });
      return;
    }

    if (!regEmailVerified) {
      toast({
        title: "Error",
        description: "Email harus diverifikasi terlebih dahulu",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(api.auth.register.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: regUsername.trim(),
          pin: regPin.trim(),
          gender: regGender,
          email: regEmail.trim(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        login(data);
        savAccountForLater(data);
        setLocation("/partner-pairing");
      } else {
        const error = await response.json();
        toast({
          title: "Register Gagal",
          description: error.message || "Username mungkin sudah digunakan",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Register error:", error);
      toast({
        title: "Error",
        description: "Gagal register. Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-pink-50 to-background flex flex-col items-center justify-start md:justify-center p-6 overflow-y-auto overflow-x-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-20 left-10 text-primary/20 animate-pulse pointer-events-none">
        <Heart size={48} />
      </div>
      <div
        className="absolute bottom-40 right-10 text-accent/30 animate-bounce pointer-events-none"
        style={{ animationDuration: "3s" }}
      >
        <Stars size={64} />
      </div>
      <div className="absolute top-40 right-20 text-secondary/40 rotate-12 pointer-events-none">
        <Heart size={32} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, type: "spring" }}
        className="w-full max-w-sm space-y-8 z-10 my-auto md:my-0"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 to-pink-400 shadow-xl shadow-pink-500/30 mb-2">
            <Heart className="w-10 h-10 text-white fill-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            Gacha LDR
          </h1>
          <p className="text-muted-foreground font-medium text-sm">
            Masuk untuk kumpulkan kartu kejutan! 💕
          </p>
        </div>

        {/* Saved Accounts View */}
        {showSavedAccounts && savedAccounts.length > 0 && !isRegisterMode ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            <div className="text-center mb-6">
              <p className="text-sm font-semibold text-muted-foreground">
                Pilih akun untuk melanjutkan
              </p>
            </div>

            {savedAccounts.map((account) => (
              <motion.button
                key={account.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSavedAccountLogin(account)}
                className={`relative w-full p-4 rounded-2xl bg-gradient-to-r ${getGradient(
                  account.gender
                )} text-white font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-between group`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getGenderEmoji(account.gender)}</span>
                  <span>Masuk {account.username}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSavedAccount(account.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={20} />
                </button>
              </motion.button>
            ))}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setShowSavedAccounts(false);
                setIsRegisterMode(true);
              }}
              className="w-full p-4 rounded-2xl border-2 border-primary/30 text-primary font-bold hover:bg-primary/5 transition-all"
            >
              <UserPlus size={20} className="inline mr-2" />
              Daftar Akun Baru
            </motion.button>
          </motion.div>
        ) : !isRegisterMode ? (
          /* Login Form */
          <motion.form
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={handleLoginSubmit}
            className="bg-white dark:bg-gradient-to-br dark:from-purple-900/95 dark:to-purple-800/95 backdrop-blur-md p-8 rounded-[2.5rem] shadow-2xl dark:border dark:border-pink-400/20 space-y-6"
          >
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-foreground flex items-center justify-center gap-2">
                <UserIcon size={20} /> Login
              </h2>
              <p className="text-xs text-muted-foreground">
                Masukkan username dan PIN kamu
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-username" className="text-xs font-semibold">
                Nama Pengguna
              </Label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40 w-5 h-5" />
                <Input
                  id="login-username"
                  autoFocus
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Masukkan username kamu"
                  className="pl-12 h-12 rounded-xl border-primary/20 focus:border-primary focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-pin" className="text-xs font-semibold">
                PIN (4 Digit)
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40 w-5 h-5" />
                <Input
                  id="login-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={loginPin}
                  onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="PIN"
                  className="pl-12 h-14 text-center text-2xl tracking-[1em] font-bold rounded-2xl border-primary/20 focus:border-primary focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={isLoading || !loginUsername || loginPin.length < 4}
                className="w-full py-4 rounded-2xl font-bold text-white shadow-lg bg-gradient-to-r from-primary to-rose-500 hover:shadow-primary/40 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:pointer-events-none transition-all"
              >
                {isLoading ? "Memverifikasi..." : "Masuk Sekarang"}
              </button>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(true);
                    setShowSavedAccounts(false);
                  }}
                  className="w-full text-sm font-semibold text-white hover:text-white transition-all py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg active:scale-95"
                >
                  <UserPlus size={16} className="inline mr-2" />
                  Belum punya akun? Daftar di sini
                </button>

                {savedAccounts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSavedAccounts(true)}
                    className="w-full text-sm font-semibold text-primary hover:bg-primary/5 transition-all py-2 rounded-lg border-2 border-primary/30"
                  >
                    ← Kembali ke Akun Tersimpan
                  </button>
                )}
              </div>
            </div>
          </motion.form>
        ) : (
          /* Register Form */
          <motion.form
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-gradient-to-br dark:from-purple-900/95 dark:to-purple-800/95 backdrop-blur-md p-8 rounded-[2.5rem] shadow-2xl dark:border dark:border-pink-400/20 space-y-6"
          >
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-foreground flex items-center justify-center gap-2">
                <UserPlus size={20} /> Daftar Akun Baru
              </h2>
              <p className="text-xs text-muted-foreground">
                Buat akun untuk bermain Gacha LDR
              </p>
            </div>

            {/* Email Verification Section */}
            <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <Label htmlFor="reg-email" className="text-xs font-semibold flex items-center gap-2">
                  <Mail size={16} className="text-blue-600" />
                  Email (Wajib Verifikasi)
                </Label>
                {regEmailVerified && (
                  <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle size={16} />
                    Terverifikasi
                  </div>
                )}
              </div>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 w-5 h-5" />
                <Input
                  id="reg-email"
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="nama@email.com"
                  disabled={regEmailVerified}
                  className="pl-10 h-10 rounded-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              {!regEmailVerified && !verificationSent && (
                <button
                  type="button"
                  onClick={handleSendVerificationCode}
                  disabled={isLoading || !regEmail.trim()}
                  className="w-full py-2 rounded-lg font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-all"
                >
                  {isLoading ? "Mengirim..." : "Kirim Kode Verifikasi"}
                </button>
              )}

              {verificationSent && !regEmailVerified && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      type="text"
                      value={verificationToken}
                      onChange={(e) => setVerificationToken(e.target.value)}
                      placeholder="Token dari email"
                      className="h-10 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyEmail}
                    disabled={isLoading || !verificationToken.trim()}
                    className="px-4 py-2 rounded-lg font-semibold text-sm bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-all"
                  >
                    Verifikasi
                  </button>
                </div>
              )}
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="reg-username" className="text-xs font-semibold">
                Nama Pengguna
              </Label>
              <Input
                id="reg-username"
                autoFocus
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                placeholder="Minimal 3 karakter"
                className="h-12 rounded-xl border-primary/20 focus:border-primary focus:ring-primary/20"
              />
            </div>

            {/* PIN */}
            <div className="space-y-2">
              <Label htmlFor="reg-pin" className="text-xs font-semibold">
                PIN (4 Digit)
              </Label>
              <Input
                id="reg-pin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={regPin}
                onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ""))}
                placeholder="PIN"
                className="h-12 text-center text-lg tracking-[0.5em] font-bold rounded-xl border-primary/20 focus:border-primary focus:ring-primary/20"
              />
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label htmlFor="gender" className="text-xs font-semibold">
                Jenis Kelamin
              </Label>
              <Select value={regGender} onValueChange={setRegGender}>
                <SelectTrigger className="h-12 rounded-xl border-primary/20 focus:border-primary focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">👦🏻 Laki-laki</SelectItem>
                  <SelectItem value="female">👧🏻 Perempuan</SelectItem>
                  <SelectItem value="other">🤷 Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Submit Buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleRegisterSubmit}
                disabled={
                  isLoading ||
                  regUsername.length < 3 ||
                  regPin.length < 4 ||
                  !regEmailVerified
                }
                className="w-full py-4 rounded-2xl font-bold text-white shadow-lg bg-gradient-to-r from-primary to-rose-500 hover:shadow-primary/40 active:scale-95 disabled:opacity-50 disabled:grayscale disabled:pointer-events-none transition-all flex items-center justify-center gap-2"
              >
                <UserPlus size={20} />
                {isLoading ? "Membuat Akun..." : "Buat Akun"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(false);
                  setRegUsername("");
                  setRegPin("");
                  setRegGender("other");
                  setRegEmail("");
                  setRegEmailVerified(false);
                  setVerificationSent(false);
                  setVerificationToken("");
                  setShowSavedAccounts(true);
                }}
                className="w-full text-sm font-semibold text-white hover:text-white transition-all py-3 rounded-xl bg-gradient-to-r from-slate-500 to-slate-600 hover:shadow-lg active:scale-95"
              >
                ← Kembali ke Login
              </button>
            </div>
          </motion.form>
        )}
      </motion.div>
    </div>
  );
}
