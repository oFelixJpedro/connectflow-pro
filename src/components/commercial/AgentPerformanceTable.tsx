import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentIndividualModal } from './AgentIndividualModal';

interface AgentAnalysis {
  id: string;
  name: string;
  avatar_url?: string;
  level: 'junior' | 'pleno' | 'senior';
  score: number;
  conversations: number;
  recommendation: 'promover' | 'manter' | 'treinar' | 'monitorar' | 'ação corretiva';
}

interface AgentPerformanceTableProps {
  loading: boolean;
  agents: AgentAnalysis[];
}

const levelLabels: Record<AgentAnalysis['level'], { label: string; color: string }> = {
  junior: { label: 'Junior', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  pleno: { label: 'Pleno', color: 'bg-primary/10 text-primary border-primary/20' },
  senior: { label: 'Senior', color: 'bg-success/10 text-success border-success/20' },
};

const recommendationLabels: Record<AgentAnalysis['recommendation'], { label: string; color: string }> = {
  promover: { label: 'Promover', color: 'bg-success/10 text-success border-success/20' },
  manter: { label: 'Manter', color: 'bg-primary/10 text-primary border-primary/20' },
  treinar: { label: 'Treinar', color: 'bg-warning/10 text-warning border-warning/20' },
  monitorar: { label: 'Monitorar', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  'ação corretiva': { label: 'Ação Corretiva', color: 'bg-destructive/10 text-destructive border-destructive/20' },
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function AgentPerformanceTable({ loading, agents }: AgentPerformanceTableProps) {
  const [selectedAgent, setSelectedAgent] = useState<AgentAnalysis | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleAgentClick = (agent: AgentAnalysis) => {
    setSelectedAgent(agent);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[180px] w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Performance dos Atendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum dado de atendente disponível</p>
            </div>
          ) : (
            <TooltipProvider delayDuration={300}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {agents.map((agent, index) => (
                  <div
                    key={agent.id}
                    onClick={() => handleAgentClick(agent)}
                    className="relative p-4 bg-muted/30 rounded-lg border cursor-pointer hover:bg-muted/50 hover:border-primary/30 transition-colors group flex flex-col"
                  >
                    {/* Rank Badge */}
                    <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">#{index + 1}</span>
                    </div>

                    {/* Avatar and Name */}
                    <div className="flex flex-col items-center text-center mb-3">
                      <Avatar className="w-14 h-14 mb-2">
                        <AvatarImage src={agent.avatar_url} className="object-cover object-top" />
                        <AvatarFallback className="bg-secondary text-secondary-foreground text-lg">
                          {getInitials(agent.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground text-sm truncate max-w-full">
                        {agent.name}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs mt-1 cursor-help", levelLabels[agent.level].color)}
                          >
                            {levelLabels[agent.level].label}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">Classificação baseada em experiência e performance.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Score */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-center gap-2 mb-3 cursor-help">
                          <span className="text-2xl font-bold text-foreground">
                            {agent.score.toFixed(1)}
                          </span>
                          <span className="text-sm text-muted-foreground">/10</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Nota média do atendente em todas as conversas (0-10).</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Progress Bar */}
                    <Progress 
                      value={agent.score * 10} 
                      className="h-2 mb-3" 
                    />

                    {/* Stats and Recommendation */}
                    <div className="flex items-center justify-between mt-auto">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground cursor-help">
                            {agent.conversations} conv.
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">Total de conversas atribuídas no período.</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs cursor-help", recommendationLabels[agent.recommendation].color)}
                          >
                            {recommendationLabels[agent.recommendation].label}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[200px]">
                          <p className="text-xs">Sugestão da IA: Promover, Manter, Treinar, Monitorar ou Ação Corretiva.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Hover indicator */}
                    <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                ))}
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      {/* Individual Agent Modal */}
      <AgentIndividualModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        agent={selectedAgent}
      />
    </>
  );
}
