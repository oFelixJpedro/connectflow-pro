import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, LayoutDashboard, Loader2, Sparkles, Radio } from 'lucide-react';
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
import { toast } from 'sonner';

export default function CommercialManager() {
  const navigate = useNavigate();
  const { loading, data, liveMetrics, lastUpdated, isAdmin, evaluating, evaluateConversations } = useCommercialData();
  const [viewMode, setViewMode] = useState<'commercial' | 'dashboard'>('commercial');

  const handleEvaluate = async () => {
    const result = await evaluateConversations();
    if (result?.success) {
      if (result.evaluated > 0) {
        toast.success(`${result.evaluated} conversa(s) avaliada(s) com sucesso!`, {
          description: result.remaining > 0 ? `Ainda restam ${result.remaining} para avaliar.` : undefined,
        });
        // Reload page to show new data
        window.location.reload();
      } else {
        toast.info('Nenhuma conversa nova para avaliar.');
      }
    } else {
      toast.error('Erro ao avaliar conversas', {
        description: 'Verifique os logs para mais detalhes.',
      });
    }
  };

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
          <div className="flex items-center gap-2">
            <Button
              onClick={handleEvaluate}
              disabled={evaluating || loading}
              size="sm"
              className="gap-2"
            >
              {evaluating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {evaluating ? 'Avaliando...' : 'Avaliar Conversas'}
            </Button>
            <Badge variant="outline" className="text-xs md:text-sm flex items-center gap-1 md:gap-2 w-fit">
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Radio className="w-3 h-3 text-green-500 animate-pulse" />
              )}
              <span className="hidden sm:inline">Tempo real</span> {format(lastUpdated, "HH:mm:ss", { locale: ptBR })}
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
    </div>
  );
}
