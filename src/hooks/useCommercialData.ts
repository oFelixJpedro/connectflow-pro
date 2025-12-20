import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getStateFromPhone, StateCode } from '@/lib/dddMapping';

interface CriteriaScores {
  communication: number;
  objectivity: number;
  humanization: number;
  objection_handling: number;
  closing: number;
  response_time: number;
}

interface AgentAnalysis {
  id: string;
  name: string;
  avatar_url?: string;
  level: 'junior' | 'pleno' | 'senior';
  score: number;
  conversations: number;
  recommendation: 'promover' | 'manter' | 'treinar' | 'monitorar' | 'ação corretiva';
}

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

interface AggregatedInsights {
  strengths: string[];
  weaknesses: string[];
  positive_patterns: string[];
  negative_patterns: string[];
  critical_issues: string[];
  insights: string[];
  final_recommendation: string;
  criteria_scores: CriteriaScores;
  average_score: number;
  qualified_leads_percent: number;
}

interface CommercialData {
  averageScore: number;
  classification: 'EXCEPCIONAL' | 'BOM' | 'REGULAR' | 'RUIM' | 'CRÍTICO';
  qualifiedLeadsPercent: number;
  conversionRate: number;
  totalConversations: number;
  totalLeads: number;
  closedDeals: number;
  avgResponseTimeMinutes: number;
  criteriaScores: CriteriaScores;
  strengths: string[];
  weaknesses: string[];
  positivePatterns: string[];
  negativePatterns: string[];
  insights: string[];
  criticalIssues: string[];
  finalRecommendation: string;
  agentsAnalysis: AgentAnalysis[];
  contactsByState: Record<StateCode, number>;
  dealsByState: Record<StateCode, number>;
}

const DEFAULT_INSIGHTS: AggregatedInsights = {
  strengths: [],
  weaknesses: [],
  positive_patterns: [],
  negative_patterns: [],
  critical_issues: [],
  insights: [],
  final_recommendation: '',
  criteria_scores: {
    communication: 0,
    objectivity: 0,
    humanization: 0,
    objection_handling: 0,
    closing: 0,
    response_time: 0,
  },
  average_score: 0,
  qualified_leads_percent: 0,
};

export interface CommercialFilter {
  type: 'general' | 'connection' | 'department';
  connectionId?: string;
  departmentId?: string;
  startDate?: Date;
  endDate?: Date;
}

