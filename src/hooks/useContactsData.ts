import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

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
}

export interface Department {
  id: string;
  name: string;
  whatsapp_connection_id: string;
}

export interface ContactFilters {
  connectionId: string;
  departmentId: string;
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
        return JSON.parse(saved);
      } catch {
        return { connectionId: 'all', departmentId: 'all' };
      }
    }
    return { connectionId: 'all', departmentId: 'all' };
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
            
            if (filters.connectionId !== 'all') {
              filteredConvData = filteredConvData.filter(c => c.whatsapp_connection_id === filters.connectionId);
            }
            
            if (filters.departmentId !== 'all') {
              filteredConvData = filteredConvData.filter(c => c.department_id === filters.departmentId);
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

        if (filters.connectionId !== 'all') {
          conversationQuery = conversationQuery.eq('whatsapp_connection_id', filters.connectionId);
        }

        if (filters.departmentId !== 'all') {
          conversationQuery = conversationQuery.eq('department_id', filters.departmentId);
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
      if (filters.connectionId !== 'all' || filters.departmentId !== 'all' || (!isAdminOrOwner && accessibleConnectionIds)) {
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

        if (filters.connectionId !== 'all') {
          conversationQuery = conversationQuery.eq('whatsapp_connection_id', filters.connectionId);
        }

        if (filters.departmentId !== 'all') {
          conversationQuery = conversationQuery.eq('department_id', filters.departmentId);
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
  }, [filters.connectionId, filters.departmentId, profile?.company_id]);

  const createContact = async (data: ContactFormData): Promise<Contact | null> => {
    if (!profile?.company_id) return null;

    try {
      const { data: newContact, error } = await supabase
        .from('contacts')
        .insert({
          company_id: profile.company_id,
          name: data.name || null,
          phone_number: data.phone_number.replace(/\D/g, ''),
          email: data.email || null,
          tags: data.tags,
          notes: data.notes || null
        })
        .select()
        .single();

      if (error) throw error;

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

  const updateContact = async (id: string, data: ContactFormData): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          name: data.name || null,
          phone_number: data.phone_number.replace(/\D/g, ''),
          email: data.email || null,
          tags: data.tags,
          notes: data.notes || null,
          // Mark name as manually edited if name was changed
          name_manually_edited: data.name ? true : false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

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
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;

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
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', ids);

      if (error) throw error;

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
            const phone = values[phoneIndex]?.replace(/\D/g, '');
            
            if (phone && phone.length >= 10) {
              contactsToImport.push({
                company_id: profile.company_id,
                phone_number: phone,
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
