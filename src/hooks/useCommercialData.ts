import { useState, useEffect } from 'react';
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

export function useCommercialData() {
  const { profile, userRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CommercialData | null>(null);
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

  useEffect(() => {
    if (!profile?.company_id || !isAdmin) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1);
        startOfWeek.setHours(0, 0, 0, 0);

        // Fetch conversations from this week
        const { data: conversations, error: convError } = await supabase
          .from('conversations')
          .select(`
            id,
            status,
            created_at,
            assigned_user_id,
            contact:contacts(phone_number, name)
          `)
          .eq('company_id', profile.company_id)
          .gte('created_at', startOfWeek.toISOString());

        if (convError) throw convError;

        // Fetch evaluations from conversation_evaluations table
        const { data: evaluations, error: evalError } = await supabase
          .from('conversation_evaluations')
          .select('*')
          .eq('company_id', profile.company_id);

        if (evalError) {
          console.error('Error fetching evaluations:', evalError);
        }

        // Fetch all contacts for geographic data
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select('phone_number')
          .eq('company_id', profile.company_id);

        if (contactsError) throw contactsError;

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
            // Group messages by conversation
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
                
                // Look for inbound messages from contact
                if (currentMsg.direction === 'inbound' && currentMsg.sender_type === 'contact') {
                  // Find the next outbound message from user
                  for (let j = i + 1; j < convMessages.length; j++) {
                    const nextMsg = convMessages[j];
                    
                    if (nextMsg.direction === 'outbound' && nextMsg.sender_type === 'user') {
                      const inboundTime = new Date(currentMsg.created_at!).getTime();
                      const outboundTime = new Date(nextMsg.created_at!).getTime();
                      const diffMinutes = Math.round((outboundTime - inboundTime) / (1000 * 60));
                      
                      // Only count reasonable response times (< 24 hours)
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
        conversations?.forEach(conv => {
          if (conv.status === 'closed' || conv.status === 'resolved') {
            const contact = conv.contact as any;
            if (contact?.phone_number) {
              const stateInfo = getStateFromPhone(contact.phone_number);
              if (stateInfo) {
                dealsByState[stateInfo.state] = (dealsByState[stateInfo.state] || 0) + 1;
              }
            }
          }
        });

        // Calculate agent statistics
        const agentStats: Record<string, { conversations: number; closed: number }> = {};
        conversations?.forEach(conv => {
          if (conv.assigned_user_id) {
            if (!agentStats[conv.assigned_user_id]) {
              agentStats[conv.assigned_user_id] = { conversations: 0, closed: 0 };
            }
            agentStats[conv.assigned_user_id].conversations++;
            if (conv.status === 'closed' || conv.status === 'resolved') {
              agentStats[conv.assigned_user_id].closed++;
            }
          }
        });

        // Calculate criteria scores from real evaluations
        let criteriaScores: CriteriaScores;
        let qualifiedLeadsPercent = 0;
        let allStrengths: string[] = [];
        let allWeaknesses: string[] = [];
        let averageScoreFromEvals = 0;

        if (evaluations && evaluations.length > 0) {
          // Calculate average scores from real evaluations
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

          evaluations.forEach(eval_ => {
            scores.communication += eval_.communication_score || 0;
            scores.objectivity += eval_.objectivity_score || 0;
            scores.humanization += eval_.humanization_score || 0;
            scores.objection_handling += eval_.objection_handling_score || 0;
            scores.closing += eval_.closing_score || 0;
            scores.response_time += eval_.response_time_score || 0;
            totalOverall += eval_.overall_score || 0;

            // Count qualified leads (hot or warm)
            if (eval_.lead_qualification === 'hot' || eval_.lead_qualification === 'warm') {
              hotWarmLeads++;
            }

            // Collect strengths and weaknesses
            if (eval_.strengths && Array.isArray(eval_.strengths)) {
              allStrengths.push(...(eval_.strengths as string[]));
            }
            if (eval_.improvements && Array.isArray(eval_.improvements)) {
              allWeaknesses.push(...(eval_.improvements as string[]));
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

          averageScoreFromEvals = Math.round((totalOverall / count) * 10) / 10;
          qualifiedLeadsPercent = Math.round((hotWarmLeads / count) * 100);

          // Get unique top strengths and weaknesses
          const strengthCounts = allStrengths.reduce((acc, s) => {
            acc[s] = (acc[s] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          const weaknessCounts = allWeaknesses.reduce((acc, w) => {
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

        } else {
          // Fallback to default values when no evaluations exist
          criteriaScores = {
            communication: 0,
            objectivity: 0,
            humanization: 0,
            objection_handling: 0,
            closing: 0,
            response_time: 0,
          };
          allStrengths = ['Sem avaliações ainda'];
          allWeaknesses = ['Execute a avaliação de conversas'];
        }

        // Build agent analysis with real evaluation data
        const agentsAnalysis: AgentAnalysis[] = agents?.map(agent => {
          const stats = agentStats[agent.id] || { conversations: 0, closed: 0 };
          
          // Calculate score from real evaluations if available
          const agentEvaluations = evaluations?.filter(e => {
            const convIds = conversations?.filter(c => c.assigned_user_id === agent.id).map(c => c.id) || [];
            return convIds.includes(e.conversation_id);
          }) || [];

          let score: number;
          if (agentEvaluations.length > 0) {
            const totalScore = agentEvaluations.reduce((sum, e) => sum + (e.overall_score || 0), 0);
            score = Math.round((totalScore / agentEvaluations.length) * 10) / 10;
          } else {
            // Fallback to closed/total ratio
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
        const closedConversations = conversations?.filter(c => 
          c.status === 'closed' || c.status === 'resolved'
        ).length || 0;
        const conversionRate = totalConversations > 0 
          ? Math.round((closedConversations / totalConversations) * 100 * 10) / 10 
          : 0;

        // Use evaluation average if available, otherwise use agent average
        const averageScore = evaluations && evaluations.length > 0
          ? averageScoreFromEvals
          : (agentsAnalysis.length > 0
              ? Math.round(agentsAnalysis.reduce((sum, a) => sum + a.score, 0) / agentsAnalysis.length * 10) / 10
              : 0);

        const classification: CommercialData['classification'] = 
          averageScore >= 9.0 ? 'EXCEPCIONAL' :
          averageScore >= 7.5 ? 'BOM' :
          averageScore >= 6.0 ? 'REGULAR' :
          averageScore >= 4.0 ? 'RUIM' : 'CRÍTICO';

        // Generate insights based on data
        const insights: string[] = [];
        const criticalIssues: string[] = [];
        
        if (criteriaScores.closing < 6) {
          insights.push('Recomendado treinamento em técnicas de fechamento de vendas');
        }
        if (criteriaScores.objection_handling < 6) {
          insights.push('Necessário melhorar tratamento de objeções');
        }
        if (criteriaScores.response_time < 6) {
          criticalIssues.push('Tempo de resposta precisa ser reduzido');
        }
        if (qualifiedLeadsPercent < 30) {
          insights.push('Taxa de leads qualificados abaixo do esperado - revisar processo de qualificação');
        }
        if (conversionRate < 30) {
          insights.push('Taxa de conversão baixa - considerar otimização do funil de vendas');
        }

        // Generate final recommendation
        let finalRecommendation = '';
        if (averageScore >= 8) {
          finalRecommendation = 'Excelente desempenho! Manter as práticas atuais e considerar promoções.';
        } else if (averageScore >= 6) {
          finalRecommendation = 'Bom desempenho com espaço para melhorias. Focar em treinamentos específicos.';
        } else if (averageScore >= 4) {
          finalRecommendation = 'Desempenho regular. Necessário plano de ação com treinamentos e monitoramento.';
        } else {
          finalRecommendation = 'Desempenho crítico! Ação imediata necessária com acompanhamento intensivo.';
        }

        // Positive and negative patterns
        const positivePatterns = allStrengths.slice(0, 3);
        const negativePatterns = allWeaknesses.slice(0, 3);

        setData({
          averageScore,
          classification,
          qualifiedLeadsPercent,
          conversionRate,
          totalConversations,
          totalLeads: totalConversations,
          closedDeals: closedConversations,
          avgResponseTimeMinutes,
          criteriaScores,
          strengths: allStrengths,
          weaknesses: allWeaknesses,
          positivePatterns,
          negativePatterns,
          insights: insights.length > 0 ? insights : ['Avalie conversas para obter insights detalhados'],
          criticalIssues,
          finalRecommendation: finalRecommendation || 'Execute a avaliação de conversas para obter recomendações',
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
  }, [profile?.company_id, isAdmin]);

  return {
    loading,
    data,
    lastUpdated,
    isAdmin,
    evaluating,
    evaluateConversations,
  };
}
