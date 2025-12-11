import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import NotFound from "./pages/NotFound";
import DeveloperLogin from "./pages/developer/DeveloperLogin";
import DeveloperDashboard from "./pages/developer/DeveloperDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
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
            
            {/* Protected Routes */}
            <Route element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/inbox" element={<Inbox />} />
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
            
            {/* Redirects */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
