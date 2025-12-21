import { supabase } from "@/integrations/supabase/client";

export type ContactEventType = 
  | 'created'
  | 'updated'
  | 'deleted'
  | 'tag_added'
  | 'tag_removed'
  | 'imported'
  | 'exported'
  | 'conversation_started'
  | 'crm_added';

export interface ContactLogEntry {
  id: string;
  company_id: string;
  contact_id: string | null;
  contact_snapshot: {
    name: string | null;
    phone_number: string;
    email: string | null;
  };
  event_type: ContactEventType;
  event_data: Record<string, unknown>;
  performed_by: string | null;
  performed_by_name: string | null;
  is_automatic: boolean;
  created_at: string;
}

export interface ContactSnapshot {
  name: string | null;
  phone_number: string;
  email: string | null;
}

interface LogContactEventParams {
  companyId: string;
  contactId: string | null;
  contactSnapshot: ContactSnapshot;
  eventType: ContactEventType;
  eventData?: Record<string, unknown>;
  performedBy?: string | null;
  performedByName?: string | null;
  isAutomatic?: boolean;
}

/**
 * Log a contact event to the contact_logs table
 */
export const logContactEvent = async ({
  companyId,
  contactId,
  contactSnapshot,
  eventType,
  eventData = {},
  performedBy = null,
  performedByName = null,
  isAutomatic = false
}: LogContactEventParams): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('contact_logs' as any)
      .insert({
        company_id: companyId,
        contact_id: contactId,
        contact_snapshot: contactSnapshot,
        event_type: eventType,
        event_data: eventData,
        performed_by: performedBy,
        performed_by_name: performedByName || 'Sistema',
        is_automatic: isAutomatic
      });

    if (error) {
      console.error('Erro ao registrar histórico de contato:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Erro ao registrar histórico de contato:', err);
    return false;
  }
};

export interface ContactLogsFilters {
  eventType?: ContactEventType;
  startDate?: Date;
  endDate?: Date;
  performedBy?: string;
  searchQuery?: string;
}

export interface UniqueContactFromLogs {
  contact_id: string | null;
  contact_snapshot: ContactSnapshot;
  event_count: number;
  last_event_type: ContactEventType;
  last_event_at: string;
  last_performed_by_name: string | null;
  is_deleted: boolean;
}

/**
 * Fetch all contact logs for a company with optional filters
 */
export const fetchContactLogs = async (
  companyId: string,
  filters?: ContactLogsFilters
): Promise<ContactLogEntry[]> => {
  try {
    let query = supabase
      .from('contact_logs' as any)
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (filters?.eventType) {
      query = query.eq('event_type', filters.eventType);
    }

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    if (filters?.performedBy) {
      query = query.eq('performed_by', filters.performedBy);
    }

    const { data, error } = await query.limit(1000);

    if (error) {
      console.error('Erro ao buscar logs de contatos:', error);
      return [];
    }

    let logs = (data || []) as unknown as ContactLogEntry[];

    // Apply search filter client-side (for contact name/phone)
    if (filters?.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      logs = logs.filter(log => {
        const snapshot = log.contact_snapshot;
        return (
          snapshot.name?.toLowerCase().includes(searchLower) ||
          snapshot.phone_number?.includes(searchLower) ||
          snapshot.email?.toLowerCase().includes(searchLower)
        );
      });
    }

    return logs;
  } catch (err) {
    console.error('Erro ao buscar logs de contatos:', err);
    return [];
  }
};

/**
 * Fetch unique contacts from logs (including deleted ones)
 */
export const fetchUniqueContactsFromLogs = async (
  companyId: string,
  filters?: ContactLogsFilters
): Promise<UniqueContactFromLogs[]> => {
  const logs = await fetchContactLogs(companyId, filters);
  
  // Group by contact_id (using phone as fallback for deleted)
  const contactsMap = new Map<string, {
    logs: ContactLogEntry[];
    contact_id: string | null;
  }>();

  for (const log of logs) {
    // Use phone_number as key to group logs for same contact
    const key = log.contact_snapshot.phone_number;
    
    if (!contactsMap.has(key)) {
      contactsMap.set(key, {
        logs: [],
        contact_id: log.contact_id
      });
    }
    
    contactsMap.get(key)!.logs.push(log);
  }

  // Convert to unique contacts array
  const uniqueContacts: UniqueContactFromLogs[] = [];
  
  for (const [_, value] of contactsMap) {
    const sortedLogs = value.logs.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    const lastLog = sortedLogs[0];
    
    // Find the most recent deletion and creation events
    const lastDeletionEvent = sortedLogs.find(log => log.event_type === 'deleted');
    const lastCreationEvent = sortedLogs.find(log => 
      log.event_type === 'created' || log.event_type === 'imported'
    );
    
    // Contact is deleted only if the last deletion is more recent than the last creation
    const isDeleted = lastDeletionEvent 
      ? !lastCreationEvent || new Date(lastDeletionEvent.created_at).getTime() > new Date(lastCreationEvent.created_at).getTime()
      : false;
    
    // Get the most recent snapshot (before deletion if deleted)
    const mostRecentSnapshot = isDeleted
      ? lastDeletionEvent?.contact_snapshot || lastLog.contact_snapshot
      : lastLog.contact_snapshot;

    uniqueContacts.push({
      contact_id: value.contact_id,
      contact_snapshot: mostRecentSnapshot,
      event_count: value.logs.length,
      last_event_type: lastLog.event_type as ContactEventType,
      last_event_at: lastLog.created_at,
      last_performed_by_name: lastLog.performed_by_name,
      is_deleted: isDeleted
    });
  }

  // Sort by last event date
  return uniqueContacts.sort(
    (a, b) => new Date(b.last_event_at).getTime() - new Date(a.last_event_at).getTime()
  );
};

/**
 * Fetch history for a specific contact (by phone number to include deleted)
 */
export const fetchContactHistory = async (
  companyId: string,
  phoneNumber: string
): Promise<ContactLogEntry[]> => {
  try {
    const { data, error } = await supabase
      .from('contact_logs' as any)
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar histórico do contato:', error);
      return [];
    }

    // Filter by phone number in snapshot
    const logs = (data || []) as unknown as ContactLogEntry[];
    return logs.filter(log => log.contact_snapshot.phone_number === phoneNumber);
  } catch (err) {
    console.error('Erro ao buscar histórico do contato:', err);
    return [];
  }
};

/**
 * Get total log count for stats
 */
export const getContactLogsCount = async (companyId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('contact_logs' as any)
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);

    if (error) {
      console.error('Erro ao contar logs:', error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.error('Erro ao contar logs:', err);
    return 0;
  }
};
