import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Bot, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAIAgents } from '@/hooks/useAIAgents';

interface AIAgentSelectorProps {
  position: { x: number; y: number };
  onSelect: (value: string) => void;
  onClose: () => void;
  onBack?: () => void;
  currentAgentId?: string;
}

export function AIAgentSelector({ position, onSelect, onClose, onBack, currentAgentId }: AIAgentSelectorProps) {
  const { agents, isLoading: loading } = useAIAgents();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter out current agent and show only active ones
  const filteredAgents = useMemo(() => {
    let filtered = agents.filter(a => a.id !== currentAgentId && a.status === 'active');
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(searchLower) ||
        a.description?.toLowerCase().includes(searchLower)
      );
    }
    return filtered;
  }, [agents, currentAgentId, search]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredAgents.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => (i + 1) % filteredAgents.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => (i - 1 + filteredAgents.length) % filteredAgents.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredAgents[selectedIndex]) {
            handleSelect(filteredAgents[selectedIndex].name);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [filteredAgents, selectedIndex, onClose]);

  const handleSelect = (agentName: string) => {
    onSelect(agentName);
  };

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-72 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
      style={{
        left: Math.min(position.x, window.innerWidth - 300),
        top: position.y + 8,
      }}
    >
      {/* Header with back button */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <span className="text-sm font-medium">Selecionar Agente</span>
      </div>

      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar agente..."
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      <div className="max-h-[240px] overflow-y-auto">
        <div className="p-1">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Nenhum agente encontrado
            </div>
          ) : (
            filteredAgents.map((agent, index) => (
              <button
                key={agent.id}
                onClick={() => handleSelect(agent.name)}
                className={cn(
                  'w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors',
                  index === selectedIndex 
                    ? 'bg-accent text-accent-foreground' 
                    : 'hover:bg-accent/50'
                )}
              >
                <Bot className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{agent.name}</div>
                  {agent.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {agent.description}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
