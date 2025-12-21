import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MediaSample {
  url: string;
  mimeType: string;
  type: 'image' | 'video' | 'audio' | 'document';
  direction: 'inbound' | 'outbound';
  messageContent?: string;
  conversationId?: string;
}

export interface ConversationWithMedia {
  conversationId: string;
  contactName?: string;
  medias: MediaSample[];
  evaluationScore?: number;
}

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
  hasMoreAlerts: boolean;
  totalAlerts: number;
}

const ALERTS_PER_PAGE = 20;

export function useAgentIndividualData(agentId: string | null, agentName?: string, agentLevel?: 'junior' | 'pleno' | 'senior') {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [data, setData] = useState<AgentIndividualData | null>(null);
  const [alertsOffset, setAlertsOffset] = useState(0);

  const fetchAlerts = useCallback(async (offset: number, existingAlerts: AgentAlert[] = []) => {
    if (!agentId || !profile?.company_id) return { alerts: existingAlerts, hasMore: false, total: 0 };

    // First get total count
    const { count: totalCount } = await supabase
      .from('agent_behavior_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', profile.company_id)
      .eq('agent_id', agentId);

    // Then fetch paginated data
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
      .range(offset, offset + ALERTS_PER_PAGE - 1);

    const newAlerts = (alerts || []).map(a => ({
      ...a,
      contact: a.contact as AgentAlert['contact'],
    })) as AgentAlert[];

    const allAlerts = offset === 0 ? newAlerts : [...existingAlerts, ...newAlerts];
    const hasMore = allAlerts.length < (totalCount || 0);

    return { alerts: allAlerts, hasMore, total: totalCount || 0 };
  }, [agentId, profile?.company_id]);

  const loadMoreAlerts = useCallback(async () => {
    if (!data || loadingMore || !data.hasMoreAlerts) return;
    
    setLoadingMore(true);
    try {
      const newOffset = alertsOffset + ALERTS_PER_PAGE;
      const { alerts, hasMore, total } = await fetchAlerts(newOffset, data.alerts);
      
      setAlertsOffset(newOffset);
      setData(prev => prev ? {
        ...prev,
        alerts,
        hasMoreAlerts: hasMore,
        totalAlerts: total,
      } : null);
    } finally {
      setLoadingMore(false);
    }
  }, [data, loadingMore, alertsOffset, fetchAlerts]);

  // Function to generate AI recommendation with modular batch processing
  const generateAIRecommendation = useCallback(async (
    name: string,
    level: 'junior' | 'pleno' | 'senior',
    metrics: AgentIndividualMetrics,
    alerts: AgentAlert[],
    totalAlerts: number,
    conversationsWithMedia: ConversationWithMedia[] = []
  ): Promise<string> => {
    try {
      console.log('[useAgentIndividualData] Generating recommendation with', conversationsWithMedia.length, 'conversations');
      
      const criticalAlertsCount = alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length;
      const alertTypes = [...new Set(alerts.map(a => a.alert_type))];

      const { data: responseData, error } = await supabase.functions.invoke('generate-agent-recommendation', {
        body: {
          agentName: name,
          level,
          overallScore: metrics.avgScore,
          criteriaScores: metrics.criteriaScores,
          conversionRate: metrics.conversionRate,
          totalConversations: metrics.totalConversations,
          closedDeals: metrics.closedDeals,
          lostDeals: metrics.lostDeals,
          avgResponseTime: metrics.avgResponseTime,
          strengths: metrics.strengths,
          weaknesses: metrics.weaknesses,
          alertsCount: totalAlerts,
          criticalAlertsCount,
          alertTypes,
          recentPerformance: metrics.recentPerformance,
          // Nova estrutura: conversas com suas mídias agrupadas
          conversationsWithMedia,
        },
      });

      if (error) {
        console.error('Error generating AI recommendation:', error);
        throw error;
      }

      console.log('[useAgentIndividualData] Recommendation response:', {
        hasRecommendation: !!responseData?.recommendation,
        mediaAnalyzed: responseData?.mediaAnalyzed,
        batchesProcessed: responseData?.batchResults?.length,
      });

      return responseData?.recommendation || '';
    } catch (error) {
      console.error('Failed to generate AI recommendation:', error);
      // Return a fallback recommendation
      return generateFallbackRecommendation(metrics, totalAlerts);
    }
  }, []);

  // Fallback recommendation if AI fails
  const generateFallbackRecommendation = (metrics: AgentIndividualMetrics, totalAlerts: number): string => {
    const criticalAlerts = totalAlerts;
    const avgScore = metrics.avgScore;
    const topWeaknesses = metrics.weaknesses;
    const topStrengths = metrics.strengths;

    if (criticalAlerts > 5) {
      return `⚠️ Atenção imediata necessária: ${criticalAlerts} alerta(s) detectado(s). Recomenda-se reunião individual para feedback e correção de conduta.`;
    } else if (avgScore < 5) {
      return `📉 Performance abaixo do esperado. Recomenda-se treinamento focado em: ${topWeaknesses.join(', ') || 'técnicas de venda'}. Acompanhamento semanal sugerido.`;
    } else if (avgScore < 7) {
      return `📊 Performance estável com espaço para melhoria. Foco em: ${topWeaknesses.slice(0, 2).join(' e ') || 'aprimoramento contínuo'}. Pode assumir mais responsabilidades com supervisão.`;
    } else {
      return `✅ Excelente performance! Candidato a mentor de novos membros. Destaque em: ${topStrengths.slice(0, 2).join(' e ') || 'atendimento'}. Considerar para promoção.`;
    }
  };

  useEffect(() => {
    if (!agentId || !profile?.company_id) {
      setData(null);
      setLoading(false);
      setAlertsOffset(0);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setAlertsOffset(0);
      
      try {
        // Fetch agent's conversations
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id, status, created_at, closed_at, contact:contact_id(id, name)')
          .eq('company_id', profile.company_id)
          .eq('assigned_user_id', agentId);

        const conversationIds = conversations?.map(c => c.id) || [];

        // Fetch evaluations for this agent's conversations
        const { data: evaluations } = await supabase
          .from('conversation_evaluations')
          .select('*')
          .eq('company_id', profile.company_id)
          .in('conversation_id', conversationIds.length > 0 ? conversationIds : ['00000000-0000-0000-0000-000000000000']);

        // Create a map of conversation scores
        const evaluationScoreMap = new Map<string, number>();
        evaluations?.forEach(e => {
          if (e.overall_score) {
            evaluationScoreMap.set(e.conversation_id, e.overall_score);
          }
        });

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

        // Fetch ALL outbound media from agent's conversations (no limit!)
        const { data: mediaMessages } = await supabase
          .from('messages')
          .select('media_url, media_mime_type, message_type, direction, content, conversation_id')
          .in('conversation_id', conversationIds.length > 0 ? conversationIds : ['00000000-0000-0000-0000-000000000000'])
          .eq('direction', 'outbound')
          .not('media_url', 'is', null)
          .order('created_at', { ascending: false });

        console.log('[useAgentIndividualData] Total media messages fetched:', mediaMessages?.length || 0);

        // Group media by conversation for the new architecture
        const mediaByConversation = new Map<string, MediaSample[]>();
        
        (mediaMessages || []).forEach(m => {
          if (!m.media_url || !m.conversation_id) return;
          
          let type: MediaSample['type'] = 'image';
          const messageType = m.message_type as string;
          if (messageType === 'image') type = 'image';
          else if (messageType === 'document') type = 'document';
          else if (messageType === 'video' || m.media_mime_type?.startsWith('video/')) type = 'video';
          else if (messageType === 'audio' || messageType === 'ptt' || m.media_mime_type?.startsWith('audio/')) type = 'audio';
          
          const media: MediaSample = {
            url: m.media_url,
            mimeType: m.media_mime_type || 'application/octet-stream',
            type,
            direction: m.direction as 'inbound' | 'outbound',
            messageContent: m.content || undefined,
            conversationId: m.conversation_id,
          };

          if (!mediaByConversation.has(m.conversation_id)) {
            mediaByConversation.set(m.conversation_id, []);
          }
          mediaByConversation.get(m.conversation_id)!.push(media);
        });

        // Build ConversationWithMedia array
        const conversationsWithMedia: ConversationWithMedia[] = Array.from(mediaByConversation.entries())
          .map(([convId, medias]) => {
            const conv = conversations?.find(c => c.id === convId);
            const contactData = conv?.contact as { id: string; name: string | null } | null;
            
            return {
              conversationId: convId,
              contactName: contactData?.name || undefined,
              medias,
              evaluationScore: evaluationScoreMap.get(convId),
            };
          })
          .filter(c => c.medias.length > 0);

        console.log('[useAgentIndividualData] Conversations with media:', conversationsWithMedia.length);
        console.log('[useAgentIndividualData] Total media count:', conversationsWithMedia.reduce((sum, c) => sum + c.medias.length, 0));

        // Fetch first page of alerts
        const { alerts, hasMore, total } = await fetchAlerts(0);

        // Calculate metrics
        const totalConversations = conversations?.length || 0;
        const closedDeals = liveMetrics?.filter(m => m.lead_status === 'closed_won').length || 0;
        const lostDeals = liveMetrics?.filter(m => m.lead_status === 'closed_lost').length || 0;
        const conversionRate = totalConversations > 0 ? (closedDeals / totalConversations) * 100 : 0;

        // Calculate avg response time from messages
        let avgResponseTime = 0;
        if (messages && messages.length > 0) {
          const responseTimes: number[] = [];
          
          const messagesByConversation = messages.reduce((acc, msg) => {
            if (!acc[msg.conversation_id]) acc[msg.conversation_id] = [];
            acc[msg.conversation_id].push(msg);
            return acc;
          }, {} as Record<string, typeof messages>);

          Object.values(messagesByConversation).forEach(convMessages => {
            for (let i = 0; i < convMessages.length - 1; i++) {
              const current = convMessages[i];
              const next = convMessages[i + 1];
              
              if (current.sender_type === 'contact' && next.sender_type === 'user') {
                const contactTime = new Date(current.created_at).getTime();
                const userTime = new Date(next.created_at).getTime();
                const diffMinutes = (userTime - contactTime) / (1000 * 60);
                
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

        const recentPerformance = avgScore >= 7 ? 'improving' : avgScore >= 5 ? 'stable' : 'declining';

        const metrics: AgentIndividualMetrics = {
          totalConversations,
          closedDeals,
          lostDeals,
          conversionRate,
          avgResponseTime,
          avgScore,
          criteriaScores,
          strengths: topStrengths,
          weaknesses: topWeaknesses,
          recentPerformance,
        };

        // Set initial data with placeholder recommendation
        setData({
          metrics,
          alerts,
          personalizedRecommendation: '',
          hasMoreAlerts: hasMore,
          totalAlerts: total,
        });
        setLoading(false);

        // Generate AI recommendation with the new modular architecture
        if (agentName && agentLevel) {
          setRecommendationLoading(true);
          try {
            const aiRecommendation = await generateAIRecommendation(
              agentName,
              agentLevel,
              metrics,
              alerts,
              total,
              conversationsWithMedia // Send conversations with their media grouped
            );
            
            setData(prev => prev ? {
              ...prev,
              personalizedRecommendation: aiRecommendation,
            } : null);
          } finally {
            setRecommendationLoading(false);
          }
        } else {
          const fallbackRec = generateFallbackRecommendation(metrics, total);
          setData(prev => prev ? {
            ...prev,
            personalizedRecommendation: fallbackRec,
          } : null);
        }

      } catch (error) {
        console.error('Error fetching agent individual data:', error);
        setData(null);
        setLoading(false);
      }
    };

    fetchData();
  }, [agentId, profile?.company_id, agentName, agentLevel, fetchAlerts, generateAIRecommendation]);

  return { loading, loadingMore, recommendationLoading, data, loadMoreAlerts };
}
