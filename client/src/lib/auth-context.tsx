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
    console.log('[Auth] ===== INITIAL STATE SETUP =====');
    const saved = localStorage.getItem("gacha_ldr_user");
    console.log('[Auth] Initial localStorage check:', saved);
    
    if (!saved) {
      console.log('[Auth] No initial user in localStorage');
      return null;
    }
    
    try {
      const parsed = JSON.parse(saved);
      // Validate that parsed user has required fields
      if (parsed?.id && parsed?.username) {
        console.log('[Auth] Valid user loaded from localStorage:', { id: parsed.id, username: parsed.username, email: parsed.email });
        console.log('[Auth] ===== INITIAL STATE SETUP COMPLETE =====');
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
    console.log('[Auth] ===== MOUNT EFFECT RUNNING =====');
    const saved = localStorage.getItem("gacha_ldr_user");
    console.log('[Auth] Current user state:', user);
    console.log('[Auth] localStorage value:', saved);
    
    if (!saved) {
      console.log('[Auth] No saved user in localStorage');
      setUser(null);
      return;
    }
    
    try {
      const parsed = JSON.parse(saved);
      console.log('[Auth] Parsed from localStorage:', { parsed, keys: Object.keys(parsed) });
      
      if (parsed?.id && parsed?.username) {
        if (parsed?.id !== user?.id) {
          console.log('[Auth] Reloading from localStorage after HMR/mount - ID changed from', user?.id, 'to', parsed.id);
          setUser(parsed);
        } else {
          console.log('[Auth] Same user ID in localStorage as current state, skipping update');
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
    console.log('[Auth] ===== MOUNT EFFECT END =====');
  }, []); // Only run once on mount

  const login = (userData: User) => {
    console.log('[Auth] ===== LOGIN CALLED =====');
    console.log('[Auth] Current user before login:', user);
    console.log('[Auth] New userData:', userData);
    
    if (!userData?.id || !userData?.username) {
      console.error('[Auth] Invalid user data - missing id or username:', userData);
      throw new Error("Data user tidak valid - missing id atau username");
    }
    
    console.log('[Auth] Setting user state to:', userData);
    setUser(userData);
    
    const serialized = JSON.stringify(userData);
    console.log('[Auth] Saving to localStorage:', serialized);
    localStorage.setItem("gacha_ldr_user", serialized);
    
    console.log('[Auth] Verifying localStorage was set:', localStorage.getItem("gacha_ldr_user"));
    console.log('[Auth] ===== LOGIN COMPLETE =====');
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
