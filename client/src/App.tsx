import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import RecordMeeting from "@/pages/record-meeting";
import MeetingDetail from "@/pages/meeting-detail";
import AllMeetings from "@/pages/all-meetings";
import { Sidebar } from "@/components/ui/sidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/record" component={RecordMeeting} />
      <Route path="/meeting/:id" component={MeetingDetail} />
      <Route path="/meetings" component={AllMeetings} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Load required scripts for Remix icons
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css';
    document.head.appendChild(link);
    
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="flex h-screen">
          <Sidebar />
          <MobileHeader />
          <main className="flex-1 overflow-auto pt-0 md:pt-0">
            <Toaster />
            <Router />
          </main>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
