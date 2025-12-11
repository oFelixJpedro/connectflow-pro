import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import PermissionRequestListener from '@/components/developer/PermissionRequestListener';

interface AppLayoutProps {
  showHeader?: boolean;
  headerTitle?: string;
}

export function AppLayout({ showHeader = true, headerTitle }: AppLayoutProps) {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {showHeader && <AppHeader title={headerTitle} />}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      {/* Global listener for developer permission requests */}
      <PermissionRequestListener />
    </div>
  );
}