export function useCommercialData(filter?: CommercialFilter) {
  const { profile, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CommercialData | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics | null>(null);
  const [aggregatedInsights, setAggregatedInsights] = useState<AggregatedInsights>(DEFAULT_INSIGHTS);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [evaluating, setEvaluating] = useState(false);

  const isAdmin = userRole?.role === 'owner' || userRole?.role === 'admin';

  const evaluateConversations = async () => {
    if (!profile?.company_id) return;
    
    setEvaluating(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('evaluate-conversation', {
        body: { 
          evaluate_all: true, 
          company_id: profile.company_id 
        }
      });

      if (error) {
        console.error('Error evaluating conversations:', error);
        return { success: false, error };
      }

      console.log('Evaluation result:', result);
      return result;
    } catch (error) {
      console.error('Error calling evaluate-conversation:', error);
      return { success: false, error };
    } finally {
      setEvaluating(false);
    }
  };

  // Fetch live metrics and aggregated insights from company_live_dashboard
  const fetchLiveMetrics = useCallback(async () => {
    if (!profile?.company_id || !isAdmin) return;

    try {
      const { data: dashboard } = await supabase
        .from('company_live_dashboard')
        .select('*')
        .eq('company_id', profile.company_id)
        .maybeSingle();

      if (dashboard) {
        setLiveMetrics({
          activeConversations: dashboard.active_conversations || 0,
          hotLeads: dashboard.hot_leads || 0,
          warmLeads: dashboard.warm_leads || 0,
          coldLeads: dashboard.cold_leads || 0,
          todayMessages: dashboard.today_messages || 0,
          todayNewConversations: dashboard.today_new_conversations || 0,
          todayContractsClosed: dashboard.today_contracts_closed || 0,
          todayLeadsLost: dashboard.today_leads_lost || 0,
          currentAvgResponseTime: dashboard.current_avg_response_time || 0,
          currentAvgSentiment: dashboard.current_avg_sentiment || 'neutral',
          topObjections: Array.isArray(dashboard.top_objections) 
            ? dashboard.top_objections as string[]
            : [],
          topPainPoints: Array.isArray(dashboard.top_pain_points)
            ? dashboard.top_pain_points as string[]
            : [],
        });

        // Parse aggregated insights from dashboard
        const rawInsights = dashboard.aggregated_insights;
        if (rawInsights && typeof rawInsights === 'object' && !Array.isArray(rawInsights)) {
          const insights = rawInsights as unknown as AggregatedInsights;
          setAggregatedInsights({
            strengths: insights.strengths || [],
            weaknesses: insights.weaknesses || [],
            positive_patterns: insights.positive_patterns || [],
            negative_patterns: insights.negative_patterns || [],
            critical_issues: insights.critical_issues || [],
            insights: insights.insights || [],
            final_recommendation: insights.final_recommendation || '',
            criteria_scores: insights.criteria_scores || DEFAULT_INSIGHTS.criteria_scores,
            average_score: insights.average_score || 0,
            qualified_leads_percent: insights.qualified_leads_percent || 0,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching live metrics:', error);
    }
  }, [profile?.company_id, isAdmin]);

  // Set up realtime subscription for live updates
  useEffect(() => {
    if (!profile?.company_id || !isAdmin) return;

    fetchLiveMetrics();

    // Subscribe to realtime updates on company_live_dashboard
    const channel = supabase
      .channel('commercial-live-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_live_dashboard',
          filter: `company_id=eq.${profile.company_id}`,
        },
        (payload) => {
          console.log('📊 [REALTIME] Dashboard updated:', payload);
          const newData = payload.new as any;
          if (newData) {
            setLiveMetrics({
              activeConversations: newData.active_conversations || 0,
              hotLeads: newData.hot_leads || 0,
              warmLeads: newData.warm_leads || 0,
              coldLeads: newData.cold_leads || 0,
              todayMessages: newData.today_messages || 0,
              todayNewConversations: newData.today_new_conversations || 0,
              todayContractsClosed: newData.today_contracts_closed || 0,
              todayLeadsLost: newData.today_leads_lost || 0,
              currentAvgResponseTime: newData.current_avg_response_time || 0,
              currentAvgSentiment: newData.current_avg_sentiment || 'neutral',
              topObjections: Array.isArray(newData.top_objections) 
                ? newData.top_objections as string[]
                : [],
              topPainPoints: Array.isArray(newData.top_pain_points)
                ? newData.top_pain_points as string[]
                : [],
            });

            // Update aggregated insights from realtime
            const rawInsights = newData.aggregated_insights;
            if (rawInsights && typeof rawInsights === 'object' && !Array.isArray(rawInsights)) {
              const insights = rawInsights as unknown as AggregatedInsights;
              setAggregatedInsights({
                strengths: insights.strengths || [],
                weaknesses: insights.weaknesses || [],
                positive_patterns: insights.positive_patterns || [],
                negative_patterns: insights.negative_patterns || [],
                critical_issues: insights.critical_issues || [],
                insights: insights.insights || [],
                final_recommendation: insights.final_recommendation || '',
                criteria_scores: insights.criteria_scores || DEFAULT_INSIGHTS.criteria_scores,
                average_score: insights.average_score || 0,
                qualified_leads_percent: insights.qualified_leads_percent || 0,
              });
            }

            setLastUpdated(new Date());
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, isAdmin, fetchLiveMetrics]);

  useEffect(() => {
    if (!profile?.company_id || !isAdmin) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // Calculate date range - use filter dates or default to current week
        let startDate: Date;
        let endDate: Date;
        
        if (filter?.startDate && filter?.endDate) {
          startDate = filter.startDate;
          endDate = filter.endDate;
        } else {
          // Default: current week
          const now = new Date();
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay() + 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = now;
        }

        // Build base query for conversations
        let conversationsQuery = supabase
          .from('conversations')
          .select(`
            id,
            status,
            created_at,
            assigned_user_id,
            whatsapp_connection_id,
            department_id,
            contact:contacts(phone_number, name)
          `)
          .eq('company_id', profile.company_id)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        // Apply filters
        if (filter?.type === 'connection' && filter.connectionId) {
          conversationsQuery = conversationsQuery.eq('whatsapp_connection_id', filter.connectionId);
        } else if (filter?.type === 'department' && filter.departmentId) {
          conversationsQuery = conversationsQuery.eq('department_id', filter.departmentId);
        }

        const { data: conversations, error: convError } = await conversationsQuery;

        if (convError) throw convError;

        // Fetch all contacts for geographic data
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select('phone_number')
          .eq('company_id', profile.company_id);

        if (contactsError) throw contactsError;

        // Fetch live metrics for closed deals (from Kanban or AI detection)
        const { data: liveMetricsData } = await supabase
          .from('conversation_live_metrics')
          .select('lead_status, conversation_id')
          .eq('company_id', profile.company_id);

        // Count closed deals from live metrics (AI-detected or Kanban confirmed)
        const closedDealsFromAI = liveMetricsData?.filter(
          m => m.lead_status === 'closed_won'
        ).length || 0;

        // Fetch messages to calculate real response time
        const conversationIds = conversations?.map(c => c.id) || [];
        let avgResponseTimeMinutes = 0;
        
        if (conversationIds.length > 0) {
          const { data: messages } = await supabase
            .from('messages')
            .select('id, conversation_id, direction, sender_type, created_at')
            .in('conversation_id', conversationIds)
            .order('created_at', { ascending: true });

          if (messages && messages.length > 0) {
            const messagesByConv: Record<string, typeof messages> = {};
            messages.forEach(msg => {
              if (!messagesByConv[msg.conversation_id]) {
                messagesByConv[msg.conversation_id] = [];
              }
              messagesByConv[msg.conversation_id].push(msg);
            });

            const responseTimes: number[] = [];
            
            Object.values(messagesByConv).forEach(convMessages => {
              convMessages.sort((a, b) => 
                new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime()
              );
              
              for (let i = 0; i < convMessages.length - 1; i++) {
                const currentMsg = convMessages[i];
                
                if (currentMsg.direction === 'inbound' && currentMsg.sender_type === 'contact') {
                  for (let j = i + 1; j < convMessages.length; j++) {
                    const nextMsg = convMessages[j];
                    
                    if (nextMsg.direction === 'outbound' && nextMsg.sender_type === 'user') {
                      const inboundTime = new Date(currentMsg.created_at!).getTime();
                      const outboundTime = new Date(nextMsg.created_at!).getTime();
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
        }

        // Fetch agents
        const { data: agents, error: agentsError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('company_id', profile.company_id);

        if (agentsError) throw agentsError;

        // Calculate contacts by state
        const contactsByState: Record<string, number> = {};
        contacts?.forEach(contact => {
          const stateInfo = getStateFromPhone(contact.phone_number);
          if (stateInfo) {
            contactsByState[stateInfo.state] = (contactsByState[stateInfo.state] || 0) + 1;
          }
        });

        // Calculate deals by state
        const dealsByState: Record<string, number> = {};
        
        if (liveMetricsData && liveMetricsData.length > 0) {
          const closedConvIds = liveMetricsData
            .filter(m => m.lead_status === 'closed_won')
            .map(m => m.conversation_id);
          
          if (closedConvIds.length > 0) {
            const { data: closedConvs } = await supabase
              .from('conversations')
              .select('contact:contacts(phone_number)')
              .in('id', closedConvIds);
            
            closedConvs?.forEach(conv => {
              const contact = conv.contact as any;
              if (contact?.phone_number) {
                const stateInfo = getStateFromPhone(contact.phone_number);
                if (stateInfo) {
                  dealsByState[stateInfo.state] = (dealsByState[stateInfo.state] || 0) + 1;
                }
              }
            });
          }
        }

        // Calculate agent statistics
        const agentStats: Record<string, { conversations: number; closed: number }> = {};
        conversations?.forEach(conv => {
          if (conv.assigned_user_id) {
            if (!agentStats[conv.assigned_user_id]) {
              agentStats[conv.assigned_user_id] = { conversations: 0, closed: 0 };
            }
            agentStats[conv.assigned_user_id].conversations++;
            const isClosedWon = liveMetricsData?.some(
              m => m.conversation_id === conv.id && m.lead_status === 'closed_won'
            );
            if (isClosedWon) {
              agentStats[conv.assigned_user_id].closed++;
            }
          }
        });

        // Fetch evaluations for agent scoring
        const { data: evaluations } = await supabase
          .from('conversation_evaluations')
          .select('*')
          .eq('company_id', profile.company_id);

        // Build agent analysis with real evaluation data
        const agentsAnalysis: AgentAnalysis[] = agents?.map(agent => {
          const stats = agentStats[agent.id] || { conversations: 0, closed: 0 };
          
          const agentEvaluations = evaluations?.filter(e => {
            const convIds = conversations?.filter(c => c.assigned_user_id === agent.id).map(c => c.id) || [];
            return convIds.includes(e.conversation_id);
          }) || [];

          let score: number;
          if (agentEvaluations.length > 0) {
            const totalScore = agentEvaluations.reduce((sum, e) => sum + (e.overall_score || 0), 0);
            score = Math.round((totalScore / agentEvaluations.length) * 10) / 10;
          } else {
            score = stats.conversations > 0 
              ? Math.round((stats.closed / stats.conversations) * 10 * 10) / 10 
              : 0;
          }
          
          const level: AgentAnalysis['level'] = 
            score >= 8.5 ? 'senior' : 
            score >= 7.0 ? 'pleno' : 'junior';
          
          const recommendation: AgentAnalysis['recommendation'] = 
            score >= 8.5 ? 'promover' :
            score >= 7.0 ? 'manter' :
            score >= 6.0 ? 'treinar' :
            score >= 5.0 ? 'monitorar' : 'ação corretiva';

          return {
            id: agent.id,
            name: agent.full_name,
            avatar_url: agent.avatar_url || undefined,
            level,
            score,
            conversations: stats.conversations,
            recommendation,
          };
        }).filter(a => a.conversations > 0).sort((a, b) => b.score - a.score) || [];

        // Calculate overall metrics
        const totalConversations = conversations?.length || 0;
        const conversionRate = totalConversations > 0 
          ? Math.round((closedDealsFromAI / totalConversations) * 100 * 10) / 10 
          : 0;

        // Use aggregated insights from realtime if available, otherwise calculate from evaluations
        const useAggregatedInsights = aggregatedInsights.average_score > 0;
        
        let averageScore: number;
        let criteriaScores: CriteriaScores;
        let qualifiedLeadsPercent: number;
        let allStrengths: string[];
        let allWeaknesses: string[];
        let positivePatterns: string[];
        let negativePatterns: string[];
        let insights: string[];
        let criticalIssues: string[];
        let finalRecommendation: string;

        if (useAggregatedInsights) {
          // Use AI-generated insights from database
          averageScore = aggregatedInsights.average_score;
          criteriaScores = aggregatedInsights.criteria_scores;
          qualifiedLeadsPercent = aggregatedInsights.qualified_leads_percent;
          allStrengths = aggregatedInsights.strengths;
          allWeaknesses = aggregatedInsights.weaknesses;
          positivePatterns = aggregatedInsights.positive_patterns;
          negativePatterns = aggregatedInsights.negative_patterns;
          insights = aggregatedInsights.insights;
          criticalIssues = aggregatedInsights.critical_issues;
          finalRecommendation = aggregatedInsights.final_recommendation;
        } else if (evaluations && evaluations.length > 0) {
          // Calculate from evaluations if no aggregated insights yet
          const scores = {
            communication: 0,
            objectivity: 0,
            humanization: 0,
            objection_handling: 0,
            closing: 0,
            response_time: 0,
          };
          let totalOverall = 0;
          let hotWarmLeads = 0;
          const tempStrengths: string[] = [];
          const tempWeaknesses: string[] = [];

          evaluations.forEach(eval_ => {
            scores.communication += eval_.communication_score || 0;
            scores.objectivity += eval_.objectivity_score || 0;
            scores.humanization += eval_.humanization_score || 0;
            scores.objection_handling += eval_.objection_handling_score || 0;
            scores.closing += eval_.closing_score || 0;
            scores.response_time += eval_.response_time_score || 0;
            totalOverall += eval_.overall_score || 0;

            if (eval_.lead_qualification === 'hot' || eval_.lead_qualification === 'warm') {
              hotWarmLeads++;
            }

            if (eval_.strengths && Array.isArray(eval_.strengths)) {
              tempStrengths.push(...(eval_.strengths as string[]));
            }
            if (eval_.improvements && Array.isArray(eval_.improvements)) {
              tempWeaknesses.push(...(eval_.improvements as string[]));
            }
          });

          const count = evaluations.length;
          criteriaScores = {
            communication: Math.round((scores.communication / count) * 10) / 10,
            objectivity: Math.round((scores.objectivity / count) * 10) / 10,
            humanization: Math.round((scores.humanization / count) * 10) / 10,
            objection_handling: Math.round((scores.objection_handling / count) * 10) / 10,
            closing: Math.round((scores.closing / count) * 10) / 10,
            response_time: Math.round((scores.response_time / count) * 10) / 10,
          };

          averageScore = Math.round((totalOverall / count) * 10) / 10;
          qualifiedLeadsPercent = Math.round((hotWarmLeads / count) * 100);

          // Get unique top strengths and weaknesses
          const strengthCounts = tempStrengths.reduce((acc, s) => {
            acc[s] = (acc[s] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          const weaknessCounts = tempWeaknesses.reduce((acc, w) => {
            acc[w] = (acc[w] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          allStrengths = Object.entries(strengthCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([s]) => s);

          allWeaknesses = Object.entries(weaknessCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([w]) => w);

          // Create distinct positive/negative patterns from evaluations
          // Don't just copy strengths/weaknesses - extract patterns from actual scores
          positivePatterns = [];
          negativePatterns = [];
          
          // Identify positive patterns from high-scoring areas
          if (criteriaScores.communication >= 7) positivePatterns.push('Comunicação clara e profissional');
          if (criteriaScores.humanization >= 7) positivePatterns.push('Atendimento humanizado e empático');
          if (criteriaScores.response_time >= 7) positivePatterns.push('Respostas rápidas e consistentes');
          if (criteriaScores.closing >= 7) positivePatterns.push('Boas técnicas de fechamento');
          
          // Identify negative patterns from low-scoring areas
          if (criteriaScores.closing < 6) negativePatterns.push('Dificuldade em técnicas de fechamento');
          if (criteriaScores.response_time < 6) negativePatterns.push('Tempo de resposta acima do ideal');
          if (criteriaScores.objection_handling < 6) negativePatterns.push('Tratamento de objeções precisa melhorar');
          if (criteriaScores.objectivity < 6) negativePatterns.push('Falta de objetividade nas respostas');
          
          // Limit to 3 each
          positivePatterns = positivePatterns.slice(0, 3);
          negativePatterns = negativePatterns.slice(0, 3);

          // Generate basic insights until AI generates them
          insights = [];
          criticalIssues = [];
          
          if (criteriaScores.closing < 6) {
            insights.push('Aguardando análise de IA para insights detalhados de fechamento');
          }
          if (criteriaScores.response_time < 6) {
            criticalIssues.push('Tempo de resposta precisa ser analisado pela IA');
          }

          finalRecommendation = 'Aguardando análise de IA para recomendação personalizada...';
        } else {
          // No data yet
          criteriaScores = {
            communication: 0,
            objectivity: 0,
            humanization: 0,
            objection_handling: 0,
            closing: 0,
            response_time: 0,
          };
          averageScore = 0;
          qualifiedLeadsPercent = 0;
          allStrengths = ['Aguardando conversas para análise'];
          allWeaknesses = ['Dados insuficientes'];
          positivePatterns = [];
          negativePatterns = [];
          insights = ['Envie mensagens para a IA começar a gerar insights automáticos'];
          criticalIssues = [];
          finalRecommendation = 'A IA irá gerar recomendações automaticamente conforme as conversas acontecem.';
        }

        const classification: CommercialData['classification'] = 
          averageScore >= 9.0 ? 'EXCEPCIONAL' :
          averageScore >= 7.5 ? 'BOM' :
          averageScore >= 6.0 ? 'REGULAR' :
          averageScore >= 4.0 ? 'RUIM' : 'CRÍTICO';

        setData({
          averageScore,
          classification,
          qualifiedLeadsPercent,
          conversionRate,
          totalConversations,
          totalLeads: totalConversations,
          closedDeals: closedDealsFromAI,
          avgResponseTimeMinutes,
          criteriaScores,
          strengths: allStrengths,
          weaknesses: allWeaknesses,
          positivePatterns,
          negativePatterns,
          insights: insights.length > 0 ? insights : ['Aguardando análise de IA'],
          criticalIssues,
          finalRecommendation: finalRecommendation || 'Aguardando análise de IA',
          agentsAnalysis,
          contactsByState: contactsByState as Record<StateCode, number>,
          dealsByState: dealsByState as Record<StateCode, number>,
        });

        setLastUpdated(new Date());
      } catch (error) {
        console.error('Error fetching commercial data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile?.company_id, isAdmin, aggregatedInsights, filter?.type, filter?.connectionId, filter?.departmentId, filter?.startDate, filter?.endDate]);

  return {
    loading,
    data,
    liveMetrics,
    aggregatedInsights,
    lastUpdated,
    isAdmin,
    evaluating,
    evaluateConversations,
  };
}