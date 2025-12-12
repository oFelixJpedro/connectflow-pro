import { Globe, User, Users, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuickReplyVisibility } from '@/hooks/useQuickRepliesData';

interface VisibilityTabsProps {
  activeTab: QuickReplyVisibility;
  onTabChange: (tab: QuickReplyVisibility) => void;
  counts: {
    all: number;
    personal: number;
    department: number;
    connection: number;
  };
  hasDepartments: boolean;
  hasConnection: boolean;
}

const tabs: { 
  id: QuickReplyVisibility; 
  label: string; 
  icon: React.ReactNode;
  description: string;
}[] = [
  { 
    id: 'all', 
    label: 'Todos', 
    icon: <Globe className="w-4 h-4" />,
    description: 'Visível para toda empresa'
  },
  { 
    id: 'personal', 
    label: 'Minhas', 
    icon: <User className="w-4 h-4" />,
    description: 'Apenas você'
  },
  { 
    id: 'department', 
    label: 'Departamento', 
    icon: <Users className="w-4 h-4" />,
    description: 'Membros do departamento'
  },
  { 
    id: 'connection', 
    label: 'Conexão', 
    icon: <Smartphone className="w-4 h-4" />,
    description: 'Usuários da conexão'
  },
];

export function VisibilityTabs({
  activeTab,
  onTabChange,
  counts,
  hasDepartments,
  hasConnection,
}: VisibilityTabsProps) {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {tabs.map((tab) => {
        const isDisabled = 
          (tab.id === 'department' && !hasDepartments) ||
          (tab.id === 'connection' && !hasConnection);
        const count = counts[tab.id];
        
        return (
          <button
            key={tab.id}
            onClick={() => !isDisabled && onTabChange(tab.id)}
            disabled={isDisabled}
            title={isDisabled ? 
              (tab.id === 'department' ? 'Você não está em nenhum departamento' : 'Selecione uma conexão') 
              : tab.description
            }
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              isDisabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {count > 0 && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                activeTab === tab.id 
                  ? "bg-primary/10 text-primary" 
                  : "bg-muted-foreground/20"
              )}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
