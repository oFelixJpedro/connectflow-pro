import { supabase } from "@/integrations/supabase/client";

export type ConversationEventType = 
  | 'created'
  | 'assigned'
  | 'transferred'
  | 'department_changed'
  | 'status_changed'
  | 'tag_added'
  | 'tag_removed'
  | 'connection_changed'
  | 'priority_changed'
  | 'resolved'
  | 'reopened'
  | 'closed';

export interface ConversationHistoryEntry {
  id: string;
  conversation_id: string;
  event_type: ConversationEventType;
  event_data: Record<string, unknown>;
  performed_by: string | null;
  performed_by_name: string | null;
  is_automatic: boolean;
  created_at: string;
}

interface LogEventParams {
  conversationId: string;
  eventType: ConversationEventType;
  eventData: Record<string, unknown>;
  performedBy?: string | null;
  performedByName?: string | null;
  isAutomatic?: boolean;
}

export const logConversationEvent = async ({
  conversationId,
  eventType,
  eventData,
  performedBy = null,
  performedByName = null,
  isAutomatic = false
}: LogEventParams): Promise<boolean> => {
  try {
    // Use raw insert since types may not be updated yet
    const { error } = await supabase
      .from('conversation_history' as any)
      .insert({
        conversation_id: conversationId,
        event_type: eventType,
        event_data: eventData,
        performed_by: performedBy,
        performed_by_name: performedByName || 'Sistema',
        is_automatic: isAutomatic
      });

    if (error) {
      console.error('Erro ao registrar histórico de conversa:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Erro ao registrar histórico de conversa:', err);
    return false;
  }
};

export const fetchConversationHistory = async (
  conversationId: string
): Promise<ConversationHistoryEntry[]> => {
  try {
    // Use raw query since types may not be updated yet
    const { data, error } = await supabase
      .from('conversation_history' as any)
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar histórico de conversa:', error);
      return [];
    }

    return (data || []) as unknown as ConversationHistoryEntry[];
  } catch (err) {
    console.error('Erro ao buscar histórico de conversa:', err);
    return [];
  }
};
