import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek } from 'date-fns';
import type { DashboardFilter, FilterType } from '@/components/dashboard/DashboardFilters';

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
  contactId: string;
  status: string;
  unreadCount: number;
  contact: {
    name: string | null;
    phoneNumber: string;
    avatarUrl: string | null;
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

const FILTER_STORAGE_KEY = 'dashboard_filter';

function loadSavedFilter(userId: string): DashboardFilter {
  try {
    const saved = localStorage.getItem(`${FILTER_STORAGE_KEY}_${userId}`);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore parse errors
  }
  return { type: 'general' };
}

function saveFilter(userId: string, filter: DashboardFilter) {
  try {
    localStorage.setItem(`${FILTER_STORAGE_KEY}_${userId}`, JSON.stringify(filter));
  } catch {
    // Ignore storage errors
  }
}

export function useDashboardData() {
  const { company, profile, userRole } = useAuth();
  const role = userRole?.role;
  const isAdmin = role === 'owner' || role === 'admin';
  
  // Initialize filter based on role
  const getInitialFilter = useCallback((): DashboardFilter => {
    if (!isAdmin && profile?.id) {
      // Non-admin users always see only their own data
      return { type: 'agent', agentId: profile.id };
    }
    if (profile?.id) {
      return loadSavedFilter(profile.id);
    }
    return { type: 'general' };
  }, [isAdmin, profile?.id]);

  const [filter, setFilter] = useState<DashboardFilter>({ type: 'general' });
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

  // Set initial filter when profile loads
  useEffect(() => {
    if (profile?.id) {
      setFilter(getInitialFilter());
    }
  }, [profile?.id, getInitialFilter]);

  const handleFilterChange = useCallback((newFilter: DashboardFilter) => {
    setFilter(newFilter);
    if (profile?.id && isAdmin) {
      saveFilter(profile.id, newFilter);
    }
  }, [profile?.id, isAdmin]);

  // Helper to apply filter to conversation queries
  const applyConversationFilter = useCallback((query: any) => {
    if (filter.type === 'agent' && filter.agentId) {
      query = query.eq('assigned_user_id', filter.agentId);
    } else if (filter.type === 'connection' && filter.connectionId) {
      query = query.eq('whatsapp_connection_id', filter.connectionId);
      // Apply department as sub-filter if present
      if (filter.departmentId) {
        query = query.eq('department_id', filter.departmentId);
      }
    }
    return query;
  }, [filter]);

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
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

        // Build queries with filters
        let todayConvsQuery = supabase
          .from('conversations')
          .select('id, status, created_at', { count: 'exact' })
          .eq('company_id', company.id)
          .gte('created_at', todayStart.toISOString())
          .lte('created_at', todayEnd.toISOString());
        todayConvsQuery = applyConversationFilter(todayConvsQuery);

        let yesterdayConvsQuery = supabase
          .from('conversations')
          .select('id', { count: 'exact' })
          .eq('company_id', company.id)
          .gte('created_at', yesterdayStart.toISOString())
          .lte('created_at', yesterdayEnd.toISOString());
        yesterdayConvsQuery = applyConversationFilter(yesterdayConvsQuery);

        let openConvsQuery = supabase
          .from('conversations')
          .select('id, status', { count: 'exact' })
          .eq('company_id', company.id)
          .in('status', ['open', 'pending', 'in_progress']);
        openConvsQuery = applyConversationFilter(openConvsQuery);

        let weeklyConvsQuery = supabase
          .from('conversations')
          .select('id, status, created_at, closed_at')
          .eq('company_id', company.id)
          .gte('created_at', weekStart.toISOString())
          .lte('created_at', weekEnd.toISOString());
        weeklyConvsQuery = applyConversationFilter(weeklyConvsQuery);

        let recentConvsQuery = supabase
          .from('conversations')
          .select(`
            id,
            contact_id,
            status,
            unread_count,
            last_message_at,
            contact:contacts(name, phone_number, avatar_url)
          `)
          .eq('company_id', company.id)
          .order('last_message_at', { ascending: false })
          .limit(5);
        recentConvsQuery = applyConversationFilter(recentConvsQuery);

        // Build messages query for hourly data
        // For agent filter, we need to get conversation IDs first, then filter messages
        let conversationIdsForMessages: string[] | null = null;
        if (filter.type === 'agent' && filter.agentId) {
          const { data: agentConvs } = await supabase
            .from('conversations')
            .select('id')
            .eq('company_id', company.id)
            .eq('assigned_user_id', filter.agentId);
          conversationIdsForMessages = agentConvs?.map(c => c.id) || [];
        } else if (filter.type === 'connection' && filter.connectionId) {
          let connQuery = supabase
            .from('conversations')
            .select('id')
            .eq('company_id', company.id)
            .eq('whatsapp_connection_id', filter.connectionId);
          // Apply department sub-filter if present
          if (filter.departmentId) {
            connQuery = connQuery.eq('department_id', filter.departmentId);
          }
          const { data: connConvs } = await connQuery;
          conversationIdsForMessages = connConvs?.map(c => c.id) || [];
        }

        let todayMessagesQuery = supabase
          .from('messages')
          .select('id, created_at, conversation_id')
          .gte('created_at', todayStart.toISOString())
          .lte('created_at', todayEnd.toISOString());

        if (conversationIdsForMessages !== null && conversationIdsForMessages.length > 0) {
          todayMessagesQuery = todayMessagesQuery.in('conversation_id', conversationIdsForMessages);
        } else if (conversationIdsForMessages !== null && conversationIdsForMessages.length === 0) {
          // No conversations match the filter, skip messages query
          todayMessagesQuery = todayMessagesQuery.eq('conversation_id', 'no-match');
        }

        let responseTimeMessagesQuery = supabase
          .from('messages')
          .select('id, conversation_id, direction, sender_type, created_at')
          .gte('created_at', todayStart.toISOString())
          .lte('created_at', todayEnd.toISOString())
          .order('created_at', { ascending: true });

        if (conversationIdsForMessages !== null && conversationIdsForMessages.length > 0) {
          responseTimeMessagesQuery = responseTimeMessagesQuery.in('conversation_id', conversationIdsForMessages);
        } else if (conversationIdsForMessages !== null && conversationIdsForMessages.length === 0) {
          responseTimeMessagesQuery = responseTimeMessagesQuery.eq('conversation_id', 'no-match');
        }

        // Query for yesterday's open conversations
        let yesterdayOpenConvsQuery = supabase
          .from('conversations')
          .select('id', { count: 'exact' })
          .eq('company_id', company.id)
          .in('status', ['open', 'pending', 'in_progress'])
          .lte('created_at', yesterdayEnd.toISOString());
        yesterdayOpenConvsQuery = applyConversationFilter(yesterdayOpenConvsQuery);

        // Query for yesterday's messages (for response time comparison)
        let yesterdayMessagesQuery = supabase
          .from('messages')
          .select('id, conversation_id, direction, sender_type, created_at')
          .gte('created_at', yesterdayStart.toISOString())
          .lte('created_at', yesterdayEnd.toISOString())
          .order('created_at', { ascending: true });

        if (conversationIdsForMessages !== null && conversationIdsForMessages.length > 0) {
          yesterdayMessagesQuery = yesterdayMessagesQuery.in('conversation_id', conversationIdsForMessages);
        } else if (conversationIdsForMessages !== null && conversationIdsForMessages.length === 0) {
          yesterdayMessagesQuery = yesterdayMessagesQuery.eq('conversation_id', 'no-match');
        }

        // Query for yesterday's resolution rate
        let yesterdayConvsForRateQuery = supabase
          .from('conversations')
          .select('id, status')
          .eq('company_id', company.id)
          .gte('created_at', yesterdayStart.toISOString())
          .lte('created_at', yesterdayEnd.toISOString());
        yesterdayConvsForRateQuery = applyConversationFilter(yesterdayConvsForRateQuery);

        // Fetch all data in parallel
        const [
          todayConvsResult,
          yesterdayConvsResult,
          openConvsResult,
          yesterdayOpenConvsResult,
          weeklyConvsResult,
          todayMessagesResult,
          recentConvsResult,
          agentsResult,
          responseTimeMessagesResult,
          yesterdayMessagesResult,
          yesterdayConvsForRateResult,
        ] = await Promise.all([
          todayConvsQuery,
          yesterdayConvsQuery,
          openConvsQuery,
          yesterdayOpenConvsQuery,
          weeklyConvsQuery,
          todayMessagesQuery,
          recentConvsQuery,
          supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('company_id', company.id)
            .eq('active', true),
          responseTimeMessagesQuery,
          yesterdayMessagesQuery,
          yesterdayConvsForRateQuery,
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

        // Calculate average response time from real messages
        let avgResponseTimeMinutes = 0;
        const responseMessages = responseTimeMessagesResult.data || [];
        
        if (responseMessages.length > 0) {
          const messagesByConv: Record<string, typeof responseMessages> = {};
          responseMessages.forEach(msg => {
            if (!messagesByConv[msg.conversation_id]) {
              messagesByConv[msg.conversation_id] = [];
            }
            messagesByConv[msg.conversation_id].push(msg);
          });

          const responseTimes: number[] = [];
          
          Object.values(messagesByConv).forEach(convMessages => {
            convMessages.sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            
            for (let i = 0; i < convMessages.length - 1; i++) {
              const currentMsg = convMessages[i];
              
              if (currentMsg.direction === 'inbound' && currentMsg.sender_type === 'contact') {
                for (let j = i + 1; j < convMessages.length; j++) {
                  const nextMsg = convMessages[j];
                  
                  if (nextMsg.direction === 'outbound' && nextMsg.sender_type === 'user') {
                    const inboundTime = new Date(currentMsg.created_at).getTime();
                    const outboundTime = new Date(nextMsg.created_at).getTime();
                    const diffMinutes = Math.round((outboundTime - inboundTime) / (1000 * 60));
                    
                    if (diffMinutes > 0 && diffMinutes < 1440) {
                      responseTimes.push(diffMinutes);
                    }
                    break;
                  }
                }
              }
            }
          });

          if (responseTimes.length > 0) {
            avgResponseTimeMinutes = Math.round(
              responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
            );
          }
        }

        // Calculate yesterday's open conversations
        const yesterdayOpenCount = yesterdayOpenConvsResult.count || 0;

        // Calculate yesterday's average response time
        let previousAvgResponseTime = 0;
        const yesterdayMessages = yesterdayMessagesResult.data || [];
        
        if (yesterdayMessages.length > 0) {
          const messagesByConv: Record<string, typeof yesterdayMessages> = {};
          yesterdayMessages.forEach(msg => {
            if (!messagesByConv[msg.conversation_id]) {
              messagesByConv[msg.conversation_id] = [];
            }
            messagesByConv[msg.conversation_id].push(msg);
          });

          const responseTimes: number[] = [];
          
          Object.values(messagesByConv).forEach(convMessages => {
            convMessages.sort((a, b) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            
            for (let i = 0; i < convMessages.length - 1; i++) {
              const currentMsg = convMessages[i];
              
              if (currentMsg.direction === 'inbound' && currentMsg.sender_type === 'contact') {
                for (let j = i + 1; j < convMessages.length; j++) {
                  const nextMsg = convMessages[j];
                  
                  if (nextMsg.direction === 'outbound' && nextMsg.sender_type === 'user') {
                    const inboundTime = new Date(currentMsg.created_at).getTime();
                    const outboundTime = new Date(nextMsg.created_at).getTime();
                    const diffMinutes = Math.round((outboundTime - inboundTime) / (1000 * 60));
                    
                    if (diffMinutes > 0 && diffMinutes < 1440) {
                      responseTimes.push(diffMinutes);
                    }
                    break;
                  }
                }
              }
            }
          });

          if (responseTimes.length > 0) {
            previousAvgResponseTime = Math.round(
              responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
            );
          }
        }

        // Calculate yesterday's resolution rate
        const yesterdayTotalConvs = yesterdayConvsForRateResult.data?.length || 0;
        const yesterdayResolvedConvs = yesterdayConvsForRateResult.data?.filter(
          c => c.status === 'closed' || c.status === 'resolved'
        ).length || 0;
        const previousResolutionRate = yesterdayTotalConvs > 0 
          ? Math.round((yesterdayResolvedConvs / yesterdayTotalConvs) * 100) 
          : 0;

        setMetrics({
          todayConversations: todayCount,
          yesterdayConversations: yesterdayCount,
          openConversations: openCount,
          yesterdayOpenConversations: yesterdayOpenCount,
          avgResponseTimeMinutes,
          previousAvgResponseTime,
          resolutionRate,
          previousResolutionRate,
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
          contactId: conv.contact_id,
          status: conv.status || 'open',
          unreadCount: conv.unread_count || 0,
          contact: {
            name: conv.contact?.name || null,
            phoneNumber: conv.contact?.phone_number || '',
            avatarUrl: conv.contact?.avatar_url || null,
          },
          lastMessageAt: conv.last_message_at || '',
        }));
        setRecentConversations(recentConvs);

        // Process agent performance (only for general/admin view)
        if (filter.type === 'general' && agentsResult.data) {
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

          const topAgents = agentStats
            .filter(a => a.conversations > 0)
            .sort((a, b) => b.conversations - a.conversations)
            .slice(0, 4);

          setAgentPerformance(topAgents);
        } else {
          // Clear agent performance for filtered views
          setAgentPerformance([]);
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
  }, [company?.id, filter, applyConversationFilter]);

  return {
    loading,
    metrics,
    weeklyData,
    hourlyData,
    recentConversations,
    agentPerformance,
    lastUpdated,
    filter,
    setFilter: handleFilterChange,
    isAdmin,
  };
}
