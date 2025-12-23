import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronRight, ChevronsUpDown, Building2, Globe, Link, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);
  
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  // Load connections and departments
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
          // Non-admin: get user's assigned departments
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Filter connections by search
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

  // Get selected label
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

  const handleSelectDepartment = (deptId: string) => {
    onChange(deptId);
    setOpen(false);
    setHoveredConnectionId(null);
  };

  const handleMouseEnterConnection = (connectionId: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredConnectionId(connectionId);
  };

  const handleMouseLeaveConnection = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredConnectionId(null);
    }, 150);
  };

  const handleMouseEnterSubmenu = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleMouseLeaveSubmenu = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredConnectionId(null);
    }, 150);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
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
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[280px] p-0 bg-popover" 
        align="start"
        sideOffset={4}
      >
        {/* Search */}
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8"
            />
          </div>
        </div>

        <ScrollArea className="max-h-80">
          <div className="p-1">
            {/* Global option */}
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors",
                "hover:bg-accent",
                value === 'global' && "bg-accent"
              )}
              onClick={() => handleSelectDepartment('global')}
            >
              <Globe className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Global (todos podem usar)</span>
            </div>

            {/* Separator */}
            {filteredConnections.length > 0 && (
              <div className="my-1 border-t border-border" />
            )}

            {/* Connections with hover for departments */}
            {filteredConnections.map((connection) => (
              <div 
                key={connection.id} 
                className="relative"
                onMouseEnter={() => handleMouseEnterConnection(connection.id)}
                onMouseLeave={handleMouseLeaveConnection}
              >
                <div
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors",
                    "hover:bg-accent",
                    hoveredConnectionId === connection.id && "bg-accent",
                    connection.departments.some(d => d.id === value) && "bg-accent/50"
                  )}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Link className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{connection.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      ({connection.departments.length})
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>

                {/* Submenu - departments with bridge area */}
                {hoveredConnectionId === connection.id && connection.departments.length > 0 && (
                  <div 
                    className="absolute left-full top-0 z-50 pl-1"
                    onMouseEnter={handleMouseEnterSubmenu}
                    onMouseLeave={handleMouseLeaveSubmenu}
                  >
                    <div className="bg-popover border border-border rounded-md shadow-md min-w-[200px]">
                      <div className="p-2 border-b border-border">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Departamentos
                        </p>
                      </div>
                      <ScrollArea className="max-h-48">
                        <div className="p-1">
                          {connection.departments.map((dept) => (
                            <div
                              key={dept.id}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors",
                                "hover:bg-accent",
                                value === dept.id && "bg-accent"
                              )}
                              onClick={() => handleSelectDepartment(dept.id)}
                            >
                              <div 
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: dept.color || '#6366F1' }}
                              />
                              <span className="text-sm truncate">{dept.name}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="py-4 text-center">
                <span className="text-sm text-muted-foreground">Carregando...</span>
              </div>
            )}

            {!isLoading && filteredConnections.length === 0 && searchQuery && (
              <div className="py-4 text-center">
                <span className="text-sm text-muted-foreground">Nenhum resultado encontrado</span>
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
