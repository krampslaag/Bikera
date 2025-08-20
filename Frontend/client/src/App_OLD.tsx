import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Navigation } from "@/components/layout/navigation";
import { useDeviceDetect } from "@/hooks/useDeviceDetect";
import { UserProvider } from "@/context/UserContext";
import Login from "@/pages/login";
import Map from "@/pages/map";
import Leaderboard from "@/pages/leaderboard";
import Active from "@/pages/active";
import Profile from "@/pages/profile";
import Dashboard from "@/pages/dashboard";
import BlockOverview from "@/pages/block-overview";
import NotFound from "@/pages/not-found";

function Router() {
  const isMobile = useDeviceDetect();
  const [location] = useLocation();

  const showNavigationPaths = ['/active', '/map', '/leaderboard', '/profile', '/block-overview'];
  const shouldShowNavigation = isMobile && showNavigationPaths.includes(location);

  return (
    <div className="min-h-screen bg-[#09060e] text-white">
      <Switch>
        <Route path="/">
          <Login />
        </Route>

        <Route path="/dashboard">
          {() => (isMobile ? <Redirect to="/active" /> : <Dashboard />)}
        </Route>

        <Route path="/leaderboard">
          <Leaderboard />
        </Route>
        <Route path="/active">
          <Active />
        </Route>
        <Route path="/map">
          <Map />
        </Route>
        <Route path="/block-overview">
          <BlockOverview />
        </Route>

        <Route path="/profile">
          <Profile />
        </Route>

        <Route>
          <NotFound />
        </Route>
      </Switch>

      {shouldShowNavigation && <Navigation />}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <Router />
        <Toaster />
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;