import { 
  MessageSquare, 
  Users, 
  Clock, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useDashboardData } from '@/hooks/useDashboardData';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

const statusLabels: Record<string, string> = {
  open: 'Abertas',
  pending: 'Pendentes',
  in_progress: 'Em Progresso',
  waiting: 'Aguardando',
  resolved: 'Resolvidas',
  closed: 'Fechadas',
};

function MetricCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="w-12 h-12 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const {
    loading,
    metrics,
    weeklyData,
    hourlyData,
    recentConversations,
    agentPerformance,
    lastUpdated,
  } = useDashboardData();

  const todayChange = metrics.yesterdayConversations > 0
    ? Math.round(((metrics.todayConversations - metrics.yesterdayConversations) / metrics.yesterdayConversations) * 100)
    : 0;

  const formatResponseTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do seu atendimento
          </p>
        </div>
        <Badge variant="outline" className="text-sm flex items-center gap-2">
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          Atualizado {format(lastUpdated, "HH:mm", { locale: ptBR })}
        </Badge>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            {/* Total Conversations */}
            <Card className="card-hover">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Conversas Hoje
                    </p>
                    <p className="text-3xl font-bold text-foreground mt-1">
                      {metrics.todayConversations}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      {todayChange >= 0 ? (
                        <ArrowUpRight className="w-4 h-4 text-success" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-destructive" />
                      )}
                      <span className={cn(
                        "text-sm font-medium",
                        todayChange >= 0 ? "text-success" : "text-destructive"
                      )}>
                        {todayChange >= 0 ? '+' : ''}{todayChange}%
                      </span>
                      <span className="text-sm text-muted-foreground">vs ontem</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Open Conversations */}
            <Card className="card-hover">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Conversas Abertas
                    </p>
                    <p className="text-3xl font-bold text-foreground mt-1">
                      {metrics.openConversations}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-sm text-muted-foreground">
                        Aguardando atendimento
                      </span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Average Response Time */}
            <Card className="card-hover">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Tempo Médio Resposta
                    </p>
                    <p className="text-3xl font-bold text-foreground mt-1">
                      {formatResponseTime(metrics.avgResponseTimeMinutes)}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      <ArrowDownRight className="w-4 h-4 text-success" />
                      <span className="text-sm text-success font-medium">Bom</span>
                      <span className="text-sm text-muted-foreground">desempenho</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-info/10 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6 text-info" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resolution Rate */}
            <Card className="card-hover">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Taxa de Resolução
                    </p>
                    <p className="text-3xl font-bold text-foreground mt-1">
                      {metrics.resolutionRate}%
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      {metrics.resolutionRate >= 80 ? (
                        <>
                          <ArrowUpRight className="w-4 h-4 text-success" />
                          <span className="text-sm text-success font-medium">Excelente</span>
                        </>
                      ) : metrics.resolutionRate >= 50 ? (
                        <>
                          <TrendingUp className="w-4 h-4 text-warning" />
                          <span className="text-sm text-warning font-medium">Regular</span>
                        </>
                      ) : (
                        <>
                          <ArrowDownRight className="w-4 h-4 text-destructive" />
                          <span className="text-sm text-destructive font-medium">Atenção</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Conversas da Semana</CardTitle>
            <CardDescription>
              Comparativo de conversas e resoluções
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : weeklyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyData}>
                    <defs>
                      <linearGradient id="colorConversas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorResolvidas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="conversas" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorConversas)"
                      strokeWidth={2}
                      name="Conversas"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="resolvidas" 
                      stroke="hsl(var(--success))" 
                      fillOpacity={1} 
                      fill="url(#colorResolvidas)"
                      strokeWidth={2}
                      name="Resolvidas"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
                  <p>Sem dados para exibir</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Hourly Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Atividade por Hora</CardTitle>
            <CardDescription>
              Picos de atendimento hoje
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : hourlyData.some(d => d.count > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis 
                      dataKey="hour" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="hsl(var(--primary))" 
                      radius={[4, 4, 0, 0]}
                      name="Mensagens"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Clock className="w-12 h-12 mb-2 opacity-50" />
                  <p>Sem atividade hoje</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Conversations & Team Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Conversations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Conversas Recentes</CardTitle>
            <CardDescription>
              Últimas interações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))
            ) : recentConversations.length > 0 ? (
              recentConversations.map((conv) => (
                <div 
                  key={conv.id}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium text-primary">
                    {conv.contact?.name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {conv.contact?.name || conv.contact?.phoneNumber}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.contact?.phoneNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline"
                      className={cn(
                        'text-xs',
                        conv.status === 'open' && 'border-conv-open text-conv-open',
                        conv.status === 'pending' && 'border-conv-pending text-conv-pending',
                        conv.status === 'in_progress' && 'border-conv-progress text-conv-progress',
                        (conv.status === 'resolved' || conv.status === 'closed') && 'border-conv-closed text-conv-closed'
                      )}
                    >
                      {statusLabels[conv.status] || conv.status}
                    </Badge>
                    {conv.unreadCount > 0 && (
                      <Badge className="bg-primary text-primary-foreground text-xs">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
                <p>Nenhuma conversa recente</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance da Equipe</CardTitle>
            <CardDescription>
              Top atendentes hoje
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
              ))
            ) : agentPerformance.length > 0 ? (
              agentPerformance.map((agent) => (
                <div key={agent.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-xs font-medium text-primary">
                        {agent.avatar}
                      </div>
                      <span className="text-sm font-medium">{agent.name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {agent.resolved}/{agent.conversations}
                    </span>
                  </div>
                  <Progress 
                    value={agent.conversations > 0 ? (agent.resolved / agent.conversations) * 100 : 0} 
                    className="h-2"
                  />
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mb-2 opacity-50" />
                <p>Sem dados de performance hoje</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
