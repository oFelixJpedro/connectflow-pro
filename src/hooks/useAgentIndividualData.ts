import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AgentAlert {
  id: string;
  agent_id: string;
  conversation_id: string;
  contact_id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  message_excerpt?: string;
  message_id?: string;
  ai_confidence: number;
  lead_was_rude: boolean;
  reviewed: boolean;
  detected_at: string;
  contact?: {
    id: string;
    name: string | null;
    phone_number: string;
  };
}

export interface AgentIndividualMetrics {
  totalConversations: number;
  closedDeals: number;
  lostDeals: number;
  conversionRate: number;
  avgResponseTime: number; // in minutes
  avgScore: number;
  criteriaScores: {
    communication: number;
    objectivity: number;
    humanization: number;
    objection_handling: number;
    closing: number;
    response_time: number;
  };
  strengths: string[];
  weaknesses: string[];
  recentPerformance: 'improving' | 'stable' | 'declining';
}

export interface AgentIndividualData {
  metrics: AgentIndividualMetrics;
  alerts: AgentAlert[];
  personalizedRecommendation: string;
}

export function useAgentIndividualData(agentId: string | null) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AgentIndividualData | null>(null);

  useEffect(() => {
    if (!agentId || !profile?.company_id) {
      setData(null);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch agent's conversations
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id, status, created_at, closed_at')
          .eq('company_id', profile.company_id)
          .eq('assigned_user_id', agentId);

        const conversationIds = conversations?.map(c => c.id) || [];

        // Fetch evaluations for this agent's conversations
        const { data: evaluations } = await supabase
          .from('conversation_evaluations')
          .select('*')
          .eq('company_id', profile.company_id)
          .in('conversation_id', conversationIds.length > 0 ? conversationIds : ['00000000-0000-0000-0000-000000000000']);

        // Fetch live metrics for this agent's conversations
        const { data: liveMetrics } = await supabase
          .from('conversation_live_metrics')
          .select('*')
          .eq('company_id', profile.company_id)
          .in('conversation_id', conversationIds.length > 0 ? conversationIds : ['00000000-0000-0000-0000-000000000000']);

        // Fetch messages to calculate response time
        const { data: messages } = await supabase
          .from('messages')
          .select('conversation_id, sender_type, created_at')
          .in('conversation_id', conversationIds.length > 0 ? conversationIds : ['00000000-0000-0000-0000-000000000000'])
          .order('created_at', { ascending: true });

        // Fetch alerts for this agent
        const { data: alerts } = await supabase
          .from('agent_behavior_alerts')
          .select(`
            *,
            contact:contact_id (
              id,
              name,
              phone_number
            )
          `)
          .eq('company_id', profile.company_id)
          .eq('agent_id', agentId)
          .order('detected_at', { ascending: false })
          .limit(20);

        // Calculate metrics
        const totalConversations = conversations?.length || 0;
        const closedDeals = liveMetrics?.filter(m => m.lead_status === 'closed_won').length || 0;
        const lostDeals = liveMetrics?.filter(m => m.lead_status === 'closed_lost').length || 0;
        const conversionRate = totalConversations > 0 ? (closedDeals / totalConversations) * 100 : 0;

        // Calculate avg response time from messages (time between contact message and user response)
        let avgResponseTime = 0;
        if (messages && messages.length > 0) {
          const responseTimes: number[] = [];
          
          // Group messages by conversation
          const messagesByConversation = messages.reduce((acc, msg) => {
            if (!acc[msg.conversation_id]) acc[msg.conversation_id] = [];
            acc[msg.conversation_id].push(msg);
            return acc;
          }, {} as Record<string, typeof messages>);

          // Calculate response times for each conversation
          Object.values(messagesByConversation).forEach(convMessages => {
            for (let i = 0; i < convMessages.length - 1; i++) {
              const current = convMessages[i];
              const next = convMessages[i + 1];
              
              // If contact sent message and user responded
              if (current.sender_type === 'contact' && next.sender_type === 'user') {
                const contactTime = new Date(current.created_at).getTime();
                const userTime = new Date(next.created_at).getTime();
                const diffMinutes = (userTime - contactTime) / (1000 * 60);
                
                // Only count reasonable response times (less than 24 hours)
                if (diffMinutes > 0 && diffMinutes < 1440) {
                  responseTimes.push(diffMinutes);
                }
              }
            }
          });

          if (responseTimes.length > 0) {
            avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
          }
        }

        // Calculate criteria scores from evaluations
        const criteriaScores = {
          communication: 0,
          objectivity: 0,
          humanization: 0,
          objection_handling: 0,
          closing: 0,
          response_time: 0,
        };

        if (evaluations && evaluations.length > 0) {
          criteriaScores.communication = evaluations.reduce((sum, e) => sum + (e.communication_score || 0), 0) / evaluations.length;
          criteriaScores.objectivity = evaluations.reduce((sum, e) => sum + (e.objectivity_score || 0), 0) / evaluations.length;
          criteriaScores.humanization = evaluations.reduce((sum, e) => sum + (e.humanization_score || 0), 0) / evaluations.length;
          criteriaScores.objection_handling = evaluations.reduce((sum, e) => sum + (e.objection_handling_score || 0), 0) / evaluations.length;
          criteriaScores.closing = evaluations.reduce((sum, e) => sum + (e.closing_score || 0), 0) / evaluations.length;
          criteriaScores.response_time = evaluations.reduce((sum, e) => sum + (e.response_time_score || 0), 0) / evaluations.length;
        }

        const avgScore = evaluations && evaluations.length > 0
          ? evaluations.reduce((sum, e) => sum + (e.overall_score || 0), 0) / evaluations.length
          : 0;

        // Aggregate strengths and weaknesses
        const allStrengths = evaluations?.flatMap(e => e.strengths || []) || [];
        const allWeaknesses = evaluations?.flatMap(e => e.improvements || []) || [];
        
        const strengthsCount = allStrengths.reduce((acc, s) => {
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const weaknessesCount = allWeaknesses.reduce((acc, w) => {
          acc[w] = (acc[w] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const topStrengths = Object.entries(strengthsCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([s]) => s);

        const topWeaknesses = Object.entries(weaknessesCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([w]) => w);

        // Generate personalized recommendation based on data
        let recommendation = '';
        const criticalAlerts = alerts?.filter(a => a.severity === 'critical' || a.severity === 'high').length || 0;
        
        if (criticalAlerts > 0) {
          recommendation = `⚠️ Atenção imediata necessária: ${criticalAlerts} alerta(s) crítico(s) detectado(s). Recomenda-se reunião individual para feedback e correção de conduta.`;
        } else if (avgScore < 5) {
          recommendation = `📉 Performance abaixo do esperado. Recomenda-se treinamento focado em: ${topWeaknesses.join(', ') || 'técnicas de venda'}. Acompanhamento semanal sugerido.`;
        } else if (avgScore < 7) {
          recommendation = `📊 Performance estável com espaço para melhoria. Foco em: ${topWeaknesses.slice(0, 2).join(' e ') || 'aprimoramento contínuo'}. Pode assumir mais responsabilidades com supervisão.`;
        } else {
          recommendation = `✅ Excelente performance! Candidato a mentor de novos membros. Destaque em: ${topStrengths.slice(0, 2).join(' e ') || 'atendimento'}. Considerar para promoção.`;
        }

        setData({
          metrics: {
            totalConversations,
            closedDeals,
            lostDeals,
            conversionRate,
            avgResponseTime,
            avgScore,
            criteriaScores,
            strengths: topStrengths,
            weaknesses: topWeaknesses,
            recentPerformance: avgScore >= 7 ? 'improving' : avgScore >= 5 ? 'stable' : 'declining',
          },
          alerts: (alerts || []).map(a => ({
            ...a,
            contact: a.contact as AgentAlert['contact'],
          })) as AgentAlert[],
          personalizedRecommendation: recommendation,
        });
      } catch (error) {
        console.error('Error fetching agent individual data:', error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [agentId, profile?.company_id]);

  return { loading, data };
}
