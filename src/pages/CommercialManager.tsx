import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, LayoutDashboard, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCommercialData } from '@/hooks/useCommercialData';
import { QualityMetricsCards } from '@/components/commercial/QualityMetricsCards';
import { BrazilMap } from '@/components/commercial/BrazilMap';
import { CriteriaRadarChart } from '@/components/commercial/CriteriaRadarChart';
import { AgentPerformanceTable } from '@/components/commercial/AgentPerformanceTable';
import { InsightsCard } from '@/components/commercial/InsightsCard';

export default function CommercialManager() {
  const navigate = useNavigate();
  const { loading, data, lastUpdated, isAdmin } = useCommercialData();
  const [viewMode, setViewMode] = useState<'commercial' | 'dashboard'>('commercial');

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
          <div className="flex items-center gap-3">
            <Select value={viewMode} onValueChange={handleViewChange}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
          <Badge variant="outline" className="text-xs md:text-sm flex items-center gap-1 md:gap-2 w-fit">
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            <span className="hidden sm:inline">Atualizado</span> {format(lastUpdated, "HH:mm", { locale: ptBR })}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Análise de qualidade e performance da equipe comercial
        </p>
      </div>

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
    </div>
  );
}
