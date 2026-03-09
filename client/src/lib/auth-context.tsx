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
    if (!saved) return null;
    
    try {
      const parsed = JSON.parse(saved);
      // Validate that parsed user has required fields
      if (parsed?.id && parsed?.username) {
        console.log('[Auth] Valid user loaded from localStorage:', { id: parsed.id, username: parsed.username });
        return parsed;
      } else {
        console.warn('[Auth] Incomplete user data in localStorage, clearing:', { id: parsed?.id, username: parsed?.username });
        localStorage.removeItem("gacha_ldr_user");
        return null;
      }
    } catch (e) {
      console.error('[Auth] Failed to parse localStorage user data:', e);
      localStorage.removeItem("gacha_ldr_user");
      return null;
    }
  });

  // Force reload from localStorage on mount to handle HMR scenarios
  useEffect(() => {
    const saved = localStorage.getItem("gacha_ldr_user");
    if (!saved) {
      setUser(null);
      return;
    }
    
    try {
      const parsed = JSON.parse(saved);
     console.log('[Auth] Loaded from localStorage:', { parsed, keys: Object.keys(parsed) });
      
      if (parsed?.id && parsed?.username) {
        if (parsed?.id !== user?.id) {
          console.log('[Auth] Reloading from localStorage after HMR/mount');
          setUser(parsed);
        }
      } else {
        console.warn('[Auth] Invalid user data in localStorage after mount, clearing:', { id: parsed?.id, username: parsed?.username });
        localStorage.removeItem("gacha_ldr_user");
        setUser(null);
      }
    } catch (e) {
      console.error('[Auth] Error reloading from localStorage:', e);
      localStorage.removeItem("gacha_ldr_user");
      setUser(null);
    }
  }, []); // Only run once on mount

  const login = (userData: User) => {
    console.log('[Auth] Login called with userData:', userData);
    if (!userData?.id || !userData?.username) {
      console.error('[Auth] Invalid user data - missing id or username:', userData);
      throw new Error("Data user tidak valid - missing id atau username");
    }
    setUser(userData);
    const serialized = JSON.stringify(userData);
    console.log('[Auth] Saving to localStorage:', serialized);
    localStorage.setItem("gacha_ldr_user", serialized);
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
