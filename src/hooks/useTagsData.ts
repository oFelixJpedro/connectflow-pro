import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface Tag {
  id: string;
  name: string;
  color: string;
  description: string | null;
  company_id: string;
  created_at: string;
  conversationsCount?: number;
  contactsCount?: number;
}

export interface TagFormData {
  name: string;
  color: string;
  description?: string;
}

export function useTagsData() {
  const { profile } = useAuth();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTags = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setLoading(true);

      // Fetch tags
      const { data: tagsData, error: tagsError } = await supabase
        .from('tags')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name', { ascending: true });

      if (tagsError) throw tagsError;

      // Fetch conversations to count tags usage
      const { data: conversationsData, error: convError } = await supabase
        .from('conversations')
        .select('id, tags')
        .eq('company_id', profile.company_id);

      if (convError) throw convError;

      // Fetch contacts to count tags usage
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('id, tags')
        .eq('company_id', profile.company_id);

      if (contactsError) throw contactsError;

      // Calculate counts for each tag
      const tagsWithCounts = (tagsData || []).map(tag => {
        const conversationsCount = (conversationsData || []).filter(
          conv => conv.tags?.includes(tag.name)
        ).length;

        const contactsCount = (contactsData || []).filter(
          contact => contact.tags?.includes(tag.name)
        ).length;

        return {
          ...tag,
          conversationsCount,
          contactsCount,
        };
      });

      setTags(tagsWithCounts);
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
      toast({
        title: 'Erro ao carregar tags',
        description: 'Não foi possível carregar as tags.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const createTag = async (data: TagFormData): Promise<Tag | null> => {
    if (!profile?.company_id) return null;

    try {
      const { data: newTag, error } = await supabase
        .from('tags')
        .insert({
          company_id: profile.company_id,
          name: data.name.trim(),
          color: data.color,
          description: data.description?.trim() || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Tag já existe',
            description: 'Já existe uma tag com esse nome.',
            variant: 'destructive',
          });
          return null;
        }
        throw error;
      }

      const tagWithCounts = {
        ...newTag,
        conversationsCount: 0,
        contactsCount: 0,
      };

      setTags(prev => [...prev, tagWithCounts].sort((a, b) => a.name.localeCompare(b.name)));

      toast({
        title: 'Tag criada!',
        description: `A tag "${newTag.name}" foi criada com sucesso.`,
      });

      return tagWithCounts;
    } catch (error) {
      console.error('Erro ao criar tag:', error);
      toast({
        title: 'Erro ao criar tag',
        description: 'Não foi possível criar a tag.',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateTag = async (id: string, data: TagFormData): Promise<boolean> => {
    if (!profile?.company_id) return false;

    try {
      const { error } = await supabase
        .from('tags')
        .update({
          name: data.name.trim(),
          color: data.color,
          description: data.description?.trim() || null,
        })
        .eq('id', id)
        .eq('company_id', profile.company_id);

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Tag já existe',
            description: 'Já existe uma tag com esse nome.',
            variant: 'destructive',
          });
          return false;
        }
        throw error;
      }

      setTags(prev =>
        prev
          .map(tag =>
            tag.id === id
              ? { ...tag, name: data.name.trim(), color: data.color, description: data.description?.trim() || null }
              : tag
          )
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      toast({
        title: 'Tag atualizada!',
        description: `A tag "${data.name}" foi atualizada com sucesso.`,
      });

      return true;
    } catch (error) {
      console.error('Erro ao atualizar tag:', error);
      toast({
        title: 'Erro ao atualizar tag',
        description: 'Não foi possível atualizar a tag.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteTag = async (id: string): Promise<boolean> => {
    if (!profile?.company_id) return false;

    const tagToDelete = tags.find(t => t.id === id);

    try {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', id)
        .eq('company_id', profile.company_id);

      if (error) throw error;

      setTags(prev => prev.filter(tag => tag.id !== id));

      toast({
        title: 'Tag excluída',
        description: tagToDelete ? `A tag "${tagToDelete.name}" foi removida.` : 'A tag foi removida com sucesso.',
      });

      return true;
    } catch (error) {
      console.error('Erro ao excluir tag:', error);
      toast({
        title: 'Erro ao excluir tag',
        description: 'Não foi possível excluir a tag.',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    tags,
    loading,
    createTag,
    updateTag,
    deleteTag,
    refresh: loadTags,
  };
}
