import { 
  BarChart3, 
  Download, 
  Calendar,
  MessageSquare,
  Clock,
  TrendingUp,
  Users,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const conversationsData = [
  { date: '01/12', total: 45, resolved: 40 },
  { date: '02/12', total: 52, resolved: 48 },
  { date: '03/12', total: 38, resolved: 35 },
  { date: '04/12', total: 65, resolved: 60 },
  { date: '05/12', total: 72, resolved: 68 },
  { date: '06/12', total: 28, resolved: 25 },
  { date: '07/12', total: 42, resolved: 38 },
];

const responseTimeData = [
  { hour: '08h', time: 2.5 },
  { hour: '09h', time: 3.2 },
  { hour: '10h', time: 4.1 },
  { hour: '11h', time: 3.8 },
  { hour: '12h', time: 5.2 },
  { hour: '13h', time: 4.5 },
  { hour: '14h', time: 2.8 },
  { hour: '15h', time: 2.3 },
  { hour: '16h', time: 3.1 },
  { hour: '17h', time: 4.2 },
];

const statusDistribution = [
  { name: 'Resolvidas', value: 156, color: 'hsl(var(--success))' },
  { name: 'Em Andamento', value: 23, color: 'hsl(var(--primary))' },
  { name: 'Pendentes', value: 8, color: 'hsl(var(--warning))' },
  { name: 'Aguardando', value: 5, color: 'hsl(var(--info))' },
];

const agentPerformance = [
  { name: 'João Silva', conversations: 45, avgTime: '2m 15s', satisfaction: 98 },
  { name: 'Maria Santos', conversations: 38, avgTime: '2m 45s', satisfaction: 96 },
  { name: 'Pedro Oliveira', conversations: 32, avgTime: '3m 10s', satisfaction: 94 },
  { name: 'Ana Costa', conversations: 28, avgTime: '2m 30s', satisfaction: 97 },
];

export default function Reports() {
  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">
            Acompanhe as métricas e desempenho do atendimento
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="7d">
            <SelectTrigger className="w-40">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Conversas</p>
                <p className="text-2xl font-bold mt-1">342</p>
                <p className="text-xs text-success mt-1">+12% vs período anterior</p>
              </div>
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio</p>
                <p className="text-2xl font-bold mt-1">2m 45s</p>
                <p className="text-xs text-success mt-1">-18% mais rápido</p>
              </div>
              <div className="w-10 h-10 bg-info/10 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-info" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taxa de Resolução</p>
                <p className="text-2xl font-bold mt-1">94.5%</p>
                <p className="text-xs text-success mt-1">+3% vs período anterior</p>
              </div>
              <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Satisfação (CSAT)</p>
                <p className="text-2xl font-bold mt-1">96%</p>
                <p className="text-xs text-success mt-1">+2% vs período anterior</p>
              </div>
              <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations Over Time */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Conversas ao Longo do Tempo</CardTitle>
            <CardDescription>
              Total de conversas e resolvidas por dia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={conversationsData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorResolved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1} 
                    fill="url(#colorTotal)"
                    strokeWidth={2}
                    name="Total"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="resolved" 
                    stroke="hsl(var(--success))" 
                    fillOpacity={1} 
                    fill="url(#colorResolved)"
                    strokeWidth={2}
                    name="Resolvidas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Status</CardTitle>
            <CardDescription>
              Status das conversas no período
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Response Time & Agent Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Response Time by Hour */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tempo de Resposta por Hora</CardTitle>
            <CardDescription>
              Tempo médio de primeira resposta (minutos)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={responseTimeData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis 
                    dataKey="hour" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value) => [`${value} min`, 'Tempo médio']}
                  />
                  <Bar 
                    dataKey="time" 
                    fill="hsl(var(--info))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Agent Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance dos Atendentes</CardTitle>
            <CardDescription>
              Ranking por número de conversas resolvidas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {agentPerformance.map((agent, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-sm font-medium text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{agent.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {agent.conversations} conversas • {agent.avgTime} média
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-success">{agent.satisfaction}%</p>
                    <p className="text-xs text-muted-foreground">satisfação</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
