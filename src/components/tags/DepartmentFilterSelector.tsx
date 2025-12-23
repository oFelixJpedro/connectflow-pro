import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronRight, Building2, Globe, Link, Search } from 'lucide-react';
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
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);
  
  const submenuRef = useRef<HTMLDivElement>(null);
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
          // Non-admin: get only connections user is assigned to
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
    return connectionsWithDepts.filter(c => 
      c.name.toLowerCase().includes(query) ||
      c.departments.some(d => d.name.toLowerCase().includes(query))
    );
  }, [connectionsWithDepts, searchQuery]);

  // Get selected label
  const selectedLabel = useMemo(() => {
    if (value.type === 'all') return 'Todos os departamentos';
    if (value.type === 'global') return 'Apenas globais';
    
    for (const conn of connectionsWithDepts) {
      const dept = conn.departments.find(d => d.id === value.departmentId);
      if (dept) return dept.name;
    }
    return 'Departamento selecionado';
  }, [value, connectionsWithDepts]);

  const handleSelectDepartment = (dept: Department) => {
    onChange({ type: 'department', departmentId: dept.id, connectionId: dept.connectionId });
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
    // Small delay to allow moving to submenu
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredConnectionId(null);
    }, 50);
  };

  const handleMouseEnterSubmenu = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleMouseLeaveSubmenu = () => {
    setHoveredConnectionId(null);
  };

  return (
    <div className={cn("", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
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
            <ChevronRight className="h-4 w-4 shrink-0 opacity-50 rotate-90" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-64 p-0 bg-popover" 
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
              {/* All departments option */}
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors",
                  "hover:bg-accent",
                  value.type === 'all' && "bg-accent"
                )}
                onClick={() => {
                  onChange({ type: 'all' });
                  setOpen(false);
                }}
              >
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Todos os departamentos</span>
              </div>

              {/* Global only option */}
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors",
                  "hover:bg-accent",
                  value.type === 'global' && "bg-accent"
                )}
                onClick={() => {
                  onChange({ type: 'global' });
                  setOpen(false);
                }}
              >
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Apenas globais</span>
              </div>

              {/* Separator */}
              {filteredConnections.length > 0 && (
                <div className="my-1 border-t border-border" />
              )}

              {/* Connections with instant hover for departments */}
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
                      value.type === 'department' && 
                        connection.departments.some(d => d.id === value.departmentId) && 
                        "bg-accent/50"
                    )}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Link className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{connection.name}</span>
                      {connection.departments.length > 0 && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({connection.departments.length})
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>

                  {/* Submenu - departments */}
                  {hoveredConnectionId === connection.id && connection.departments.length > 0 && (
                    <div 
                      ref={submenuRef}
                      className="absolute left-full top-0 ml-1 z-50 bg-popover border border-border rounded-md shadow-md min-w-[200px]"
                      onMouseEnter={handleMouseEnterSubmenu}
                      onMouseLeave={handleMouseLeaveSubmenu}
                    >
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
                                value.type === 'department' && value.departmentId === dept.id && "bg-accent"
                              )}
                              onClick={() => handleSelectDepartment(dept)}
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
    </div>
  );
}
