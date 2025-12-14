import { useState } from 'react';
import { AppSidebarContent } from './AppSidebarContent';

export function AppSidebar() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  return (
    <div className="hidden md:flex h-screen">
      <AppSidebarContent 
        collapsed={sidebarCollapsed} 
        onToggleCollapse={toggleSidebar}
        showCollapseButton={true}
      />
    </div>
  );
}
