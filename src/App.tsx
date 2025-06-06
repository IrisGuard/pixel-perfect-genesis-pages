
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import AdminAuthModal from "@/components/admin/AdminAuthModal";
import AdminPanelRenderer from "@/components/admin/AdminPanelRenderer";
import Index from "./pages/Index";
import Staking from "./pages/Staking";
import NotFound from "./pages/NotFound";

// Initialize security systems
import { antiMockDataProtection } from "@/services/security/antiMockDataProtection";

const queryClient = new QueryClient();

// Initialize anti-mock protection on app start
console.log('🛡️ Initializing security systems...');
antiMockDataProtection; // This triggers the singleton initialization

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AdminAuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/staking" element={<Staking />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        
        {/* Admin Components - Hidden from normal users */}
        <AdminAuthModal />
        <AdminPanelRenderer />
      </AdminAuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
