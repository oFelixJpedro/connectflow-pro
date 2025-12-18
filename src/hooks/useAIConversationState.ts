import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AIConversationState, AIConversationStatus } from '@/types/ai-agents';

interface UseAIConversationStateProps {
  conversationId: string | undefined;
  whatsappConnectionId: string | undefined;
}

interface LinkedAgent {
  id: string;
  name: string;
}

interface UseAIConversationStateReturn {
  state: AIConversationState | null;
  isLoading: boolean;
  error: string | null;
  isActionLoading: boolean;
  hasAgent: boolean;
  agentName: string | null;
  
  // Actions
  startAI: () => Promise<boolean>;
  pauseAI: (durationMinutes: number) => Promise<boolean>;
  stopAI: () => Promise<boolean>;
  restartAI: () => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useAIConversationState({ conversationId, whatsappConnectionId }: UseAIConversationStateProps): UseAIConversationStateReturn {
  const [state, setState] = useState<AIConversationState | null>(null);
  const [linkedAgent, setLinkedAgent] = useState<LinkedAgent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Load linked agent for the connection
  const loadLinkedAgent = useCallback(async () => {
    if (!whatsappConnectionId) {
      setLinkedAgent(null);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('ai_agent_connections')
        .select(`
          agent_id,
          ai_agents!inner (
            id,
            name,
            is_primary
          )
        `)
        .eq('connection_id', whatsappConnectionId);

      if (fetchError) throw fetchError;

      // Find primary agent or first agent
      const primaryAgent = data?.find((item: any) => item.ai_agents?.is_primary);
      const firstAgent = data?.[0];
      const agentData = primaryAgent || firstAgent;

      if (agentData?.ai_agents) {
        setLinkedAgent({
          id: agentData.ai_agents.id,
          name: agentData.ai_agents.name,
        });
      } else {
        setLinkedAgent(null);
      }
    } catch (err) {
      console.error('[useAIConversationState] Error loading linked agent:', err);
      setLinkedAgent(null);
    }
  }, [whatsappConnectionId]);

  // Load conversation state
  const loadState = useCallback(async () => {
    if (!conversationId) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('ai_conversation_states')
        .select('*')
        .eq('conversation_id', conversationId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      setState(data as unknown as AIConversationState | null);
    } catch (err) {
      console.error('[useAIConversationState] Error loading state:', err);
      setError('Erro ao carregar estado da IA');
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  // Load on mount and when props change
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await Promise.all([loadLinkedAgent(), loadState()]);
      setIsLoading(false);
    };
    load();
  }, [loadLinkedAgent, loadState]);

  // Real-time subscription for conversation state
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`ai-state-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_conversation_states',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log('[useAIConversationState] Real-time update:', payload);
          if (payload.eventType === 'DELETE') {
            setState(null);
          } else {
            setState(payload.new as AIConversationState);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Call edge function to perform AI action
  const performAction = async (action: string, extraData?: Record<string, unknown>): Promise<boolean> => {
    if (!conversationId) return false;

    setIsActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await supabase.functions.invoke('conversation-management', {
        body: {
          action,
          conversationId,
          ...extraData,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro na operação');
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Erro desconhecido');
      }

      // Reload state after action
      await loadState();
      return true;
    } catch (err) {
      console.error(`[useAIConversationState] Error on ${action}:`, err);
      setError(err instanceof Error ? err.message : 'Erro na operação');
      return false;
    } finally {
      setIsActionLoading(false);
    }
  };

  const startAI = useCallback(async (): Promise<boolean> => {
    return performAction('ai_start');
  }, [conversationId]);

  const pauseAI = useCallback(async (durationMinutes: number): Promise<boolean> => {
    return performAction('ai_pause', { pauseDurationMinutes: durationMinutes });
  }, [conversationId]);

  const stopAI = useCallback(async (): Promise<boolean> => {
    return performAction('ai_stop');
  }, [conversationId]);

  const restartAI = useCallback(async (): Promise<boolean> => {
    return performAction('ai_restart');
  }, [conversationId]);

  return {
    state,
    isLoading,
    error,
    isActionLoading,
    hasAgent: linkedAgent !== null,
    agentName: linkedAgent?.name ?? null,
    startAI,
    pauseAI,
    stopAI,
    restartAI,
    refetch: loadState,
  };
}
