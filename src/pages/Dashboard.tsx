import { 
  MessageSquare, 
  Users, 
  Clock, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  CheckCircle2,
  AlertCircle,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { mockDashboardMetrics, mockConversations } from '@/data/mockData';
import { cn } from '@/lib/utils';
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

const chartData = [
  { name: 'Seg', conversas: 45, resolvidas: 40 },
  { name: 'Ter', conversas: 52, resolvidas: 48 },
  { name: 'Qua', conversas: 38, resolvidas: 35 },
  { name: 'Qui', conversas: 65, resolvidas: 60 },
  { name: 'Sex', conversas: 72, resolvidas: 68 },
  { name: 'Sáb', conversas: 28, resolvidas: 25 },
  { name: 'Dom', conversas: 15, resolvidas: 14 },
];

const hourlyData = [
  { hour: '08h', count: 12 },
  { hour: '09h', count: 28 },
  { hour: '10h', count: 45 },
  { hour: '11h', count: 38 },
  { hour: '12h', count: 15 },
  { hour: '13h', count: 22 },
  { hour: '14h', count: 48 },
  { hour: '15h', count: 52 },
  { hour: '16h', count: 42 },
  { hour: '17h', count: 35 },
  { hour: '18h', count: 18 },
];

const statusColors = {
  open: 'bg-conv-open',
  pending: 'bg-conv-pending',
  in_progress: 'bg-conv-progress',
  closed: 'bg-conv-closed',
};

const statusLabels = {
  open: 'Abertas',
  pending: 'Pendentes',
  in_progress: 'Em Progresso',
  waiting: 'Aguardando',
  resolved: 'Resolvidas',
  closed: 'Fechadas',
};

export default function Dashboard() {
  const metrics = mockDashboardMetrics;
  const recentConversations = mockConversations.slice(0, 5);

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
        <Badge variant="outline" className="text-sm">
          Atualizado agora
        </Badge>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <ArrowUpRight className="w-4 h-4 text-success" />
                  <span className="text-sm text-success font-medium">+12%</span>
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
                  <ArrowDownRight className="w-4 h-4 text-destructive" />
                  <span className="text-sm text-destructive font-medium">-5%</span>
                  <span className="text-sm text-muted-foreground">vs ontem</span>
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
                  {metrics.avgResponseTime}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <ArrowDownRight className="w-4 h-4 text-success" />
                  <span className="text-sm text-success font-medium">-18%</span>
                  <span className="text-sm text-muted-foreground">mais rápido</span>
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
                  <ArrowUpRight className="w-4 h-4 text-success" />
                  <span className="text-sm text-success font-medium">+3%</span>
                  <span className="text-sm text-muted-foreground">vs semana</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
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
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
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
                    name="Conversas"
                  />
                </BarChart>
              </ResponsiveContainer>
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
            {recentConversations.map((conv) => (
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
                    {statusLabels[conv.status]}
                  </Badge>
                  {conv.unreadCount > 0 && (
                    <Badge className="bg-primary text-primary-foreground text-xs">
                      {conv.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
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
            {[
              { name: 'João Silva', conversations: 28, resolved: 25, avatar: 'JS' },
              { name: 'Maria Santos', conversations: 24, resolved: 22, avatar: 'MS' },
              { name: 'Pedro Oliveira', conversations: 19, resolved: 18, avatar: 'PO' },
              { name: 'Ana Costa', conversations: 15, resolved: 14, avatar: 'AC' },
            ].map((agent, index) => (
              <div key={index} className="space-y-2">
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
                  value={(agent.resolved / agent.conversations) * 100} 
                  className="h-2"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
