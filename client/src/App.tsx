import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { Layout } from "@/components/layout";
import { useAppWebSocket } from "@/hooks/use-websocket";
import { useCardExpiryCheck } from "@/hooks/use-card-expiry-check";
import { usePushNotifications } from "@/hooks/use-push-notifications";

// Pages
import Login from "@/pages/login";
import Gacha from "@/pages/gacha";
import Inventory from "@/pages/inventory";
import ActiveCards from "@/pages/active-cards";
import Profile from "@/pages/profile";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  console.log('[ProtectedRoute] Render with user:', { userId: user?.id, hasUser: !!user });

  useEffect(() => {
    // Give it a brief moment for user to load from localStorage
    const timer = setTimeout(() => {
      if (!user) {
        console.log('[ProtectedRoute] User not found after delay, redirecting to login');
        setLocation("/");
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [user, setLocation]);

  // Render component even if user is loading - let component handle it
  return <Component />;
}

// WebSocket initialization component
function AppServices() {
  const { user } = useAuth();
  
  // Custom hooks that use hooks internally must be called at top level
  useAppWebSocket(user?.id);
  useCardExpiryCheck();
  usePushNotifications();
  
  return null;
}

function Router() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();

  console.log('[Router] Rendering, user:', { userId: user?.id, location });

  // Simple root redirect logic
  useEffect(() => {
    console.log('[Router] Effect running, user:', { userId: user?.id, location });
    if (user && location === "/") {
      console.log('[Router] Redirecting to /gacha');
      setLocation("/gacha");
    }
  }, [user, location, setLocation]);

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/gacha" component={() => <ProtectedRoute component={Gacha} />} />
        <Route path="/inventory" component={() => <ProtectedRoute component={Inventory} />} />
        <Route path="/active" component={() => <ProtectedRoute component={ActiveCards} />} />
        <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  console.log('[App] Rendering');
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <AppServices />
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
