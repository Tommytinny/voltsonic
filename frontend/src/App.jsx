import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import Game from "./pages/Dashboard.jsx";
import Wallet from "./pages/Wallet.jsx";
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

const App = () => (
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

export default App;
