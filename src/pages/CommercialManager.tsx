import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, LayoutDashboard, Loader2, Radio, Library, Globe, Wifi, Users, Calendar, ChevronDown, Search, X, Check, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { FeatureLockedModal } from '@/components/subscription/FeatureLockedModal';
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
  color?: string | null;
  whatsapp_connection_id: string;
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
  const { loading, data, liveMetrics, isAdmin, insightsLoading, refreshData, lastUpdated } = useCommercialData(filter);
  const [viewMode, setViewMode] = useState<'commercial' | 'dashboard'>('commercial');
  const [reportsModalOpen, setReportsModalOpen] = useState(false);
  const [showLockedModal, setShowLockedModal] = useState(false);
  
  // Filter options data
  const [connections, setConnections] = useState<Connection[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(false);
  
  // Dropdown filter state
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');

  // Check if commercial manager is enabled for this company
  const commercialManagerEnabled = (company as any)?.commercial_manager_enabled ?? false;

  // Load all filter data (connections and departments)
  useEffect(() => {
    if (!company?.id) return;

    const loadAllFilterData = async () => {
      setLoadingFilters(true);
      try {
        // Load connections
        const { data: connectionsData } = await supabase
          .from('whatsapp_connections')
          .select('id, name, phone_number')
          .eq('company_id', company.id)
          .eq('status', 'connected')
          .order('name');
        
        if (connectionsData) {
          setConnections(connectionsData);
          
          // Load all departments for all connections
          const connectionIds = connectionsData.map(c => c.id);
          if (connectionIds.length > 0) {
            const { data: departmentsData } = await supabase
              .from('departments')
              .select('id, name, color, whatsapp_connection_id')
              .in('whatsapp_connection_id', connectionIds)
              .eq('active', true)
              .order('name');
            
            setDepartments(departmentsData || []);
          }
        }
      } catch (error) {
        console.error('Error loading filter data:', error);
      } finally {
        setLoadingFilters(false);
      }
    };

    loadAllFilterData();
  }, [company?.id]);

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

  const handleSelectGeneral = () => {
    setFilter({ type: 'general' });
    setFilterOpen(false);
    setFilterSearch('');
  };

  const handleSelectConnection = (connectionId: string, departmentId?: string) => {
    setFilter({
      type: 'connection',
      connectionId,
      departmentId,
    });
    setFilterOpen(false);
    setFilterSearch('');
  };

  const handleClearFilter = () => {
    setFilter({ type: 'general' });
    setFilterSearch('');
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

  const getFilterDisplayText = () => {
    if (filter.type === 'general') return 'Visão Geral';
    if (filter.type === 'connection' && filter.connectionId) {
      const conn = connections.find(c => c.id === filter.connectionId);
      if (conn) {
        if (filter.departmentId) {
          const dept = departments.find(d => d.id === filter.departmentId);
          return dept ? `${conn.name} - ${dept.name}` : conn.name;
        }
        return conn.name;
      }
    }
    return 'Selecionar filtro';
  };

  const getFilterIcon = () => {
    if (filter.type === 'general') return Globe;
    return Wifi;
  };

  const filteredConnections = filterSearch
    ? connections.filter(c => 
        c.name.toLowerCase().includes(filterSearch.toLowerCase()) ||
        c.phone_number.includes(filterSearch)
      )
    : connections;

  const getDepartmentsForConnection = (connectionId: string) => {
    return departments.filter(d => d.whatsapp_connection_id === connectionId);
  };

  // Redirect non-admins
  if (!isAdmin) {
    navigate('/dashboard');
    return null;
  }

  // Show locked modal if feature is not enabled
  if (!commercialManagerEnabled) {
    return (
      <div className="h-full overflow-auto p-3 md:p-6 flex items-center justify-center">
        <FeatureLockedModal
          open={true}
          onClose={() => navigate('/dashboard')}
          featureName="Gerente Comercial"
          featureDescription="O Gerente Comercial é um recurso premium que oferece análises avançadas de performance da sua equipe de vendas, insights de IA, relatórios detalhados e muito mais."
          price="R$ 197,00"
          benefits={[
            "Dashboard em tempo real com métricas de vendas",
            "Análise de qualidade de atendimento por IA",
            "Relatórios semanais automatizados",
            "Mapa de leads por região do Brasil",
            "Performance individual de cada atendente",
            "Identificação de pontos fortes e fracos",
            "Insights e recomendações de melhoria"
          ]}
        />
      </div>
    );
  }

  const FilterIcon = getFilterIcon();

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
              onClick={refreshData}
              disabled={loading || insightsLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", (loading || insightsLoading) && "animate-spin")} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
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
              {loading || insightsLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Radio className="w-3 h-3 text-green-500 animate-pulse" />
              )}
              <span className="hidden sm:inline">Atualizado</span> {format(lastUpdated, "HH:mm", { locale: ptBR })}
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Main Filter Dropdown */}
          <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="min-w-[200px] justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FilterIcon className="h-4 w-4" />
                  <span className="truncate">{getFilterDisplayText()}</span>
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent className="w-[280px]" align="start">
              {/* Search */}
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="pl-8 h-8"
                  />
                </div>
              </div>
              
              {/* Visão Geral */}
              <DropdownMenuItem 
                onClick={handleSelectGeneral}
                className="flex items-center gap-2 cursor-pointer"
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  {filter.type === 'general' ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />
                  )}
                </div>
                <Globe className="h-4 w-4" />
                <span>Visão Geral</span>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              {/* Por Conexão - Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="flex items-center gap-2">
                  <div className="w-4 h-4" />
                  <Wifi className="h-4 w-4" />
                  <span className="flex-1">Por Conexão</span>
                  {filter.type === 'connection' && (
                    <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">1</Badge>
                  )}
                </DropdownMenuSubTrigger>
                
                <DropdownMenuSubContent className="w-[220px] max-h-[300px] overflow-y-auto">
                  {loadingFilters ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredConnections.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                      {filterSearch ? 'Nenhuma conexão encontrada' : 'Nenhuma conexão ativa'}
                    </div>
                  ) : (
                    filteredConnections.map(conn => {
                      const connDepartments = getDepartmentsForConnection(conn.id);
                      const isConnSelected = filter.connectionId === conn.id;
                      
                      if (connDepartments.length === 0) {
                        // Connection without departments - direct selection
                        return (
                          <DropdownMenuItem
                            key={conn.id}
                            onClick={() => handleSelectConnection(conn.id)}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <div className="w-4 h-4 flex items-center justify-center">
                              {isConnSelected && !filter.departmentId ? (
                                <Check className="h-4 w-4 text-primary" />
                              ) : (
                                <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />
                              )}
                            </div>
                            <Wifi className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate">{conn.name}</span>
                          </DropdownMenuItem>
                        );
                      }
                      
                      // Connection with departments - nested submenu
                      return (
                        <DropdownMenuSub key={conn.id}>
                          <DropdownMenuSubTrigger className="flex items-center gap-2">
                            <div className="w-4 h-4 flex items-center justify-center">
                              {isConnSelected ? (
                                <Check className="h-4 w-4 text-primary" />
                              ) : (
                                <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />
                              )}
                            </div>
                            <Wifi className="h-4 w-4 text-muted-foreground" />
                            <span className="flex-1 truncate">{conn.name}</span>
                          </DropdownMenuSubTrigger>
                          
                          <DropdownMenuSubContent className="w-[200px]">
                            {/* All departments */}
                            <DropdownMenuItem
                              onClick={() => handleSelectConnection(conn.id)}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <div className="w-4 h-4 flex items-center justify-center">
                                {isConnSelected && !filter.departmentId ? (
                                  <Check className="h-4 w-4 text-primary" />
                                ) : (
                                  <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />
                                )}
                              </div>
                              <Users className="h-4 w-4" />
                              <span>Todos departamentos</span>
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            
                            {/* Individual departments */}
                            {connDepartments.map(dept => (
                              <DropdownMenuItem
                                key={dept.id}
                                onClick={() => handleSelectConnection(conn.id, dept.id)}
                                className="flex items-center gap-2 cursor-pointer"
                              >
                                <div className="w-4 h-4 flex items-center justify-center">
                                  {isConnSelected && filter.departmentId === dept.id ? (
                                    <Check className="h-4 w-4 text-primary" />
                                  ) : (
                                    <div className="w-3 h-3 rounded-full border border-muted-foreground/30" />
                                  )}
                                </div>
                                <div 
                                  className="w-3 h-3 rounded-full shrink-0" 
                                  style={{ backgroundColor: dept.color || '#6b7280' }}
                                />
                                <span className="truncate">{dept.name}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      );
                    })
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              
              {/* Clear filter */}
              {filter.type !== 'general' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={handleClearFilter}
                    className="flex items-center gap-2 cursor-pointer text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                    <span>Limpar filtro</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

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
