import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Search, X, Link, Kanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ALL_CONNECTIONS_ID } from '@/components/inbox/ConnectionSelector';

interface KanbanStage {
  id: string;
  name: string;
  color: string;
  connectionId: string;
  connectionName: string;
}

interface KanbanStageHierarchySelectorProps {
  selectedConnectionId: string | null;
  selectedStageIds: string[];
  onChange: (stageIds: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export function KanbanStageHierarchySelector({
  selectedConnectionId,
  selectedStageIds,
  onChange,
  disabled = false,
  className = '',
}: KanbanStageHierarchySelectorProps) {
  const { profile } = useAuth();
  const [stages, setStages] = useState<KanbanStage[]>([]);
  const [connections, setConnections] = useState<{ id: string; name: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isAllConnections = selectedConnectionId === ALL_CONNECTIONS_ID;

  // Load stages
  useEffect(() => {
    async function loadStages() {
      if (!selectedConnectionId) {
        setStages([]);
        setConnections([]);
        return;
      }

      setIsLoading(true);

      try {
        if (isAllConnections && profile?.company_id) {
          // Load all connections first
          const { data: connectionsData } = await supabase
            .from('whatsapp_connections')
            .select('id, name')
            .eq('company_id', profile.company_id)
            .eq('active', true)
            .order('name');

          if (!connectionsData || connectionsData.length === 0) {
            setStages([]);
            setConnections([]);
            setIsLoading(false);
            return;
          }

          setConnections(connectionsData.map(c => ({ id: c.id, name: c.name || 'Sem nome' })));

          const connectionIds = connectionsData.map(c => c.id);

          // Get boards for all connections
          const { data: boards } = await supabase
            .from('kanban_boards')
            .select('id, whatsapp_connection_id')
            .in('whatsapp_connection_id', connectionIds);

          if (!boards || boards.length === 0) {
            setStages([]);
            setIsLoading(false);
            return;
          }

          const boardIds = boards.map(b => b.id);
          const boardToConnection = new Map(boards.map(b => [b.id, b.whatsapp_connection_id]));

          // Get all columns
          const { data: columns } = await supabase
            .from('kanban_columns')
            .select('id, name, color, board_id')
            .in('board_id', boardIds)
            .order('position');

          if (columns) {
            const connectionMap = new Map(connectionsData.map(c => [c.id, c.name || 'Sem nome']));
            setStages(columns.map(c => {
              const connId = boardToConnection.get(c.board_id) || '';
              return {
                id: c.id,
                name: c.name,
                color: c.color || '#3B82F6',
                connectionId: connId,
                connectionName: connectionMap.get(connId) || 'Sem nome',
              };
            }));
          }
        } else {
          // Single connection
          const { data: connectionData } = await supabase
            .from('whatsapp_connections')
            .select('id, name')
            .eq('id', selectedConnectionId)
            .maybeSingle();

          if (connectionData) {
            setConnections([{ id: connectionData.id, name: connectionData.name || 'Sem nome' }]);
          }

          const { data: boardData } = await supabase
            .from('kanban_boards')
            .select('id')
            .eq('whatsapp_connection_id', selectedConnectionId)
            .maybeSingle();

          if (!boardData) {
            setStages([]);
            setIsLoading(false);
            return;
          }

          const { data: columns } = await supabase
            .from('kanban_columns')
            .select('id, name, color')
            .eq('board_id', boardData.id)
            .order('position');

          setStages((columns || []).map(c => ({
            id: c.id,
            name: c.name,
            color: c.color || '#3B82F6',
            connectionId: selectedConnectionId,
            connectionName: connectionData?.name || 'Sem nome',
          })));
        }
      } catch (error) {
        console.error('[KanbanStageHierarchySelector] Error loading stages:', error);
        setStages([]);
        setConnections([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadStages();
  }, [selectedConnectionId, isAllConnections, profile?.company_id]);

  // Group stages by connection
  const stagesByConnection = useMemo(() => {
    const grouped = new Map<string, KanbanStage[]>();
    stages.forEach(stage => {
      if (!grouped.has(stage.connectionId)) {
        grouped.set(stage.connectionId, []);
      }
      grouped.get(stage.connectionId)!.push(stage);
    });
    return grouped;
  }, [stages]);

  // Filter stages based on search
  const filteredStagesByConnection = useMemo(() => {
    if (!searchTerm.trim()) return stagesByConnection;

    const term = searchTerm.toLowerCase();
    const filtered = new Map<string, KanbanStage[]>();

    stagesByConnection.forEach((stageList, connId) => {
      const matchingStages = stageList.filter(s => 
        s.name.toLowerCase().includes(term) ||
        s.connectionName.toLowerCase().includes(term)
      );
      if (matchingStages.length > 0) {
        filtered.set(connId, matchingStages);
      }
    });

    return filtered;
  }, [stagesByConnection, searchTerm]);

  // Get selected stages info
  const selectedStagesInfo = useMemo(() => {
    return stages.filter(s => selectedStageIds.includes(s.id));
  }, [stages, selectedStageIds]);

  const toggleStage = (stageId: string) => {
    if (selectedStageIds.includes(stageId)) {
      onChange(selectedStageIds.filter(id => id !== stageId));
    } else {
      onChange([...selectedStageIds, stageId]);
    }
  };

  const removeStage = (stageId: string) => {
    onChange(selectedStageIds.filter(id => id !== stageId));
  };

  const clearSelection = () => {
    onChange([]);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Prevent dropdown from closing when clicking inside
  const preventClose = (e: Event) => {
    e.preventDefault();
  };

  if (stages.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between h-9 font-normal bg-background border-input hover:bg-accent hover:text-accent-foreground"
            disabled={disabled || isLoading}
          >
            <span className="flex items-center gap-2 truncate">
              <Kanban className="w-4 h-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {selectedStageIds.length > 0 
                  ? `${selectedStageIds.length} estágio${selectedStageIds.length > 1 ? 's' : ''}`
                  : 'Todos os estágios'
                }
              </span>
            </span>
            <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent 
          className="min-w-[280px] bg-popover border-border" 
          align="start"
          sideOffset={4}
        >
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar estágio..."
                value={searchTerm}
                onChange={handleSearch}
                className="h-8 pl-8 text-sm bg-background"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Stages by connection */}
          <div className="max-h-[300px] overflow-y-auto py-1">
            {isAllConnections ? (
              // Show connections with submenus
              Array.from(filteredStagesByConnection.entries()).map(([connId, stageList]) => {
                const connection = connections.find(c => c.id === connId);
                const selectedCount = stageList.filter(s => selectedStageIds.includes(s.id)).length;

                return (
                  <DropdownMenuSub key={connId}>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Link className="w-4 h-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{connection?.name || 'Conexão'}</span>
                        {selectedCount > 0 && (
                          <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5 shrink-0">
                            {selectedCount}
                          </Badge>
                        )}
                      </div>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="min-w-[220px] bg-popover border-border">
                      {stageList.map(stage => (
                        <DropdownMenuItem
                          key={stage.id}
                          className="cursor-pointer"
                          onSelect={preventClose}
                          onClick={() => toggleStage(stage.id)}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <Checkbox
                              checked={selectedStageIds.includes(stage.id)}
                              className="pointer-events-none"
                            />
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: stage.color }}
                            />
                            <span className="truncate">{stage.name}</span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                );
              })
            ) : (
              // Single connection - show stages directly
              Array.from(filteredStagesByConnection.values()).flat().map(stage => (
                <DropdownMenuItem
                  key={stage.id}
                  className="cursor-pointer"
                  onSelect={preventClose}
                  onClick={() => toggleStage(stage.id)}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Checkbox
                      checked={selectedStageIds.includes(stage.id)}
                      className="pointer-events-none"
                    />
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="truncate">{stage.name}</span>
                  </div>
                </DropdownMenuItem>
              ))
            )}

            {filteredStagesByConnection.size === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum estágio encontrado
              </div>
            )}
          </div>

          {/* Clear selection */}
          {selectedStageIds.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer text-muted-foreground"
                onClick={clearSelection}
              >
                <X className="w-4 h-4 mr-2" />
                Limpar seleção
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Selected badges */}
      {selectedStagesInfo.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedStagesInfo.map(stage => (
            <Badge
              key={stage.id}
              variant="secondary"
              className="text-xs h-6 pl-1.5 pr-1 gap-1"
              style={{ 
                backgroundColor: `${stage.color}20`,
                borderColor: stage.color,
                borderWidth: '1px'
              }}
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              <span className="truncate max-w-[100px]">{stage.name}</span>
              <button
                type="button"
                onClick={() => removeStage(stage.id)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
