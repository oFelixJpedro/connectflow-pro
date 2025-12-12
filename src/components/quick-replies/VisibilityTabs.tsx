import { Globe, User, Building2, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuickReplyVisibility } from '@/hooks/useQuickRepliesData';
import { useAuth } from '@/contexts/AuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Department {
  id: string;
  name: string;
}

interface Connection {
  id: string;
  name: string;
  phone_number: string;
}

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
  departments: Department[];
  connections: Connection[];
  selectedDepartmentId: string | null;
  selectedConnectionId: string | null;
  onDepartmentChange: (id: string | null) => void;
  onConnectionChange: (id: string | null) => void;
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
    icon: <Building2 className="w-4 h-4" />,
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
  departments,
  connections,
  selectedDepartmentId,
  selectedConnectionId,
  onDepartmentChange,
  onConnectionChange,
}: VisibilityTabsProps) {
  const { userRole } = useAuth();
  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  // Render tab with optional inline dropdown
  const renderTab = (tab: typeof tabs[0]) => {
    const isDisabled = 
      (tab.id === 'department' && !hasDepartments && !isAdminOrOwner) ||
      (tab.id === 'connection' && !hasConnection);
    const count = counts[tab.id];
    const isActive = activeTab === tab.id;
    
    // Show inline dropdown for department and connection tabs
    const showDepartmentDropdown = tab.id === 'department' && isActive && departments.length > 0;
    const showConnectionDropdown = tab.id === 'connection' && isActive && connections.length > 0;
    
    return (
      <div
        key={tab.id}
        className={cn(
          "flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1",
          isActive
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
          isDisabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {!showDepartmentDropdown && !showConnectionDropdown && (
          <button
            onClick={() => !isDisabled && onTabChange(tab.id)}
            disabled={isDisabled}
            title={isDisabled ? 
              (tab.id === 'department' ? 'Você não está em nenhum departamento' : 'Selecione uma conexão') 
              : tab.description
            }
            className="flex items-center justify-center gap-2"
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {count > 0 && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "bg-muted-foreground/20"
              )}>
                {count}
              </span>
            )}
          </button>
        )}
        
        {/* Inline department dropdown */}
        {showDepartmentDropdown && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <Select
              value={selectedDepartmentId || 'all'}
              onValueChange={(value) => onDepartmentChange(value === 'all' ? null : value)}
            >
              <SelectTrigger className="h-7 border-none shadow-none bg-transparent p-0 gap-1 min-w-[150px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os departamentos</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {count > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center bg-primary/10 text-primary">
                {count}
              </span>
            )}
          </div>
        )}
        
        {/* Inline connection dropdown */}
        {showConnectionDropdown && (
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            <Select
              value={selectedConnectionId || 'all'}
              onValueChange={(value) => onConnectionChange(value === 'all' ? null : value)}
            >
              <SelectTrigger className="h-7 border-none shadow-none bg-transparent p-0 gap-1 min-w-[150px]">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as conexões</SelectItem>
                {connections.map((conn) => (
                  <SelectItem key={conn.id} value={conn.id}>
                    {conn.name} ({conn.phone_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {count > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center bg-primary/10 text-primary">
                {count}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {tabs.map(renderTab)}
    </div>
  );
}
