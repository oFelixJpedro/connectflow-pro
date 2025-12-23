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
}

interface ConnectionWithDepartments extends Connection {
  departments: Department[];
}

interface DepartmentFormSelectorProps {
  value: string; // 'global' | department id
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function DepartmentFormSelector({
  value,
  onChange,
  disabled = false,
  className,
}: DepartmentFormSelectorProps) {
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
            .select('id, name')
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
              departments: (departments || [])
                .filter(d => d.whatsapp_connection_id === conn.id)
                .map(d => ({
                  id: d.id,
                  name: d.name,
                  color: d.color,
                  connectionId: d.whatsapp_connection_id,
                })),
            }));
            
            setConnectionsWithDepts(result.filter(c => c.departments.length > 0));
          }
        } else {
          const { data: userDepts } = await supabase
            .from('department_users')
            .select('department_id, departments(id, name, color, whatsapp_connection_id, whatsapp_connections(id, name))')
            .eq('user_id', profile.id);

          if (userDepts) {
            const connectionMap = new Map<string, ConnectionWithDepartments>();
            
            userDepts.forEach(ud => {
              const dept = ud.departments as any;
              if (!dept || !dept.whatsapp_connections) return;
              
              const conn = dept.whatsapp_connections;
              if (!connectionMap.has(conn.id)) {
                connectionMap.set(conn.id, {
                  id: conn.id,
                  name: conn.name,
                  departments: [],
                });
              }
              
              connectionMap.get(conn.id)!.departments.push({
                id: dept.id,
                name: dept.name,
                color: dept.color,
                connectionId: conn.id,
              });
            });
            
            setConnectionsWithDepts(Array.from(connectionMap.values()));
          }
        }
      } catch (error) {
        console.error('[DepartmentFormSelector] Error loading data:', error);
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
    if (value === 'global') return 'Global (todos podem usar)';
    
    for (const conn of connectionsWithDepts) {
      const dept = conn.departments.find(d => d.id === value);
      if (dept) return dept.name;
    }
    return 'Selecione um departamento';
  }, [value, connectionsWithDepts]);

  const selectedDepartment = useMemo(() => {
    if (value === 'global') return null;
    for (const conn of connectionsWithDepts) {
      const dept = conn.departments.find(d => d.id === value);
      if (dept) return dept;
    }
    return null;
  }, [value, connectionsWithDepts]);

  const handleSelect = (deptId: string) => {
    onChange(deptId);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled || isLoading}
          className={cn(
            'w-full justify-between font-normal h-10',
            value === 'global' && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate flex items-center gap-2">
            {value === 'global' ? (
              <Globe className="w-4 h-4 shrink-0 text-muted-foreground" />
            ) : selectedDepartment?.color ? (
              <div 
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: selectedDepartment.color }}
              />
            ) : (
              <Building2 className="w-4 h-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">{selectedLabel}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[280px]" align="start">
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
          {/* Global option */}
          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => handleSelect('global')}
          >
            <Globe className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1">Global (todos podem usar)</span>
            {value === 'global' && <Check className="w-4 h-4 text-primary" />}
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
                <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer text-left">
                  <Wifi className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0 text-left">
                    <span className="block truncate">{connection.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    ({connection.departments.length})
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[200px]">
                  {connection.departments.map((dept) => {
                    const isSelected = value === dept.id;
                    return (
                      <DropdownMenuItem
                        key={dept.id}
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => handleSelect(dept.id)}
                      >
                        <div 
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: dept.color || '#6366F1' }}
                        />
                        <span className="flex-1 truncate">{dept.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-primary" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
