import { useState, useMemo } from 'react';
import { 
  Filter, 
  Search, 
  X, 
  Building2, 
  User, 
  AlertTriangle,
  Tag,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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

interface Department {
  id: string;
  name: string;
  color?: string;
}

interface TeamMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

const PRIORITIES = [
  { value: 'low', label: 'Baixa', color: 'hsl(var(--muted-foreground))' },
  { value: 'medium', label: 'Média', color: 'hsl(210, 100%, 50%)' },
  { value: 'high', label: 'Alta', color: 'hsl(38, 100%, 50%)' },
  { value: 'urgent', label: 'Urgente', color: 'hsl(0, 100%, 50%)' },
];

interface CRMFilterSelectorProps {
  // Departamentos
  departments: Department[];
  selectedDepartmentIds: string[];
  onDepartmentChange: (ids: string[]) => void;
  
  // Responsável
  teamMembers: TeamMember[];
  selectedResponsibleIds: string[];
  onResponsibleChange: (ids: string[]) => void;
  
  // Prioridade
  selectedPriorities: string[];
  onPriorityChange: (priorities: string[]) => void;
  
  // Tags
  availableTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  
  disabled?: boolean;
}

export function CRMFilterSelector({
  departments,
  selectedDepartmentIds,
  onDepartmentChange,
  teamMembers,
  selectedResponsibleIds,
  onResponsibleChange,
  selectedPriorities,
  onPriorityChange,
  availableTags,
  selectedTags,
  onTagsChange,
  disabled = false,
}: CRMFilterSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  // Total active filters count
  const totalActiveFilters = 
    selectedDepartmentIds.length + 
    selectedResponsibleIds.length + 
    selectedPriorities.length + 
    selectedTags.length;

  const hasActiveFilters = totalActiveFilters > 0;

  // Filter items based on search
  const filteredDepartments = useMemo(() => {
    if (!searchQuery.trim()) return departments;
    const query = searchQuery.toLowerCase();
    return departments.filter(d => d.name.toLowerCase().includes(query));
  }, [departments, searchQuery]);

  const filteredTeamMembers = useMemo(() => {
    if (!searchQuery.trim()) return teamMembers;
    const query = searchQuery.toLowerCase();
    return teamMembers.filter(m => m.full_name.toLowerCase().includes(query));
  }, [teamMembers, searchQuery]);

  const filteredPriorities = useMemo(() => {
    if (!searchQuery.trim()) return PRIORITIES;
    const query = searchQuery.toLowerCase();
    return PRIORITIES.filter(p => p.label.toLowerCase().includes(query));
  }, [searchQuery]);

  const filteredTags = useMemo(() => {
    if (!searchQuery.trim()) return availableTags;
    const query = searchQuery.toLowerCase();
    return availableTags.filter(t => t.toLowerCase().includes(query));
  }, [availableTags, searchQuery]);

  // Toggle handlers
  const toggleDepartment = (id: string) => {
    if (selectedDepartmentIds.includes(id)) {
      onDepartmentChange(selectedDepartmentIds.filter(d => d !== id));
    } else {
      onDepartmentChange([...selectedDepartmentIds, id]);
    }
  };

  const toggleResponsible = (id: string) => {
    if (selectedResponsibleIds.includes(id)) {
      onResponsibleChange(selectedResponsibleIds.filter(r => r !== id));
    } else {
      onResponsibleChange([...selectedResponsibleIds, id]);
    }
  };

  const togglePriority = (value: string) => {
    if (selectedPriorities.includes(value)) {
      onPriorityChange(selectedPriorities.filter(p => p !== value));
    } else {
      onPriorityChange([...selectedPriorities, value]);
    }
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const clearAllFilters = () => {
    onDepartmentChange([]);
    onResponsibleChange([]);
    onPriorityChange([]);
    onTagsChange([]);
  };

  // Get all selected items for badges
  const getSelectedItems = () => {
    const items: { type: string; id: string; label: string; color?: string }[] = [];

    selectedDepartmentIds.forEach(id => {
      const dept = departments.find(d => d.id === id);
      if (dept) {
        items.push({ type: 'department', id, label: dept.name, color: dept.color });
      }
    });

    selectedResponsibleIds.forEach(id => {
      const member = teamMembers.find(m => m.id === id);
      if (member) {
        items.push({ type: 'responsible', id, label: member.full_name });
      }
    });

    selectedPriorities.forEach(value => {
      const priority = PRIORITIES.find(p => p.value === value);
      if (priority) {
        items.push({ type: 'priority', id: value, label: priority.label, color: priority.color });
      }
    });

    selectedTags.forEach(tag => {
      items.push({ type: 'tag', id: tag, label: tag });
    });

    return items;
  };

  const removeItem = (type: string, id: string) => {
    switch (type) {
      case 'department':
        onDepartmentChange(selectedDepartmentIds.filter(d => d !== id));
        break;
      case 'responsible':
        onResponsibleChange(selectedResponsibleIds.filter(r => r !== id));
        break;
      case 'priority':
        onPriorityChange(selectedPriorities.filter(p => p !== id));
        break;
      case 'tag':
        onTagsChange(selectedTags.filter(t => t !== id));
        break;
    }
  };

  const selectedItems = getSelectedItems();

  return (
    <div className="flex flex-col gap-2">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            Filtros
            {totalActiveFilters > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {totalActiveFilters}
              </Badge>
            )}
            <ChevronDown className="w-4 h-4 opacity-50" />
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
                placeholder="Buscar filtros..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </div>

          {/* Items */}
          <div className="overflow-y-auto flex-1 max-h-[300px]">
            {/* Departamentos */}
            {filteredDepartments.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Building2 className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">Departamento</span>
                    {selectedDepartmentIds.length > 0 && (
                      <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5 shrink-0">
                        {selectedDepartmentIds.length}
                      </Badge>
                    )}
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[200px] max-h-[250px] overflow-y-auto bg-popover">
                  {filteredDepartments.map((dept) => (
                    <DropdownMenuItem
                      key={dept.id}
                      className="flex items-center gap-2 cursor-pointer"
                      onSelect={(e) => {
                        e.preventDefault();
                        toggleDepartment(dept.id);
                      }}
                    >
                      <Checkbox
                        checked={selectedDepartmentIds.includes(dept.id)}
                        className="pointer-events-none"
                      />
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
            )}

            {/* Responsável */}
            {filteredTeamMembers.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <User className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">Responsável</span>
                    {selectedResponsibleIds.length > 0 && (
                      <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5 shrink-0">
                        {selectedResponsibleIds.length}
                      </Badge>
                    )}
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[200px] max-h-[250px] overflow-y-auto bg-popover">
                  {filteredTeamMembers.map((member) => (
                    <DropdownMenuItem
                      key={member.id}
                      className="flex items-center gap-2 cursor-pointer"
                      onSelect={(e) => {
                        e.preventDefault();
                        toggleResponsible(member.id);
                      }}
                    >
                      <Checkbox
                        checked={selectedResponsibleIds.includes(member.id)}
                        className="pointer-events-none"
                      />
                      <span className="truncate">{member.full_name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            {/* Prioridade */}
            {filteredPriorities.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">Prioridade</span>
                    {selectedPriorities.length > 0 && (
                      <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5 shrink-0">
                        {selectedPriorities.length}
                      </Badge>
                    )}
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[180px] bg-popover">
                  {filteredPriorities.map((priority) => (
                    <DropdownMenuItem
                      key={priority.value}
                      className="flex items-center gap-2 cursor-pointer"
                      onSelect={(e) => {
                        e.preventDefault();
                        togglePriority(priority.value);
                      }}
                    >
                      <Checkbox
                        checked={selectedPriorities.includes(priority.value)}
                        className="pointer-events-none"
                      />
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: priority.color }}
                      />
                      <span className="truncate">{priority.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            {/* Tags */}
            {filteredTags.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Tag className="w-4 h-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">Tags</span>
                    {selectedTags.length > 0 && (
                      <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5 shrink-0">
                        {selectedTags.length}
                      </Badge>
                    )}
                  </div>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-[180px] max-h-[250px] overflow-y-auto bg-popover">
                  {filteredTags.map((tag) => (
                    <DropdownMenuItem
                      key={tag}
                      className="flex items-center gap-2 cursor-pointer"
                      onSelect={(e) => {
                        e.preventDefault();
                        toggleTag(tag);
                      }}
                    >
                      <Checkbox
                        checked={selectedTags.includes(tag)}
                        className="pointer-events-none"
                      />
                      <span className="truncate">{tag}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            {/* Empty state */}
            {filteredDepartments.length === 0 && 
             filteredTeamMembers.length === 0 && 
             filteredPriorities.length === 0 && 
             filteredTags.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nenhum filtro encontrado
              </div>
            )}
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center gap-2 cursor-pointer text-muted-foreground"
                onSelect={(e) => {
                  e.preventDefault();
                  clearAllFilters();
                }}
              >
                <X className="h-4 w-4" />
                <span>Limpar filtros</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Selected badges */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedItems.map((item) => (
            <Badge
              key={`${item.type}-${item.id}`}
              variant="secondary"
              className="text-xs flex items-center gap-1 pr-1"
            >
              {item.color && (
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <span className="truncate max-w-[100px]">{item.label}</span>
              <button
                type="button"
                className="ml-1 hover:bg-muted rounded p-0.5"
                onClick={() => removeItem(item.type, item.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
