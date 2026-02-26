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
  // Only connect WS if logged in
  if (user) {
    useAppWebSocket();
  }
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
