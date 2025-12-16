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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { ConversationFilters as FiltersType } from '@/types';

interface Department {
  id: string;
  name: string;
}

interface Agent {
  id: string;
  full_name: string;
}

interface ConversationFiltersProps {
  connectionId: string | null;
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  currentUserId?: string;
  isRestricted?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos', color: null },
  { value: 'open', label: 'Abertas', color: 'bg-primary' },
  { value: 'in_progress', label: 'Em atendimento', color: 'bg-success' },
  { value: 'closed', label: 'Fechadas', color: 'bg-destructive' },
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
        .select('id, name')
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

  // Sync local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Count active filters (excluding column-based assignment)
  const activeFiltersCount = [
    filters.status && filters.status !== 'all',
    filters.departmentId && filters.departmentId !== 'all',
    isAdminOrOwner && filters.filterByAgentId,
    isAdminOrOwner && filters.isFollowing,
  ].filter(Boolean).length;

  const handleApply = () => {
    onFiltersChange(localFilters);
    localStorage.setItem('conversationFilters', JSON.stringify(localFilters));
    setIsOpen(false);
  };

  const handleClear = () => {
    const clearedFilters: FiltersType = {
      status: 'all',
      departmentId: undefined,
      filterByAgentId: undefined,
      isFollowing: undefined,
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
    } else if (filterKey === 'departmentId') {
      newFilters.departmentId = undefined;
    } else if (filterKey === 'filterByAgentId') {
      newFilters.filterByAgentId = undefined;
    }
    onFiltersChange(newFilters);
    localStorage.setItem('conversationFilters', JSON.stringify(newFilters));
  };

  const getFilterLabel = (key: keyof FiltersType, value: string | undefined): string => {
    if (key === 'status') {
      return STATUS_OPTIONS.find(o => o.value === value)?.label || value || '';
    }
    if (key === 'departmentId') {
      return departments.find(d => d.id === value)?.name || 'Departamento';
    }
    if (key === 'filterByAgentId') {
      return agents.find(a => a.id === value)?.full_name || 'Atendente';
    }
    return '';
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
        className="w-72 p-0 bg-popover border-border flex flex-col max-h-[60vh]"
        sideOffset={4}
      >
        <div className="p-3 border-b border-border shrink-0">
          <h4 className="font-medium text-sm">Filtrar Conversas</h4>
        </div>
        
        <div className="flex-1 overflow-y-auto min-h-0 max-h-[300px]">
          <div className="p-3 space-y-4">
            {/* Agent Filter - Only for admin/owner */}
            {isAdminOrOwner && agents.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Por Atendente
                  </Label>
                  <RadioGroup
                    value={localFilters.filterByAgentId || 'all'}
                    onValueChange={(value) => 
                      setLocalFilters(prev => ({ 
                        ...prev, 
                        filterByAgentId: value === 'all' ? undefined : value 
                      }))
                    }
                    className="space-y-1.5"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="agent-all" />
                      <Label 
                        htmlFor="agent-all"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Todos os atendentes
                      </Label>
                    </div>
                    {agents.map((agent) => (
                      <div key={agent.id} className="flex items-center space-x-2">
                        <RadioGroupItem value={agent.id} id={`agent-${agent.id}`} />
                        <Label 
                          htmlFor={`agent-${agent.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {agent.full_name}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <Separator />
              </>
            )}

            {/* Status Filter */}
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
                      className="text-sm font-normal cursor-pointer flex items-center gap-2"
                    >
                      {option.color && (
                        <span className={`w-2 h-2 rounded-full ${option.color}`} />
                      )}
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {departments.length > 0 && (
              <>
                <Separator />

                {/* Department Filter */}
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

            {/* OUTROS Filter - Only for admin/owner */}
            {isAdminOrOwner && (
              <>
                <Separator />

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Outros
                  </Label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="filter-following"
                      checked={localFilters.isFollowing || false}
                      onChange={(e) => 
                        setLocalFilters(prev => ({ 
                          ...prev, 
                          isFollowing: e.target.checked ? true : undefined 
                        }))
                      }
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
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
