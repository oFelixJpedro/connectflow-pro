import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { DeveloperAuthProvider } from "@/contexts/DeveloperAuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import Contacts from "./pages/Contacts";
import CRM from "./pages/CRM";
import Tags from "./pages/Tags";
import QuickReplies from "./pages/QuickReplies";
import Departments from "./pages/Departments";
import Connections from "./pages/Connections";
import SettingsGeneral from "./pages/SettingsGeneral";
import Team from "./pages/Team";
import InternalChat from "./pages/InternalChat";
import AIAgents from "./pages/AIAgents";
import AIAgentConfig from "./pages/AIAgentConfig";
import CommercialManager from "./pages/CommercialManager";

import NotFound from "./pages/NotFound";
import DeveloperLogin from "./pages/developer/DeveloperLogin";
import DeveloperDashboard from "./pages/developer/DeveloperDashboard";
import DeveloperUsage from "./pages/developer/DeveloperUsage";

// Landing pages
import { LandingPage, PricingPage, TrialPage, CheckoutSuccess } from "./pages/landing";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public Landing Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/precos" element={<PricingPage />} />
              <Route path="/checkout-success" element={<CheckoutSuccess />} />
              <Route path="/trial" element={<TrialPage />} />
              
              {/* Auth Route */}
              <Route path="/auth" element={<Auth />} />
              
              {/* Developer Routes (completely separate from main system) */}
              <Route path="/developer" element={
                <DeveloperAuthProvider>
                  <DeveloperLogin />
                </DeveloperAuthProvider>
              } />
              <Route path="/developer/dashboard" element={
                <DeveloperAuthProvider>
                  <DeveloperDashboard />
                </DeveloperAuthProvider>
              } />
              <Route path="/developer/usage" element={
                <DeveloperAuthProvider>
                  <DeveloperUsage />
                </DeveloperAuthProvider>
              } />
              
              {/* Protected Routes */}
              <Route element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }>
              <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/commercial-manager" element={<CommercialManager />} />
                
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/ai-agents" element={<AIAgents />} />
                <Route path="/ai-agents/:agentId" element={<AIAgentConfig />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/crm" element={<CRM />} />
                
                {/* Settings Routes */}
                <Route path="/settings" element={<Navigate to="/settings/general" replace />} />
                <Route path="/settings/general" element={<SettingsGeneral />} />
                <Route path="/settings/tags" element={<Tags />} />
                <Route path="/settings/quick-replies" element={<QuickReplies />} />
                <Route path="/settings/departments" element={<Departments />} />
                <Route path="/settings/connections" element={<Connections />} />
                <Route path="/settings/team" element={<Team />} />
                
                {/* Legacy redirects for old routes */}
                <Route path="/tags" element={<Navigate to="/settings/tags" replace />} />
                <Route path="/quick-replies" element={<Navigate to="/settings/quick-replies" replace />} />
                <Route path="/departments" element={<Navigate to="/settings/departments" replace />} />
                <Route path="/connections" element={<Navigate to="/settings/connections" replace />} />
                <Route path="/team" element={<Navigate to="/settings/team" replace />} />
              </Route>
              
              {/* Internal Chat - Full screen overlay */}
              <Route path="/internal-chat" element={
                <ProtectedRoute>
                  <InternalChat />
                </ProtectedRoute>
              } />
              
              {/* Home redirect for authenticated users */}
              <Route path="/home" element={
                <ProtectedRoute>
                  <Navigate to="/dashboard" replace />
                </ProtectedRoute>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
