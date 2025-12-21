import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Clock,
  Target,
  ThumbsUp,
  ThumbsDown,
  Award,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CriteriaRadarChart } from './CriteriaRadarChart';
import { AgentAlertsSection } from './AgentAlertsSection';
import { ConversationPreviewModal } from '@/components/crm/ConversationPreviewModal';
import { useAgentIndividualData, type AgentAlert } from '@/hooks/useAgentIndividualData';

interface AgentData {
  id: string;
  name: string;
  avatar_url?: string;
  level: 'junior' | 'pleno' | 'senior';
  score: number;
  conversations: number;
  recommendation: 'promover' | 'manter' | 'treinar' | 'monitorar' | 'ação corretiva';
}

interface AgentIndividualModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: AgentData | null;
}

const levelLabels: Record<AgentData['level'], { label: string; color: string }> = {
  junior: { label: 'Junior', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
  pleno: { label: 'Pleno', color: 'bg-primary/10 text-primary border-primary/20' },
  senior: { label: 'Senior', color: 'bg-success/10 text-success border-success/20' },
};

const recommendationLabels: Record<AgentData['recommendation'], { label: string; color: string; icon: typeof Award }> = {
  promover: { label: 'Promover', color: 'bg-success/10 text-success border-success/20', icon: Award },
  manter: { label: 'Manter', color: 'bg-primary/10 text-primary border-primary/20', icon: CheckCircle },
  treinar: { label: 'Treinar', color: 'bg-warning/10 text-warning border-warning/20', icon: Target },
  monitorar: { label: 'Monitorar', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20', icon: AlertTriangle },
  'ação corretiva': { label: 'Ação Corretiva', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
};

const performanceIcons = {
  improving: <TrendingUp className="w-4 h-4 text-success" />,
  stable: <Minus className="w-4 h-4 text-muted-foreground" />,
  declining: <TrendingDown className="w-4 h-4 text-destructive" />,
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function AgentIndividualModal({ open, onOpenChange, agent }: AgentIndividualModalProps) {
  const { loading, loadingMore, data, loadMoreAlerts } = useAgentIndividualData(agent?.id || null);
  const [selectedAlert, setSelectedAlert] = useState<AgentAlert | null>(null);
  const [chatPreviewOpen, setChatPreviewOpen] = useState(false);

  const handleViewConversation = (alert: AgentAlert) => {
    setSelectedAlert(alert);
    setChatPreviewOpen(true);
  };

  if (!agent) return null;

  const RecIcon = recommendationLabels[agent.recommendation].icon;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="w-14 h-14">
                  <AvatarImage src={agent.avatar_url} className="object-cover object-top" />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {getInitials(agent.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                    {agent.name}
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs", levelLabels[agent.level].color)}
                    >
                      {levelLabels[agent.level].label}
                    </Badge>
                  </DialogTitle>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MessageSquare className="w-4 h-4" />
                      {agent.conversations} conversas
                    </div>
                    {data && (
                      <div className="flex items-center gap-1 text-sm">
                        {performanceIcons[data.metrics.recentPerformance]}
                        <span className={cn(
                          data.metrics.recentPerformance === 'improving' && 'text-success',
                          data.metrics.recentPerformance === 'declining' && 'text-destructive',
                          data.metrics.recentPerformance === 'stable' && 'text-muted-foreground'
                        )}>
                          {data.metrics.recentPerformance === 'improving' && 'Melhorando'}
                          {data.metrics.recentPerformance === 'stable' && 'Estável'}
                          {data.metrics.recentPerformance === 'declining' && 'Declinando'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-3xl font-bold text-foreground">
                    {agent.score.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">Score Geral /10</p>
                </div>
                <Badge 
                  variant="outline" 
                  className={cn("text-sm py-1 px-3 gap-1", recommendationLabels[agent.recommendation].color)}
                >
                  <RecIcon className="w-4 h-4" />
                  {recommendationLabels[agent.recommendation].label}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {loading ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                      <Skeleton key={i} className="h-24" />
                    ))}
                  </div>
                  <Skeleton className="h-64" />
                  <Skeleton className="h-40" />
                </div>
              ) : data ? (
                <>
                  {/* Metrics Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          <MessageSquare className="w-4 h-4" />
                          <span className="text-xs">Conversas</span>
                        </div>
                        <p className="text-2xl font-bold">{data.metrics.totalConversations}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          <Target className="w-4 h-4" />
                          <span className="text-xs">Conversão</span>
                        </div>
                        <p className="text-2xl font-bold">{data.metrics.conversionRate.toFixed(1)}%</p>
                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <span className="text-success">{data.metrics.closedDeals} ganhos</span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-destructive">{data.metrics.lostDeals} perdidos</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          <Clock className="w-4 h-4" />
                          <span className="text-xs">Tempo Resposta</span>
                        </div>
                        <p className="text-2xl font-bold">{data.metrics.avgResponseTime.toFixed(0)}</p>
                        <p className="text-xs text-muted-foreground">minutos (média)</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-xs">Alertas</span>
                        </div>
                        <p className={cn(
                          "text-2xl font-bold",
                          data.alerts.length > 0 && "text-warning"
                        )}>
                          {data.alerts.length}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {data.alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length} críticos
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Radar Chart and Strengths/Weaknesses */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Radar Chart */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Análise por Critério</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CriteriaRadarChart 
                          scores={data.metrics.criteriaScores}
                          loading={false}
                          showCard={false}
                        />
                      </CardContent>
                    </Card>

                    {/* Strengths and Weaknesses */}
                    <div className="space-y-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <ThumbsUp className="w-4 h-4 text-success" />
                            Pontos Fortes
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {data.metrics.strengths.length > 0 ? (
                            <ul className="space-y-2">
                              {data.metrics.strengths.map((s, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Dados insuficientes para análise
                            </p>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <ThumbsDown className="w-4 h-4 text-destructive" />
                            Pontos de Melhoria
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {data.metrics.weaknesses.length > 0 ? (
                            <ul className="space-y-2">
                              {data.metrics.weaknesses.map((w, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                                  {w}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Dados insuficientes para análise
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* Alerts Section */}
                  <AgentAlertsSection 
                    alerts={data.alerts}
                    totalAlerts={data.totalAlerts}
                    hasMore={data.hasMoreAlerts}
                    loadingMore={loadingMore}
                    onViewConversation={handleViewConversation}
                    onLoadMore={loadMoreAlerts}
                  />

                  {/* Personalized Recommendation */}
                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Award className="w-4 h-4 text-primary" />
                        Recomendação Personalizada
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed">
                        {data.personalizedRecommendation}
                      </p>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    Não foi possível carregar os dados do atendente
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Chat Preview Modal - Using unified CRM modal */}
      <ConversationPreviewModal
        open={chatPreviewOpen}
        onOpenChange={setChatPreviewOpen}
        contactId={selectedAlert?.contact_id || ''}
        contactName={selectedAlert?.contact?.name || undefined}
        contactPhone={selectedAlert?.contact?.phone_number}
      />
    </>
  );
}
