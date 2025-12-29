import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export type InboxColumn = 'minhas' | 'fila' | 'todas';

interface InboxTabsProps {
  activeTab: InboxColumn;
  onTabChange: (tab: InboxColumn) => void;
  isRestricted?: boolean;
  counts?: {
    minhas: number;
    fila: number;
    todas: number;
  };
}

interface TabConfig {
  id: InboxColumn;
  label: string;
}

export function InboxTabs({ 
  activeTab, 
  onTabChange, 
  isRestricted = false,
  counts
}: InboxTabsProps) {
  const { userRole } = useAuth();
  const role = userRole?.role;

  // Determine which tabs to show based on role and permissions
  const visibleTabs = useMemo((): TabConfig[] => {
    const tabs: TabConfig[] = [];

    // Everyone sees "Minhas"
    tabs.push({ id: 'minhas', label: 'Minhas' });

    // Show "Fila" for owner, admin, supervisor, and agents with full access
    if (role === 'owner' || role === 'admin' || role === 'supervisor' || !isRestricted) {
      tabs.push({ id: 'fila', label: 'Fila' });
    }

    // Show "Todas" for everyone except viewer
    // Agents will see conversations with blur if not assigned to them
    if (role !== 'viewer') {
      tabs.push({ id: 'todas', label: 'Todas' });
    }

    return tabs;
  }, [role, isRestricted]);

  // If current activeTab is not in visible tabs, switch to first available
  const isActiveTabVisible = visibleTabs.some(tab => tab.id === activeTab);
  const effectiveActiveTab = isActiveTabVisible ? activeTab : visibleTabs[0]?.id || 'minhas';

  return (
    <div className="flex w-full bg-muted/30">
      {visibleTabs.map((tab) => {
        const count = counts?.[tab.id] || 0;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 px-4',
              'text-sm font-medium text-center',
              'transition-all duration-200',
              'border-b-2 focus:outline-none',
              effectiveActiveTab === tab.id
                ? 'border-primary text-primary bg-background shadow-sm font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {tab.label}
            {count > 0 && (
              <span className={cn(
                'min-w-5 h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center',
                'bg-red-500 text-white' // Always red for unread count
              )}>
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
