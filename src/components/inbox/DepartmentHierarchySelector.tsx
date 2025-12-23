import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, X, Building2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ALL_CONNECTIONS_ID } from '@/components/inbox/ConnectionSelector';
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
  color?: string;
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

interface DepartmentHierarchySelectorProps {
  selectedConnectionId: string | null;
  selectedDepartmentIds: string[];
  onChange: (departmentIds: string[]) => void;
  disabled?: boolean;
  className?: string;
}

function toPastelColor(hexColor: string): { background: string; text: string } {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) || 128;
  const g = parseInt(hex.substr(2, 2), 16) || 128;
  const b = parseInt(hex.substr(4, 2), 16) || 128;
  
  const pastelR = Math.round(r * 0.3 + 255 * 0.7);
  const pastelG = Math.round(g * 0.3 + 255 * 0.7);
  const pastelB = Math.round(b * 0.3 + 255 * 0.7);
  
  return {
    background: `rgb(${pastelR}, ${pastelG}, ${pastelB})`,
    text: hexColor,
  };
}

export function DepartmentHierarchySelector({
  selectedConnectionId,
  selectedDepartmentIds,
  onChange,
  disabled = false,
  className,
}: DepartmentHierarchySelectorProps) {
  const { profile, userRole } = useAuth();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionsWithDepts, setConnectionsWithDepts] = useState<ConnectionWithDepartments[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isAllConnections = selectedConnectionId === ALL_CONNECTIONS_ID;
  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  useEffect(() => {
    async function loadData() {
      if (!profile?.company_id) return;
      
      setIsLoading(true);

      try {
        let connectionIds: string[] = [];

        if (isAllConnections) {
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
                    color: d.color || undefined,
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
                    color: d.color || undefined,
                    connectionId: d.whatsapp_connection_id,
                  })),
              }));
              
              setConnectionsWithDepts(result);
            }
          }
        } else if (selectedConnectionId) {
          const { data: connection } = await supabase
            .from('whatsapp_connections')
            .select('id, name, phone_number')
            .eq('id', selectedConnectionId)
            .single();

          const { data: departments } = await supabase
            .from('departments')
            .select('id, name, color, whatsapp_connection_id')
            .eq('whatsapp_connection_id', selectedConnectionId)
            .eq('active', true)
            .order('name');

          if (connection) {
            setConnectionsWithDepts([{
              id: connection.id,
              name: connection.name,
              phoneNumber: connection.phone_number,
              departments: (departments || []).map(d => ({
                id: d.id,
                name: d.name,
                color: d.color || undefined,
                connectionId: d.whatsapp_connection_id,
              })),
            }]);
          }
        } else {
          setConnectionsWithDepts([]);
        }
      } catch (error) {
        console.error('[DepartmentHierarchySelector] Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [selectedConnectionId, profile?.company_id, profile?.id, isAllConnections, isAdminOrOwner]);

  const allDepartments = useMemo(() => 
    connectionsWithDepts.flatMap(c => c.departments),
    [connectionsWithDepts]
  );

  const selectedDepartments = useMemo(() => 
    allDepartments.filter(d => selectedDepartmentIds.includes(d.id)),
    [allDepartments, selectedDepartmentIds]
  );

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

  const handleDepartmentToggle = (departmentId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (selectedDepartmentIds.includes(departmentId)) {
      onChange(selectedDepartmentIds.filter(id => id !== departmentId));
    } else {
      onChange([...selectedDepartmentIds, departmentId]);
    }
  };

  const handleSelectAllConnection = (connectionId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const connection = connectionsWithDepts.find(c => c.id === connectionId);
    if (!connection) return;

    const connectionDeptIds = connection.departments.map(d => d.id);
    const allSelected = connection.departments.every(d => selectedDepartmentIds.includes(d.id));
    
    if (allSelected) {
      onChange(selectedDepartmentIds.filter(id => !connectionDeptIds.includes(id)));
    } else {
      const newIds = [...new Set([...selectedDepartmentIds, ...connectionDeptIds])];
      onChange(newIds);
    }
  };

  const isConnectionFullySelected = (connectionId: string) => {
    const connection = connectionsWithDepts.find(c => c.id === connectionId);
    if (!connection || connection.departments.length === 0) return false;
    return connection.departments.every(d => selectedDepartmentIds.includes(d.id));
  };

  const isConnectionPartiallySelected = (connectionId: string) => {
    const connection = connectionsWithDepts.find(c => c.id === connectionId);
    if (!connection) return false;
    const selectedCount = connection.departments.filter(d => selectedDepartmentIds.includes(d.id)).length;
    return selectedCount > 0 && selectedCount < connection.departments.length;
  };

  const handleRemoveDepartment = (departmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedDepartmentIds.filter(id => id !== departmentId));
  };

  const hasDepartments = allDepartments.length > 0;

  if (!hasDepartments && !isLoading) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled || isLoading}
            className={cn(
              'w-full justify-between font-normal h-9',
              selectedDepartmentIds.length === 0 && 'text-muted-foreground'
            )}
          >
            <span className="truncate flex items-center gap-2">
              <Building2 className="w-4 h-4 shrink-0" />
              {selectedDepartmentIds.length === 0
                ? 'Todos os departamentos'
                : selectedDepartmentIds.length === 1
                ? selectedDepartments[0]?.name
                : `${selectedDepartmentIds.length} departamentos`}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80" align="start">
          {/* Search */}
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conexão ou departamento..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <DropdownMenuSeparator />

          <div className="max-h-64 overflow-y-auto">
            {filteredConnections.length === 0 ? (
              <div className="py-4 text-center">
                <span className="text-sm text-muted-foreground">Nenhuma conexão encontrada</span>
              </div>
            ) : (
              filteredConnections.map((connection) => {
                const fullySelected = isConnectionFullySelected(connection.id);
                const partiallySelected = isConnectionPartiallySelected(connection.id);
                const selectedCount = connection.departments.filter(d => selectedDepartmentIds.includes(d.id)).length;

                return (
                  <DropdownMenuSub key={connection.id}>
                    <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={fullySelected}
                        className="pointer-events-none"
                        {...(partiallySelected ? { "data-state": "indeterminate" } : {})}
                      />
                      <span className="flex-1 truncate">{connection.name}</span>
                      {selectedCount > 0 && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {selectedCount}
                        </Badge>
                      )}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="min-w-[220px]">
                      {/* Select all option */}
                      <DropdownMenuItem
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={(e) => handleSelectAllConnection(connection.id, e)}
                      >
                        <Checkbox checked={fullySelected} className="pointer-events-none" />
                        <span className="font-medium">Selecionar todos</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      
                      {connection.departments.length === 0 ? (
                        <div className="py-2 px-3 text-sm text-muted-foreground">
                          Nenhum departamento
                        </div>
                      ) : (
                        connection.departments.map((dept) => {
                          const isSelected = selectedDepartmentIds.includes(dept.id);
                          return (
                            <DropdownMenuItem
                              key={dept.id}
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={(e) => handleDepartmentToggle(dept.id, e)}
                            >
                              <Checkbox checked={isSelected} className="pointer-events-none" />
                              {dept.color && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: dept.color }}
                                />
                              )}
                              <span className="flex-1 truncate">{dept.name}</span>
                            </DropdownMenuItem>
                          );
                        })
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                );
              })
            )}
          </div>

          {/* Clear button */}
          {selectedDepartmentIds.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center justify-center gap-1 text-muted-foreground cursor-pointer"
                onClick={() => onChange([])}
              >
                <X className="w-4 h-4" />
                Limpar seleção
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Selected badges with pastel colors */}
      {selectedDepartments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedDepartments.slice(0, 3).map((dept) => {
            const pastelStyle = dept.color ? toPastelColor(dept.color) : null;
            return (
              <Badge
                key={dept.id}
                variant="secondary"
                className="text-xs px-2 py-0.5 gap-1"
                style={pastelStyle ? {
                  backgroundColor: pastelStyle.background,
                  color: pastelStyle.text,
                } : undefined}
              >
                {dept.name}
                <button
                  onClick={(e) => handleRemoveDepartment(dept.id, e)}
                  className="ml-0.5 hover:opacity-70"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          {selectedDepartments.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{selectedDepartments.length - 3}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
