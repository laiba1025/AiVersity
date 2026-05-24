import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Register from "@/pages/register";
import Login from "@/pages/login";
import Chat from "@/pages/chat";
import Documents from "@/pages/documents";
import MandatoryDocs from './pages/mandatory-docs';
import Notifications from "@/pages/notifications";
import Search from "@/pages/search";
import Recommendations from "@/pages/recommendations";
import AppBar from "@/components/app-bar";
import SideSlider from "@/components/side-slider";
import BottomNavigation from "@/components/bottom-navigation";
import { AppProvider } from "@/context/app-context";
import { useEffect } from "react";
import { useApp } from "@/context/app-context";

function Router() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useApp();

  useEffect(() => {
    // Auto-navigate root to home for this simplified app
    if (location === "/") {
      setLocation('/home');
    }
  }, [location, setLocation]);

  useEffect(() => {
    // Note: do not force navigation for unauthenticated users here.
    // Earlier behavior forced all unauthenticated users to /register which prevented
    // exploring public pages (chat, recommendations, search). We only auto-redirect
    // from the root path in the other effect above.
  }, [isAuthenticated, isLoading, location, setLocation]);

  const isHome = location === "/home";

  return (
    <div className={`flex flex-col h-screen ${isHome ? "bg-neutral-950" : "bg-transparent"}`}>
      {!isHome && <AppBar />}
      <div className="flex flex-1 overflow-hidden">
        {/* Sliding left menu - hide on auth pages and on small screens */}
        {!isHome && !(location === "/login" || location === "/register") && (
          <div className="hidden md:block">
            <SideSlider />
          </div>
        )}

        {/* Main Content */}
        <main className={isHome ? "flex-1 overflow-y-auto" : "flex-1 overflow-y-auto px-4 sm:px-6 py-6"}>
          <div className={isHome ? "w-full" : "max-w-5xl mx-auto"}>
            <Switch>
              <Route path="/home" component={Home} />
              <Route path="/register" component={Register} />
              <Route path="/login" component={Login} />
              <Route path="/chat" component={Chat} />
              <Route path="/documents" component={Documents} />
              <Route path="/mandatory-docs" component={MandatoryDocs} />
              <Route path="/search" component={Search} />
              <Route path="/recommendations" component={Recommendations} />
              <Route path="/notifications" component={Notifications} />
              <Route component={NotFound} />
            </Switch>
          </div>
        </main>
      </div>

      {/* Bottom navigation: show only on small screens */}
      {!isHome && (
        <div className="md:hidden">
          <BottomNavigation />
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <Router />
        <Toaster />
      </AppProvider>
    </QueryClientProvider>
  );
}

export default App;
