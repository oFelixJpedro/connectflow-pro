import { useState, useEffect } from 'react';
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
import { SearchableDropdown } from '@/components/ui/searchable-dropdown';
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ConversationFilters as FiltersType } from '@/types';

interface Department {
  id: string;
  name: string;
  color?: string;
}

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
  const { userRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>([]);
  const [localFilters, setLocalFilters] = useState<FiltersType>(filters);

  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  // Load departments for the connection
  useEffect(() => {
    async function loadDepartments() {
      if (!connectionId) {
        setDepartments([]);
        return;
      }

      const { data, error } = await supabase
        .from('departments')
        .select('id, name, color')
        .eq('whatsapp_connection_id', connectionId)
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('[ConversationFilters] Error loading departments:', error);
        return;
      }

      setDepartments(data || []);
    }

    loadDepartments();
  }, [connectionId]);

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

  // Load kanban columns for the connection
  useEffect(() => {
    async function loadKanbanColumns() {
      if (!connectionId) {
        setKanbanColumns([]);
        return;
      }

      // First get the board for this connection
      const { data: boardData, error: boardError } = await supabase
        .from('kanban_boards')
        .select('id')
        .eq('whatsapp_connection_id', connectionId)
        .maybeSingle();

      if (boardError || !boardData) {
        setKanbanColumns([]);
        return;
      }

      // Then get columns for this board
      const { data, error } = await supabase
        .from('kanban_columns')
        .select('id, name, color')
        .eq('board_id', boardData.id)
        .order('position');

      if (error) {
        console.error('[ConversationFilters] Error loading kanban columns:', error);
        return;
      }

      setKanbanColumns(data || []);
    }

    loadKanbanColumns();
  }, [connectionId]);

  // Sync local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Count active filters
  const activeFiltersCount = [
    localFilters.status && localFilters.status.length > 0,
    localFilters.departmentId,
    isAdminOrOwner && localFilters.filterByAgentId,
    localFilters.tags && localFilters.tags.length > 0,
    localFilters.kanbanColumnId,
    isAdminOrOwner && localFilters.isFollowing,
  ].filter(Boolean).length;

  const handleApply = () => {
    onFiltersChange(localFilters);
    localStorage.setItem('conversationFilters', JSON.stringify(localFilters));
    setIsOpen(false);
  };

  const handleClear = () => {
    const clearedFilters: FiltersType = {
      status: [],
      departmentId: undefined,
      filterByAgentId: undefined,
      tags: undefined,
      kanbanColumnId: undefined,
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
  const departmentOptions = departments.map(d => ({ value: d.id, label: d.name, color: d.color }));
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
            {/* Agent Filter - Only for admin/owner */}
            {isAdminOrOwner && agents.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Por Atendente
                  </Label>
                  <SearchableDropdown
                    options={agentOptions}
                    value={localFilters.filterByAgentId}
                    onChange={(value) => setLocalFilters(prev => ({ ...prev, filterByAgentId: value }))}
                    placeholder="Todos os atendentes"
                    searchPlaceholder="Buscar atendente..."
                    emptyMessage="Nenhum atendente encontrado"
                  />
                </div>
                <Separator />
              </>
            )}

            {/* Department Filter */}
            {departments.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Departamento
                  </Label>
                  <SearchableDropdown
                    options={departmentOptions}
                    value={localFilters.departmentId}
                    onChange={(value) => setLocalFilters(prev => ({ ...prev, departmentId: value }))}
                    placeholder="Todos os departamentos"
                    searchPlaceholder="Buscar departamento..."
                    emptyMessage="Nenhum departamento encontrado"
                  />
                </div>
                <Separator />
              </>
            )}

            {/* Tags Filter */}
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

            {/* Kanban Funnel Stage Filter */}
            {kanbanColumns.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Estágio do Funil
                  </Label>
                  <SearchableDropdown
                    options={kanbanOptions}
                    value={localFilters.kanbanColumnId}
                    onChange={(value) => setLocalFilters(prev => ({ ...prev, kanbanColumnId: value }))}
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
