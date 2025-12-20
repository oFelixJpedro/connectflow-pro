import { useState, useEffect, useMemo } from 'react';
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

  const isAdmin = userRole?.role === 'owner' || userRole?.role === 'admin';

  useEffect(() => {
    if (!profile?.company_id || !isAdmin) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch this week's data from conversations and contacts
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
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

        // Fetch all contacts for geographic data
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select('phone_number')
          .eq('company_id', profile.company_id);

        if (contactsError) throw contactsError;

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

        // Calculate deals by state (closed/resolved conversations)
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

        // Build agent analysis
        const agentsAnalysis: AgentAnalysis[] = agents?.map(agent => {
          const stats = agentStats[agent.id] || { conversations: 0, closed: 0 };
          const score = stats.conversations > 0 
            ? Math.round((stats.closed / stats.conversations) * 10 * 10) / 10 
            : 0;
          
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

        const averageScore = agentsAnalysis.length > 0
          ? Math.round(agentsAnalysis.reduce((sum, a) => sum + a.score, 0) / agentsAnalysis.length * 10) / 10
          : 0;

        const classification: CommercialData['classification'] = 
          averageScore >= 9.0 ? 'EXCEPCIONAL' :
          averageScore >= 7.5 ? 'BOM' :
          averageScore >= 6.0 ? 'REGULAR' :
          averageScore >= 4.0 ? 'RUIM' : 'CRÍTICO';

        // Mock criteria scores (will be replaced by AI evaluation)
        const criteriaScores: CriteriaScores = {
          communication: 7.5,
          objectivity: 7.2,
          humanization: 8.0,
          objection_handling: 6.8,
          closing: 7.0,
          response_time: 7.5,
        };

        setData({
          averageScore,
          classification,
          qualifiedLeadsPercent: 45, // TODO: Calculate from evaluations
          conversionRate,
          totalConversations,
          totalLeads: totalConversations,
          closedDeals: closedConversations,
          avgResponseTimeMinutes: 15, // TODO: Calculate from messages
          criteriaScores,
          strengths: ['Atendimento cordial', 'Resposta rápida', 'Conhecimento do produto'],
          weaknesses: ['Técnica de fechamento', 'Follow-up'],
          positivePatterns: ['Uso adequado de emojis', 'Personalização do atendimento'],
          negativePatterns: ['Demora em horários de pico'],
          insights: ['Considerar treinamento de técnicas de fechamento', 'Implementar automação de follow-up'],
          criticalIssues: [],
          finalRecommendation: 'Manter ritmo atual com foco em treinamento de fechamento',
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
  };
}
