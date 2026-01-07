import { Bot, Trash2, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { AIAgent } from '@/types/ai-agents';

interface AgentGridCardProps {
  agent: AIAgent;
  onNavigate: (agentId: string) => void;
  onToggleStatus: (agent: AIAgent, e: React.MouseEvent) => void;
  onDelete: (agent: AIAgent, e: React.MouseEvent) => void;
  parentAgentName?: string;
  canActivate?: boolean;
}

export function AgentGridCard({
  agent,
  onNavigate,
  onToggleStatus,
  onDelete,
  parentAgentName,
  canActivate = true,
}: AgentGridCardProps) {
  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-600">Ativo</span>
          </div>
        );
      case 'paused':
        return (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-medium text-amber-600">Pausado</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Inativo</span>
          </div>
        );
    }
  };

  const connectionCount = agent.connections?.length || 0;
  
  // Can always deactivate, but can only activate if canActivate is true
  const isActive = agent.status === 'active';
  const switchDisabled = !isActive && !canActivate;

  return (
    <Card 
      className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 group flex flex-col min-h-[180px]"
      onClick={() => onNavigate(agent.id)}
    >
      <CardContent className="p-4 flex flex-col flex-1">
        {/* Header - Ícone e Status */}
        <div className="flex items-start justify-between mb-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          {getStatusIndicator(agent.status)}
        </div>

        {/* Nome e Descrição */}
        <div className="flex-1 min-h-0">
          <h3 className="font-semibold text-base leading-tight line-clamp-1">
            {agent.name}
          </h3>
          {parentAgentName && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Sub-agente de <span className="font-medium">{parentAgentName}</span>
            </p>
          )}
          {agent.description && !parentAgentName && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {agent.description}
            </p>
          )}
        </div>

        {/* Conexões */}
        {connectionCount > 0 && (
          <div className="flex items-center gap-1.5 mt-3">
            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="flex items-center gap-1">
              {agent.connections!.slice(0, 2).map((conn) => (
                <Badge 
                  key={conn.id} 
                  variant="secondary" 
                  className="text-[10px] px-1.5 py-0 h-5 max-w-[80px] truncate"
                >
                  {conn.connection?.name || conn.connection?.phone_number || 'Conexão'}
                </Badge>
              ))}
              {connectionCount > 2 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                  +{connectionCount - 2}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Footer - Ações */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          {switchDisabled ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="pointer-events-auto"
                >
                  <Switch
                    checked={isActive}
                    disabled
                    className="opacity-50 cursor-not-allowed pointer-events-none"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">Adquira créditos de IA para ativar</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Switch
              checked={isActive}
              onClick={(e) => onToggleStatus(agent, e)}
            />
          )}
          <button
            onClick={(e) => onDelete(agent, e)}
            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors opacity-0 group-hover:opacity-100"
            title="Excluir agente"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
