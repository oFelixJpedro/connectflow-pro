import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import { logContactEvent, ContactSnapshot } from '@/lib/contactHistory';
import { normalizePhoneNumber } from '@/lib/phoneUtils';

export interface Contact {
  id: string;
  company_id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  tags: string[];
  notes: string | null;
  custom_fields: Json | null;
  last_interaction_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Virtual fields from conversations join
  connection_ids?: string[];
  department_ids?: string[];
}

export interface ContactFormData {
  name: string;
  phone_number: string;
  email: string;
  tags: string[];
  notes: string;
  // New contact fields
  connectionId?: string;
  initialMessage?: string;
  initialMessageMedia?: {
    type: 'image' | 'video' | 'audio' | 'document';
    file: File;
  };
}

export interface Department {
  id: string;
  name: string;
  whatsapp_connection_id: string;
}

export interface ContactFilters {
  connectionIds: string[];
  departmentIds: string[];
}

interface ConnectionUserAccess {
  connection_id: string;
  access_level: string;
  department_access_mode: string;
}

interface DepartmentUserAccess {
  department_id: string;
}

export function useContactsData() {
  const { profile, userRole } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [connections, setConnections] = useState<{ id: string; name: string; phone_number: string }[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ContactFilters>(() => {
    const saved = localStorage.getItem('contactsFilters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migrate from old format
        if (typeof parsed.connectionId === 'string') {
          return {
            connectionIds: parsed.connectionId === 'all' ? [] : [parsed.connectionId],
            departmentIds: parsed.departmentId === 'all' ? [] : [parsed.departmentId],
          };
        }
        return {
          connectionIds: parsed.connectionIds || [],
          departmentIds: parsed.departmentIds || [],
        };
      } catch {
        return { connectionIds: [], departmentIds: [] };
      }
    }
    return { connectionIds: [], departmentIds: [] };
  });
  const [stats, setStats] = useState({
    total: 0,
    withEmail: 0,
    newLast7Days: 0,
    activeTags: 0
  });

  // User permissions state
  const [connectionUserAccess, setConnectionUserAccess] = useState<ConnectionUserAccess[]>([]);
  const [departmentUserAccess, setDepartmentUserAccess] = useState<DepartmentUserAccess[]>([]);

  // Check if user is admin or owner
  const isAdminOrOwner = useMemo(() => {
    return userRole?.role === 'owner' || userRole?.role === 'admin';
  }, [userRole?.role]);

  // Save filters to localStorage
  useEffect(() => {
    localStorage.setItem('contactsFilters', JSON.stringify(filters));
  }, [filters]);

  // Load user permissions
  const loadUserPermissions = useCallback(async () => {
    if (!profile?.id || isAdminOrOwner) return;

    try {
      // Load connection_users for this user
      const { data: connUsers, error: connError } = await supabase
        .from('connection_users')
        .select('connection_id, access_level, department_access_mode')
        .eq('user_id', profile.id);

      if (connError) throw connError;
      setConnectionUserAccess(connUsers || []);

      // Load department_users for this user
      const { data: deptUsers, error: deptError } = await supabase
        .from('department_users')
        .select('department_id')
        .eq('user_id', profile.id);

      if (deptError) throw deptError;
      setDepartmentUserAccess(deptUsers || []);
    } catch (error) {
      console.error('Error loading user permissions:', error);
    }
  }, [profile?.id, isAdminOrOwner]);

  // Get accessible connection IDs for this user
  const accessibleConnectionIds = useMemo(() => {
    if (isAdminOrOwner) return null; // null means all connections
    return connectionUserAccess.map(cu => cu.connection_id);
  }, [isAdminOrOwner, connectionUserAccess]);

  // Get accessible department IDs for this user
  const getAccessibleDepartmentIds = useCallback((connectionId: string): string[] | null => {
    if (isAdminOrOwner) return null; // null means all departments
    
    const connAccess = connectionUserAccess.find(cu => cu.connection_id === connectionId);
    if (!connAccess) return [];

    if (connAccess.department_access_mode === 'all') {
      return null; // all departments for this connection
    }
    
    if (connAccess.department_access_mode === 'none') {
      return []; // no departments
    }

    // specific departments
    return departmentUserAccess.map(du => du.department_id);
  }, [isAdminOrOwner, connectionUserAccess, departmentUserAccess]);

  // Check if user has assigned_only access for any connection
  const hasAssignedOnlyAccess = useMemo(() => {
    if (isAdminOrOwner) return false;
    return connectionUserAccess.some(cu => cu.access_level === 'assigned_only');
  }, [isAdminOrOwner, connectionUserAccess]);

  // Get connection IDs with assigned_only access
  const assignedOnlyConnectionIds = useMemo(() => {
    if (isAdminOrOwner) return [];
    return connectionUserAccess
      .filter(cu => cu.access_level === 'assigned_only')
      .map(cu => cu.connection_id);
  }, [isAdminOrOwner, connectionUserAccess]);

  const loadContacts = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      // For non-admin users with assigned_only access, we need to get contacts through conversations
      if (!isAdminOrOwner && hasAssignedOnlyAccess) {
        // Get contacts from conversations assigned to this user
        let conversationQuery = supabase
          .from('conversations')
          .select('contact_id, whatsapp_connection_id, department_id')
          .eq('company_id', profile.company_id);

        // Build filter for connections
        if (accessibleConnectionIds && accessibleConnectionIds.length > 0) {
          // For assigned_only connections, filter by assigned_user_id
          // For full access connections, include all
          const fullAccessConnIds = connectionUserAccess
            .filter(cu => cu.access_level === 'full')
            .map(cu => cu.connection_id);

          if (assignedOnlyConnectionIds.length > 0 && fullAccessConnIds.length > 0) {
            // User has mixed access - need complex filter
            // Get conversations where:
            // 1. Connection is full access, OR
            // 2. Connection is assigned_only AND assigned to user
            const { data: convData, error: convError } = await supabase
              .from('conversations')
              .select('contact_id, whatsapp_connection_id, department_id')
              .eq('company_id', profile.company_id)
              .or(`whatsapp_connection_id.in.(${fullAccessConnIds.join(',')}),and(whatsapp_connection_id.in.(${assignedOnlyConnectionIds.join(',')}),assigned_user_id.eq.${profile.id})`);

            if (convError) throw convError;
            
            // Apply additional filters
            let filteredConvData = convData || [];
            
            if (filters.connectionIds.length > 0) {
              filteredConvData = filteredConvData.filter(c => filters.connectionIds.includes(c.whatsapp_connection_id || ''));
            }
            
            if (filters.departmentIds.length > 0) {
              filteredConvData = filteredConvData.filter(c => filters.departmentIds.includes(c.department_id || ''));
            }

            // Apply department access restrictions
            filteredConvData = filteredConvData.filter(c => {
              if (!c.whatsapp_connection_id) return false;
              const accessibleDepts = getAccessibleDepartmentIds(c.whatsapp_connection_id);
              if (accessibleDepts === null) return true; // all departments accessible
              if (!c.department_id) return true; // no department set
              return accessibleDepts.includes(c.department_id);
            });

            const contactIds = [...new Set(filteredConvData.map(c => c.contact_id))];
            
            if (contactIds.length === 0) {
              setContacts([]);
              setStats({ total: 0, withEmail: 0, newLast7Days: 0, activeTags: 0 });
              return;
            }

            const { data, error } = await supabase
              .from('contacts')
              .select('*')
              .in('id', contactIds)
              .order('created_at', { ascending: false });

            if (error) throw error;

            const contactsData = (data || []).map(c => ({
              ...c,
              tags: c.tags || []
            }));

            setContacts(contactsData);
            calculateStats(contactsData);
            return;

          } else if (assignedOnlyConnectionIds.length > 0) {
            // User only has assigned_only access
            conversationQuery = conversationQuery
              .in('whatsapp_connection_id', assignedOnlyConnectionIds)
              .eq('assigned_user_id', profile.id);
          } else {
            // User only has full access to some connections
            conversationQuery = conversationQuery
              .in('whatsapp_connection_id', fullAccessConnIds);
          }
        } else if (accessibleConnectionIds && accessibleConnectionIds.length === 0) {
          // No access to any connections
          setContacts([]);
          setStats({ total: 0, withEmail: 0, newLast7Days: 0, activeTags: 0 });
          return;
        }

        if (filters.connectionIds.length > 0) {
          conversationQuery = conversationQuery.in('whatsapp_connection_id', filters.connectionIds);
        }

        if (filters.departmentIds.length > 0) {
          conversationQuery = conversationQuery.in('department_id', filters.departmentIds);
        }

        const { data: convData, error: convError } = await conversationQuery;
        if (convError) throw convError;

        // Apply department access restrictions
        let filteredConvData = (convData || []).filter(c => {
          if (!c.whatsapp_connection_id) return false;
          const accessibleDepts = getAccessibleDepartmentIds(c.whatsapp_connection_id);
          if (accessibleDepts === null) return true;
          if (!c.department_id) return true;
          return accessibleDepts.includes(c.department_id);
        });

        const contactIds = [...new Set(filteredConvData.map(c => c.contact_id))];
        
        if (contactIds.length === 0) {
          setContacts([]);
          setStats({ total: 0, withEmail: 0, newLast7Days: 0, activeTags: 0 });
          return;
        }

        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .in('id', contactIds)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const contactsData = (data || []).map(c => ({
          ...c,
          tags: c.tags || []
        }));

        setContacts(contactsData);
        calculateStats(contactsData);
        return;
      }

      // If filtering by connection or department, we need to get contacts that have conversations
      if (filters.connectionIds.length > 0 || filters.departmentIds.length > 0 || (!isAdminOrOwner && accessibleConnectionIds)) {
        // Get contact IDs that match the filter criteria via conversations
        let conversationQuery = supabase
          .from('conversations')
          .select('contact_id, whatsapp_connection_id, department_id')
          .eq('company_id', profile.company_id);

        // Apply connection access restrictions for non-admin users
        if (!isAdminOrOwner && accessibleConnectionIds && accessibleConnectionIds.length > 0) {
          conversationQuery = conversationQuery.in('whatsapp_connection_id', accessibleConnectionIds);
        } else if (!isAdminOrOwner && accessibleConnectionIds && accessibleConnectionIds.length === 0) {
          setContacts([]);
          setStats({ total: 0, withEmail: 0, newLast7Days: 0, activeTags: 0 });
          return;
        }

        if (filters.connectionIds.length > 0) {
          conversationQuery = conversationQuery.in('whatsapp_connection_id', filters.connectionIds);
        }

        if (filters.departmentIds.length > 0) {
          conversationQuery = conversationQuery.in('department_id', filters.departmentIds);
        }

        const { data: convData, error: convError } = await conversationQuery;
        if (convError) throw convError;

        // Apply department access restrictions for non-admin users
        let filteredConvData = convData || [];
        if (!isAdminOrOwner) {
          filteredConvData = filteredConvData.filter(c => {
            if (!c.whatsapp_connection_id) return false;
            const accessibleDepts = getAccessibleDepartmentIds(c.whatsapp_connection_id);
            if (accessibleDepts === null) return true;
            if (!c.department_id) return true;
            return accessibleDepts.includes(c.department_id);
          });
        }

        const contactIds = [...new Set(filteredConvData.map(c => c.contact_id))];
        
        if (contactIds.length === 0) {
          setContacts([]);
          setStats({ total: 0, withEmail: 0, newLast7Days: 0, activeTags: 0 });
          return;
        }

        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .in('id', contactIds)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const contactsData = (data || []).map(c => ({
          ...c,
          tags: c.tags || []
        }));

        setContacts(contactsData);
        calculateStats(contactsData);
      } else {
        // No filters - get all contacts (admin/owner only)
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const contactsData = (data || []).map(c => ({
          ...c,
          tags: c.tags || []
        }));

        setContacts(contactsData);
        calculateStats(contactsData);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast.error('Erro ao carregar contatos');
    }
  }, [profile?.company_id, profile?.id, filters, isAdminOrOwner, accessibleConnectionIds, hasAssignedOnlyAccess, assignedOnlyConnectionIds, connectionUserAccess, getAccessibleDepartmentIds]);

  const calculateStats = (contactsData: Contact[]) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    setStats({
      total: contactsData.length,
      withEmail: contactsData.filter(c => c.email).length,
      newLast7Days: contactsData.filter(c => 
        c.created_at && new Date(c.created_at) > sevenDaysAgo
      ).length,
      activeTags: 0
    });
  };

  const loadTags = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('company_id', profile.company_id);

      if (error) throw error;

      setTags(data || []);
      setStats(prev => ({ ...prev, activeTags: data?.length || 0 }));
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }, [profile?.company_id]);

  const loadConnections = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      let query = supabase
        .from('whatsapp_connections')
        .select('id, name, phone_number')
        .eq('company_id', profile.company_id)
        .eq('active', true);

      const { data, error } = await query;

      if (error) throw error;

      // Filter connections based on user permissions
      let filteredConnections = data || [];
      if (!isAdminOrOwner && accessibleConnectionIds) {
        filteredConnections = filteredConnections.filter(c => accessibleConnectionIds.includes(c.id));
      }

      setConnections(filteredConnections);
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  }, [profile?.company_id, isAdminOrOwner, accessibleConnectionIds]);

  const loadDepartments = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      // Get all departments from all connections of this company
      let connectionQuery = supabase
        .from('whatsapp_connections')
        .select('id')
        .eq('company_id', profile.company_id)
        .eq('active', true);

      const { data: connectionsData } = await connectionQuery;

      if (!connectionsData || connectionsData.length === 0) {
        setDepartments([]);
        return;
      }

      let connectionIds = connectionsData.map(c => c.id);
      
      // Filter connections based on user permissions
      if (!isAdminOrOwner && accessibleConnectionIds) {
        connectionIds = connectionIds.filter(id => accessibleConnectionIds.includes(id));
      }

      if (connectionIds.length === 0) {
        setDepartments([]);
        return;
      }

      const { data, error } = await supabase
        .from('departments')
        .select('id, name, whatsapp_connection_id')
        .in('whatsapp_connection_id', connectionIds)
        .eq('active', true)
        .order('name');

      if (error) throw error;

      // Filter departments based on user permissions
      let filteredDepartments = data || [];
      if (!isAdminOrOwner) {
        filteredDepartments = filteredDepartments.filter(dept => {
          const accessibleDepts = getAccessibleDepartmentIds(dept.whatsapp_connection_id);
          if (accessibleDepts === null) return true; // all departments accessible
          return accessibleDepts.includes(dept.id);
        });
      }

      setDepartments(filteredDepartments);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  }, [profile?.company_id, isAdminOrOwner, accessibleConnectionIds, getAccessibleDepartmentIds]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await loadUserPermissions();
    await Promise.all([loadContacts(), loadTags(), loadConnections(), loadDepartments()]);
    setLoading(false);
  }, [loadContacts, loadTags, loadConnections, loadDepartments, loadUserPermissions]);

  useEffect(() => {
    if (profile?.company_id && userRole) {
      loadData();
    }
  }, [profile?.company_id, userRole]);

  // Reload when permissions change
  useEffect(() => {
    if (profile?.company_id && connectionUserAccess.length >= 0) {
      loadConnections();
      loadDepartments();
      loadContacts();
    }
  }, [connectionUserAccess, departmentUserAccess]);

  // Reload contacts when filters change
  useEffect(() => {
    if (profile?.company_id) {
      loadContacts();
    }
  }, [filters.connectionIds, filters.departmentIds, profile?.company_id]);

  const createContact = async (data: ContactFormData): Promise<Contact | null> => {
    if (!profile?.company_id) return null;

    // Normalize the phone number
    const normalizedPhone = normalizePhoneNumber(data.phone_number);
    if (!normalizedPhone) {
      toast.error('Número de telefone inválido. Verifique o DDD e o número.');
      return null;
    }

    try {
      // Create the contact
      const { data: newContact, error } = await supabase
        .from('contacts')
        .insert({
          company_id: profile.company_id,
          name: data.name || null,
          phone_number: normalizedPhone,
          email: data.email || null,
          tags: data.tags,
          notes: data.notes || null
        })
        .select()
        .single();

      if (error) throw error;

      // Log the creation event
      const snapshot: ContactSnapshot = {
        name: newContact.name,
        phone_number: newContact.phone_number,
        email: newContact.email
      };
      
      await logContactEvent({
        companyId: profile.company_id,
        contactId: newContact.id,
        contactSnapshot: snapshot,
        eventType: 'created',
        eventData: { tags: data.tags },
        performedBy: profile.id,
        performedByName: profile.full_name || profile.email
      });

      // If connection is provided, create conversation and add to CRM
      if (data.connectionId) {
        // Get default department for this connection
        const { data: defaultDept } = await supabase
          .from('departments')
          .select('id')
          .eq('whatsapp_connection_id', data.connectionId)
          .eq('is_default', true)
          .maybeSingle();

        // Create conversation - assign to creator if sending initial message
        const hasInitialMessage = !!(data.initialMessage || data.initialMessageMedia);
        const { data: newConversation, error: convError } = await supabase
          .from('conversations')
          .insert({
            company_id: profile.company_id,
            contact_id: newContact.id,
            whatsapp_connection_id: data.connectionId,
            department_id: defaultDept?.id || null,
            status: 'open',
            priority: 'normal',
            channel: 'whatsapp',
            // Auto-assign to creator when sending initial message
            assigned_user_id: hasInitialMessage ? profile.id : null,
            assigned_at: hasInitialMessage ? new Date().toISOString() : null
          })
          .select()
          .single();

        if (convError) {
          console.error('Error creating conversation:', convError);
        }

        // Add to CRM first column
        await addContactToCRM(newContact.id, data.connectionId);

        // Send initial message if provided
        if (newConversation && (data.initialMessage || data.initialMessageMedia)) {
          await sendInitialMessage(
            newContact.id,
            newConversation.id,
            data.connectionId,
            data.initialMessage,
            data.initialMessageMedia
          );
        }
      }

      setContacts(prev => [{ ...newContact, tags: newContact.tags || [] }, ...prev]);
      setStats(prev => ({ ...prev, total: prev.total + 1 }));
      toast.success('Contato criado com sucesso');
      return newContact;
    } catch (error: any) {
      console.error('Error creating contact:', error);
      if (error.code === '23505') {
        toast.error('Já existe um contato com este telefone');
      } else {
        toast.error('Erro ao criar contato');
      }
      return null;
    }
  };

  const addContactToCRM = async (contactId: string, connectionId: string) => {
    try {
      // Get or create board for this connection
      let { data: board } = await supabase
        .from('kanban_boards')
        .select('id')
        .eq('whatsapp_connection_id', connectionId)
        .single();

      if (!board) {
        // Board doesn't exist, skip CRM (board will be created when admin configures CRM)
        return;
      }

      // Get first column
      const { data: columns } = await supabase
        .from('kanban_columns')
        .select('id')
        .eq('board_id', board.id)
        .order('position')
        .limit(1);

      if (!columns || columns.length === 0) return;

      const firstColumnId = columns[0].id;

      // Get max position in column
      const { data: maxPosData } = await supabase
        .from('kanban_cards')
        .select('position')
        .eq('column_id', firstColumnId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = (maxPosData?.[0]?.position ?? -1) + 1;

      // Create card
      await supabase
        .from('kanban_cards')
        .insert({
          contact_id: contactId,
          column_id: firstColumnId,
          position: nextPosition,
          priority: 'medium'
        });

      // Log history
      const { data: card } = await supabase
        .from('kanban_cards')
        .select('id')
        .eq('contact_id', contactId)
        .single();

      if (card) {
        await supabase
          .from('kanban_card_history')
          .insert({
            card_id: card.id,
            action_type: 'created',
            new_value: { column_id: firstColumnId, priority: 'medium' },
            user_id: profile?.id
          });
      }
    } catch (error) {
      console.error('Error adding contact to CRM:', error);
      // Don't throw - CRM addition is secondary
    }
  };

  const sendInitialMessage = async (
    contactId: string,
    conversationId: string,
    connectionId: string,
    message?: string,
    media?: { type: 'image' | 'video' | 'audio' | 'document'; file: File }
  ) => {
    try {
      // Get connection details
      const { data: connection } = await supabase
        .from('whatsapp_connections')
        .select('instance_token, uazapi_base_url, phone_number')
        .eq('id', connectionId)
        .single();

      if (!connection) return;

      // Get contact phone number
      const { data: contact } = await supabase
        .from('contacts')
        .select('phone_number')
        .eq('id', contactId)
        .single();

      if (!contact) return;

      const recipientPhone = contact.phone_number;

      if (media) {
        // IMPORTANT: our media Edge Functions expect base64 (imageData/videoData/audioData/documentData)
        // and handle Storage + DB message creation internally.
        const fileToDataUrl = (file: File) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });

        const dataUrl = await fileToDataUrl(media.file);

        if (media.type === 'image') {
          const { error } = await supabase.functions.invoke('send-whatsapp-image', {
            body: {
              imageData: dataUrl,
              fileName: media.file.name,
              mimeType: media.file.type,
              conversationId,
              connectionId,
              contactPhoneNumber: recipientPhone,
              caption: message || '',
              quotedMessageId: null,
            },
          });

          if (error) console.error('Error sending image:', error);
          return;
        }

        if (media.type === 'video') {
          const { error } = await supabase.functions.invoke('send-whatsapp-video', {
            body: {
              videoData: dataUrl,
              fileName: media.file.name,
              mimeType: media.file.type,
              conversationId,
              connectionId,
              contactPhoneNumber: recipientPhone,
              text: message || '',
              duration: null,
              quotedMessageId: null,
            },
          });

          if (error) console.error('Error sending video:', error);
          return;
        }

        if (media.type === 'document') {
          const { error } = await supabase.functions.invoke('send-whatsapp-document', {
            body: {
              documentData: dataUrl,
              fileName: media.file.name,
              mimeType: media.file.type,
              conversationId,
              connectionId,
              contactPhoneNumber: recipientPhone,
              text: message || '',
              quotedMessageId: null,
            },
          });

          if (error) console.error('Error sending document:', error);
          return;
        }

        if (media.type === 'audio') {
          // Audio function uses conversationId to find contact/connection
          const { error } = await supabase.functions.invoke('send-whatsapp-audio', {
            body: {
              audioData: dataUrl,
              fileName: media.file.name,
              mimeType: media.file.type,
              duration: null,
              conversationId,
              quotedMessageId: null,
            },
          });

          if (error) console.error('Error sending audio:', error);
          return;
        }

        return;
      }

      if (message && message.trim()) {
        // Text message uses send-whatsapp-message which expects messageId + conversationId
        const { data: messageRecord, error: msgError } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            content: message.trim(),
            message_type: 'text',
            direction: 'outbound',
            sender_type: 'user',
            sender_id: profile?.id,
            status: 'pending',
          })
          .select('id')
          .single();

        if (msgError || !messageRecord) {
          console.error('Error creating text message record:', msgError);
          return;
        }

        const { error: sendError } = await supabase.functions.invoke('send-whatsapp-message', {
          body: {
            messageId: messageRecord.id,
            conversationId,
          },
        });

        if (sendError) {
          console.error('Error sending text message:', sendError);
          await supabase
            .from('messages')
            .update({ status: 'failed', error_message: sendError.message })
            .eq('id', messageRecord.id);
        }
      }
    } catch (error) {
      console.error('Error sending initial message:', error);
    }
  };

  const updateContact = async (id: string, data: ContactFormData): Promise<boolean> => {
    try {
      // Get old contact for comparison
      const oldContact = contacts.find(c => c.id === id);
      
      const { error } = await supabase
        .from('contacts')
        .update({
          name: data.name || null,
          phone_number: data.phone_number.replace(/\D/g, ''),
          email: data.email || null,
          tags: data.tags,
          notes: data.notes || null,
          name_manually_edited: data.name ? true : false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Log update event with changes
      if (oldContact && profile?.company_id) {
        const changes: Array<{ field: string; old_value: any; new_value: any }> = [];
        
        if (oldContact.name !== (data.name || null)) {
          changes.push({ field: 'Nome', old_value: oldContact.name, new_value: data.name || null });
        }
        if (oldContact.email !== (data.email || null)) {
          changes.push({ field: 'E-mail', old_value: oldContact.email, new_value: data.email || null });
        }
        if (JSON.stringify(oldContact.tags) !== JSON.stringify(data.tags)) {
          changes.push({ field: 'Tags', old_value: oldContact.tags, new_value: data.tags });
        }

        await logContactEvent({
          companyId: profile.company_id,
          contactId: id,
          contactSnapshot: {
            name: data.name || null,
            phone_number: data.phone_number.replace(/\D/g, ''),
            email: data.email || null
          },
          eventType: 'updated',
          eventData: { changes },
          performedBy: profile.id,
          performedByName: profile.full_name || profile.email
        });
      }

      setContacts(prev => prev.map(c => 
        c.id === id 
          ? { 
              ...c, 
              name: data.name || null,
              phone_number: data.phone_number.replace(/\D/g, ''),
              email: data.email || null,
              tags: data.tags,
              notes: data.notes || null
            } 
          : c
      ));
      toast.success('Contato atualizado com sucesso');
      return true;
    } catch (error: any) {
      console.error('Error updating contact:', error);
      if (error.code === '23505') {
        toast.error('Já existe um contato com este telefone');
      } else {
        toast.error('Erro ao atualizar contato');
      }
      return false;
    }
  };

  const deleteContact = async (id: string): Promise<boolean> => {
    try {
      // Get contact before deletion for snapshot
      const contactToDelete = contacts.find(c => c.id === id);
      
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Log deletion event
      if (contactToDelete && profile?.company_id) {
        await logContactEvent({
          companyId: profile.company_id,
          contactId: id,
          contactSnapshot: {
            name: contactToDelete.name,
            phone_number: contactToDelete.phone_number,
            email: contactToDelete.email
          },
          eventType: 'deleted',
          performedBy: profile.id,
          performedByName: profile.full_name || profile.email
        });
      }

      setContacts(prev => prev.filter(c => c.id !== id));
      setStats(prev => ({ ...prev, total: prev.total - 1 }));
      toast.success('Contato excluído com sucesso');
      return true;
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Erro ao excluir contato');
      return false;
    }
  };

  const deleteMultipleContacts = async (ids: string[]): Promise<boolean> => {
    try {
      // Get contacts before deletion for snapshots
      const contactsToDelete = contacts.filter(c => ids.includes(c.id));
      
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', ids);

      if (error) throw error;

      // Log deletion events
      if (profile?.company_id) {
        for (const contact of contactsToDelete) {
          await logContactEvent({
            companyId: profile.company_id,
            contactId: contact.id,
            contactSnapshot: {
              name: contact.name,
              phone_number: contact.phone_number,
              email: contact.email
            },
            eventType: 'deleted',
            performedBy: profile.id,
            performedByName: profile.full_name || profile.email
          });
        }
      }

      setContacts(prev => prev.filter(c => !ids.includes(c.id)));
      setStats(prev => ({ ...prev, total: prev.total - ids.length }));
      toast.success(`${ids.length} contato(s) excluído(s)`);
      return true;
    } catch (error) {
      console.error('Error deleting contacts:', error);
      toast.error('Erro ao excluir contatos');
      return false;
    }
  };

  const startConversation = async (contactId: string, connectionId: string): Promise<string | null> => {
    if (!profile?.company_id) return null;

    try {
      // Check if conversation already exists
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contactId)
        .eq('whatsapp_connection_id', connectionId)
        .maybeSingle();

      if (existing) {
        return existing.id;
      }

      // Get default department for this connection
      const { data: defaultDept } = await supabase
        .from('departments')
        .select('id')
        .eq('whatsapp_connection_id', connectionId)
        .eq('is_default', true)
        .maybeSingle();

      // Create new conversation
      const { data: newConversation, error } = await supabase
        .from('conversations')
        .insert({
          company_id: profile.company_id,
          contact_id: contactId,
          whatsapp_connection_id: connectionId,
          department_id: defaultDept?.id || null,
          status: 'open',
          priority: 'normal',
          channel: 'whatsapp'
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Conversa criada com sucesso');
      return newConversation.id;
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error('Erro ao iniciar conversa');
      return null;
    }
  };

  const exportContacts = (contactsToExport: Contact[]) => {
    const headers = ['Nome', 'Telefone', 'E-mail', 'Tags', 'Notas', 'Última Interação', 'Criado em'];
    const rows = contactsToExport.map(c => [
      c.name || '',
      c.phone_number,
      c.email || '',
      (c.tags || []).join(', '),
      c.notes || '',
      c.last_interaction_at || '',
      c.created_at || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contatos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success(`${contactsToExport.length} contato(s) exportado(s)`);
  };

  const importContacts = async (file: File): Promise<boolean> => {
    if (!profile?.company_id) return false;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length < 2) {
            toast.error('Arquivo vazio ou inválido');
            resolve(false);
            return;
          }

          const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
          const phoneIndex = headers.findIndex(h => h.includes('telefone') || h.includes('phone'));
          const nameIndex = headers.findIndex(h => h.includes('nome') || h.includes('name'));
          const emailIndex = headers.findIndex(h => h.includes('email') || h.includes('e-mail'));
          const tagsIndex = headers.findIndex(h => h.includes('tag'));
          const notesIndex = headers.findIndex(h => h.includes('nota') || h.includes('note'));

          if (phoneIndex === -1) {
            toast.error('Coluna de telefone não encontrada');
            resolve(false);
            return;
          }

          const contactsToImport: Array<{
            company_id: string;
            phone_number: string;
            name: string | null;
            email: string | null;
            tags: string[];
            notes: string | null;
          }> = [];

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].match(/(".*?"|[^,]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
            const rawPhone = values[phoneIndex] || '';
            const normalizedPhone = normalizePhoneNumber(rawPhone);
            
            if (normalizedPhone) {
              contactsToImport.push({
                company_id: profile.company_id,
                phone_number: normalizedPhone,
                name: nameIndex >= 0 ? values[nameIndex] || null : null,
                email: emailIndex >= 0 ? values[emailIndex] || null : null,
                tags: tagsIndex >= 0 && values[tagsIndex] ? values[tagsIndex].split(/[,;]/).map(t => t.trim()).filter(Boolean) : [],
                notes: notesIndex >= 0 ? values[notesIndex] || null : null
              });
            }
          }

          if (contactsToImport.length === 0) {
            toast.error('Nenhum contato válido encontrado');
            resolve(false);
            return;
          }

          const { error } = await supabase
            .from('contacts')
            .upsert(contactsToImport, { 
              onConflict: 'company_id,phone_number',
              ignoreDuplicates: false 
            });

          if (error) throw error;

          await loadContacts();
          toast.success(`${contactsToImport.length} contato(s) importado(s)`);
          resolve(true);
        } catch (error) {
          console.error('Error importing contacts:', error);
          toast.error('Erro ao importar contatos');
          resolve(false);
        }
      };
      reader.readAsText(file);
    });
  };

  return {
    contacts,
    tags,
    connections,
    departments,
    loading,
    stats,
    filters,
    setFilters,
    createContact,
    updateContact,
    deleteContact,
    deleteMultipleContacts,
    startConversation,
    exportContacts,
    importContacts,
    refresh: loadData
  };
}
