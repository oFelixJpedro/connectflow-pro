import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import PermissionRequestListener from '@/components/developer/PermissionRequestListener';
import { useSessionMonitor } from '@/hooks/useSessionMonitor';
import { MobileSidebar, MobileSidebarTrigger } from './MobileSidebar';

export function AppLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  
  // Monitor session expiration and auto-redirect to login
  useSessionMonitor();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <AppSidebar />
      
      {/* Mobile Sidebar */}
      <MobileSidebar 
        open={mobileSidebarOpen} 
        onOpenChange={setMobileSidebarOpen} 
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Menu Trigger */}
        <div className="md:hidden absolute top-3 left-3 z-50">
          <MobileSidebarTrigger onClick={() => setMobileSidebarOpen(true)} />
        </div>
        
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      {/* Global listener for developer permission requests */}
      <PermissionRequestListener />
    </div>
  );
}
