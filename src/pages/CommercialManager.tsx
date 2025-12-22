import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, LayoutDashboard, Loader2, Radio, Library, Globe, Phone, Users, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCommercialData, type CommercialFilter } from '@/hooks/useCommercialData';
import { QualityMetricsCards } from '@/components/commercial/QualityMetricsCards';
import { LiveMetricsCards } from '@/components/commercial/LiveMetricsCards';
import { BrazilMap } from '@/components/commercial/BrazilMap';
import { CriteriaRadarChart } from '@/components/commercial/CriteriaRadarChart';
import { AgentPerformanceTable } from '@/components/commercial/AgentPerformanceTable';
import { InsightsCard } from '@/components/commercial/InsightsCard';
import { ReportsModal } from '@/components/reports/ReportsModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Connection {
  id: string;
  name: string;
  phone_number: string;
}

interface Department {
  id: string;
  name: string;
}

type PeriodPreset = 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom';

export default function CommercialManager() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const [filter, setFilter] = useState<CommercialFilter>({ type: 'general' });
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('week');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const { loading, data, liveMetrics, isAdmin, insightsLoading } = useCommercialData(filter);
  const [viewMode, setViewMode] = useState<'commercial' | 'dashboard'>('commercial');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [reportsModalOpen, setReportsModalOpen] = useState(false);
  
  // Filter options data
  const [connections, setConnections] = useState<Connection[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(false);

  // Real-time clock update
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load filter options
  useEffect(() => {
    if (!company?.id) return;

    const loadFilterData = async () => {
      setLoadingFilters(true);
      try {
        if (filter.type === 'connection' && connections.length === 0) {
          const { data } = await supabase
            .from('whatsapp_connections')
            .select('id, name, phone_number')
            .eq('company_id', company.id)
            .eq('status', 'connected')
            .order('name');
          setConnections(data || []);
        }
      } catch (error) {
        console.error('Error loading filter data:', error);
      } finally {
        setLoadingFilters(false);
      }
    };

    loadFilterData();
  }, [filter.type, company?.id, connections.length]);

  // Load departments when connection is selected
  useEffect(() => {
    if (!filter.connectionId) {
      setDepartments([]);
      return;
    }

    const loadDepartments = async () => {
      try {
        const { data } = await supabase
          .from('departments')
          .select('id, name')
          .eq('whatsapp_connection_id', filter.connectionId)
          .eq('active', true)
          .order('name');
        setDepartments(data || []);
      } catch (error) {
        console.error('Error loading departments:', error);
      }
    };

    loadDepartments();
  }, [filter.connectionId]);

  // Update filter when period changes
  useEffect(() => {
    const now = new Date();
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    switch (periodPreset) {
      case 'today':
        startDate = startOfDay(now);
        endDate = endOfDay(now);
        break;
      case 'yesterday':
        startDate = startOfDay(subDays(now, 1));
        endDate = endOfDay(subDays(now, 1));
        break;
      case 'week':
        startDate = startOfDay(subDays(now, 6)); // Últimos 7 dias (6 dias atrás + hoje)
        endDate = endOfDay(now);
        break;
      case 'month':
        startDate = startOfMonth(now);
        endDate = endOfDay(now);
        break;
      case 'last_month':
        startDate = startOfMonth(subMonths(now, 1));
        endDate = endOfDay(subMonths(startOfMonth(now), 1));
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = startOfDay(customStartDate);
          endDate = endOfDay(customEndDate);
        }
        break;
    }

    setFilter(prev => ({
      ...prev,
      startDate,
      endDate,
    }));
  }, [periodPreset, customStartDate, customEndDate]);

  const handleViewChange = (value: string) => {
    if (value === 'dashboard') {
      navigate('/dashboard');
    }
    setViewMode(value as 'commercial' | 'dashboard');
  };

  const handleFilterTypeChange = (type: CommercialFilter['type']) => {
    setFilter(prev => ({ ...prev, type, connectionId: undefined, departmentId: undefined }));
  };

  const handleSecondaryFilterChange = (value: string) => {
    if (filter.type === 'connection') {
      setFilter(prev => ({ ...prev, connectionId: value, departmentId: undefined }));
    }
  };

  const handleDepartmentChange = (value: string) => {
    setFilter(prev => ({ ...prev, departmentId: value === 'all' ? undefined : value }));
  };

  const handlePeriodChange = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    if (preset !== 'custom') {
      setDatePickerOpen(false);
    }
  };

  const handleCustomDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from) setCustomStartDate(range.from);
    if (range?.to) {
      setCustomEndDate(range.to);
      setDatePickerOpen(false);
    }
  };

  const getPeriodLabel = () => {
    switch (periodPreset) {
      case 'today': return 'Hoje';
      case 'yesterday': return 'Ontem';
      case 'week': return 'Esta semana';
      case 'month': return 'Este mês';
      case 'last_month': return 'Mês passado';
      case 'custom': 
        if (customStartDate && customEndDate) {
          return `${format(customStartDate, 'dd/MM')} - ${format(customEndDate, 'dd/MM')}`;
        }
        return 'Personalizado';
    }
  };

  const getSecondaryValue = () => {
    if (filter.type === 'connection') return filter.connectionId || '';
    return '';
  };

  const getSecondaryOptions = () => {
    if (filter.type === 'connection') {
      return connections.map(c => ({ value: c.id, label: `${c.name} (${c.phone_number})` }));
    }
    return [];
  };

  if (!isAdmin) {
    navigate('/dashboard');
    return null;
  }

  const secondaryOptions = getSecondaryOptions();
  const showSecondaryFilter = filter.type === 'connection';
  const showDepartmentFilter = filter.type === 'connection' && filter.connectionId;

  return (
    <div className="h-full overflow-auto p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <Select value={viewMode} onValueChange={handleViewChange}>
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
            <p className="text-sm text-muted-foreground mt-1">
              Análise de qualidade e performance da equipe comercial
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReportsModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Library className="w-4 h-4" />
              <span className="hidden sm:inline">Relatórios</span>
            </Button>
            <Badge variant="outline" className="text-xs md:text-sm flex items-center gap-1 md:gap-2 w-fit">
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Radio className="w-3 h-3 text-green-500 animate-pulse" />
              )}
              <span className="hidden sm:inline">Tempo real</span> {format(currentTime, "HH:mm:ss", { locale: ptBR })}
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={filter.type} onValueChange={(v) => handleFilterTypeChange(v as CommercialFilter['type'])}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecionar filtro" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="general">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Geral
                </div>
              </SelectItem>
              <SelectItem value="connection">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Por Conexão
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {showSecondaryFilter && (
            <Select 
              value={getSecondaryValue()} 
              onValueChange={handleSecondaryFilterChange}
              disabled={loadingFilters}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Selecionar conexão..." />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {secondaryOptions.length === 0 ? (
                  <div className="py-2 px-3 text-sm text-muted-foreground">
                    Nenhuma conexão ativa
                  </div>
                ) : (
                  secondaryOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}

          {showDepartmentFilter && (
            <Select 
              value={filter.departmentId || 'all'} 
              onValueChange={handleDepartmentChange}
            >
              <SelectTrigger className="w-[200px]">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <SelectValue placeholder="Departamento..." />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">
                  Todos departamentos
                </SelectItem>
                {departments.length === 0 ? (
                  <div className="py-2 px-3 text-sm text-muted-foreground">
                    Nenhum departamento
                  </div>
                ) : (
                  departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}

          {/* Period Filter */}
          <div className="flex items-center gap-2">
            <Select value={periodPreset} onValueChange={(v) => handlePeriodChange(v as PeriodPreset)}>
              <SelectTrigger className="w-[160px]">
                <Calendar className="w-4 h-4 mr-1" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="yesterday">Ontem</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
                <SelectItem value="last_month">Mês passado</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>

            {periodPreset === 'custom' && (
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[200px] justify-start text-left font-normal",
                      !customStartDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {customStartDate && customEndDate
                      ? `${format(customStartDate, 'dd/MM/yy')} - ${format(customEndDate, 'dd/MM/yy')}`
                      : 'Selecionar datas'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover" align="start">
                  <CalendarComponent
                    mode="range"
                    selected={{ from: customStartDate, to: customEndDate }}
                    onSelect={handleCustomDateSelect}
                    numberOfMonths={2}
                    locale={ptBR}
                    className="pointer-events-auto"
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(23, 59, 59, 999);
                      
                      // Minimum date: company creation date or fallback
                      const minDate = company?.created_at 
                        ? new Date(company.created_at) 
                        : new Date('2020-01-01');
                      minDate.setHours(0, 0, 0, 0);
                      
                      return date > today || date < minDate;
                    }}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </div>

      {/* Live Metrics - Real-time */}
      <LiveMetricsCards loading={loading} metrics={liveMetrics} />

      {/* Quality Metrics */}
      <QualityMetricsCards
        loading={loading}
        averageScore={data?.averageScore || 0}
        classification={data?.classification || 'REGULAR'}
        qualifiedLeadsPercent={data?.qualifiedLeadsPercent || 0}
        conversionRate={data?.conversionRate || 0}
      />

      {/* Map and Radar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BrazilMap
          contactsByState={data?.contactsByState || {}}
          dealsByState={data?.dealsByState || {}}
        />
        <CriteriaRadarChart
          loading={loading}
          scores={data?.criteriaScores || {
            communication: 0,
            objectivity: 0,
            humanization: 0,
            objection_handling: 0,
            closing: 0,
            response_time: 0,
          }}
        />
      </div>

      {/* Agent Performance */}
      <AgentPerformanceTable
        loading={loading}
        agents={data?.agentsAnalysis || []}
      />

      {/* Insights */}
      <InsightsCard
        loading={loading}
        insightsLoading={insightsLoading}
        strengths={data?.strengths || []}
        weaknesses={data?.weaknesses || []}
        positivePatterns={data?.positivePatterns || []}
        negativePatterns={data?.negativePatterns || []}
        insights={data?.insights || []}
        criticalIssues={data?.criticalIssues || []}
        finalRecommendation={data?.finalRecommendation || ''}
      />

      {/* Reports Modal */}
      <ReportsModal
        open={reportsModalOpen}
        onOpenChange={setReportsModalOpen}
      />
    </div>
  );
}
