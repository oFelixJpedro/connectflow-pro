import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import PermissionRequestListener from '@/components/developer/PermissionRequestListener';
import { useSessionMonitor } from '@/hooks/useSessionMonitor';
import { MobileSidebar } from './MobileSidebar';

interface AppLayoutProps {
  showHeader?: boolean;
  headerTitle?: string;
}

export function AppLayout({ showHeader = true, headerTitle }: AppLayoutProps) {
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
        {showHeader && (
          <AppHeader 
            title={headerTitle} 
            onMenuClick={() => setMobileSidebarOpen(true)}
          />
        )}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      {/* Global listener for developer permission requests */}
      <PermissionRequestListener />
    </div>
  );
}
