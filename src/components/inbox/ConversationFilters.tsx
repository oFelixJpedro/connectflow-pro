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
import { DepartmentHierarchySelector } from '@/components/inbox/DepartmentHierarchySelector';
import { TagHierarchySelector } from '@/components/inbox/TagHierarchySelector';
import { KanbanStageHierarchySelector } from '@/components/inbox/KanbanStageHierarchySelector';
import { AgentHierarchySelector } from '@/components/inbox/AgentHierarchySelector';
import { useAuth } from '@/contexts/AuthContext';
import type { ConversationFilters as FiltersType } from '@/types';

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
  const [localFilters, setLocalFilters] = useState<FiltersType>(filters);

  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

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
            {isAdminOrOwner && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Por Atendente
                  </Label>
                  <AgentHierarchySelector
                    selectedAgentIds={localFilters.filterByAgentIds || []}
                    onChange={(ids) => setLocalFilters(prev => ({ 
                      ...prev, 
                      filterByAgentIds: ids.length > 0 ? ids : undefined 
                    }))}
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

            {/* Tags Filter - Hierarchical selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tags
              </Label>
              <TagHierarchySelector
                selectedConnectionId={connectionId}
                selectedTagIds={localFilters.tags || []}
                onChange={(ids) => setLocalFilters(prev => ({ 
                  ...prev, 
                  tags: ids.length > 0 ? ids : undefined 
                }))}
              />
            </div>
            <Separator />

            {/* Kanban Funnel Stage Filter - Hierarchical selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Estágio do Funil
              </Label>
              <KanbanStageHierarchySelector
                selectedConnectionId={connectionId}
                selectedStageIds={localFilters.kanbanColumnIds || []}
                onChange={(ids) => setLocalFilters(prev => ({ 
                  ...prev, 
                  kanbanColumnIds: ids.length > 0 ? ids : undefined 
                }))}
              />
            </div>
            <Separator />

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
