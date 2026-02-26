import React, { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Layout } from "@/components/layout";
import { useAppWebSocket } from "@/hooks/use-websocket";

// Pages
import Login from "@/pages/login";
import Gacha from "@/pages/gacha";
import Inventory from "@/pages/inventory";
import ActiveCards from "@/pages/active-cards";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  if (!user) return null;
  return <Component />;
}

// WebSocket initialization component
function AppServices() {
  const { user } = useAuth();
  
  // Custom hook that uses hooks internally must be called at top level
  // but we can move the condition inside useAppWebSocket or wrap the logic here
  // The error "Hooks can only be called inside of the body of a function component" 
  // happened because useAppWebSocket was likely called conditionally or improperly.
  
  // Let's fix the Hook rule violation in AppServices
  useAppWebSocket(); 
  
  return null;
}

function Router() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();

  // Simple root redirect logic
  useEffect(() => {
    if (user && location === "/") {
      setLocation("/gacha");
    }
  }, [user, location, setLocation]);

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/gacha">
          {() => <ProtectedRoute component={Gacha} />}
        </Route>
        <Route path="/inventory">
          {() => <ProtectedRoute component={Inventory} />}
        </Route>
        <Route path="/active">
          {() => <ProtectedRoute component={ActiveCards} />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <AppServices />
          <Router />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
