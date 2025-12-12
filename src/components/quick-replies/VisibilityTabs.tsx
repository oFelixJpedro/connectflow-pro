import { Globe, User, Users, Smartphone } from 'lucide-react';
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
  departments,
  connections,
  selectedDepartmentId,
  selectedConnectionId,
  onDepartmentChange,
  onConnectionChange,
}: VisibilityTabsProps) {
  const { userRole } = useAuth();
  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        {tabs.map((tab) => {
          // Admin/owner always have access to departments tab
          const isDisabled = 
            (tab.id === 'department' && !hasDepartments && !isAdminOrOwner) ||
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
                "flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors flex-1",
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

      {/* Department filter dropdown */}
      {activeTab === 'department' && departments.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtrar por:</span>
          <Select
            value={selectedDepartmentId || 'all'}
            onValueChange={(value) => onDepartmentChange(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Todos os departamentos" />
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
        </div>
      )}

      {/* Connection filter dropdown */}
      {activeTab === 'connection' && connections.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtrar por:</span>
          <Select
            value={selectedConnectionId || 'all'}
            onValueChange={(value) => onConnectionChange(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Todas as conexões" />
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
        </div>
      )}
    </div>
  );
}
