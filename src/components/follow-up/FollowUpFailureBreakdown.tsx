import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { FailureCategory } from '@/types/follow-up';

interface FollowUpFailureBreakdownProps {
  data: FailureCategory[];
  totalFailed: number;
}

export function FollowUpFailureBreakdown({ data, totalFailed }: FollowUpFailureBreakdownProps) {
  if (totalFailed === 0) {
    return (
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Detalhamento de Falhas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-32 flex items-center justify-center text-muted-foreground">
            Nenhuma falha registrada no período 🎉
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Detalhamento de Falhas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((category) => (
            <div key={category.code} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium">{category.label}</span>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">{category.count.toLocaleString('pt-BR')}</span>
                  <span className="text-muted-foreground w-16 text-right">
                    {category.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
              <Progress 
                value={category.percentage} 
                className="h-2"
              />
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm font-medium">
            <span className="text-foreground">Total de Falhas</span>
            <span className="text-muted-foreground">{totalFailed.toLocaleString('pt-BR')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
