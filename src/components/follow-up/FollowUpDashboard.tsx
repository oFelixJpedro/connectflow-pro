import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, RefreshCw } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFollowUpDashboard } from '@/hooks/useFollowUpDashboard';
import { FollowUpMetricsCards } from './FollowUpMetricsCards';
import { FollowUpDailyChart } from './FollowUpDailyChart';
import { FollowUpHourlyChart } from './FollowUpHourlyChart';
import { FollowUpFailureBreakdown } from './FollowUpFailureBreakdown';
import { Skeleton } from '@/components/ui/skeleton';

export function FollowUpDashboard() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const dateRange = {
    start: new Date(startDate),
    end: new Date(endDate)
  };

  const {
    metrics,
    dailyData,
    hourlyData,
    failureBreakdown,
    isLoading,
    refresh
  } = useFollowUpDashboard(dateRange);

  return (
    <div className="space-y-6">
      {/* Header with date filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard de Follow-up</h2>
          <p className="text-muted-foreground">
            Acompanhe o desempenho das suas sequências de follow-up
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-36"
            />
            <span className="text-muted-foreground">até</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-36"
            />
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <FollowUpMetricsCards metrics={metrics} />
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <>
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </>
        ) : (
          <>
            <FollowUpDailyChart data={dailyData} />
            <FollowUpHourlyChart data={hourlyData} />
          </>
        )}
      </div>

      {/* Failure Breakdown */}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <FollowUpFailureBreakdown data={failureBreakdown} totalFailed={metrics.failed} />
      )}
    </div>
  );
}
