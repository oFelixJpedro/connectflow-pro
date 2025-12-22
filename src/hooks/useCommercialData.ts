import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getStateFromPhone, StateCode } from '@/lib/dddMapping';

// Cache for filtered insights to avoid repeated API calls
interface InsightsCache {
  key: string;
  data: FilteredAIInsights;
  timestamp: number;
}

interface FilteredAIInsights {
  strengths: string[];
  weaknesses: string[];
  positivePatterns: string[];
  negativePatterns: string[];
  insights: string[];
  criticalIssues: string[];
  finalRecommendation: string;
  mediaStats?: {
    total: number;
    problematic: number;
    byType: Record<string, number>;
  };
}

interface MediaSample {
  url: string;
  mimeType: string;
  type: 'image' | 'video' | 'audio' | 'document';
}

interface ConversationWithMedia {
  conversationId: string;
  contactName?: string;
  evaluation: {
    conversation_id: string;
    overall_score: number | null;
    communication_score: number | null;
    objectivity_score: number | null;
    humanization_score: number | null;
    objection_handling_score: number | null;
    closing_score: number | null;
    response_time_score: number | null;
    strengths: string[] | null;
    improvements: string[] | null;
    ai_summary: string | null;
    lead_qualification: string | null;
  };
  medias: MediaSample[];
}

const insightsCache: InsightsCache | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
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
  agent_rankings?: AgentAnalysis[]; // Persisted agent rankings from commercial-pixel
}

export interface CRMStageMapData {
  stageId: string;
  stageName: string;
  stageColor: string;
  countByState: Record<StateCode, number>;
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

const EMPTY_LIVE_METRICS: LiveMetrics = {
  activeConversations: 0,
  hotLeads: 0,
  warmLeads: 0,
  coldLeads: 0,
  todayMessages: 0,
  todayNewConversations: 0,
  todayContractsClosed: 0,
  todayLeadsLost: 0,
  currentAvgResponseTime: 0,
  currentAvgSentiment: 'neutral',
  topObjections: [],
  topPainPoints: [],
};

const EMPTY_COMMERCIAL_DATA: CommercialData = {
  averageScore: 0,
  classification: 'CRÍTICO',
  qualifiedLeadsPercent: 0,
  conversionRate: 0,
  totalConversations: 0,
  totalLeads: 0,
  closedDeals: 0,
  avgResponseTimeMinutes: 0,
  criteriaScores: {
    communication: 0,
    objectivity: 0,
    humanization: 0,
    objection_handling: 0,
    closing: 0,
    response_time: 0,
  },
  strengths: ['Nenhuma conversa encontrada neste filtro'],
  weaknesses: [],
  positivePatterns: [],
  negativePatterns: [],
  insights: ['Selecione outro filtro ou aguarde novas conversas'],
  criticalIssues: [],
  finalRecommendation: 'Sem dados suficientes para análise.',
  agentsAnalysis: [],
  contactsByState: {} as Record<StateCode, number>,
  dealsByState: {} as Record<StateCode, number>,
};

export interface CommercialFilter {
  type: 'general' | 'connection';
  connectionId?: string;
  departmentId?: string; // Sub-filter when connection is selected
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
  const [insightsLoading, setInsightsLoading] = useState(false);
  
  // Async job state
  const [insightsJobId, setInsightsJobId] = useState<string | null>(null);
  const [insightsProgress, setInsightsProgress] = useState(0);
  const [insightsCurrentStep, setInsightsCurrentStep] = useState('');
  
  // Track if filter is active to control realtime behavior
  // Connection filter requires recalculating insights from scratch
  // Date filter with default period should still use aggregated insights from DB
  const hasConnectionFilter = filter?.type === 'connection' && !!filter.connectionId;
  const hasDepartmentFilter = !!filter?.departmentId;
  const hasDateFilter = !!(filter?.startDate && filter?.endDate);
  
