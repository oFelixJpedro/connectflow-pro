import { Search, X, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KanbanFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterResponsible: string[];
  onResponsibleChange: (value: string[]) => void;
  filterPriority: string[];
  onPriorityChange: (value: string[]) => void;
  filterTags: string[];
  onTagsChange: (value: string[]) => void;
  teamMembers: { id: string; full_name: string; avatar_url: string | null }[];
  availableTags: string[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

const priorities = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

export function KanbanFilters({
  searchQuery,
  onSearchChange,
  filterResponsible,
  onResponsibleChange,
  filterPriority,
  onPriorityChange,
  filterTags,
  onTagsChange,
  teamMembers,
  availableTags,
  hasActiveFilters,
  onClearFilters,
}: KanbanFiltersProps) {
  const toggleResponsible = (id: string) => {
    if (filterResponsible.includes(id)) {
      onResponsibleChange(filterResponsible.filter(r => r !== id));
    } else {
      onResponsibleChange([...filterResponsible, id]);
    }
  };

  const togglePriority = (value: string) => {
    if (filterPriority.includes(value)) {
      onPriorityChange(filterPriority.filter(p => p !== value));
    } else {
      onPriorityChange([...filterPriority, value]);
    }
  };

  const toggleTag = (tag: string) => {
    if (filterTags.includes(tag)) {
      onTagsChange(filterTags.filter(t => t !== tag));
    } else {
      onTagsChange([...filterTags, tag]);
    }
  };

  const activeFilterCount = 
    (filterResponsible.length > 0 ? 1 : 0) +
    (filterPriority.length > 0 ? 1 : 0) +
    (filterTags.length > 0 ? 1 : 0);

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Responsible Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            Responsável
            {filterResponsible.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {filterResponsible.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <ScrollArea className="max-h-64">
            <div className="space-y-2">
              {teamMembers.map(member => (
                <div key={member.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`responsible-${member.id}`}
                    checked={filterResponsible.includes(member.id)}
                    onCheckedChange={() => toggleResponsible(member.id)}
                  />
                  <Label 
                    htmlFor={`responsible-${member.id}`}
                    className="text-sm cursor-pointer"
                  >
                    {member.full_name}
                  </Label>
                </div>
              ))}
              {teamMembers.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum membro</p>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Priority Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            Prioridade
            {filterPriority.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {filterPriority.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48" align="start">
          <div className="space-y-2">
            {priorities.map(p => (
              <div key={p.value} className="flex items-center gap-2">
                <Checkbox
                  id={`priority-${p.value}`}
                  checked={filterPriority.includes(p.value)}
                  onCheckedChange={() => togglePriority(p.value)}
                />
                <Label 
                  htmlFor={`priority-${p.value}`}
                  className="text-sm cursor-pointer"
                >
                  {p.label}
                </Label>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Tags Filter */}
      {availableTags.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              Tags
              {filterTags.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {filterTags.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {availableTags.map(tag => (
                  <div key={tag} className="flex items-center gap-2">
                    <Checkbox
                      id={`tag-${tag}`}
                      checked={filterTags.includes(tag)}
                      onCheckedChange={() => toggleTag(tag)}
                    />
                    <Label 
                      htmlFor={`tag-${tag}`}
                      className="text-sm cursor-pointer"
                    >
                      {tag}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="text-muted-foreground"
        >
          <X className="w-4 h-4 mr-1" />
          Limpar filtros
        </Button>
      )}
    </div>
  );
}
