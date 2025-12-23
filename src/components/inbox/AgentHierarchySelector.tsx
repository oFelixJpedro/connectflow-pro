import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, X, User, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Agent {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

interface AgentHierarchySelectorProps {
  selectedAgentIds: string[];
  onChange: (agentIds: string[]) => void;
  disabled?: boolean;
  className?: string;
}

export function AgentHierarchySelector({
  selectedAgentIds,
  onChange,
  disabled = false,
  className,
}: AgentHierarchySelectorProps) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAgents() {
      if (!profile?.company_id) return;
      
      setIsLoading(true);

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('company_id', profile.company_id)
          .eq('active', true)
          .order('full_name');

        if (error) {
          console.error('[AgentHierarchySelector] Error loading agents:', error);
          return;
        }

        setAgents(data || []);
      } catch (error) {
        console.error('[AgentHierarchySelector] Error:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAgents();
  }, [profile?.company_id]);

  // Filter agents by search
  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents;
    
    const query = searchQuery.toLowerCase();
    return agents.filter(agent => 
      agent.full_name.toLowerCase().includes(query)
    );
  }, [agents, searchQuery]);

  // Get selected agents for display
  const selectedAgents = useMemo(() => {
    return agents.filter(agent => selectedAgentIds.includes(agent.id));
  }, [agents, selectedAgentIds]);

  const handleAgentToggle = (agentId: string) => {
    const isSelected = selectedAgentIds.includes(agentId);
    if (isSelected) {
      onChange(selectedAgentIds.filter(id => id !== agentId));
    } else {
      onChange([...selectedAgentIds, agentId]);
    }
  };

  const handleClearSelection = () => {
    onChange([]);
  };

  const handleRemoveAgent = (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedAgentIds.filter(id => id !== agentId));
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-card font-normal"
            disabled={disabled || isLoading}
          >
            <span className="flex items-center gap-2 truncate">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {selectedAgentIds.length === 0 
                  ? "Todos os atendentes" 
                  : `${selectedAgentIds.length} selecionado${selectedAgentIds.length > 1 ? 's' : ''}`
                }
              </span>
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className="min-w-[280px] p-0 bg-popover border-border" 
          align="start"
          sideOffset={4}
        >
          {/* Search field */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar atendente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Agents list */}
          <div className="max-h-[280px] overflow-y-auto p-1">
            {filteredAgents.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhum atendente encontrado
              </div>
            ) : (
              filteredAgents.map((agent) => {
                const isSelected = selectedAgentIds.includes(agent.id);
                return (
                  <DropdownMenuItem
                    key={agent.id}
                    className="flex items-center gap-2 cursor-pointer"
                    onSelect={(e) => {
                      e.preventDefault();
                      handleAgentToggle(agent.id);
                    }}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="pointer-events-none"
                    />
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                      {agent.avatar_url ? (
                        <img 
                          src={agent.avatar_url} 
                          alt={agent.full_name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        getInitials(agent.full_name)
                      )}
                    </div>
                    <span className="truncate">{agent.full_name}</span>
                  </DropdownMenuItem>
                );
              })
            )}
          </div>

          {/* Clear selection */}
          {selectedAgentIds.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onSelect={() => handleClearSelection()}
              >
                <X className="h-4 w-4 mr-2" />
                Limpar seleção
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Selected agents badges */}
      {selectedAgents.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedAgents.map((agent) => (
            <Badge
              key={agent.id}
              variant="secondary"
              className="text-xs flex items-center gap-1 pr-1 bg-secondary/50"
            >
              <span className="truncate max-w-[120px]">{agent.full_name}</span>
              <button
                type="button"
                onClick={(e) => handleRemoveAgent(agent.id, e)}
                className="ml-0.5 hover:bg-secondary rounded-sm p-0.5"
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
