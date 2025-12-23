import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Building2, Globe, Wifi, Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Department {
  id: string;
  name: string;
  color: string | null;
  connectionId: string;
}

interface Connection {
  id: string;
  name: string;
  phoneNumber: string;
}

interface ConnectionWithDepartments extends Connection {
  departments: Department[];
}

export type DepartmentFilterValue = 
  | { type: 'all' }
  | { type: 'global' }
  | { type: 'department'; departmentId: string; connectionId: string };

interface DepartmentFilterSelectorProps {
  value: DepartmentFilterValue;
  onChange: (value: DepartmentFilterValue) => void;
  disabled?: boolean;
  className?: string;
}

export function DepartmentFilterSelector({
  value,
  onChange,
  disabled = false,
  className,
}: DepartmentFilterSelectorProps) {
  const { profile, userRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionsWithDepts, setConnectionsWithDepts] = useState<ConnectionWithDepartments[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  useEffect(() => {
    async function loadData() {
      if (!profile?.company_id) return;
      
      setIsLoading(true);

      try {
        let connectionIds: string[] = [];

        if (isAdminOrOwner) {
          const { data: connections } = await supabase
            .from('whatsapp_connections')
            .select('id, name, phone_number')
            .eq('company_id', profile.company_id)
            .eq('active', true)
            .order('name');
          
          if (connections) {
            connectionIds = connections.map(c => c.id);
            
            const { data: departments } = await supabase
              .from('departments')
              .select('id, name, color, whatsapp_connection_id')
              .in('whatsapp_connection_id', connectionIds)
              .eq('active', true)
              .order('name');

            const result = connections.map(conn => ({
              id: conn.id,
              name: conn.name,
              phoneNumber: conn.phone_number,
              departments: (departments || [])
                .filter(d => d.whatsapp_connection_id === conn.id)
                .map(d => ({
                  id: d.id,
                  name: d.name,
                  color: d.color,
                  connectionId: d.whatsapp_connection_id,
                })),
            }));
            
            setConnectionsWithDepts(result);
          }
        } else {
          const { data: userConnections } = await supabase
            .from('connection_users')
            .select('connection_id, whatsapp_connections(id, name, phone_number)')
            .eq('user_id', profile.id);

          if (userConnections) {
            const connections = userConnections
              .filter(uc => uc.whatsapp_connections)
              .map(uc => ({
                id: (uc.whatsapp_connections as any).id,
                name: (uc.whatsapp_connections as any).name,
                phoneNumber: (uc.whatsapp_connections as any).phone_number,
              }));

            connectionIds = connections.map(c => c.id);

            const { data: departments } = await supabase
              .from('departments')
              .select('id, name, color, whatsapp_connection_id')
              .in('whatsapp_connection_id', connectionIds)
              .eq('active', true)
              .order('name');

            const result = connections.map(conn => ({
              ...conn,
              departments: (departments || [])
                .filter(d => d.whatsapp_connection_id === conn.id)
                .map(d => ({
                  id: d.id,
                  name: d.name,
                  color: d.color,
                  connectionId: d.whatsapp_connection_id,
                })),
            }));
            
            setConnectionsWithDepts(result);
          }
        }
      } catch (error) {
        console.error('[DepartmentFilterSelector] Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [profile?.company_id, profile?.id, isAdminOrOwner]);

  const filteredConnections = useMemo(() => {
    if (!searchQuery) return connectionsWithDepts;
    const query = searchQuery.toLowerCase();
    return connectionsWithDepts
      .map(c => ({
        ...c,
        departments: c.departments.filter(d => d.name.toLowerCase().includes(query)),
      }))
      .filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.departments.length > 0
      );
  }, [connectionsWithDepts, searchQuery]);

  const selectedLabel = useMemo(() => {
    if (value.type === 'all') return 'Todos os departamentos';
    if (value.type === 'global') return 'Apenas globais';
    
    for (const conn of connectionsWithDepts) {
      const dept = conn.departments.find(d => d.id === value.departmentId);
      if (dept) return dept.name;
    }
    return 'Departamento selecionado';
  }, [value, connectionsWithDepts]);

  const handleSelect = (newValue: DepartmentFilterValue) => {
    onChange(newValue);
    setOpen(false);
  };

  return (
    <div className={cn("", className)}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled || isLoading}
            className={cn(
              'w-full sm:w-[220px] justify-between font-normal h-9',
              value.type === 'all' && 'text-muted-foreground'
            )}
          >
            <span className="truncate flex items-center gap-2">
              <Building2 className="w-4 h-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{selectedLabel}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="start">
          {/* Search */}
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <DropdownMenuSeparator />

          <div className="max-h-80 overflow-y-auto">
            {/* All departments option */}
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => handleSelect({ type: 'all' })}
            >
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1">Todos os departamentos</span>
              {value.type === 'all' && <Check className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>

            {/* Global only option */}
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => handleSelect({ type: 'global' })}
            >
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1">Apenas globais</span>
              {value.type === 'global' && <Check className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>

            {filteredConnections.length > 0 && <DropdownMenuSeparator />}

            {isLoading ? (
              <div className="py-4 text-center">
                <span className="text-sm text-muted-foreground">Carregando...</span>
              </div>
            ) : filteredConnections.length === 0 && searchQuery ? (
              <div className="py-4 text-center">
                <span className="text-sm text-muted-foreground">Nenhum resultado encontrado</span>
              </div>
            ) : (
              filteredConnections.map((connection) => (
                <DropdownMenuSub key={connection.id}>
                  <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
                    <Wifi className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{connection.name}</span>
                    {connection.departments.length > 0 && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({connection.departments.length})
                      </span>
                    )}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="min-w-[200px]">
                    {connection.departments.length === 0 ? (
                      <div className="py-2 px-3 text-sm text-muted-foreground">
                        Nenhum departamento
                      </div>
                    ) : (
                      connection.departments.map((dept) => {
                        const isSelected = value.type === 'department' && value.departmentId === dept.id;
                        return (
                          <DropdownMenuItem
                            key={dept.id}
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => handleSelect({
                              type: 'department',
                              departmentId: dept.id,
                              connectionId: dept.connectionId
                            })}
                          >
                            <div 
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: dept.color || '#6366F1' }}
                            />
                            <span className="flex-1 truncate">{dept.name}</span>
                            {isSelected && <Check className="w-4 h-4 text-primary" />}
                          </DropdownMenuItem>
                        );
                      })
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
