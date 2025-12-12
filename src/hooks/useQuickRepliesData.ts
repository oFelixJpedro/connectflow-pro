import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export type QuickReplyMediaType = 'text' | 'image' | 'video' | 'audio' | 'document';
export type QuickReplyVisibility = 'all' | 'personal' | 'department' | 'connection';

export interface QuickReply {
  id: string;
  company_id: string;
  created_by_user_id: string | null;
  shortcut: string;
  title: string;
  message: string;
  is_global: boolean;
  category: string | null; // Legacy - keeping for backwards compatibility
  category_id: string | null; // New - references quick_reply_categories
  use_count: number;
  media_url: string | null;
  media_type: QuickReplyMediaType | null;
  visibility_type: QuickReplyVisibility;
  department_id: string | null;
  whatsapp_connection_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuickReplyFormData {
  shortcut: string;
  title: string;
  message: string;
  category?: string; // Legacy
  category_id?: string | null; // New
  is_global: boolean;
  media_url?: string | null;
  media_type?: QuickReplyMediaType;
  visibility_type: QuickReplyVisibility;
  department_id?: string | null;
  whatsapp_connection_id?: string | null;
}

export function useQuickRepliesData() {
  const { profile, user, userRole } = useAuth();
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [userDepartments, setUserDepartments] = useState<string[]>([]);

  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  // Load user's departments
  const loadUserDepartments = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('department_users')
        .select('department_id')
        .eq('user_id', user.id);

      if (error) throw error;
      setUserDepartments(data?.map(d => d.department_id) || []);
    } catch (error) {
      console.error('Erro ao carregar departamentos do usuário:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    loadUserDepartments();
  }, [loadUserDepartments]);

  const loadQuickReplies = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('quick_replies')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('use_count', { ascending: false });

      if (error) throw error;

      // Cast types properly
      const typedData = (data || []).map(item => ({
        ...item,
        media_type: (item.media_type || 'text') as QuickReplyMediaType,
        visibility_type: (item.visibility_type || 'all') as QuickReplyVisibility,
      }));

