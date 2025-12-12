import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface QuickReplyCategory {
  id: string;
  name: string;
  company_id: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useQuickReplyCategories() {
  const { profile, user } = useAuth();
  const [categories, setCategories] = useState<QuickReplyCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quick_reply_categories')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!profile?.company_id) return;

    const channel = supabase
      .channel('quick_reply_categories_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quick_reply_categories',
          filter: `company_id=eq.${profile.company_id}`,
        },
        () => {
          loadCategories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, loadCategories]);

  const createCategory = async (name: string): Promise<QuickReplyCategory | null> => {
    if (!profile?.company_id || !user?.id) return null;

    const trimmedName = name.trim();
    if (trimmedName.length < 3) {
      toast({
        title: 'Nome muito curto',
        description: 'O nome da categoria deve ter pelo menos 3 caracteres.',
        variant: 'destructive',
      });
      return null;
    }

    if (trimmedName.length > 50) {
      toast({
        title: 'Nome muito longo',
        description: 'O nome da categoria deve ter no máximo 50 caracteres.',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('quick_reply_categories')
        .insert({
          name: trimmedName,
          company_id: profile.company_id,
          created_by_user_id: user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Categoria já existe',
            description: 'Já existe uma categoria com esse nome.',
            variant: 'destructive',
          });
          return null;
        }
        throw error;
      }

      setCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));

      toast({
        title: 'Categoria criada!',
        description: `A categoria "${data.name}" foi criada com sucesso.`,
      });

      return data;
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      toast({
        title: 'Erro ao criar categoria',
        description: 'Não foi possível criar a categoria.',
        variant: 'destructive',
      });
      return null;
    }
  };

  const deleteCategory = async (id: string): Promise<boolean> => {
    try {
      const categoryToDelete = categories.find(c => c.id === id);
      
      const { error } = await supabase
        .from('quick_reply_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setCategories(prev => prev.filter(c => c.id !== id));

      toast({
        title: 'Categoria excluída',
        description: categoryToDelete 
          ? `A categoria "${categoryToDelete.name}" foi removida.`
          : 'A categoria foi removida com sucesso.',
      });

      return true;
    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
      toast({
        title: 'Erro ao excluir categoria',
        description: 'Não foi possível excluir a categoria.',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    categories,
    loading,
    createCategory,
    deleteCategory,
    refresh: loadCategories,
  };
}
