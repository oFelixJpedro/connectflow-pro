import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
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
          <div className="space-y-3">
            {agents.map((agent, index) => (
              <div
                key={agent.id}
                className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg border"
              >
                {/* Rank */}
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">#{index + 1}</span>
                </div>

                {/* Avatar */}
                <Avatar className="w-10 h-10">
                  <AvatarImage src={agent.avatar_url} className="object-cover object-top" />
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
                    {getInitials(agent.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Name and Level */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {agent.name}
                    </span>
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs", levelLabels[agent.level].color)}
                    >
                      {levelLabels[agent.level].label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress 
                      value={agent.score * 10} 
                      className="h-2 flex-1 max-w-[100px]" 
                    />
                    <span className="text-sm text-muted-foreground">
                      {agent.conversations} conv.
                    </span>
                  </div>
                </div>

                {/* Score */}
                <div className="text-right">
                  <p className="text-xl font-bold text-foreground">
                    {agent.score.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">/10</p>
                </div>

                {/* Recommendation */}
                <Badge 
                  variant="outline" 
                  className={cn("text-xs shrink-0", recommendationLabels[agent.recommendation].color)}
                >
                  {recommendationLabels[agent.recommendation].label}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
