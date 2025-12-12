import { useState, useEffect, useCallback } from 'react';
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
}

export interface ContactFormData {
  name: string;
  phone_number: string;
  email: string;
  tags: string[];
  notes: string;
}

export function useContactsData() {
  const { profile } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [connections, setConnections] = useState<{ id: string; name: string; phone_number: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    withEmail: 0,
    newLast7Days: 0,
    activeTags: 0
  });

  const loadContacts = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
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

      // Calculate stats
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      setStats({
        total: contactsData.length,
        withEmail: contactsData.filter(c => c.email).length,
        newLast7Days: contactsData.filter(c => 
          c.created_at && new Date(c.created_at) > sevenDaysAgo
        ).length,
        activeTags: 0 // Will be updated when tags are loaded
      });
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast.error('Erro ao carregar contatos');
    }
  }, [profile?.company_id]);

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
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('id, name, phone_number')
        .eq('company_id', profile.company_id)
        .eq('status', 'connected')
        .eq('active', true);

      if (error) throw error;

      setConnections(data || []);
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  }, [profile?.company_id]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadContacts(), loadTags(), loadConnections()]);
    setLoading(false);
  }, [loadContacts, loadTags, loadConnections]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    loading,
    stats,
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
