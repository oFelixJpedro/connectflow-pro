import { useState, useEffect, useMemo } from 'react';
import { Check, ChevronRight, ChevronsUpDown, X, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ALL_CONNECTIONS_ID } from '@/components/inbox/ConnectionSelector';

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
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);

  const isAllConnections = selectedConnectionId === ALL_CONNECTIONS_ID;
  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  // Load connections and departments
  useEffect(() => {
    async function loadData() {
      if (!profile?.company_id) return;
      
      setIsLoading(true);

      try {
        let connectionIds: string[] = [];

        if (isAllConnections) {
          // Get all connections user has access to
          if (isAdminOrOwner) {
            const { data: connections } = await supabase
              .from('whatsapp_connections')
              .select('id, name, phone_number')
              .eq('company_id', profile.company_id)
              .eq('active', true)
              .order('name');
            
            if (connections) {
              connectionIds = connections.map(c => c.id);
              
              // Load departments for all connections
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
                    color: d.color || undefined,
                    connectionId: d.whatsapp_connection_id,
                  })),
              }));
              
              setConnectionsWithDepts(result);
            }
          }
        } else if (selectedConnectionId) {
          // Single connection selected
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

  // All departments flat for counting
  const allDepartments = useMemo(() => 
    connectionsWithDepts.flatMap(c => c.departments),
    [connectionsWithDepts]
  );

  // Selected departments with details
  const selectedDepartments = useMemo(() => 
    allDepartments.filter(d => selectedDepartmentIds.includes(d.id)),
    [allDepartments, selectedDepartmentIds]
  );

  // Filter connections by search
  const filteredConnections = useMemo(() => {
    if (!searchQuery) return connectionsWithDepts;
    const query = searchQuery.toLowerCase();
    return connectionsWithDepts.filter(c => 
      c.name.toLowerCase().includes(query) ||
      c.departments.some(d => d.name.toLowerCase().includes(query))
    );
  }, [connectionsWithDepts, searchQuery]);

  const handleDepartmentToggle = (departmentId: string) => {
    if (selectedDepartmentIds.includes(departmentId)) {
      onChange(selectedDepartmentIds.filter(id => id !== departmentId));
    } else {
      onChange([...selectedDepartmentIds, departmentId]);
    }
  };

  const handleSelectAllConnection = (connectionId: string, checked: boolean) => {
    const connection = connectionsWithDepts.find(c => c.id === connectionId);
    if (!connection) return;

    const connectionDeptIds = connection.departments.map(d => d.id);
    
    if (checked) {
      // Add all departments from this connection
      const newIds = [...new Set([...selectedDepartmentIds, ...connectionDeptIds])];
      onChange(newIds);
    } else {
      // Remove all departments from this connection
      onChange(selectedDepartmentIds.filter(id => !connectionDeptIds.includes(id)));
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

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const handleRemoveDepartment = (departmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedDepartmentIds.filter(id => id !== departmentId));
  };

  // Check if we have any departments to show
  const hasDepartments = allDepartments.length > 0;

  if (!hasDepartments) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
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
            <div className="flex items-center gap-1 shrink-0">
              {selectedDepartmentIds.length > 0 && (
                <X
                  className="h-3.5 w-3.5 opacity-50 hover:opacity-100"
                  onClick={handleClearAll}
                />
              )}
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 p-0 bg-popover" 
          align="start"
          sideOffset={4}
        >
          {/* Search */}
          <div className="p-2 border-b border-border">
            <Input
              placeholder="Buscar conexão ou departamento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8"
            />
          </div>

          <ScrollArea className="max-h-64">
            <div className="p-2 space-y-1">
              {filteredConnections.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma conexão encontrada
                </p>
              ) : (
                filteredConnections.map((connection) => (
                  <HoverCard 
                    key={connection.id} 
                    openDelay={100} 
                    closeDelay={100}
                    open={hoveredConnectionId === connection.id}
                    onOpenChange={(isOpen) => setHoveredConnectionId(isOpen ? connection.id : null)}
                  >
                    <HoverCardTrigger asChild>
                      <div
                        className={cn(
                          "flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                          "hover:bg-accent"
                        )}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Checkbox
                            checked={isConnectionFullySelected(connection.id)}
                            ref={(ref) => {
                              if (ref && isConnectionPartiallySelected(connection.id)) {
                                (ref as any).indeterminate = true;
                              }
                            }}
                            onCheckedChange={(checked) => 
                              handleSelectAllConnection(connection.id, checked as boolean)
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-sm truncate">{connection.name}</span>
                          {connection.departments.filter(d => selectedDepartmentIds.includes(d.id)).length > 0 && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {connection.departments.filter(d => selectedDepartmentIds.includes(d.id)).length}
                            </Badge>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent 
                      side="right" 
                      align="start" 
                      sideOffset={8}
                      className="w-56 p-0 bg-popover"
                    >
                      <div className="p-2 border-b border-border">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Departamentos
                        </p>
                      </div>
                      <ScrollArea className="max-h-48">
                        <div className="p-2 space-y-1">
                          {connection.departments.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              Nenhum departamento
                            </p>
                          ) : (
                            connection.departments.map((dept) => (
                              <div
                                key={dept.id}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
                                onClick={() => handleDepartmentToggle(dept.id)}
                              >
                                <Checkbox
                                  checked={selectedDepartmentIds.includes(dept.id)}
                                  onCheckedChange={() => handleDepartmentToggle(dept.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                {dept.color && (
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: dept.color }}
                                  />
                                )}
                                <Label className="text-sm cursor-pointer truncate">
                                  {dept.name}
                                </Label>
                              </div>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </HoverCardContent>
                  </HoverCard>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Clear button */}
          {selectedDepartmentIds.length > 0 && (
            <div className="p-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => onChange([])}
              >
                <X className="w-4 h-4 mr-1" />
                Limpar seleção
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Selected badges */}
      {selectedDepartments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedDepartments.slice(0, 3).map((dept) => (
            <Badge
              key={dept.id}
              variant="secondary"
              className="text-xs px-2 py-0.5 gap-1"
              style={dept.color ? { backgroundColor: dept.color, color: '#000' } : undefined}
            >
              {dept.name}
              <X
                className="h-3 w-3 cursor-pointer hover:opacity-70"
                onClick={(e) => handleRemoveDepartment(dept.id, e)}
              />
            </Badge>
          ))}
          {selectedDepartments.length > 3 && (
            <Badge variant="outline" className="text-xs px-2 py-0.5">
              +{selectedDepartments.length - 3}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
