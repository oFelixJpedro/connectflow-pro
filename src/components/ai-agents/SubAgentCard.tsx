import { Bot, Settings, Trash2, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import type { AIAgent } from '@/types/ai-agents';

interface SubAgentCardProps {
  agent: AIAgent;
  onNavigate: (agentId: string) => void;
  onToggleStatus: (agent: AIAgent) => void;
  onDelete: (agent: AIAgent) => void;
}

export function SubAgentCard({
  agent,
  onNavigate,
  onToggleStatus,
  onDelete,
}: SubAgentCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">Ativo</Badge>;
      case 'paused':
        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">Pausado</Badge>;
      default:
        return <Badge variant="secondary">Inativo</Badge>;
    }
  };

  return (
    <Card 
      className="cursor-pointer hover:border-primary/50 transition-colors group"
      onClick={() => onNavigate(agent.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Ícone */}
          <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-muted-foreground" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium truncate">{agent.name}</h4>
              {getStatusBadge(agent.status)}
            </div>
            {agent.description && (
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {agent.description}
              </p>
            )}
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={agent.status === 'active'}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStatus(agent);
              }}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(agent);
              }}
              className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100"
              title="Excluir sub-agente"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
