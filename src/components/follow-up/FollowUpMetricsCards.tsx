import { Card, CardContent } from '@/components/ui/card';
import { List, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import type { FollowUpMetrics } from '@/types/follow-up';

interface FollowUpMetricsCardsProps {
  metrics: FollowUpMetrics;
}

export function FollowUpMetricsCards({ metrics }: FollowUpMetricsCardsProps) {
  const cards = [
    {
      title: 'Total',
      value: metrics.total.toLocaleString('pt-BR'),
      subtitle: 'follow-ups no período',
      icon: List,
      iconColor: 'text-muted-foreground',
      bgColor: 'bg-muted/50'
    },
    {
      title: 'Enviados',
      value: metrics.sent.toLocaleString('pt-BR'),
      subtitle: `${metrics.successRate.toFixed(1)}% de sucesso`,
      icon: CheckCircle2,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      title: 'Falhas',
      value: metrics.failed.toLocaleString('pt-BR'),
      subtitle: `${metrics.failureRate.toFixed(1)}% de falha`,
      icon: AlertCircle,
      iconColor: 'text-destructive',
      bgColor: 'bg-destructive/10'
    },
    {
      title: 'Programados',
      value: metrics.pending.toLocaleString('pt-BR'),
      subtitle: 'aguardando envio',
      icon: Clock,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="border-border">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <p className="text-3xl font-bold text-foreground mt-1">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
              </div>
              <div className={`p-3 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
