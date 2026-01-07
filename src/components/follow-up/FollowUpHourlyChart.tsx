import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { FollowUpHourlyData } from '@/types/follow-up';

interface FollowUpHourlyChartProps {
  data: FollowUpHourlyData[];
}

export function FollowUpHourlyChart({ data }: FollowUpHourlyChartProps) {
  const chartData = data.map(item => ({
    ...item,
    hourLabel: `${item.hour.toString().padStart(2, '0')}h`
  }));

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Distribuição por Hora</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          {data.every(d => d.count === 0) ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Sem dados para exibir
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis 
                  dataKey="hourLabel" 
                  fontSize={10}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  interval={2}
                />
                <YAxis 
                  fontSize={12}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [value, 'Follow-ups']}
                />
                <Bar 
                  dataKey="count" 
                  name="Follow-ups" 
                  fill="hsl(217, 91%, 60%)" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
