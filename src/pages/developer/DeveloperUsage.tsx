import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeveloperAuth } from '@/contexts/DeveloperAuthContext';
import { useDeveloperUsage } from '@/hooks/useDeveloperUsage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft,
  Terminal,
  Brain,
  Database,
  HardDrive,
  Activity,
  DollarSign,
  TrendingUp,
  Zap,
  RefreshCw,
  Moon,
  Sun,
  LogOut,
  Building2
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

// Supabase Pro limits
const SUPABASE_LIMITS = {
  database: 8 * 1024 * 1024 * 1024, // 8 GB in bytes
  storage: 100 * 1024 * 1024 * 1024, // 100 GB
  bandwidth: 250 * 1024 * 1024 * 1024, // 250 GB
  realtimeMessages: 5_000_000,
  edgeFunctionInvocations: 2_000_000,
  mau: 100_000
};

function DeveloperThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="h-8 w-8 p-0"
      title={isDark ? "Modo claro" : "Modo escuro"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(value);
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(2)} KB`;
}

export default function DeveloperUsage() {
  const navigate = useNavigate();
  const { developer, isAuthenticated, isLoading: authLoading, logout } = useDeveloperAuth();
  const { stats, isLoading, error, refetch } = useDeveloperUsage();

  React.useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/developer');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/developer');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Estimate database size (rough approximation based on row counts)
  const estimatedDbSize = stats 
    ? (stats.totalMessages * 500) + (stats.totalConversations * 200) + (stats.totalContacts * 300)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/developer/dashboard')}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              <span className="font-semibold">Monitor de Uso</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={refetch}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <span className="text-sm text-muted-foreground hidden md:inline">{developer?.email}</span>
            <DeveloperThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {error && (
          <Card className="border-destructive">
            <CardContent className="py-4">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* AI Cost */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-500" />
                Custo IA (30 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <p className="text-2xl font-bold">{formatCurrency(stats?.totalAICost || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatNumber(stats?.totalAICalls || 0)} chamadas
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Tokens */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                Tokens Utilizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <p className="text-2xl font-bold">
                    {formatNumber((stats?.totalInputTokens || 0) + (stats?.totalOutputTokens || 0))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatNumber(stats?.totalInputTokens || 0)} in / {formatNumber(stats?.totalOutputTokens || 0)} out
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Database */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-500" />
                Banco de Dados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <p className="text-2xl font-bold">{formatBytes(estimatedDbSize)}</p>
                  <div className="mt-2">
                    <Progress 
                      value={(estimatedDbSize / SUPABASE_LIMITS.database) * 100} 
                      className="h-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {((estimatedDbSize / SUPABASE_LIMITS.database) * 100).toFixed(2)}% de 8 GB
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-500" />
                Atividade Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <p className="text-2xl font-bold">{formatNumber(stats?.totalMessages || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    mensagens | {formatNumber(stats?.totalConversations || 0)} conversas
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily Cost Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Custo IA por Dia
              </CardTitle>
              <CardDescription>Últimos 30 dias</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stats?.dailyUsage || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => format(new Date(value), 'dd/MM')}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `$${value.toFixed(2)}`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Custo']}
                      labelFormatter={(label) => format(new Date(label), 'dd/MM/yyyy', { locale: ptBR })}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="total_cost" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Calls by Function Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Uso por Função
              </CardTitle>
              <CardDescription>Chamadas de IA por tipo</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats?.usageByFunction || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis 
                      type="category" 
                      dataKey="function_name" 
                      tick={{ fontSize: 10 }}
                      width={120}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === 'total_cost' ? formatCurrency(value) : formatNumber(value),
                        name === 'total_cost' ? 'Custo' : 'Chamadas'
                      ]}
                    />
                    <Bar dataKey="total_calls" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tables Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Usage by Function Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Detalhamento por Função
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Função</TableHead>
                      <TableHead className="text-right">Chamadas</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.usageByFunction.map(fn => (
                      <TableRow key={fn.function_name}>
                        <TableCell className="font-mono text-xs">
                          {fn.function_name}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(fn.total_calls)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(fn.total_input_tokens + fn.total_output_tokens)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(fn.total_cost)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!stats?.usageByFunction || stats.usageByFunction.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Nenhum dado disponível
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Usage by Company Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Top 10 Empresas por Uso
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-right">Chamadas</TableHead>
                      <TableHead className="text-right">Tokens</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.usageByCompany.map(comp => (
                      <TableRow key={comp.company_id}>
                        <TableCell className="font-medium">
                          {comp.company_name}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(comp.total_calls)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(comp.total_tokens)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(comp.total_cost)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!stats?.usageByCompany || stats.usageByCompany.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Nenhum dado disponível
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cost Projection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Projeção de Custos
            </CardTitle>
            <CardDescription>
              Baseado no uso atual
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-1">Empresas Ativas</p>
                  <p className="text-2xl font-bold">{stats?.usageByCompany.length || 0}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-1">Custo Médio/Empresa (30d)</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency((stats?.totalAICost || 0) / Math.max(1, stats?.usageByCompany.length || 1))}
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-1">Projeção p/ 50 Empresas</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(
                      ((stats?.totalAICost || 0) / Math.max(1, stats?.usageByCompany.length || 1)) * 50 + 25
                    )}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    (IA + Supabase Pro $25)
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Supabase Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Recursos Supabase (Pro Plan)
            </CardTitle>
            <CardDescription>
              $25/mês - Limites incluídos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Database</span>
                  <span>{formatBytes(estimatedDbSize)} / 8 GB</span>
                </div>
                <Progress value={(estimatedDbSize / SUPABASE_LIMITS.database) * 100} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Storage</span>
                  <span>~{formatBytes(stats?.totalStorageFiles || 0)} / 100 GB</span>
                </div>
                <Progress value={0.5} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Realtime Messages</span>
                  <span>~{formatNumber(stats?.totalMessages || 0)} / 5M</span>
                </div>
                <Progress 
                  value={((stats?.totalMessages || 0) / SUPABASE_LIMITS.realtimeMessages) * 100} 
                  className="h-2" 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
