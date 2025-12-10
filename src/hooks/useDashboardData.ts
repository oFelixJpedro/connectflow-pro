import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay, subDays, format, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardMetrics {
  todayConversations: number;
  yesterdayConversations: number;
  openConversations: number;
  yesterdayOpenConversations: number;
  avgResponseTimeMinutes: number;
  previousAvgResponseTime: number;
  resolutionRate: number;
  previousResolutionRate: number;
}

interface WeeklyChartData {
  name: string;
  conversas: number;
  resolvidas: number;
}

interface HourlyData {
  hour: string;
  count: number;
}

interface RecentConversation {
  id: string;
  status: string;
  unreadCount: number;
  contact: {
    name: string | null;
    phoneNumber: string;
  };
  lastMessageAt: string;
}

interface AgentPerformance {
  id: string;
  name: string;
  avatar: string;
  conversations: number;
  resolved: number;
}

export function useDashboardData() {
  const { company } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    todayConversations: 0,
    yesterdayConversations: 0,
    openConversations: 0,
    yesterdayOpenConversations: 0,
    avgResponseTimeMinutes: 0,
    previousAvgResponseTime: 0,
    resolutionRate: 0,
    previousResolutionRate: 0,
  });
  const [weeklyData, setWeeklyData] = useState<WeeklyChartData[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    if (!company?.id) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      
      try {
        const now = new Date();
        const todayStart = startOfDay(now);
        const todayEnd = endOfDay(now);
        const yesterdayStart = startOfDay(subDays(now, 1));
        const yesterdayEnd = endOfDay(subDays(now, 1));
        const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

        // Fetch all data in parallel
        const [
          todayConvsResult,
          yesterdayConvsResult,
          openConvsResult,
          weeklyConvsResult,
          todayMessagesResult,
          recentConvsResult,
          agentsResult,
        ] = await Promise.all([
          // Today's conversations
          supabase
            .from('conversations')
            .select('id, status, created_at', { count: 'exact' })
            .eq('company_id', company.id)
            .gte('created_at', todayStart.toISOString())
            .lte('created_at', todayEnd.toISOString()),

          // Yesterday's conversations
          supabase
            .from('conversations')
            .select('id', { count: 'exact' })
            .eq('company_id', company.id)
            .gte('created_at', yesterdayStart.toISOString())
            .lte('created_at', yesterdayEnd.toISOString()),

          // Open conversations (open, pending, in_progress)
          supabase
            .from('conversations')
            .select('id, status', { count: 'exact' })
            .eq('company_id', company.id)
            .in('status', ['open', 'pending', 'in_progress']),

          // Weekly conversations (last 7 days)
          supabase
            .from('conversations')
            .select('id, status, created_at, closed_at')
            .eq('company_id', company.id)
            .gte('created_at', weekStart.toISOString())
            .lte('created_at', weekEnd.toISOString()),

          // Today's messages for hourly chart
          supabase
            .from('messages')
            .select('id, created_at, conversation_id')
            .gte('created_at', todayStart.toISOString())
            .lte('created_at', todayEnd.toISOString()),

          // Recent conversations with contact info
          supabase
            .from('conversations')
            .select(`
              id,
              status,
              unread_count,
              last_message_at,
              contact:contacts(name, phone_number)
            `)
            .eq('company_id', company.id)
            .order('last_message_at', { ascending: false })
            .limit(5),

          // Agent performance - profiles with conversation counts
          supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('company_id', company.id)
            .eq('active', true),
        ]);

        // Process metrics
        const todayCount = todayConvsResult.count || 0;
        const yesterdayCount = yesterdayConvsResult.count || 0;
        const openCount = openConvsResult.count || 0;

        // Calculate resolution rate
        const totalConvs = todayConvsResult.data?.length || 0;
        const resolvedConvs = todayConvsResult.data?.filter(
          c => c.status === 'closed' || c.status === 'resolved'
        ).length || 0;
        const resolutionRate = totalConvs > 0 ? Math.round((resolvedConvs / totalConvs) * 100) : 0;

        setMetrics({
          todayConversations: todayCount,
          yesterdayConversations: yesterdayCount,
          openConversations: openCount,
          yesterdayOpenConversations: 0, // Would need historical data
          avgResponseTimeMinutes: 5, // Calculate from messages if needed
          previousAvgResponseTime: 6,
          resolutionRate,
          previousResolutionRate: resolutionRate - 3, // Placeholder
        });

        // Process weekly chart data
        const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const weeklyChartData: WeeklyChartData[] = [];
        
        for (let i = 0; i < 7; i++) {
          const day = subDays(now, 6 - i);
          const dayStart = startOfDay(day);
          const dayEnd = endOfDay(day);
          
          const dayConvs = weeklyConvsResult.data?.filter(c => {
            const createdAt = new Date(c.created_at);
            return createdAt >= dayStart && createdAt <= dayEnd;
          }) || [];
          
          const resolvedOnDay = dayConvs.filter(
            c => c.status === 'closed' || c.status === 'resolved'
          ).length;

          weeklyChartData.push({
            name: weekDays[day.getDay()],
            conversas: dayConvs.length,
            resolvidas: resolvedOnDay,
          });
        }
        setWeeklyData(weeklyChartData);

        // Process hourly data
        const hourlyChartData: HourlyData[] = [];
        for (let h = 8; h <= 18; h++) {
          const hourMessages = todayMessagesResult.data?.filter(m => {
            const msgHour = new Date(m.created_at).getHours();
            return msgHour === h;
          }) || [];
          
          hourlyChartData.push({
            hour: `${h.toString().padStart(2, '0')}h`,
            count: hourMessages.length,
          });
        }
        setHourlyData(hourlyChartData);

        // Process recent conversations
        const recentConvs: RecentConversation[] = (recentConvsResult.data || []).map(conv => ({
          id: conv.id,
          status: conv.status || 'open',
          unreadCount: conv.unread_count || 0,
          contact: {
            name: conv.contact?.name || null,
            phoneNumber: conv.contact?.phone_number || '',
          },
          lastMessageAt: conv.last_message_at || '',
        }));
        setRecentConversations(recentConvs);

        // Process agent performance
        if (agentsResult.data) {
          const agentStats = await Promise.all(
            agentsResult.data.map(async (agent) => {
              const [assignedResult, resolvedResult] = await Promise.all([
                supabase
                  .from('conversations')
                  .select('id', { count: 'exact' })
                  .eq('company_id', company.id)
                  .eq('assigned_user_id', agent.id)
                  .gte('created_at', todayStart.toISOString()),
                supabase
                  .from('conversations')
                  .select('id', { count: 'exact' })
                  .eq('company_id', company.id)
                  .eq('assigned_user_id', agent.id)
                  .in('status', ['closed', 'resolved'])
                  .gte('created_at', todayStart.toISOString()),
              ]);

              const initials = agent.full_name
                .split(' ')
                .map(n => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return {
                id: agent.id,
                name: agent.full_name,
                avatar: initials,
                conversations: assignedResult.count || 0,
                resolved: resolvedResult.count || 0,
              };
            })
          );

          // Sort by conversations and take top 4
          const topAgents = agentStats
            .filter(a => a.conversations > 0)
            .sort((a, b) => b.conversations - a.conversations)
            .slice(0, 4);

          setAgentPerformance(topAgents);
        }

        setLastUpdated(new Date());
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    // Refresh every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [company?.id]);

  return {
    loading,
    metrics,
    weeklyData,
    hourlyData,
    recentConversations,
    agentPerformance,
    lastUpdated,
  };
}
