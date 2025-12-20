import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, 
  Users, 
  Clock, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LayoutDashboard
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDashboardData } from '@/hooks/useDashboardData';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { ConversationPreviewModal } from '@/components/crm/ConversationPreviewModal';
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
  const navigate = useNavigate();
  const {
    loading,
    metrics,
    weeklyData,
    hourlyData,
    recentConversations,
    agentPerformance,
    lastUpdated,
    filter,
    setFilter,
    isAdmin,
  } = useDashboardData();

  const [viewMode, setViewMode] = useState<'dashboard' | 'commercial'>('dashboard');

  // State for conversation preview modal
  const [previewModal, setPreviewModal] = useState<{
    open: boolean;
    contactId: string;
    contactName?: string;
    contactPhone?: string;
    contactAvatarUrl?: string;
  }>({
    open: false,
    contactId: '',
  });

  const handleConversationClick = (conv: typeof recentConversations[0]) => {
    setPreviewModal({
      open: true,
      contactId: conv.contactId,
      contactName: conv.contact?.name || undefined,
      contactPhone: conv.contact?.phoneNumber,
      contactAvatarUrl: conv.contact?.avatarUrl || undefined,
    });
  };

  const handleViewChange = (value: string) => {
    if (value === 'commercial') {
      navigate('/commercial-manager');
    }
    setViewMode(value as 'dashboard' | 'commercial');
  };

  const todayChange = metrics.yesterdayConversations > 0
    ? Math.round(((metrics.todayConversations - metrics.yesterdayConversations) / metrics.yesterdayConversations) * 100)
    : 0;

  const formatResponseTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  // Get filter display label for non-admin users
  const getPageTitle = () => {
    if (!isAdmin) {
      return 'Dashboard - Minhas Métricas';
    }
    return 'Dashboard';
  };

  const getPageDescription = () => {
    if (!isAdmin) {
      return 'Suas métricas de atendimento';
    }
    return 'Visão geral do seu atendimento';
  };

  // Get filter indicator for admin
  const getFilterIndicator = () => {
    if (!isAdmin || filter.type === 'general') return null;
    
    let label = '';
    if (filter.type === 'agent' && filter.agentId) {
      label = 'Filtrado por atendente';
    } else if (filter.type === 'connection' && filter.connectionId) {
      label = 'Filtrado por conexão';
    } else if (filter.type === 'department' && filter.departmentId) {
      label = 'Filtrado por departamento';
    }
    
    if (!label) return null;
    
    return (
      <Badge variant="secondary" className="text-xs">
        📊 {label}
      </Badge>
    );
  };

  return (
    <div className="h-full overflow-auto p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            {isAdmin ? (
              <Select value="dashboard" onValueChange={handleViewChange}>
                <SelectTrigger className="w-auto border-none shadow-none text-xl md:text-2xl font-bold bg-transparent h-auto p-0 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="dashboard">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <LayoutDashboard className="w-5 h-5" />
                      Dashboard
                    </div>
                  </SelectItem>
                  <SelectItem value="commercial">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <TrendingUp className="w-5 h-5" />
                      Gerente Comercial
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <h1 className="text-xl md:text-2xl font-bold text-foreground">{getPageTitle()}</h1>
            )}
            <p className="text-sm text-muted-foreground">
              {getPageDescription()}
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {getFilterIndicator()}
            
            <Badge variant="outline" className="text-xs md:text-sm flex items-center gap-1 md:gap-2">
              {loading && <Loader2 className="w-3 h-3 animate-spin" />}
              <span className="hidden sm:inline">Atualizado</span> {format(lastUpdated, "HH:mm", { locale: ptBR })}
            </Badge>
          </div>
        </div>

        {/* Filters - Only for admin/owner */}
        {isAdmin && (
          <DashboardFilters 
            filter={filter} 
            onFilterChange={setFilter} 
            isAdmin={isAdmin} 
          />
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
                      {metrics.avgResponseTimeMinutes > 0 
                        ? formatResponseTime(metrics.avgResponseTimeMinutes)
                        : 'N/A'}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      {metrics.avgResponseTimeMinutes === 0 ? (
                        <span className="text-sm text-muted-foreground">Sem dados suficientes</span>
                      ) : metrics.avgResponseTimeMinutes < 5 ? (
                        <>
                          <ArrowDownRight className="w-4 h-4 text-success" />
                          <span className="text-sm text-success font-medium">Excelente</span>
                        </>
                      ) : metrics.avgResponseTimeMinutes <= 15 ? (
                        <>
                          <ArrowDownRight className="w-4 h-4 text-success" />
                          <span className="text-sm text-success font-medium">Bom desempenho</span>
                        </>
                      ) : metrics.avgResponseTimeMinutes <= 30 ? (
                        <>
                          <TrendingUp className="w-4 h-4 text-warning" />
                          <span className="text-sm text-warning font-medium">Atenção</span>
                        </>
                      ) : (
                        <>
                          <ArrowUpRight className="w-4 h-4 text-destructive" />
                          <span className="text-sm text-destructive font-medium">Crítico</span>
                        </>
                      )}
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
                  onClick={() => handleConversationClick(conv)}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <Avatar className="w-10 h-10">
                    {conv.contact?.avatarUrl && (
                      <AvatarImage src={conv.contact.avatarUrl} alt={conv.contact?.name || 'Contato'} />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                      {conv.contact?.name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
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

        {/* Team Performance - Only show for general view */}
        {(filter.type === 'general' || !isAdmin) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Desempenho da Equipe</CardTitle>
              <CardDescription>
                Atendentes com melhor performance hoje
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-2 w-full" />
                    </div>
                    <Skeleton className="h-4 w-12" />
                  </div>
                ))
              ) : agentPerformance.length > 0 ? (
                agentPerformance.map((agent, index) => {
                  const resolveRate = agent.conversations > 0 
                    ? Math.round((agent.resolved / agent.conversations) * 100) 
                    : 0;
                  
                  return (
                    <div 
                      key={agent.id}
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="relative">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium text-primary">
                          {agent.avatar}
                        </div>
                        {index === 0 && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-warning rounded-full flex items-center justify-center text-[10px]">
                            🏆
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {agent.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={resolveRate} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {agent.resolved}/{agent.conversations}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{resolveRate}%</p>
                        <p className="text-xs text-muted-foreground">resolvidas</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mb-2 opacity-50" />
                  <p>Sem dados de performance</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* When filtered, show a placeholder or different card */}
        {filter.type !== 'general' && isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detalhes do Filtro</CardTitle>
              <CardDescription>
                Informações sobre a visualização atual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  {filter.type === 'agent' && <Users className="w-8 h-8 text-primary" />}
                  {filter.type === 'connection' && <MessageSquare className="w-8 h-8 text-primary" />}
                  {filter.type === 'department' && <Users className="w-8 h-8 text-primary" />}
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  {filter.type === 'agent' && 'Visualizando por Atendente'}
                  {filter.type === 'connection' && 'Visualizando por Conexão'}
                  {filter.type === 'department' && 'Visualizando por Departamento'}
                </p>
                <p className="text-xs text-center">
                  Selecione um item no filtro acima para ver os dados segmentados
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Conversation Preview Modal */}
      <ConversationPreviewModal
        open={previewModal.open}
        onOpenChange={(open) => setPreviewModal(prev => ({ ...prev, open }))}
        contactId={previewModal.contactId}
        contactName={previewModal.contactName}
        contactPhone={previewModal.contactPhone}
        contactAvatarUrl={previewModal.contactAvatarUrl}
      />

    </div>
  );
}
