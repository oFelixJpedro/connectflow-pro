import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Flame, Thermometer, Snowflake, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface LiveMetrics {
  activeConversations: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  todayMessages: number;
  todayNewConversations: number;
  todayContractsClosed: number;
  todayLeadsLost: number;
  currentAvgResponseTime: number;
  currentAvgSentiment: string;
  topObjections: string[];
  topPainPoints: string[];
}

interface LiveMetricsCardsProps {
  loading: boolean;
  metrics: LiveMetrics | null;
}

function MetricCardSkeleton() {
  return (
    <Card className="bg-card/50">
      <CardContent className="p-4">
        <Skeleton className="h-4 w-20 mb-2" />
        <Skeleton className="h-8 w-16" />
      </CardContent>
    </Card>
  );
}

export function LiveMetricsCards({ loading, metrics }: LiveMetricsCardsProps) {
  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: 'Conversas Ativas',
      value: metrics.activeConversations,
      icon: Activity,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      label: 'Leads Quentes',
      value: metrics.hotLeads,
      icon: Flame,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10'
    },
    {
      label: 'Leads Mornos',
      value: metrics.warmLeads,
      icon: Thermometer,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10'
    },
    {
      label: 'Leads Frios',
      value: metrics.coldLeads,
      icon: Snowflake,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10'
    },
    {
      label: 'Mensagens Hoje',
      value: metrics.todayMessages,
      icon: MessageSquare,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      label: 'Novas Conversas',
      value: metrics.todayNewConversations,
      icon: MessageSquare,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10'
    },
    {
      label: 'Fechados Hoje',
      value: metrics.todayContractsClosed,
      icon: TrendingUp,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10'
    },
    {
      label: 'Perdidos Hoje',
      value: metrics.todayLeadsLost,
      icon: TrendingDown,
      color: 'text-red-400',
      bgColor: 'bg-red-400/10'
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
      {cards.map((card) => (
        <Card key={card.label} className={`${card.bgColor} border-0`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <card.icon className={`w-3 h-3 ${card.color}`} />
              <span className="text-[10px] text-muted-foreground truncate">{card.label}</span>
            </div>
            <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
