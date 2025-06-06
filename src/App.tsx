
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { TokenProvider } from "@/contexts/TokenContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Staking from "./pages/Staking";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AdminAuthProvider>
      <TokenProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/staking" element={<Staking />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </TokenProvider>
    </AdminAuthProvider>
  </QueryClientProvider>
);

export default App;