  // Detect if the date filter is the default "Esta semana" (current week)
  // If it's the default period, we should use aggregated dashboard data instead of recalculating
  const isDefaultPeriod = useMemo(() => {
    if (!filter?.startDate || !filter?.endDate) return true;
    
    // Use UTC to avoid timezone mismatches with server/database
    const now = new Date();
    
    // Calculate start of current week (Monday) in UTC
    const dayOfWeekUTC = now.getUTCDay();
    const diffToMonday = dayOfWeekUTC === 0 ? -6 : 1 - dayOfWeekUTC; // Monday is first day (ISO week)
    const weekStartUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + diffToMonday
    ));
    
    // Compare only dates (YYYY-MM-DD format) in UTC to avoid timezone issues
    const filterStartISO = filter.startDate.toISOString().split('T')[0];
    const weekStartISO = weekStartUTC.toISOString().split('T')[0];
    
    console.log('📅 [isDefaultPeriod] Comparing:', { filterStartISO, weekStartISO, isDefault: filterStartISO === weekStartISO });
    
    return filterStartISO === weekStartISO;
  }, [filter?.startDate, filter?.endDate]);
  
  // hasActiveFilter: true when user has selected a SPECIFIC filter (not just default period)
  // This controls whether we use aggregated dashboard data or calculate filtered data
  const hasSpecificFilter = hasConnectionFilter || hasDepartmentFilter;
  const hasNonDefaultDateFilter = hasDateFilter && !isDefaultPeriod;
  const hasActiveFilter = hasSpecificFilter || hasNonDefaultDateFilter;
  
  // For insights, only connection/department filter requires recalculation
  const hasActiveFilterForInsights = hasSpecificFilter;
  
  const filterRef = useRef(filter);
  filterRef.current = filter;
  
  // Prevent concurrent calls to fetchCompanyLiveMetrics
  const isFetchingLiveMetricsRef = useRef(false);
  
  // Cache for filtered AI insights
  const insightsCacheRef = useRef<InsightsCache | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isAdmin = userRole?.role === 'owner' || userRole?.role === 'admin';
  
  // Generate cache key based on filter
  const filterCacheKey = useMemo(() => {
    return JSON.stringify({
      connectionId: filter?.connectionId,
      departmentId: filter?.departmentId,
      startDate: filter?.startDate?.toISOString(),
      endDate: filter?.endDate?.toISOString(),
    });
  }, [filter?.connectionId, filter?.departmentId, filter?.startDate, filter?.endDate]);
  
  // Function to fetch AI-generated insights for filtered data with media analysis
  const fetchFilteredInsights = useCallback(async (
    evaluations: Array<{
      conversation_id: string;
      overall_score: number | null;
      communication_score: number | null;
      objectivity_score: number | null;
      humanization_score: number | null;
      objection_handling_score: number | null;
      closing_score: number | null;
      response_time_score: number | null;
      strengths: string[] | null;
      improvements: string[] | null;
      ai_summary: string | null;
      lead_qualification: string | null;
    }>,
    criteriaScores: CriteriaScores,
    filterDescription?: string
  ): Promise<FilteredAIInsights | null> => {
    // Check cache first
    const cached = insightsCacheRef.current;
    if (cached && cached.key === filterCacheKey && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
      console.log('[useCommercialData] Using cached filtered insights');
      return cached.data;
    }
    
    if (evaluations.length === 0) return null;
    
    setInsightsLoading(true);
    
    try {
      // Get conversation IDs from evaluations
      const conversationIds = evaluations.map(e => e.conversation_id);
      
      // Fetch outbound media for these conversations
      const { data: messagesWithMedia } = await supabase
        .from('messages')
        .select('conversation_id, media_url, media_mime_type, message_type')
        .eq('direction', 'outbound')
        .in('conversation_id', conversationIds)
        .not('media_url', 'is', null);
      
      // Get contact names for each conversation
      const { data: conversationsData } = await supabase
        .from('conversations')
        .select('id, contact:contacts(name)')
        .in('id', conversationIds);
      
      const contactNames: Record<string, string> = {};
      conversationsData?.forEach(c => {
        const contact = c.contact as any;
        if (contact?.name) {
          contactNames[c.id] = contact.name;
        }
      });
      
      // Helper to determine media type
      const getMediaType = (mimeType: string, messageType: string): 'image' | 'video' | 'audio' | 'document' => {
        if (messageType === 'image' || mimeType?.startsWith('image/')) return 'image';
        if (messageType === 'video' || mimeType?.startsWith('video/')) return 'video';
        if (messageType === 'audio' || messageType === 'ptt' || mimeType?.startsWith('audio/')) return 'audio';
        return 'document';
      };
      
      // Group media by conversation
      const mediaByConversation: Record<string, MediaSample[]> = {};
      messagesWithMedia?.forEach(msg => {
        if (!mediaByConversation[msg.conversation_id]) {
          mediaByConversation[msg.conversation_id] = [];
        }
        mediaByConversation[msg.conversation_id].push({
          url: msg.media_url!,
          mimeType: msg.media_mime_type || 'application/octet-stream',
          type: getMediaType(msg.media_mime_type || '', msg.message_type || ''),
        });
      });
      
      // Build conversationsWithMedia array (limit to 100 conversations max)
      const conversationsWithMedia: ConversationWithMedia[] = evaluations.slice(0, 100).map(e => ({
        conversationId: e.conversation_id,
        contactName: contactNames[e.conversation_id],
        evaluation: {
          conversation_id: e.conversation_id,
          overall_score: e.overall_score,
          communication_score: e.communication_score,
          objectivity_score: e.objectivity_score,
          humanization_score: e.humanization_score,
          objection_handling_score: e.objection_handling_score,
          closing_score: e.closing_score,
          response_time_score: e.response_time_score,
          strengths: e.strengths,
          improvements: e.improvements,
          ai_summary: e.ai_summary,
          lead_qualification: e.lead_qualification,
        },
        medias: (mediaByConversation[e.conversation_id] || []).slice(0, 10), // Max 10 medias per conversation
      }));
      
      const totalMedias = conversationsWithMedia.reduce((sum, c) => sum + c.medias.length, 0);
      console.log(`[useCommercialData] Sending ${conversationsWithMedia.length} conversations with ${totalMedias} medias to AI`);
      
      const { data: result, error } = await supabase.functions.invoke('generate-filtered-insights', {
        body: {
          conversationsWithMedia,
          criteriaScores,
          filterDescription,
        },
      });
      
      if (error) {
        console.error('[useCommercialData] Error fetching filtered insights:', error);
        return null;
      }
      
      if (result && !result.error) {
        const insights: FilteredAIInsights = {
          strengths: result.strengths || [],
          weaknesses: result.weaknesses || [],
          positivePatterns: result.positivePatterns || [],
          negativePatterns: result.negativePatterns || [],
          insights: result.insights || [],
          criticalIssues: result.criticalIssues || [],
          finalRecommendation: result.finalRecommendation || '',
          mediaStats: result.mediaStats,
        };
        
        // Update cache
        insightsCacheRef.current = {
          key: filterCacheKey,
          data: insights,
          timestamp: Date.now(),
        };
        
        console.log(`[useCommercialData] AI insights received with mediaStats:`, result.mediaStats);
        
        return insights;
      }
      
      return null;
    } catch (error) {
      console.error('[useCommercialData] Error calling generate-filtered-insights:', error);
      return null;
    } finally {
      setInsightsLoading(false);
    }
  }, [filterCacheKey]);

  // Async job polling function
  const pollJobStatus = useCallback(async (jobId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    const poll = async () => {
      try {
        const { data: statusData, error } = await supabase.functions.invoke('get-insights-job-status', {
          body: { jobId }
        });
        
        if (error) {
          console.error('[useCommercialData] Error polling job status:', error);
          return;
        }
        
        setInsightsProgress(statusData?.progress || 0);
        setInsightsCurrentStep(statusData?.currentStep || 'Processando...');
        
        if (statusData?.status === 'completed') {
          // Job completed - update data with result
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          const result = statusData.result;
          if (result) {
            setData(prevData => prevData ? {
              ...prevData,
              strengths: result.strengths?.length > 0 ? result.strengths : prevData.strengths,
              weaknesses: result.weaknesses?.length > 0 ? result.weaknesses : prevData.weaknesses,
              positivePatterns: result.positivePatterns || prevData.positivePatterns,
              negativePatterns: result.negativePatterns || prevData.negativePatterns,
              insights: result.insights?.length > 0 ? result.insights : prevData.insights,
              criticalIssues: result.criticalIssues || prevData.criticalIssues,
              finalRecommendation: result.finalRecommendation || prevData.finalRecommendation,
            } : prevData);
            
            // Update cache
            insightsCacheRef.current = {
              key: filterCacheKey,
              data: result,
              timestamp: Date.now(),
            };
          }
          
          setInsightsLoading(false);
          setInsightsJobId(null);
          setInsightsProgress(100);
          setInsightsCurrentStep('Concluído');
          console.log('[useCommercialData] Async job completed');
          return;
        }
        
        if (statusData?.status === 'failed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setInsightsLoading(false);
          setInsightsJobId(null);
          setInsightsProgress(0);
          setInsightsCurrentStep('Erro no processamento');
          console.error('[useCommercialData] Async job failed:', statusData.error);
          return;
        }
        
        // Still processing - continue polling
      } catch (err) {
        console.error('[useCommercialData] Polling error:', err);
      }
    };
    
    // Initial poll
    await poll();
    
    // Set up interval for continued polling
    pollingIntervalRef.current = setInterval(poll, 2000);
  }, [filterCacheKey]);

  // Start async insights job
  const startInsightsJob = useCallback(async (
    evaluations: any[],
    criteriaScores: CriteriaScores,
    filterDescription: string,
    conversationIds: string[]
  ) => {
    setInsightsLoading(true);
    setInsightsProgress(0);
    setInsightsCurrentStep('Iniciando análise...');
    
    try {
      const { data: result, error } = await supabase.functions.invoke('queue-insights-job', {
        body: {
          filters: {
            connectionId: filter?.connectionId,
            departmentId: filter?.departmentId,
            startDate: filter?.startDate?.toISOString(),
            endDate: filter?.endDate?.toISOString(),
          },
          conversationIds,
          evaluations,
          criteriaScores,
          filterDescription,
        },
      });
      
      if (error || !result?.jobId) {
        console.error('[useCommercialData] Error starting insights job:', error);
        setInsightsLoading(false);
        // Fallback to sync processing
        return null;
      }
      
      setInsightsJobId(result.jobId);
      console.log('[useCommercialData] Async job started:', result.jobId);
      
      // Start polling
      pollJobStatus(result.jobId);
      
      return result.jobId;
    } catch (err) {
      console.error('[useCommercialData] Error starting job:', err);
      setInsightsLoading(false);
      return null;
    }
  }, [filter, pollJobStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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

  // Calculate live metrics from conversation_live_metrics for filtered data
  const calculateFilteredLiveMetrics = async (conversationIds: string[]): Promise<LiveMetrics> => {
    if (!profile?.company_id || conversationIds.length === 0) {
      return EMPTY_LIVE_METRICS;
    }

    try {
      // Fetch conversation_live_metrics for filtered conversations
      const { data: metrics } = await supabase
        .from('conversation_live_metrics')
        .select('*')
        .in('conversation_id', conversationIds);

      if (!metrics || metrics.length === 0) {
        return EMPTY_LIVE_METRICS;
      }

      // Count lead statuses
      const hotLeads = metrics.filter(m => m.lead_status === 'hot').length;
      const warmLeads = metrics.filter(m => m.lead_status === 'warm').length;
      const coldLeads = metrics.filter(m => m.lead_status === 'cold').length;
      const closedWon = metrics.filter(m => m.lead_status === 'closed_won').length;
      const closedLost = metrics.filter(m => m.lead_status === 'closed_lost').length;

      // Calculate average response time
      const responseTimes = metrics
        .filter(m => m.avg_response_time_seconds && m.avg_response_time_seconds > 0)
        .map(m => m.avg_response_time_seconds!);
      const avgResponseTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 60) // Convert to minutes
        : 0;

      // Get most common sentiment
      const sentimentCounts: Record<string, number> = {};
      metrics.forEach(m => {
        const sentiment = m.current_sentiment || 'neutral';
        sentimentCounts[sentiment] = (sentimentCounts[sentiment] || 0) + 1;
      });
      const avgSentiment = Object.entries(sentimentCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

      // Aggregate objections and pain points
      const allObjections: string[] = [];
      const allPainPoints: string[] = [];
      metrics.forEach(m => {
        if (m.objections_detected) allObjections.push(...m.objections_detected);
        if (m.pain_points) allPainPoints.push(...m.pain_points);
      });

      // Get top 5 most common
      const getTop5 = (arr: string[]) => {
        const counts: Record<string, number> = {};
        arr.forEach(item => { counts[item] = (counts[item] || 0) + 1; });
        return Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([item]) => item);
      };

      // Count today's data from filtered conversations
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const { data: todayConvs } = await supabase
        .from('conversations')
        .select('id, created_at, status')
        .in('id', conversationIds)
        .gte('created_at', todayISO);

      const { count: todayMessagesCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', conversationIds)
        .gte('created_at', todayISO);

      return {
        activeConversations: metrics.filter(m => 
          m.lead_status && !['closed_won', 'closed_lost'].includes(m.lead_status)
        ).length,
        hotLeads,
        warmLeads,
        coldLeads,
        todayMessages: todayMessagesCount || 0,
        todayNewConversations: todayConvs?.length || 0,
        todayContractsClosed: closedWon,
        todayLeadsLost: closedLost,
        currentAvgResponseTime: avgResponseTime,
        currentAvgSentiment: avgSentiment,
        topObjections: getTop5(allObjections),
        topPainPoints: getTop5(allPainPoints),
      };
    } catch (error) {
      console.error('Error calculating filtered live metrics:', error);
      return EMPTY_LIVE_METRICS;
    }
  };

  // Fetch live metrics from company_live_dashboard (for general/unfiltered view)
  const fetchCompanyLiveMetrics = useCallback(async () => {
    if (!profile?.company_id || !isAdmin || isFetchingLiveMetricsRef.current) return;
    
    isFetchingLiveMetricsRef.current = true;

    try {
      const { data: dashboard } = await supabase
        .from('company_live_dashboard')
        .select('*')
        .eq('company_id', profile.company_id)
        .maybeSingle();

      // Calculate today's metrics dynamically (since company_live_dashboard may not be updated)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // Fetch today's new conversations
      const { count: todayNewConversations } = await supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', profile.company_id)
        .gte('created_at', todayISO);

      // Fetch closed deals and lost leads from conversation_live_metrics
      const { data: todayMetrics } = await supabase
        .from('conversation_live_metrics')
        .select('lead_status, updated_at')
        .eq('company_id', profile.company_id)
        .in('lead_status', ['closed_won', 'closed_lost'])
        .gte('updated_at', todayISO);

      const todayContractsClosed = todayMetrics?.filter(m => m.lead_status === 'closed_won').length || 0;
      const todayLeadsLost = todayMetrics?.filter(m => m.lead_status === 'closed_lost').length || 0;

      if (dashboard) {
        setLiveMetrics({
          activeConversations: dashboard.active_conversations || 0,
          hotLeads: dashboard.hot_leads || 0,
          warmLeads: dashboard.warm_leads || 0,
          coldLeads: dashboard.cold_leads || 0,
          todayMessages: dashboard.today_messages || 0,
          todayNewConversations: todayNewConversations || dashboard.today_new_conversations || 0,
          todayContractsClosed: todayContractsClosed || dashboard.today_contracts_closed || 0,
          todayLeadsLost: todayLeadsLost || dashboard.today_leads_lost || 0,
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
      } else {
        // No dashboard data, set with calculated values
        setLiveMetrics({
          ...EMPTY_LIVE_METRICS,
          todayNewConversations: todayNewConversations || 0,
          todayContractsClosed,
          todayLeadsLost,
        });
      }
    } catch (error) {
      console.error('Error fetching live metrics:', error);
    } finally {
      isFetchingLiveMetricsRef.current = false;
    }
  }, [profile?.company_id, isAdmin]);

  // Set up realtime subscription for live updates (only when no filter active)
  useEffect(() => {
    if (!profile?.company_id || !isAdmin) return;

    // Fetch company-wide metrics when no specific filter is active
    // Default period (Esta semana) should still use aggregated dashboard data
    if (!hasActiveFilter) {
      console.log('📊 Fetching company-wide live metrics (no active filter or default period)');
      fetchCompanyLiveMetrics();
    }

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
          // Only update from realtime if no SPECIFIC filter is active
          // Default period should still receive realtime updates
          const hasConnFilter = filterRef.current?.type === 'connection' && filterRef.current?.connectionId;
          const hasDeptFilter = !!filterRef.current?.departmentId;
          
          // Specific filter = connection or department (NOT just default date period)
          if (hasConnFilter || hasDeptFilter) {
            console.log('📊 [REALTIME] Ignoring dashboard update - specific filter active');
            return;
          }

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
  }, [profile?.company_id, isAdmin, fetchCompanyLiveMetrics, hasActiveFilter]);

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
          // Apply department as sub-filter if present
          if (filter.departmentId) {
            conversationsQuery = conversationsQuery.eq('department_id', filter.departmentId);
          }
        }

        const { data: conversations, error: convError } = await conversationsQuery;

        if (convError) throw convError;

        // Extract conversation IDs for filtering related data
        const conversationIds = conversations?.map(c => c.id) || [];
        
        console.log('📊 Conversations found:', conversationIds.length, 'hasActiveFilter:', hasActiveFilter, 'isDefaultPeriod:', isDefaultPeriod);
        
        // Check if we have rich aggregated insights from dashboard
        const hasRichAggregatedInsights = aggregatedInsights.strengths?.length > 0 || 
                                          aggregatedInsights.final_recommendation?.length > 0;
        
        // EARLY RETURN: Only return empty data if:
        // 1. A SPECIFIC filter is active (connection/department or non-default date)
        // 2. No conversations found
        // 3. No rich aggregated insights available as fallback
        if (hasActiveFilter && conversationIds.length === 0 && !hasRichAggregatedInsights) {
          console.log('📊 No conversations found for active filter and no aggregated insights - returning empty data');
          setData(EMPTY_COMMERCIAL_DATA);
          setLiveMetrics(EMPTY_LIVE_METRICS);
          setAggregatedInsights(DEFAULT_INSIGHTS);
          setLastUpdated(new Date());
          setLoading(false);
          return;
        }

        // Calculate filtered live metrics only when a SPECIFIC filter is active
        // Default period should use the company-wide metrics from dashboard
        if (hasActiveFilter && conversationIds.length > 0) {
          console.log('📊 Calculating filtered live metrics for', conversationIds.length, 'conversations');
          const filteredMetrics = await calculateFilteredLiveMetrics(conversationIds);
          setLiveMetrics(filteredMetrics);
        } else if (hasActiveFilter && conversationIds.length === 0) {
          // No conversations in filter range - show empty metrics only for specific filters
          setLiveMetrics(EMPTY_LIVE_METRICS);
        }
        // NOTE: When no active filter (including default period), live metrics are fetched 
        // by the dedicated useEffect that handles realtime subscription

        // Extract contact IDs from filtered conversations
        const contactPhones = conversations?.map(c => (c.contact as any)?.phone_number).filter(Boolean) || [];

        // Fetch contacts for geographic data - filtered by conversations when connection filter is active
        let contactsQuery = supabase
          .from('contacts')
          .select('phone_number')
          .eq('company_id', profile.company_id);

        // If filtering by connection, only get contacts from filtered conversations
        if (hasActiveFilter && contactPhones.length > 0) {
          contactsQuery = contactsQuery.in('phone_number', contactPhones);
        }

        const { data: contacts, error: contactsError } = await contactsQuery;

        if (contactsError) throw contactsError;

        // Fetch live metrics for closed deals - filtered by conversations when needed
        let liveMetricsQuery = supabase
          .from('conversation_live_metrics')
          .select('lead_status, conversation_id')
          .eq('company_id', profile.company_id);

        // If filtering by connection, only get metrics from filtered conversations
        if (hasActiveFilter && conversationIds.length > 0) {
          liveMetricsQuery = liveMetricsQuery.in('conversation_id', conversationIds);
        }

        const { data: liveMetricsData } = await liveMetricsQuery;

        // Count closed deals from live metrics (AI-detected or Kanban confirmed)
        const closedDealsFromAI = liveMetricsData?.filter(
          m => m.lead_status === 'closed_won'
        ).length || 0;

        // Fetch messages to calculate real response time
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

        // Fetch evaluations for agent scoring - filtered by period and connection
        let evaluationsQuery = supabase
          .from('conversation_evaluations')
          .select('*')
          .eq('company_id', profile.company_id);

        // Apply period filter
        if (startDate && endDate) {
          evaluationsQuery = evaluationsQuery
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());
        }

        // If filtering by connection, only get evaluations from filtered conversations
        if (hasActiveFilter && conversationIds.length > 0) {
          evaluationsQuery = evaluationsQuery.in('conversation_id', conversationIds);
        }

        const { data: evaluations } = await evaluationsQuery;

        // Build agent analysis with real evaluation data
        // Priority: 1) Calculate from current data if filter active, 2) Use persisted rankings from DB if available and no filter, 3) Calculate fresh
        let agentsAnalysis: AgentAnalysis[];
        
        const hasPersistedRankings = aggregatedInsights.agent_rankings && aggregatedInsights.agent_rankings.length > 0;
        const shouldUsePersistedRankings = !hasActiveFilter && hasPersistedRankings;
        
        if (shouldUsePersistedRankings) {
          // Use persisted rankings from aggregated_insights (updated by commercial-pixel)
          console.log('📊 [useCommercialData] Using persisted agent_rankings from DB:', aggregatedInsights.agent_rankings!.length, 'agents');
          agentsAnalysis = aggregatedInsights.agent_rankings!;
        } else {
          // Calculate fresh from conversations and evaluations
          console.log('📊 [useCommercialData] Calculating agent rankings from conversations/evaluations');
          agentsAnalysis = agents?.map(agent => {
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
        }
        
        console.log('📊 [useCommercialData] Final agentsAnalysis:', agentsAnalysis.length, 'agents');

        // Calculate overall metrics
        const totalConversations = conversations?.length || 0;
        const conversionRate = totalConversations > 0 
          ? Math.round((closedDealsFromAI / totalConversations) * 100 * 10) / 10 
          : 0;

        // Use aggregated insights from realtime if available and no CONNECTION filter active
        // Date filter alone should still use aggregated insights from DB
        // Check for rich insights content, not just average_score (which may be 0 initially)
        const hasRichInsights = (aggregatedInsights.strengths?.length > 0) || 
                                (aggregatedInsights.final_recommendation?.length > 0);
        const useAggregatedInsights = !hasActiveFilterForInsights && hasRichInsights;
        
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
          // Calculate from evaluations if filter active or no aggregated insights yet
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

          // When filter is active, we'll fetch AI insights in a separate call
          // For now, set placeholder values that will be replaced by AI
          if (hasActiveFilter) {
            // Build filter description for AI context
            let filterDesc = '';
            if (filter?.connectionId) {
              filterDesc += 'Conexão específica selecionada. ';
            }
            if (filter?.departmentId) {
              filterDesc += 'Departamento específico. ';
            }
            if (filter?.startDate && filter?.endDate) {
              filterDesc += `Período: ${filter.startDate.toLocaleDateString('pt-BR')} a ${filter.endDate.toLocaleDateString('pt-BR')}`;
            }
            
            // Determine if we should use async processing
            // Use async for large datasets: >100 conversations or >5 agents with conversations
            const agentsWithConversations = agentsAnalysis.filter(a => a.conversations > 0).length;
            const shouldUseAsync = conversationIds.length > 100 || agentsWithConversations > 5;
            
            // Call AI for filtered insights (debounced)
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }
            
            debounceTimerRef.current = setTimeout(async () => {
              const evaluationsData = evaluations.map(e => ({
                conversation_id: e.conversation_id,
                overall_score: e.overall_score,
                communication_score: e.communication_score,
                objectivity_score: e.objectivity_score,
                humanization_score: e.humanization_score,
                objection_handling_score: e.objection_handling_score,
                closing_score: e.closing_score,
                response_time_score: e.response_time_score,
                strengths: e.strengths as string[] | null,
                improvements: e.improvements as string[] | null,
                ai_summary: e.ai_summary,
                lead_qualification: e.lead_qualification,
              }));
              
              if (shouldUseAsync) {
                // Use async processing for large datasets
                console.log(`[useCommercialData] Using async processing for ${conversationIds.length} conversations, ${agentsWithConversations} agents`);
                await startInsightsJob(
                  evaluationsData,
                  criteriaScores,
                  filterDesc,
                  conversationIds
                );
              } else {
                // Use sync processing for small datasets
                const aiInsights = await fetchFilteredInsights(
                  evaluationsData,
                  criteriaScores,
                  filterDesc
                );
                
                if (aiInsights) {
                  // Update data with AI-generated insights
                  setData(prevData => prevData ? {
                    ...prevData,
                    strengths: aiInsights.strengths.length > 0 ? aiInsights.strengths : prevData.strengths,
                    weaknesses: aiInsights.weaknesses.length > 0 ? aiInsights.weaknesses : prevData.weaknesses,
                    positivePatterns: aiInsights.positivePatterns,
                    negativePatterns: aiInsights.negativePatterns,
                    insights: aiInsights.insights.length > 0 ? aiInsights.insights : prevData.insights,
                    criticalIssues: aiInsights.criticalIssues,
                    finalRecommendation: aiInsights.finalRecommendation || prevData.finalRecommendation,
                  } : prevData);
                }
              }
            }, 500); // 500ms debounce
            
            // Set initial placeholder values while AI processes
            positivePatterns = [];
            negativePatterns = [];
            insights = ['Gerando análise de IA para dados filtrados...'];
            criticalIssues = [];
            finalRecommendation = 'Analisando conversas filtradas...';
          } else {
            // Not filtered - use basic local calculations
            insights = [];
            criticalIssues = [];
            
            if (criteriaScores.closing < 6) {
              insights.push('Aguardando análise de IA para insights detalhados de fechamento');
            }
            if (criteriaScores.response_time < 6) {
              criticalIssues.push('Tempo de resposta precisa ser analisado pela IA');
            }
            
            finalRecommendation = 'Aguardando análise de IA para recomendação personalizada...';
          }
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
          allStrengths = hasActiveFilter 
            ? ['Nenhuma avaliação encontrada neste filtro'] 
            : ['Aguardando conversas para análise'];
          allWeaknesses = ['Dados insuficientes'];
          positivePatterns = [];
          negativePatterns = [];
          insights = hasActiveFilter 
            ? ['Selecione outro filtro ou aguarde novas conversas avaliadas']
            : ['Envie mensagens para a IA começar a gerar insights automáticos'];
          criticalIssues = [];
          finalRecommendation = hasActiveFilter
            ? 'Sem avaliações para este filtro.'
            : 'A IA irá gerar recomendações automaticamente conforme as conversas acontecem.';
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
  }, [profile?.company_id, isAdmin, aggregatedInsights, filter?.type, filter?.connectionId, filter?.departmentId, filter?.startDate, filter?.endDate, hasActiveFilter, fetchCompanyLiveMetrics, fetchFilteredInsights, startInsightsJob]);

  return {
    loading,
    data,
    liveMetrics,
    aggregatedInsights,
    lastUpdated,
    isAdmin,
    evaluating,
    evaluateConversations,
    insightsLoading,
    insightsProgress,
    insightsCurrentStep,
    insightsJobId,
  };
}
