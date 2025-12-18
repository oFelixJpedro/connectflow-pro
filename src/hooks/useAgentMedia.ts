import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AgentMedia {
  id: string;
  agent_id: string;
  media_type: 'image' | 'video' | 'audio' | 'document' | 'text' | 'link';
  media_key: string;
  media_url: string | null;
  media_content: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export function useAgentMedia(agentId: string | null) {
  const [medias, setMedias] = useState<AgentMedia[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadMedias = useCallback(async () => {
    if (!agentId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent-media`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: 'list', agentId }),
        }
      );

      const result = await response.json();
      if (result.success) {
        setMedias(result.medias || []);
      } else {
        console.error('Error loading medias:', result.error);
      }
    } catch (error) {
      console.error('Error loading medias:', error);
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  // Real-time subscription for media changes
  useEffect(() => {
    if (!agentId) return;

    const channel = supabase
      .channel(`ai-agent-media-${agentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_agent_media',
          filter: `agent_id=eq.${agentId}`,
        },
        () => {
          // Reload medias when any change happens
          loadMedias();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [agentId, loadMedias]);

  const uploadMedia = useCallback(async (
    mediaType: 'image' | 'video' | 'audio' | 'document',
    mediaKey: string,
    file: File
  ): Promise<AgentMedia | null> => {
    if (!agentId) return null;

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent-media`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            action: 'upload',
            agentId,
            mediaType,
            mediaKey,
            fileBase64: base64,
            fileName: file.name,
            mimeType: file.type,
          }),
        }
      );

      const result = await response.json();
      if (result.success) {
        toast.success('Mídia enviada com sucesso!');
        return result.media;
      } else {
        toast.error(result.error || 'Erro ao enviar mídia');
        return null;
      }
    } catch (error) {
      console.error('Error uploading media:', error);
      toast.error('Erro ao enviar mídia');
      return null;
    }
  }, [agentId]);

  const createTextOrLink = useCallback(async (
    mediaType: 'text' | 'link',
    mediaKey: string,
    mediaContent: string
  ): Promise<AgentMedia | null> => {
    if (!agentId) return null;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent-media`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            action: mediaType === 'text' ? 'create_text' : 'create_link',
            agentId,
            mediaType,
            mediaKey,
            mediaContent,
          }),
        }
      );

      const result = await response.json();
      if (result.success) {
        toast.success(mediaType === 'text' ? 'Texto criado!' : 'Link criado!');
        return result.media;
      } else {
        toast.error(result.error || 'Erro ao criar');
        return null;
      }
    } catch (error) {
      console.error('Error creating text/link:', error);
      toast.error('Erro ao criar');
      return null;
    }
  }, [agentId]);

  const deleteMedia = useCallback(async (mediaId: string): Promise<boolean> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-agent-media`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: 'delete', mediaId }),
        }
      );

      const result = await response.json();
      if (result.success) {
        toast.success('Mídia excluída!');
        setMedias(prev => prev.filter(m => m.id !== mediaId));
        return true;
      } else {
        toast.error(result.error || 'Erro ao excluir');
        return false;
      }
    } catch (error) {
      console.error('Error deleting media:', error);
      toast.error('Erro ao excluir');
      return false;
    }
  }, []);

  const getMediasByType = useCallback((type: AgentMedia['media_type']) => {
    return medias.filter(m => m.media_type === type);
  }, [medias]);

  return {
    medias,
    isLoading,
    loadMedias,
    uploadMedia,
    createTextOrLink,
    deleteMedia,
    getMediasByType,
  };
}
