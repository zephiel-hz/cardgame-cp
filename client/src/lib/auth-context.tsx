import React, { createContext, useContext, useState, useEffect } from "react";
import type { User } from "@shared/schema";

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("gacha_ldr_user");
    return saved ? JSON.parse(saved) : null;
  });

  // Force reload from localStorage on mount to handle HMR scenarios
  useEffect(() => {
    const saved = localStorage.getItem("gacha_ldr_user");
    const parsed = saved ? JSON.parse(saved) : null;
    if (parsed?.id !== user?.id) {
      console.log('[Auth] Reloading from localStorage after HMR/mount');
      setUser(parsed);
    }
  }, []); // Only run once on mount

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem("gacha_ldr_user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("gacha_ldr_user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
