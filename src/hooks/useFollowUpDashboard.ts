import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfDay, endOfDay, eachDayOfInterval, parseISO } from 'date-fns';
import type {
  FollowUpMetrics,
  FollowUpDailyData,
  FollowUpHourlyData,
  FailureCategory,
  FollowUpQueueItem,
  FAILURE_LABELS
} from '@/types/follow-up';

interface DateRange {
  start: Date;
  end: Date;
}

const FAILURE_LABEL_MAP: Record<string, string> = {
  'empty_history': 'Histórico vazio',
  'no_negotiation': 'Lead sem negociação',
  'stage_disabled': 'Estágio com follow-up desativado',
  'ai_disabled': 'IA Desativada',
  'ai_paused': 'IA Pausada',
  'no_credits': 'Sem créditos de IA',
  'contact_opted_out': 'Contato optou por não receber',
  'whatsapp_error': 'Erro no WhatsApp',
  'outside_hours': 'Fora do horário de operação',
  'other': 'Outros'
};

export function useFollowUpDashboard(dateRange: DateRange) {
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<FollowUpMetrics>({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    successRate: 0,
    failureRate: 0
  });
  const [dailyData, setDailyData] = useState<FollowUpDailyData[]>([]);
  const [hourlyData, setHourlyData] = useState<FollowUpHourlyData[]>([]);
  const [failureBreakdown, setFailureBreakdown] = useState<FailureCategory[]>([]);
  const [recentQueue, setRecentQueue] = useState<FollowUpQueueItem[]>([]);

  // Use ref to store dateRange to avoid dependency issues
  const dateRangeRef = useRef(dateRange);
  dateRangeRef.current = dateRange;

  const fetchDashboardData = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setIsLoading(true);

      const startDate = startOfDay(dateRangeRef.current.start).toISOString();
      const endDate = endOfDay(dateRangeRef.current.end).toISOString();

      // Fetch all queue items in date range
      const { data: queueItems, error: queueError } = await supabase
        .from('follow_up_queue')
        .select('*')
        .eq('company_id', profile.company_id)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (queueError) throw queueError;

      const items = queueItems || [];

      // Calculate metrics
      const total = items.length;
      const sent = items.filter(i => i.status === 'sent').length;
      const failed = items.filter(i => i.status === 'failed').length;
      const pending = items.filter(i => i.status === 'pending' || i.status === 'processing').length;
      const successRate = total > 0 ? (sent / total) * 100 : 0;
      const failureRate = total > 0 ? (failed / total) * 100 : 0;

      setMetrics({
        total,
        sent,
        failed,
        pending,
        successRate,
        failureRate
      });

      // Calculate daily data
      const days = eachDayOfInterval({ start: dateRangeRef.current.start, end: dateRangeRef.current.end });
      const dailyStats = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayItems = items.filter(i => i.created_at.startsWith(dayStr));
        return {
          date: dayStr,
          sent: dayItems.filter(i => i.status === 'sent').length,
          failed: dayItems.filter(i => i.status === 'failed').length
        };
      });
      setDailyData(dailyStats);

      // Calculate hourly distribution
      const hourlyStats: Record<number, number> = {};
      for (let i = 0; i < 24; i++) hourlyStats[i] = 0;
      
      items.forEach(item => {
        const hour = new Date(item.created_at).getHours();
        hourlyStats[hour]++;
      });
      
      setHourlyData(
        Object.entries(hourlyStats).map(([hour, count]) => ({
          hour: parseInt(hour),
          count
        }))
      );

      // Calculate failure breakdown
      const failedItems = items.filter(i => i.status === 'failed');
      const failureCounts: Record<string, number> = {};
      
      failedItems.forEach(item => {
        const code = item.failure_code || 'other';
        failureCounts[code] = (failureCounts[code] || 0) + 1;
      });
      
      const totalFailures = failedItems.length;
      const breakdown = Object.entries(failureCounts)
        .map(([code, count]) => ({
          code,
          label: FAILURE_LABEL_MAP[code] || code,
          count,
          percentage: totalFailures > 0 ? (count / totalFailures) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count);
      
      setFailureBreakdown(breakdown);

      // Fetch recent pending items
      const { data: recentItems, error: recentError } = await supabase
        .from('follow_up_queue')
        .select(`
          *,
          contact:contacts(id, name, phone_number, avatar_url),
          sequence:follow_up_sequences(id, name, follow_up_type)
        `)
        .eq('company_id', profile.company_id)
        .in('status', ['pending', 'processing'])
        .order('scheduled_at', { ascending: true })
        .limit(10);

      if (!recentError && recentItems) {
        setRecentQueue(recentItems as FollowUpQueueItem[]);
      }

    } catch (err: any) {
      console.error('Error fetching follow-up dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.company_id]);

  // Use primitive values for dateRange to trigger fetch
  const startDateISO = dateRange.start.toISOString();
  const endDateISO = dateRange.end.toISOString();

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData, startDateISO, endDateISO]);

  // Set up realtime subscription with debounce
  useEffect(() => {
    if (!profile?.company_id) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const channel = supabase
      .channel('followup-queue-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follow_up_queue',
          filter: `company_id=eq.${profile.company_id}`
        },
        () => {
          // Debounce refresh to avoid rapid fetches
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            fetchDashboardData();
          }, 1000);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, fetchDashboardData]);

  return {
    metrics,
    dailyData,
    hourlyData,
    failureBreakdown,
    recentQueue,
    isLoading,
    refresh: fetchDashboardData
  };
}
