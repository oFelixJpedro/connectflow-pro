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

    // Show "Todas" only for owner and admin
    if (role === 'owner' || role === 'admin') {
      tabs.push({ id: 'todas', label: 'Todas' });
    }

    return tabs;
  }, [role, isRestricted]);

  // If current activeTab is not in visible tabs, switch to first available
  const isActiveTabVisible = visibleTabs.some(tab => tab.id === activeTab);
  const effectiveActiveTab = isActiveTabVisible ? activeTab : visibleTabs[0]?.id || 'minhas';

  return (
    <div className="flex border-b border-border">
      {visibleTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors',
            'border-b-2 -mb-px focus:outline-none',
            effectiveActiveTab === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          )}
        >
          {tab.label}
          {counts && counts[tab.id] > 0 && (
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full min-w-5 text-center',
              effectiveActiveTab === tab.id
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
            )}>
              {counts[tab.id]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
