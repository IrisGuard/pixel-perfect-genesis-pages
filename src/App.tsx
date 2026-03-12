
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { TokenProvider } from "@/contexts/TokenContext";
import { WalletProvider } from "@/contexts/WalletContext";
import Index from "./pages/Index";
import HowItWorks from "./pages/HowItWorks";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancelled from "./pages/PaymentCancelled";
import NotFound from "./pages/NotFound";
import FactoryControl from "./pages/FactoryControl";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AdminAuthProvider>
      <WalletProvider>
        <TokenProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route path="/payment-cancelled" element={<PaymentCancelled />} />
                <Route path="/factory-control" element={<FactoryControl />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </TokenProvider>
      </WalletProvider>
    </AdminAuthProvider>
  </QueryClientProvider>
);

export default App;
