import { useState, useEffect, useMemo } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown';
import { DepartmentHierarchySelector } from '@/components/inbox/DepartmentHierarchySelector';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ALL_CONNECTIONS_ID } from '@/components/inbox/ConnectionSelector';
import type { ConversationFilters as FiltersType } from '@/types';

interface Agent {
  id: string;
  full_name: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface KanbanColumn {
  id: string;
  name: string;
  color: string;
  connectionId: string;
}

interface ConversationFiltersProps {
  connectionId: string | null;
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  currentUserId?: string;
  isRestricted?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'open', label: 'Abertas' },
  { value: 'in_progress', label: 'Em atendimento' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'waiting', label: 'Aguardando' },
  { value: 'closed', label: 'Fechadas' },
] as const;

export function ConversationFiltersComponent({
  connectionId,
  filters,
  onFiltersChange,
  currentUserId,
  isRestricted = false,
}: ConversationFiltersProps) {
  const { userRole, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>([]);
  const [localFilters, setLocalFilters] = useState<FiltersType>(filters);

  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';
  const isAllConnections = connectionId === ALL_CONNECTIONS_ID;

  // Load agents for admin/owner
  useEffect(() => {
    async function loadAgents() {
      if (!isAdminOrOwner) {
        setAgents([]);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('active', true)
        .order('full_name');

      if (error) {
        console.error('[ConversationFilters] Error loading agents:', error);
        return;
      }

      setAgents(data || []);
    }

    loadAgents();
  }, [isAdminOrOwner]);

  // Load tags
  useEffect(() => {
    async function loadTags() {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color')
        .order('name');

      if (error) {
        console.error('[ConversationFilters] Error loading tags:', error);
        return;
      }

      setTags(data || []);
    }

    loadTags();
  }, []);

  // Load kanban columns for the connection(s)
  useEffect(() => {
    async function loadKanbanColumns() {
      if (!connectionId) {
        setKanbanColumns([]);
        return;
      }

      try {
        if (isAllConnections && profile?.company_id) {
          // Get all boards for company connections
          const { data: connections } = await supabase
            .from('whatsapp_connections')
            .select('id')
            .eq('company_id', profile.company_id)
            .eq('active', true);

          if (!connections || connections.length === 0) {
            setKanbanColumns([]);
            return;
          }

          const connectionIds = connections.map(c => c.id);

          const { data: boards } = await supabase
            .from('kanban_boards')
            .select('id, whatsapp_connection_id')
            .in('whatsapp_connection_id', connectionIds);

          if (!boards || boards.length === 0) {
            setKanbanColumns([]);
            return;
          }

          const boardIds = boards.map(b => b.id);

          const { data: columns } = await supabase
            .from('kanban_columns')
            .select('id, name, color, board_id')
            .in('board_id', boardIds)
            .order('position');

          if (columns) {
            // Map board_id to connection_id
            const boardToConnection = new Map(boards.map(b => [b.id, b.whatsapp_connection_id]));
            setKanbanColumns(columns.map(c => ({
              id: c.id,
              name: c.name,
              color: c.color || '#3B82F6',
              connectionId: boardToConnection.get(c.board_id) || '',
            })));
          }
        } else {
          // Single connection
          const { data: boardData } = await supabase
            .from('kanban_boards')
            .select('id')
            .eq('whatsapp_connection_id', connectionId)
            .maybeSingle();

          if (!boardData) {
            setKanbanColumns([]);
            return;
          }

          const { data } = await supabase
            .from('kanban_columns')
            .select('id, name, color')
            .eq('board_id', boardData.id)
            .order('position');

          setKanbanColumns((data || []).map(c => ({
            id: c.id,
            name: c.name,
            color: c.color || '#3B82F6',
            connectionId: connectionId,
          })));
        }
      } catch (error) {
        console.error('[ConversationFilters] Error loading kanban columns:', error);
        setKanbanColumns([]);
      }
    }

    loadKanbanColumns();
  }, [connectionId, isAllConnections, profile?.company_id]);

  // Sync local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    return [
      localFilters.status && localFilters.status.length > 0,
      localFilters.departmentIds && localFilters.departmentIds.length > 0,
      isAdminOrOwner && localFilters.filterByAgentIds && localFilters.filterByAgentIds.length > 0,
      localFilters.tags && localFilters.tags.length > 0,
      localFilters.kanbanColumnIds && localFilters.kanbanColumnIds.length > 0,
      isAdminOrOwner && localFilters.isFollowing,
    ].filter(Boolean).length;
  }, [localFilters, isAdminOrOwner]);

  const handleApply = () => {
    onFiltersChange(localFilters);
    localStorage.setItem('conversationFilters', JSON.stringify(localFilters));
    setIsOpen(false);
  };

  const handleClear = () => {
    const clearedFilters: FiltersType = {
      status: [],
      departmentIds: undefined,
      filterByAgentIds: undefined,
      tags: undefined,
      kanbanColumnIds: undefined,
      isFollowing: undefined,
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
    localStorage.removeItem('conversationFilters');
    setIsOpen(false);
  };

  const handleStatusChange = (statusValue: string, checked: boolean) => {
    const currentStatuses = localFilters.status || [];
    let newStatuses: string[];
    
    if (checked) {
      newStatuses = [...currentStatuses, statusValue];
    } else {
      newStatuses = currentStatuses.filter(s => s !== statusValue);
    }
    
    setLocalFilters(prev => ({ ...prev, status: newStatuses }));
  };

  // Convert options for dropdowns
  const agentOptions = agents.map(a => ({ value: a.id, label: a.full_name }));
  const tagOptions = tags.map(t => ({ value: t.id, label: t.name, color: t.color }));
  const kanbanOptions = kanbanColumns.map(k => ({ value: k.id, label: k.name, color: k.color }));

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 bg-card relative"
        >
          <Filter className="w-4 h-4" />
          {activeFiltersCount > 0 && (
            <Badge 
              variant="secondary" 
              className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1.5 text-xs bg-primary text-primary-foreground"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        align="end" 
        className="w-80 p-0 bg-popover border-border flex flex-col max-h-[70vh]"
        sideOffset={4}
      >
        <div className="p-3 border-b border-border shrink-0">
          <h4 className="font-medium text-sm">Filtrar Conversas</h4>
        </div>
        
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-3 space-y-4">
            {/* Agent Filter - Only for admin/owner - Multi-select */}
            {isAdminOrOwner && agents.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Por Atendente
                  </Label>
                  <MultiSelectDropdown
                    options={agentOptions}
                    values={localFilters.filterByAgentIds || []}
                    onChange={(values) => setLocalFilters(prev => ({ 
                      ...prev, 
                      filterByAgentIds: values.length > 0 ? values : undefined 
                    }))}
                    placeholder="Todos os atendentes"
                    searchPlaceholder="Buscar atendente..."
                    emptyMessage="Nenhum atendente encontrado"
                  />
                </div>
                <Separator />
              </>
            )}

            {/* Department Filter - Hierarchical selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Departamento
              </Label>
              <DepartmentHierarchySelector
                selectedConnectionId={connectionId}
                selectedDepartmentIds={localFilters.departmentIds || []}
                onChange={(ids) => setLocalFilters(prev => ({ 
                  ...prev, 
                  departmentIds: ids.length > 0 ? ids : undefined 
                }))}
              />
            </div>
            <Separator />

            {/* Tags Filter - Multi-select */}
            {tags.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Tags
                  </Label>
                  <MultiSelectDropdown
                    options={tagOptions}
                    values={localFilters.tags || []}
                    onChange={(values) => setLocalFilters(prev => ({ ...prev, tags: values.length > 0 ? values : undefined }))}
                    placeholder="Todas as tags"
                    searchPlaceholder="Buscar tags..."
                    emptyMessage="Nenhuma tag encontrada"
                  />
                </div>
                <Separator />
              </>
            )}

            {/* Kanban Funnel Stage Filter - Multi-select */}
            {kanbanColumns.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Estágio do Funil
                  </Label>
                  <MultiSelectDropdown
                    options={kanbanOptions}
                    values={localFilters.kanbanColumnIds || []}
                    onChange={(values) => setLocalFilters(prev => ({ 
                      ...prev, 
                      kanbanColumnIds: values.length > 0 ? values : undefined 
                    }))}
                    placeholder="Todos os estágios"
                    searchPlaceholder="Buscar estágio..."
                    emptyMessage="Nenhum estágio encontrado"
                  />
                </div>
                <Separator />
              </>
            )}

            {/* Status Filter with Checkboxes */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </Label>
              <div className="space-y-2">
                {STATUS_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${option.value}`}
                      checked={(localFilters.status || []).includes(option.value)}
                      onCheckedChange={(checked) => handleStatusChange(option.value, checked as boolean)}
                    />
                    <Label 
                      htmlFor={`status-${option.value}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* OUTROS Filter - Only for admin/owner */}
            {isAdminOrOwner && (
              <>
                <Separator />

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Outros
                  </Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="filter-following"
                      checked={localFilters.isFollowing || false}
                      onCheckedChange={(checked) => 
                        setLocalFilters(prev => ({ 
                          ...prev, 
                          isFollowing: checked ? true : undefined 
                        }))
                      }
                    />
                    <Label 
                      htmlFor="filter-following"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Seguindo
                    </Label>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-3 border-t border-border flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="flex-1"
          >
            Limpar
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            className="flex-1"
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
