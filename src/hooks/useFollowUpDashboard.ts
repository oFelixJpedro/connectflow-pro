import { useState, useEffect, useCallback } from 'react';
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

  const fetchDashboardData = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setIsLoading(true);

      const startDate = startOfDay(dateRange.start).toISOString();
      const endDate = endOfDay(dateRange.end).toISOString();

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
      const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
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
  }, [profile?.company_id, dateRange.start, dateRange.end]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Set up realtime subscription
  useEffect(() => {
    if (!profile?.company_id) return;

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
          // Debounce refresh
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
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
