import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X, Globe, User, Wifi, Users, Circle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type FilterType = 'general' | 'agent' | 'connection';

export interface DashboardFilter {
  type: FilterType;
  agentId?: string;
  connectionId?: string;
  departmentId?: string;
}

interface Agent {
  id: string;
  full_name: string;
}

interface Connection {
  id: string;
  name: string;
  phone_number: string;
}

interface Department {
  id: string;
  name: string;
  color?: string;
}

interface DashboardFilterSelectorProps {
  filter: DashboardFilter;
  onFilterChange: (filter: DashboardFilter) => void;
  isAdmin: boolean;
}

export function DashboardFilterSelector({ filter, onFilterChange, isAdmin }: DashboardFilterSelectorProps) {
  const { company } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [departmentsByConnection, setDepartmentsByConnection] = useState<Record<string, Department[]>>({});
  const [loading, setLoading] = useState(false);

  // Load agents and connections on mount
  useEffect(() => {
    if (!company?.id || !isAdmin) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [agentsRes, connectionsRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name')
            .eq('company_id', company.id)
            .eq('active', true)
            .order('full_name'),
          supabase
            .from('whatsapp_connections')
            .select('id, name, phone_number')
            .eq('company_id', company.id)
            .eq('status', 'connected')
            .order('name'),
        ]);

        setAgents(agentsRes.data || []);
        setConnections(connectionsRes.data || []);

        // Load departments for all connections
        if (connectionsRes.data && connectionsRes.data.length > 0) {
          const connectionIds = connectionsRes.data.map((c) => c.id);
          const { data: depts } = await supabase
            .from('departments')
            .select('id, name, color, whatsapp_connection_id')
            .in('whatsapp_connection_id', connectionIds)
            .eq('active', true)
            .order('name');

          const grouped: Record<string, Department[]> = {};
          (depts || []).forEach((dept) => {
            if (!grouped[dept.whatsapp_connection_id]) {
              grouped[dept.whatsapp_connection_id] = [];
            }
            grouped[dept.whatsapp_connection_id].push({
              id: dept.id,
              name: dept.name,
              color: dept.color || undefined,
            });
          });
          setDepartmentsByConnection(grouped);
        }
      } catch (error) {
        console.error('Error loading filter data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [company?.id, isAdmin]);

  // Don't render anything for non-admin users
  if (!isAdmin) return null;

  // Filter agents and connections based on search
  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents;
    const query = searchQuery.toLowerCase();
    return agents.filter((a) => a.full_name?.toLowerCase().includes(query));
  }, [agents, searchQuery]);

  const filteredConnections = useMemo(() => {
    if (!searchQuery.trim()) return connections;
    const query = searchQuery.toLowerCase();
    return connections.filter((c) => {
      const connMatches = c.name?.toLowerCase().includes(query) || c.phone_number?.includes(query);
      const depts = departmentsByConnection[c.id] || [];
      const deptMatches = depts.some((d) => d.name.toLowerCase().includes(query));
      return connMatches || deptMatches;
    });
  }, [connections, searchQuery, departmentsByConnection]);

  // Selection handlers
  const handleSelectGeneral = () => {
    onFilterChange({ type: 'general' });
    setOpen(false);
  };

  const handleSelectAgent = (agentId: string) => {
    onFilterChange({ type: 'agent', agentId });
    setOpen(false);
  };

  const handleSelectConnection = (connectionId: string) => {
    onFilterChange({ type: 'connection', connectionId });
    setOpen(false);
  };

  const handleSelectDepartment = (connectionId: string, departmentId: string) => {
    onFilterChange({ type: 'connection', connectionId, departmentId });
    setOpen(false);
  };

  const handleClearFilter = () => {
    onFilterChange({ type: 'general' });
  };

  // Check selections
  const isGeneralSelected = filter.type === 'general';
  const isAgentSelected = (agentId: string) => filter.type === 'agent' && filter.agentId === agentId;
  const isConnectionSelected = (connectionId: string) =>
    filter.type === 'connection' && filter.connectionId === connectionId && !filter.departmentId;
  const isDepartmentSelected = (connectionId: string, departmentId: string) =>
    filter.type === 'connection' && filter.connectionId === connectionId && filter.departmentId === departmentId;
  const isConnectionOrDeptSelected = (connectionId: string) =>
    filter.type === 'connection' && filter.connectionId === connectionId;

  // Get display info
  const getDisplayInfo = () => {
    if (filter.type === 'general') {
      return { icon: Globe, text: 'Visão Geral' };
    }
    if (filter.type === 'agent' && filter.agentId) {
      const agent = agents.find((a) => a.id === filter.agentId);
      return { icon: User, text: agent?.full_name || 'Atendente' };
    }
    if (filter.type === 'connection' && filter.connectionId) {
      const conn = connections.find((c) => c.id === filter.connectionId);
      const connName = conn?.name || conn?.phone_number || 'Conexão';
      if (filter.departmentId) {
        const depts = departmentsByConnection[filter.connectionId] || [];
        const dept = depts.find((d) => d.id === filter.departmentId);
        return { icon: Wifi, text: `${connName} → ${dept?.name || 'Departamento'}` };
      }
      return { icon: Wifi, text: connName };
    }
    return { icon: Globe, text: 'Selecionar filtro' };
  };

  const displayInfo = getDisplayInfo();
  const DisplayIcon = displayInfo.icon;

  // Radio indicator component
  const RadioIndicator = ({ selected }: { selected: boolean }) => (
    selected ? (
      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
    ) : (
      <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
    )
  );

  return (
    <div className="flex flex-col gap-2 w-fit">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            disabled={loading}
            className="w-fit min-w-[200px] max-w-[350px] justify-between"
          >
            <div className="flex items-center gap-2 truncate">
              <DisplayIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{displayInfo.text}</span>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="min-w-[280px] max-h-[400px] overflow-hidden flex flex-col bg-popover"
          sideOffset={4}
        >
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </div>

          {/* Items */}
          <div className="overflow-y-auto flex-1 max-h-[300px]">
            {/* General view option */}
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer"
              onSelect={(e) => {
                e.preventDefault();
                handleSelectGeneral();
              }}
            >
              <RadioIndicator selected={isGeneralSelected} />
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Visão Geral</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* By Agent submenu */}
            {filteredAgents.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">Por Atendente</span>
                    {filter.type === 'agent' && filter.agentId && (
                      <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5 shrink-0">
                        1
                      </Badge>
                    )}
                  </div>
                </DropdownMenuSubTrigger>

                <DropdownMenuSubContent className="min-w-[200px] max-h-[300px] overflow-y-auto bg-popover">
                  {filteredAgents.map((agent) => (
                    <DropdownMenuItem
                      key={agent.id}
                      className="flex items-center gap-2 cursor-pointer"
                      onSelect={(e) => {
                        e.preventDefault();
                        handleSelectAgent(agent.id);
                      }}
                    >
                      <RadioIndicator selected={isAgentSelected(agent.id)} />
                      <span className="truncate">{agent.full_name}</span>
                    </DropdownMenuItem>
                  ))}
                  {filteredAgents.length === 0 && (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      Nenhum atendente encontrado
                    </div>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            {/* By Connection submenu */}
            {filteredConnections.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Wifi className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">Por Conexão</span>
                    {filter.type === 'connection' && filter.connectionId && (
                      <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5 shrink-0">
                        1
                      </Badge>
                    )}
                  </div>
                </DropdownMenuSubTrigger>

                <DropdownMenuSubContent className="min-w-[220px] max-h-[300px] overflow-y-auto bg-popover">
                  {filteredConnections.map((connection) => {
                    const depts = departmentsByConnection[connection.id] || [];
                    const hasDepartments = depts.length > 0;

                    if (!hasDepartments) {
                      // Connection without departments - simple item
                      return (
                        <DropdownMenuItem
                          key={connection.id}
                          className="flex items-center gap-2 cursor-pointer"
                          onSelect={(e) => {
                            e.preventDefault();
                            handleSelectConnection(connection.id);
                          }}
                        >
                          <RadioIndicator selected={isConnectionSelected(connection.id)} />
                          <span className="truncate">
                            {connection.name || connection.phone_number}
                          </span>
                        </DropdownMenuItem>
                      );
                    }

                    // Connection with departments - nested submenu
                    return (
                      <DropdownMenuSub key={connection.id}>
                        <DropdownMenuSubTrigger className="cursor-pointer">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Wifi className="w-4 h-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">
                              {connection.name || connection.phone_number}
                            </span>
                            {isConnectionOrDeptSelected(connection.id) && (
                              <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5 shrink-0">
                                1
                              </Badge>
                            )}
                          </div>
                        </DropdownMenuSubTrigger>

                        <DropdownMenuSubContent className="min-w-[180px] bg-popover">
                          {/* All departments option */}
                          <DropdownMenuItem
                            className="flex items-center gap-2 cursor-pointer"
                            onSelect={(e) => {
                              e.preventDefault();
                              handleSelectConnection(connection.id);
                            }}
                          >
                            <RadioIndicator selected={isConnectionSelected(connection.id)} />
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Todos departamentos</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          {/* Individual departments */}
                          {depts.map((dept) => (
                            <DropdownMenuItem
                              key={dept.id}
                              className="flex items-center gap-2 cursor-pointer"
                              onSelect={(e) => {
                                e.preventDefault();
                                handleSelectDepartment(connection.id, dept.id);
                              }}
                            >
                              <RadioIndicator selected={isDepartmentSelected(connection.id, dept.id)} />
                              {dept.color && (
                                <div
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: dept.color }}
                                />
                              )}
                              <span className="truncate">{dept.name}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    );
                  })}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            {filteredAgents.length === 0 && filteredConnections.length === 0 && searchQuery && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nenhum resultado encontrado
              </div>
            )}
          </div>

          {/* Clear filter */}
          {!isGeneralSelected && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center gap-2 cursor-pointer text-muted-foreground"
                onSelect={(e) => {
                  e.preventDefault();
                  handleClearFilter();
                  setOpen(false);
                }}
              >
                <X className="h-4 w-4" />
                <span>Limpar filtro</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter badge indicator */}
      {!isGeneralSelected && (
        <div className="flex flex-wrap gap-1">
          <Badge
            variant="secondary"
            className="text-xs flex items-center gap-1 pr-1"
          >
            <DisplayIcon className="h-3 w-3" />
            <span className="truncate max-w-[200px]">{displayInfo.text}</span>
            <button
              type="button"
              className="ml-1 hover:bg-muted rounded p-0.5"
              onClick={handleClearFilter}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      )}
    </div>
  );
}
