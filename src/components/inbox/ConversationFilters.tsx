import { useState, useEffect } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import type { ConversationFilters as FiltersType } from '@/types';

interface Department {
  id: string;
  name: string;
}

interface ConversationFiltersProps {
  connectionId: string | null;
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  currentUserId?: string;
}

const ASSIGNMENT_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'mine', label: 'Minhas conversas' },
  { value: 'unassigned', label: 'Não atribuídas' },
  { value: 'others', label: 'De outros atendentes' },
] as const;

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'open', label: 'Abertas' },
  { value: 'in_progress', label: 'Em atendimento' },
  { value: 'closed', label: 'Fechadas' },
] as const;

export function ConversationFiltersComponent({
  connectionId,
  filters,
  onFiltersChange,
  currentUserId,
}: ConversationFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [localFilters, setLocalFilters] = useState<FiltersType>(filters);

  // Carregar departamentos da conexão
  useEffect(() => {
    async function loadDepartments() {
      if (!connectionId) {
        setDepartments([]);
        return;
      }

      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('whatsapp_connection_id', connectionId)
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('[ConversationFilters] Erro ao carregar departamentos:', error);
        return;
      }

      setDepartments(data || []);
    }

    loadDepartments();
  }, [connectionId]);

  // Sync local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Contar filtros ativos
  const activeFiltersCount = [
    filters.assignedUserId && filters.assignedUserId !== 'all',
    filters.status && filters.status !== 'all',
    filters.departmentId && filters.departmentId !== 'all',
  ].filter(Boolean).length;

  const handleApply = () => {
    onFiltersChange(localFilters);
    localStorage.setItem('conversationFilters', JSON.stringify(localFilters));
    setIsOpen(false);
  };

  const handleClear = () => {
    const clearedFilters: FiltersType = {
      status: 'all',
      assignedUserId: 'all',
      departmentId: undefined,
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
    localStorage.removeItem('conversationFilters');
    setIsOpen(false);
  };

  const removeFilter = (filterKey: keyof FiltersType) => {
    const newFilters = { ...filters };
    if (filterKey === 'status') {
      newFilters.status = 'all';
    } else if (filterKey === 'assignedUserId') {
      newFilters.assignedUserId = 'all';
    } else if (filterKey === 'departmentId') {
      newFilters.departmentId = undefined;
    }
    onFiltersChange(newFilters);
    localStorage.setItem('conversationFilters', JSON.stringify(newFilters));
  };

  const getFilterLabel = (key: keyof FiltersType, value: string | undefined): string => {
    if (key === 'status') {
      return STATUS_OPTIONS.find(o => o.value === value)?.label || value || '';
    }
    if (key === 'assignedUserId') {
      return ASSIGNMENT_OPTIONS.find(o => o.value === value)?.label || value || '';
    }
    if (key === 'departmentId') {
      return departments.find(d => d.id === value)?.name || 'Departamento';
    }
    return '';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 bg-card"
            >
              <Filter className="w-4 h-4" />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <Badge 
                  variant="secondary" 
                  className="ml-1 h-5 min-w-5 px-1.5 text-xs bg-primary text-primary-foreground"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            align="start" 
            className="w-72 p-0 bg-popover border-border flex flex-col max-h-[60vh]"
            sideOffset={4}
          >
            <div className="p-3 border-b border-border shrink-0">
              <h4 className="font-medium text-sm">Filtrar Conversas</h4>
            </div>
            
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-4">
                {/* Filtro de Atribuição */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Atribuição
                  </Label>
                  <RadioGroup
                    value={localFilters.assignedUserId || 'all'}
                    onValueChange={(value) => 
                      setLocalFilters(prev => ({ ...prev, assignedUserId: value as FiltersType['assignedUserId'] }))
                    }
                    className="space-y-1.5"
                  >
                    {ASSIGNMENT_OPTIONS.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.value} id={`assignment-${option.value}`} />
                        <Label 
                          htmlFor={`assignment-${option.value}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <Separator />

                {/* Filtro de Status */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </Label>
                  <RadioGroup
                    value={localFilters.status || 'all'}
                    onValueChange={(value) => 
                      setLocalFilters(prev => ({ ...prev, status: value as FiltersType['status'] }))
                    }
                    className="space-y-1.5"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.value} id={`status-${option.value}`} />
                        <Label 
                          htmlFor={`status-${option.value}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                {departments.length > 0 && (
                  <>
                    <Separator />

                    {/* Filtro de Departamento */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Departamento
                      </Label>
                      <RadioGroup
                        value={localFilters.departmentId || 'all'}
                        onValueChange={(value) => 
                          setLocalFilters(prev => ({ 
                            ...prev, 
                            departmentId: value === 'all' ? undefined : value 
                          }))
                        }
                        className="space-y-1.5"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="all" id="department-all" />
                          <Label 
                            htmlFor="department-all"
                            className="text-sm font-normal cursor-pointer"
                          >
                            Todos
                          </Label>
                        </div>
                        {departments.map((dept) => (
                          <div key={dept.id} className="flex items-center space-x-2">
                            <RadioGroupItem value={dept.id} id={`department-${dept.id}`} />
                            <Label 
                              htmlFor={`department-${dept.id}`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              {dept.name}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

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

        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
          >
            Limpar todos
          </Button>
        )}
      </div>

      {/* Chips dos filtros ativos */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.assignedUserId && filters.assignedUserId !== 'all' && (
            <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-0.5">
              <span className="text-xs">{getFilterLabel('assignedUserId', filters.assignedUserId)}</span>
              <button
                onClick={() => removeFilter('assignedUserId')}
                className="ml-1 hover:bg-muted rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.status && filters.status !== 'all' && (
            <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-0.5">
              <span className="text-xs">{getFilterLabel('status', filters.status)}</span>
              <button
                onClick={() => removeFilter('status')}
                className="ml-1 hover:bg-muted rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {filters.departmentId && (
            <Badge variant="secondary" className="gap-1 pl-2 pr-1 py-0.5">
              <span className="text-xs">{getFilterLabel('departmentId', filters.departmentId)}</span>
              <button
                onClick={() => removeFilter('departmentId')}
                className="ml-1 hover:bg-muted rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
