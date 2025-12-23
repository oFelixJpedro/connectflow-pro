import { useState, useMemo } from 'react';
import { Globe, User, Building2, Wifi, Filter, Search, X, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuickReplyVisibility } from '@/hooks/useQuickRepliesData';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  // Get active filter info
  const getActiveFilterInfo = () => {
    switch (activeTab) {
      case 'all':
        return { label: 'Todos', icon: <Globe className="w-4 h-4" /> };
      case 'personal':
        return { label: 'Minhas', icon: <User className="w-4 h-4" /> };
      case 'department':
        const dept = departments.find(d => d.id === selectedDepartmentId);
        return { 
          label: dept ? dept.name : 'Departamento', 
          icon: <Building2 className="w-4 h-4" /> 
        };
      case 'connection':
        const conn = connections.find(c => c.id === selectedConnectionId);
        return { 
          label: conn ? conn.name : 'Conexão', 
          icon: <Wifi className="w-4 h-4" /> 
        };
      default:
        return { label: 'Filtrar', icon: <Filter className="w-4 h-4" /> };
    }
  };

  // Filter items by search
  const filteredDepartments = useMemo(() => {
    if (!searchQuery) return departments;
    return departments.filter(d => 
      d.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [departments, searchQuery]);

  const filteredConnections = useMemo(() => {
    if (!searchQuery) return connections;
    return connections.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone_number.includes(searchQuery)
    );
  }, [connections, searchQuery]);

  // Count selected filters
  const selectedCount = useMemo(() => {
    let count = 0;
    if (activeTab === 'department' && selectedDepartmentId) count++;
    if (activeTab === 'connection' && selectedConnectionId) count++;
    if (activeTab !== 'all') count++; // Count the main filter type
    return count;
  }, [activeTab, selectedDepartmentId, selectedConnectionId]);

  const handleClearFilters = () => {
    onTabChange('all');
    onDepartmentChange(null);
    onConnectionChange(null);
    setSearchQuery('');
  };

  const filterInfo = getActiveFilterInfo();
  const hasActiveFilters = activeTab !== 'all' || selectedDepartmentId || selectedConnectionId;

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            {filterInfo.icon}
            <span>{filterInfo.label}</span>
            {selectedCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {selectedCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 bg-popover">
          {/* Search */}
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>
          
          <DropdownMenuSeparator />

          {/* Main visibility options */}
          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => {
              onTabChange('all');
              onDepartmentChange(null);
              onConnectionChange(null);
            }}
          >
            <Globe className="w-4 h-4" />
            <span className="flex-1">Todos</span>
            {activeTab === 'all' && <Check className="w-4 h-4 text-primary" />}
            <Badge variant="secondary" className="ml-auto text-xs">
              {counts.all}
            </Badge>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="gap-2 cursor-pointer"
            onClick={() => {
              onTabChange('personal');
              onDepartmentChange(null);
              onConnectionChange(null);
            }}
          >
            <User className="w-4 h-4" />
            <span className="flex-1">Minhas</span>
            {activeTab === 'personal' && <Check className="w-4 h-4 text-primary" />}
            <Badge variant="secondary" className="ml-auto text-xs">
              {counts.personal}
            </Badge>
          </DropdownMenuItem>

          {/* Departments submenu */}
          {(hasDepartments || isAdminOrOwner) && filteredDepartments.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                className={cn(
                  "gap-2",
                  !hasDepartments && !isAdminOrOwner && "opacity-50 cursor-not-allowed"
                )}
                disabled={!hasDepartments && !isAdminOrOwner}
              >
                <Building2 className="w-4 h-4" />
                <span className="flex-1">Departamento</span>
                {activeTab === 'department' && selectedDepartmentId && (
                  <Badge variant="secondary" className="ml-auto text-xs">1</Badge>
                )}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56 bg-popover">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  Selecione o departamento
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {filteredDepartments.map((dept) => (
                  <DropdownMenuItem
                    key={dept.id}
                    className="gap-2 cursor-pointer"
                    onClick={() => {
                      onTabChange('department');
                      onDepartmentChange(dept.id);
                      onConnectionChange(null);
                    }}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span>{dept.name}</span>
                    </div>
                    {activeTab === 'department' && selectedDepartmentId === dept.id && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {/* Connections submenu */}
          {hasConnection && filteredConnections.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <Wifi className="w-4 h-4" />
                <span className="flex-1">Conexão</span>
                {activeTab === 'connection' && selectedConnectionId && (
                  <Badge variant="secondary" className="ml-auto text-xs">1</Badge>
                )}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56 bg-popover">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  Selecione a conexão
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {filteredConnections.map((conn) => (
                  <DropdownMenuItem
                    key={conn.id}
                    className="gap-2 cursor-pointer"
                    onClick={() => {
                      onTabChange('connection');
                      onConnectionChange(conn.id);
                      onDepartmentChange(null);
                    }}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <Wifi className="w-4 h-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-sm">{conn.name}</span>
                        <span className="text-xs text-muted-foreground">{conn.phone_number}</span>
                      </div>
                    </div>
                    {activeTab === 'connection' && selectedConnectionId === conn.id && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          {/* Clear filters */}
          {hasActiveFilters && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer text-muted-foreground"
                onClick={handleClearFilters}
              >
                <X className="w-4 h-4" />
                <span>Limpar filtros</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1 flex-wrap">
          {activeTab === 'personal' && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <User className="w-3 h-3" />
              Minhas
              <button 
                onClick={() => onTabChange('all')}
                className="ml-1 hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {activeTab === 'department' && selectedDepartmentId && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Building2 className="w-3 h-3" />
              {departments.find(d => d.id === selectedDepartmentId)?.name || 'Departamento'}
              <button 
                onClick={() => {
                  onTabChange('all');
                  onDepartmentChange(null);
                }}
                className="ml-1 hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {activeTab === 'connection' && selectedConnectionId && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Wifi className="w-3 h-3" />
              {connections.find(c => c.id === selectedConnectionId)?.name || 'Conexão'}
              <button 
                onClick={() => {
                  onTabChange('all');
                  onConnectionChange(null);
                }}
                className="ml-1 hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
