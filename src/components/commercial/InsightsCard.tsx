import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  Lightbulb, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  MessageSquare,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InsightsCardProps {
  loading: boolean;
  insightsLoading?: boolean; // Separate loading state for AI insights
  insightsProgress?: number; // Progress percentage (0-100)
  insightsCurrentStep?: string; // Current step description
  strengths: string[];
  weaknesses: string[];
  positivePatterns: string[];
  negativePatterns: string[];
  insights: string[];
  criticalIssues: string[];
  finalRecommendation: string;
}

// Skeleton component for insights sections
function InsightsSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-2 p-2 rounded-lg">
          <Skeleton className="h-4 w-4 mt-0.5 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

export function InsightsCard({
  loading,
  insightsLoading = false,
  insightsProgress = 0,
  insightsCurrentStep = '',
  strengths,
  weaknesses,
  positivePatterns,
  negativePatterns,
  insights,
  criticalIssues,
  finalRecommendation,
}: InsightsCardProps) {
  // Show progress bar when async processing is active
  const showProgressBar = insightsLoading && insightsProgress > 0 && insightsProgress < 100;
  
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Async Processing Progress Bar */}
      {showProgressBar && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm font-medium text-primary">
                Processando análise de IA...
              </span>
            </div>
            <Progress value={insightsProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {insightsCurrentStep || `${insightsProgress}% concluído`}
            </p>
          </CardContent>
        </Card>
      )}
      {/* Strengths and Weaknesses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Strengths */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-success">
              <CheckCircle2 className="w-5 h-5" />
              Pontos Fortes
              {insightsLoading && (
                <span className="ml-2 text-xs text-muted-foreground animate-pulse">
                  Analisando...
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insightsLoading ? (
              <InsightsSkeleton />
            ) : (
              <div className="space-y-2">
                {strengths.map((item, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-2 p-2 bg-success/5 rounded-lg"
                  >
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
                {strengths.length === 0 && (
                  <p className="text-muted-foreground text-sm">Nenhum ponto forte identificado</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weaknesses */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-warning">
              <AlertTriangle className="w-5 h-5" />
              Pontos Fracos
              {insightsLoading && (
                <span className="ml-2 text-xs text-muted-foreground animate-pulse">
                  Analisando...
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insightsLoading ? (
              <InsightsSkeleton />
            ) : (
              <div className="space-y-2">
                {weaknesses.map((item, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-2 p-2 bg-warning/5 rounded-lg"
                  >
                    <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
                {weaknesses.length === 0 && (
                  <p className="text-muted-foreground text-sm">Nenhum ponto fraco identificado</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Positive Patterns */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-primary">
              <TrendingUp className="w-5 h-5" />
              Padrões Positivos
              {insightsLoading && (
                <span className="ml-2 text-xs text-muted-foreground animate-pulse">
                  Analisando...
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insightsLoading ? (
              <InsightsSkeleton />
            ) : (
              <div className="space-y-2">
                {positivePatterns.map((item, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-2 p-2 bg-primary/5 rounded-lg"
                  >
                    <TrendingUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
                {positivePatterns.length === 0 && (
                  <p className="text-muted-foreground text-sm">Nenhum padrão positivo identificado</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Negative Patterns */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-orange-500">
              <TrendingDown className="w-5 h-5" />
              Padrões Negativos
              {insightsLoading && (
                <span className="ml-2 text-xs text-muted-foreground animate-pulse">
                  Analisando...
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insightsLoading ? (
              <InsightsSkeleton />
            ) : (
              <div className="space-y-2">
                {negativePatterns.map((item, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-2 p-2 bg-orange-500/5 rounded-lg"
                  >
                    <TrendingDown className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
                {negativePatterns.length === 0 && (
                  <p className="text-muted-foreground text-sm">Nenhum padrão negativo identificado</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Critical Issues */}
      <Card className={cn(
        "border-destructive/50",
        criticalIssues.length > 0 ? "bg-destructive/5" : ""
      )}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Problemas Críticos
            {insightsLoading && (
              <span className="ml-2 text-xs text-muted-foreground animate-pulse">
                Analisando...
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {insightsLoading ? (
            <InsightsSkeleton />
          ) : (
            <div className="space-y-2">
              {criticalIssues.map((item, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-2 p-2 bg-destructive/10 rounded-lg"
                >
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <span className="text-sm font-medium text-destructive">{item}</span>
                </div>
              ))}
              {criticalIssues.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhum problema crítico identificado</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights and Recommendations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-warning" />
            Insights e Recomendações
            {insightsLoading && (
              <span className="ml-2 text-xs text-muted-foreground animate-pulse">
                IA analisando...
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {insightsLoading ? (
            <InsightsSkeleton />
          ) : (
            <div className="space-y-2">
              {insights.map((item, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg"
                >
                  <Lightbulb className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                  <span className="text-sm">{item}</span>
                </div>
              ))}
              {insights.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhum insight disponível</p>
              )}
            </div>
          )}

          {/* Final Recommendation */}
          {insightsLoading ? (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <Skeleton className="w-5 h-5 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            </div>
          ) : finalRecommendation && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <MessageSquare className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-primary text-sm">Recomendação Final</p>
                  <p className="text-foreground mt-1">{finalRecommendation}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
