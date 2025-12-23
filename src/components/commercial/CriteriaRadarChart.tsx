import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChartPie } from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';

interface CriteriaScores {
  communication: number;
  objectivity: number;
  humanization: number;
  objection_handling: number;
  closing: number;
  response_time: number;
}

interface CriteriaRadarChartProps {
  loading: boolean;
  scores: CriteriaScores;
  showCard?: boolean;
}

const criteriaLabels: Record<keyof CriteriaScores, { label: string; tooltip: string }> = {
  communication: { label: 'Comunicação', tooltip: 'Clareza, gramática e tom adequado nas mensagens.' },
  objectivity: { label: 'Objetividade', tooltip: 'Capacidade de ir direto ao ponto. Respostas concisas.' },
  humanization: { label: 'Humanização', tooltip: 'Personalização do atendimento. Empatia e conexão.' },
  objection_handling: { label: 'Objeções', tooltip: 'Habilidade em contornar objeções do cliente.' },
  closing: { label: 'Fechamento', tooltip: 'Técnicas de fechamento e condução para decisão.' },
  response_time: { label: 'Tempo Resp.', tooltip: 'Velocidade média de resposta ao cliente.' },
};

export function CriteriaRadarChart({ loading, scores, showCard = true }: CriteriaRadarChartProps) {
  const data = Object.entries(scores).map(([key, value]) => ({
    criteria: criteriaLabels[key as keyof CriteriaScores].label,
    tooltip: criteriaLabels[key as keyof CriteriaScores].tooltip,
    score: value,
    fullMark: 10,
  }));

  if (loading) {
    if (!showCard) {
      return <Skeleton className="h-[280px] w-full" />;
    }
    return (
      <Card className="h-full">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartContent = (
    <>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid 
              stroke="hsl(var(--border))" 
              strokeDasharray="3 3"
            />
            <PolarAngleAxis
              dataKey="criteria"
              tick={{ 
                fill: 'hsl(var(--muted-foreground))', 
                fontSize: 11 
              }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 10]}
              tick={{ 
                fill: 'hsl(var(--muted-foreground))', 
                fontSize: 10 
              }}
            />
            <Radar
              name="Score"
              dataKey="score"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number) => [`${value.toFixed(1)}/10`, 'Score']}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend below chart */}
      <TooltipProvider delayDuration={300}>
        <div className="grid grid-cols-2 gap-2 mt-4">
          {data.map((item) => (
            <Tooltip key={item.criteria}>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 cursor-help">
                  <span className="text-sm text-muted-foreground">{item.criteria}</span>
                  <span className="font-semibold text-foreground">{item.score.toFixed(1)}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px]">
                <p className="text-xs">{item.tooltip}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </>
  );

  if (!showCard) {
    return chartContent;
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ChartPie className="w-5 h-5 text-primary" />
          Critérios de Avaliação
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartContent}
      </CardContent>
    </Card>
  );
}
