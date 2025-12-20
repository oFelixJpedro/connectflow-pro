import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, LayoutDashboard, Loader2, Radio, Library } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCommercialData } from '@/hooks/useCommercialData';
import { QualityMetricsCards } from '@/components/commercial/QualityMetricsCards';
import { LiveMetricsCards } from '@/components/commercial/LiveMetricsCards';
import { BrazilMap } from '@/components/commercial/BrazilMap';
import { CriteriaRadarChart } from '@/components/commercial/CriteriaRadarChart';
import { AgentPerformanceTable } from '@/components/commercial/AgentPerformanceTable';
import { InsightsCard } from '@/components/commercial/InsightsCard';
import { ReportsModal } from '@/components/reports/ReportsModal';

export default function CommercialManager() {
  const navigate = useNavigate();
  const { loading, data, liveMetrics, isAdmin } = useCommercialData();
  const [viewMode, setViewMode] = useState<'commercial' | 'dashboard'>('commercial');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [reportsModalOpen, setReportsModalOpen] = useState(false);

  // Real-time clock update
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleViewChange = (value: string) => {
    if (value === 'dashboard') {
      navigate('/dashboard');
    }
    setViewMode(value as 'commercial' | 'dashboard');
  };

  if (!isAdmin) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="h-full overflow-auto p-3 md:p-6 space-y-4 md:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 md:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <Select value={viewMode} onValueChange={handleViewChange}>
              <SelectTrigger className="w-[220px] border-none shadow-none text-xl md:text-2xl font-bold bg-transparent h-auto p-0 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="dashboard">
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4" />
                    Dashboard
                  </div>
                </SelectItem>
                <SelectItem value="commercial">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Gerente Comercial
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
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
        <p className="text-sm text-muted-foreground">
          Análise de qualidade e performance da equipe comercial
        </p>
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