      setQuickReplies(typedData);
    } catch (error) {
      console.error('Erro ao carregar respostas rápidas:', error);
      toast({
        title: 'Erro ao carregar respostas',
        description: 'Não foi possível carregar as respostas rápidas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    loadQuickReplies();
  }, [loadQuickReplies]);

  // Filter replies by visibility tab
  const getFilteredByVisibility = useCallback((
    visibilityTab: QuickReplyVisibility,
    connectionId?: string | null,
    departmentId?: string | null
  ): QuickReply[] => {
    return quickReplies.filter(reply => {
      switch (visibilityTab) {
        case 'all':
          return reply.visibility_type === 'all';
        case 'personal':
          return reply.visibility_type === 'personal' && reply.created_by_user_id === user?.id;
        case 'department':
          // If departmentId is specified, filter by that specific department
          if (departmentId) {
            return reply.visibility_type === 'department' && reply.department_id === departmentId;
          }
          // Otherwise, show all departments the user has access to
          return reply.visibility_type === 'department' && 
            reply.department_id && 
            userDepartments.includes(reply.department_id);
        case 'connection':
          // If connectionId is specified, filter by that specific connection
          if (connectionId) {
            return reply.visibility_type === 'connection' && reply.whatsapp_connection_id === connectionId;
          }
          // Otherwise, show all connection quick replies
          return reply.visibility_type === 'connection';
        default:
          return true;
      }
    });
  }, [quickReplies, user?.id, userDepartments]);

  // Get counts per visibility type
  const getVisibilityCounts = useCallback((connectionId?: string | null) => {
    return {
      all: quickReplies.filter(r => r.visibility_type === 'all').length,
      personal: quickReplies.filter(r => 
        r.visibility_type === 'personal' && r.created_by_user_id === user?.id
      ).length,
      department: quickReplies.filter(r => 
        r.visibility_type === 'department' && 
        r.department_id && 
        userDepartments.includes(r.department_id)
      ).length,
      connection: quickReplies.filter(r => 
        r.visibility_type === 'connection' && 
        r.whatsapp_connection_id === connectionId
      ).length,
    };
  }, [quickReplies, user?.id, userDepartments]);

  const uploadMedia = async (file: File): Promise<string | null> => {
    if (!profile?.company_id) return null;

    try {
      // Sanitize filename
      const sanitizedName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      
      const fileExt = sanitizedName.split('.').pop();
      const fileName = `${profile.company_id}/quick-replies/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('whatsapp-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      const { data: publicUrl } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(data.path);

      return publicUrl.publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      toast({
        title: 'Erro ao fazer upload',
        description: 'Não foi possível enviar o arquivo.',
        variant: 'destructive',
      });
      return null;
    }
  };

  const deleteMedia = async (mediaUrl: string): Promise<void> => {
    if (!mediaUrl) return;

    try {
      const urlParts = mediaUrl.split('/whatsapp-media/');
      if (urlParts.length < 2) return;

      const path = urlParts[1];
      await supabase.storage.from('whatsapp-media').remove([path]);
    } catch (error) {
      console.error('Erro ao deletar mídia:', error);
    }
  };

  const createQuickReply = async (data: QuickReplyFormData): Promise<QuickReply | null> => {
    if (!profile?.company_id || !user?.id) return null;

    const shortcut = data.shortcut.startsWith('/') ? data.shortcut : `/${data.shortcut}`;

    try {
      const { data: newReply, error } = await supabase
        .from('quick_replies')
        .insert({
          company_id: profile.company_id,
          created_by_user_id: user.id,
          shortcut: shortcut.toLowerCase().trim(),
          title: data.title.trim(),
          message: data.message.trim(),
          category: data.category?.trim() || null, // Legacy
          category_id: data.category_id || null, // New
          is_global: data.visibility_type === 'all',
          media_url: data.media_url || null,
          media_type: data.media_type || 'text',
          visibility_type: data.visibility_type,
          department_id: data.visibility_type === 'department' ? data.department_id : null,
          whatsapp_connection_id: data.visibility_type === 'connection' ? data.whatsapp_connection_id : null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Atalho já existe',
            description: 'Já existe uma resposta rápida com esse atalho.',
            variant: 'destructive',
          });
          return null;
        }
        throw error;
      }

      const typedReply: QuickReply = {
        ...newReply,
        media_type: (newReply.media_type || 'text') as QuickReplyMediaType,
        visibility_type: (newReply.visibility_type || 'all') as QuickReplyVisibility,
      };

      setQuickReplies(prev => [typedReply, ...prev]);

      toast({
        title: 'Resposta criada!',
        description: `Use "${typedReply.shortcut}" no chat para usar esta resposta.`,
      });

      return typedReply;
    } catch (error) {
      console.error('Erro ao criar resposta rápida:', error);
      toast({
        title: 'Erro ao criar resposta',
        description: 'Não foi possível criar a resposta rápida.',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateQuickReply = async (id: string, data: QuickReplyFormData): Promise<boolean> => {
    if (!profile?.company_id) return false;

    const shortcut = data.shortcut.startsWith('/') ? data.shortcut : `/${data.shortcut}`;

    try {
      const { error } = await supabase
        .from('quick_replies')
        .update({
          shortcut: shortcut.toLowerCase().trim(),
          title: data.title.trim(),
          message: data.message.trim(),
          category: data.category?.trim() || null, // Legacy
          category_id: data.category_id || null, // New
          is_global: data.visibility_type === 'all',
          media_url: data.media_url || null,
          media_type: data.media_type || 'text',
          visibility_type: data.visibility_type,
          department_id: data.visibility_type === 'department' ? data.department_id : null,
          whatsapp_connection_id: data.visibility_type === 'connection' ? data.whatsapp_connection_id : null,
        })
        .eq('id', id);

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Atalho já existe',
            description: 'Já existe outra resposta rápida com esse atalho.',
            variant: 'destructive',
          });
          return false;
        }
        throw error;
      }

      setQuickReplies(prev =>
        prev.map(reply =>
          reply.id === id
            ? {
                ...reply,
                shortcut: shortcut.toLowerCase().trim(),
                title: data.title.trim(),
                message: data.message.trim(),
                category: data.category?.trim() || null,
                category_id: data.category_id || null,
                is_global: data.visibility_type === 'all',
                media_url: data.media_url || null,
                media_type: data.media_type || 'text',
                visibility_type: data.visibility_type,
                department_id: data.visibility_type === 'department' ? data.department_id : null,
                whatsapp_connection_id: data.visibility_type === 'connection' ? data.whatsapp_connection_id : null,
              }
            : reply
        )
      );

      toast({
        title: 'Resposta atualizada!',
        description: 'A resposta rápida foi atualizada com sucesso.',
      });

      return true;
    } catch (error) {
      console.error('Erro ao atualizar resposta rápida:', error);
      toast({
        title: 'Erro ao atualizar resposta',
        description: 'Não foi possível atualizar a resposta rápida.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteQuickReply = async (id: string): Promise<boolean> => {
    if (!profile?.company_id) return false;

    const replyToDelete = quickReplies.find(r => r.id === id);

    try {
      if (replyToDelete?.media_url) {
        await deleteMedia(replyToDelete.media_url);
      }

      const { error } = await supabase
        .from('quick_replies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setQuickReplies(prev => prev.filter(reply => reply.id !== id));

      toast({
        title: 'Resposta excluída',
        description: replyToDelete 
          ? `A resposta "${replyToDelete.title}" foi removida.` 
          : 'A resposta rápida foi removida com sucesso.',
      });

      return true;
    } catch (error) {
      console.error('Erro ao excluir resposta rápida:', error);
      toast({
        title: 'Erro ao excluir resposta',
        description: 'Não foi possível excluir a resposta rápida.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const incrementUseCount = async (id: string): Promise<void> => {
    try {
      const reply = quickReplies.find(r => r.id === id);
      if (!reply) return;

      const { error } = await supabase
        .from('quick_replies')
        .update({ use_count: (reply.use_count || 0) + 1 })
        .eq('id', id);

      if (error) throw error;

      setQuickReplies(prev =>
        prev.map(r =>
          r.id === id ? { ...r, use_count: (r.use_count || 0) + 1 } : r
        )
      );
    } catch (error) {
      console.error('Erro ao incrementar contador de uso:', error);
    }
  };

  return {
    quickReplies,
    loading,
    isAdminOrOwner,
    userDepartments,
    createQuickReply,
    updateQuickReply,
    deleteQuickReply,
    incrementUseCount,
    uploadMedia,
    deleteMedia,
    getFilteredByVisibility,
    getVisibilityCounts,
    refresh: loadQuickReplies,
  };
}
