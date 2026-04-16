import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import Game from "./pages/Dashboard.jsx";
import Wallet from "./pages/Wallet.jsx";
import Countdown from "./pages/Countdown.jsx";
import NotFound from "./pages/NotFound.jsx";
import Test from "./pages/testing.jsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
      refetchOnWindowFocus: false,
    },
  },
});

function isLaunchLive() {
  const LAUNCH_TARGET = String(import.meta.env.VITE_LAUNCH_HOUR || "15").trim();
  const now = new Date();
  const target = new Date(now.getTime());
  target.setUTCHours(LAUNCH_TARGET, 0, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return now >= target;
}

const App = () => {
  const launchLive = isLaunchLive();

  return (
    <QueryClientProvider client={queryClient}>
      <Sonner />
      <BrowserRouter>
        <Routes>
              <Route path="/" element={<Game />} />
              <Route path="/game" element={<Game />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/test" element={<Test />} />
            
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};


export default App;
