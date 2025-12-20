import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartPie } from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
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
}

const criteriaLabels: Record<keyof CriteriaScores, string> = {
  communication: 'Comunicação',
  objectivity: 'Objetividade',
  humanization: 'Humanização',
  objection_handling: 'Objeções',
  closing: 'Fechamento',
  response_time: 'Tempo Resp.',
};

export function CriteriaRadarChart({ loading, scores }: CriteriaRadarChartProps) {
  const data = Object.entries(scores).map(([key, value]) => ({
    criteria: criteriaLabels[key as keyof CriteriaScores],
    score: value,
    fullMark: 10,
  }));

  if (loading) {
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

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ChartPie className="w-5 h-5 text-primary" />
          Critérios de Avaliação
        </CardTitle>
      </CardHeader>
      <CardContent>
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
              <Tooltip
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
          {data.map((item) => (
            <div 
              key={item.criteria} 
              className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2"
            >
              <span className="text-sm text-muted-foreground">{item.criteria}</span>
              <span className="font-semibold text-foreground">{item.score.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
