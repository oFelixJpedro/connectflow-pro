import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Target, Star, Flame, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QualityMetricsCardsProps {
  loading: boolean;
  averageScore: number;
  classification: 'EXCEPCIONAL' | 'BOM' | 'REGULAR' | 'RUIM' | 'CRÍTICO';
  qualifiedLeadsPercent: number;
  conversionRate: number;
}

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

export function QualityMetricsCards({
  loading,
  averageScore,
  classification,
  qualifiedLeadsPercent,
  conversionRate,
}: QualityMetricsCardsProps) {
  const getClassificationColor = (cls: string) => {
    switch (cls) {
      case 'EXCEPCIONAL':
        return 'bg-success/10 text-success border-success/20';
      case 'BOM':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'REGULAR':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'RUIM':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'CRÍTICO':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getScoreIndicator = (score: number) => {
    if (score >= 9.0) return { text: 'Excelente', color: 'text-success' };
    if (score >= 7.5) return { text: 'Bom', color: 'text-primary' };
    if (score >= 6.0) return { text: 'Regular', color: 'text-warning' };
    if (score >= 4.0) return { text: 'Baixo', color: 'text-orange-500' };
    return { text: 'Crítico', color: 'text-destructive' };
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
    );
  }

  const scoreIndicator = getScoreIndicator(averageScore);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Average Score */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="card-hover cursor-help">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Nota Média
                    </p>
                    <p className="text-3xl font-bold text-foreground mt-1">
                      {averageScore.toFixed(1)}
                      <span className="text-lg text-muted-foreground">/10</span>
                    </p>
                    <p className={cn("text-sm font-medium mt-1", scoreIndicator.color)}>
                      {scoreIndicator.text}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Target className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px]">
            <p className="text-xs">Média das notas de todas as conversas avaliadas pela IA. Escala de 0 a 10.</p>
          </TooltipContent>
        </Tooltip>

        {/* Classification */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="card-hover cursor-help">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Classificação
                    </p>
                    <Badge 
                      className={cn(
                        "mt-2 text-base py-1 px-3",
                        getClassificationColor(classification)
                      )}
                    >
                      {classification}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-2">
                      Desempenho geral
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center">
                    <Star className="w-6 h-6 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[250px]">
            <p className="text-xs">EXCEPCIONAL (≥9.0), BOM (≥7.5), REGULAR (≥6.0), RUIM (≥4.0), CRÍTICO (&lt;4.0)</p>
          </TooltipContent>
        </Tooltip>

        {/* Qualified Leads */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="card-hover cursor-help">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Leads Qualificados
                    </p>
                    <p className="text-3xl font-bold text-foreground mt-1">
                      {qualifiedLeadsPercent}%
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Hot + Warm leads
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-destructive/10 rounded-xl flex items-center justify-center">
                    <Flame className="w-6 h-6 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px]">
            <p className="text-xs">Percentual de leads Hot + Warm em relação ao total. Indica eficiência na qualificação.</p>
          </TooltipContent>
        </Tooltip>

        {/* Conversion Rate */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="card-hover cursor-help">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Taxa de Conversão
                    </p>
                    <p className="text-3xl font-bold text-foreground mt-1">
                      {conversionRate.toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Leads → Contratos
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px]">
            <p className="text-xs">Percentual de leads que fecharam contrato. (Contratos ÷ Total de Leads) × 100</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
