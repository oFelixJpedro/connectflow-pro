import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { 
  AIAgent, 
  AIAgentConnection, 
  AIAgentTemplate,
  CreateAIAgentData, 
  UpdateAIAgentData 
} from '@/types/ai-agents';

export function useAIAgents() {
  const { profile } = useAuth();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [templates, setTemplates] = useState<AIAgentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar agentes da empresa
  const loadAgents = useCallback(async () => {
    if (!profile?.company_id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('ai_agents')
        .select(`
          *,
          connections:ai_agent_connections(
            id,
            connection_id,
            created_at,
            connection:whatsapp_connections(id, name, phone_number, status)
          )
        `)
        .eq('company_id', profile.company_id)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      // Processar agentes primários e secundários
      const processedAgents = (data || []).map(agent => ({
        ...agent,
        company_info: agent.company_info || {},
        activation_triggers: agent.activation_triggers || [],
      })) as AIAgent[];
      
      setAgents(processedAgents);
    } catch (err) {
      console.error('Erro ao carregar agentes:', err);
      setError('Erro ao carregar agentes');
    } finally {
      setIsLoading(false);
    }
  }, [profile?.company_id]);

  // Carregar templates disponíveis
  const loadTemplates = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('ai_agent_templates')
        .select('*')
        .eq('is_active', true)
        .order('usage_count', { ascending: false });

      if (fetchError) throw fetchError;
      
      setTemplates((data || []).map(t => ({
        ...t,
        company_info_template: t.company_info_template || {},
      })) as AIAgentTemplate[]);
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
    }
  }, []);

  // Criar novo agente
  const createAgent = useCallback(async (data: CreateAIAgentData): Promise<AIAgent | null> => {
    if (!profile?.company_id || !profile?.id) {
      toast.error('Usuário não autenticado');
      return null;
    }

    try {
      const { data: newAgent, error: createError } = await supabase
        .from('ai_agents')
        .insert({
          company_id: profile.company_id,
          name: data.name,
          description: data.description || null,
          agent_type: data.agent_type,
          is_primary: data.is_primary ?? (data.agent_type === 'single'),
          parent_agent_id: data.parent_agent_id || null,
          created_by: profile.id,
          status: 'inactive',
          temperature: 1.0,
          audio_temperature: 1.0,
        })
        .select()
        .single();

      if (createError) throw createError;

      toast.success('Agente criado com sucesso!');
      await loadAgents();
      
      return {
        ...newAgent,
        company_info: newAgent.company_info || {},
        activation_triggers: newAgent.activation_triggers || [],
      } as AIAgent;
    } catch (err) {
      console.error('Erro ao criar agente:', err);
      toast.error('Erro ao criar agente');
      return null;
    }
  }, [profile?.company_id, profile?.id, loadAgents]);

  // Atualizar agente
  const updateAgent = useCallback(async (agentId: string, data: UpdateAIAgentData): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('ai_agents')
        .update(data)
        .eq('id', agentId);

      if (updateError) throw updateError;

      toast.success('Agente atualizado com sucesso!');
      await loadAgents();
      return true;
    } catch (err) {
      console.error('Erro ao atualizar agente:', err);
      toast.error('Erro ao atualizar agente');
      return false;
    }
  }, [loadAgents]);

  // Excluir agente (com limpeza completa de arquivos e registros)
  const deleteAgent = useCallback(async (agentId: string): Promise<boolean> => {
    try {
      // 1. Buscar todas as mídias do agente para excluir do storage
      const { data: mediaRecords } = await supabase
        .from('ai_agent_media')
        .select('id, media_url')
        .eq('agent_id', agentId);

      // 2. Excluir arquivos do storage
      if (mediaRecords && mediaRecords.length > 0) {
        const filePaths = mediaRecords
          .filter(m => m.media_url)
          .map(m => {
            // Extrair o path do arquivo da URL
            const url = m.media_url as string;
            const match = url.match(/ai-agent-media\/(.+)$/);
            return match ? match[1] : null;
          })
          .filter(Boolean) as string[];

        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('ai-agent-media')
            .remove(filePaths);

          if (storageError) {
            console.warn('Aviso: Alguns arquivos não puderam ser excluídos do storage:', storageError);
          }
        }
      }

      // 3. Limpar registros órfãos de ai_conversation_states
      const { error: statesError } = await supabase
        .from('ai_conversation_states')
        .delete()
        .eq('agent_id', agentId);

      if (statesError) {
        console.warn('Aviso: Erro ao limpar estados de conversação:', statesError);
      }

      // 4. Excluir o agente (CASCADE vai limpar ai_agent_connections, ai_agent_media, ai_agent_logs)
      const { error: deleteError } = await supabase
        .from('ai_agents')
        .delete()
        .eq('id', agentId);

      if (deleteError) throw deleteError;

      toast.success('Agente excluído com sucesso!');
      await loadAgents();
      return true;
    } catch (err) {
      console.error('Erro ao excluir agente:', err);
      toast.error('Erro ao excluir agente');
      return false;
    }
  }, [loadAgents]);

  // Alterar status do agente
  const setAgentStatus = useCallback(async (agentId: string, status: 'active' | 'paused' | 'inactive', pausedUntil?: Date): Promise<boolean> => {
    try {
      const updateData: UpdateAIAgentData = { status };
      if (status === 'paused' && pausedUntil) {
        (updateData as Record<string, unknown>).paused_until = pausedUntil.toISOString();
      } else {
        (updateData as Record<string, unknown>).paused_until = null;
      }

      const { error: updateError } = await supabase
        .from('ai_agents')
        .update(updateData)
        .eq('id', agentId);

      if (updateError) throw updateError;

      const statusLabels = {
        active: 'ativado',
        paused: 'pausado',
        inactive: 'desativado',
      };
      
      toast.success(`Agente ${statusLabels[status]} com sucesso!`);
      await loadAgents();
      return true;
    } catch (err) {
      console.error('Erro ao alterar status do agente:', err);
      toast.error('Erro ao alterar status do agente');
      return false;
    }
  }, [loadAgents]);

  // Vincular conexão ao agente
  const addConnection = useCallback(async (agentId: string, connectionId: string): Promise<boolean> => {
    try {
      // VALIDAÇÃO: Verificar se a conexão já está vinculada a outro agente
      const { data: existingLink, error: checkError } = await supabase
        .from('ai_agent_connections')
        .select('agent_id')
        .eq('connection_id', connectionId)
        .neq('agent_id', agentId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingLink) {
        toast.error('Esta conexão já está vinculada a outro agente');
        return false;
      }

      const { error: insertError } = await supabase
        .from('ai_agent_connections')
        .insert({
          agent_id: agentId,
          connection_id: connectionId,
        });

      if (insertError) throw insertError;

      toast.success('Conexão vinculada ao agente!');
      await loadAgents();
      return true;
    } catch (err) {
      console.error('Erro ao vincular conexão:', err);
      toast.error('Erro ao vincular conexão');
      return false;
    }
  }, [loadAgents]);

  // Remover conexão do agente
  const removeConnection = useCallback(async (agentId: string, connectionId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('ai_agent_connections')
        .delete()
        .eq('agent_id', agentId)
        .eq('connection_id', connectionId);

      if (deleteError) throw deleteError;

      toast.success('Conexão removida do agente!');
      await loadAgents();
      return true;
    } catch (err) {
      console.error('Erro ao remover conexão:', err);
      toast.error('Erro ao remover conexão');
      return false;
    }
  }, [loadAgents]);

  // Criar agente a partir de template
  const createFromTemplate = useCallback(async (templateId: string, name: string): Promise<AIAgent | null> => {
    if (!profile?.company_id || !profile?.id) {
      toast.error('Usuário não autenticado');
      return null;
    }

    try {
      // Buscar template
      const { data: template, error: templateError } = await supabase
        .from('ai_agent_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;

      // Criar agente com dados do template
      const { data: newAgent, error: createError } = await supabase
        .from('ai_agents')
        .insert({
          company_id: profile.company_id,
          name,
          description: template.description,
          agent_type: template.agent_type,
          is_primary: true,
          rules_content: template.rules_template,
          script_content: template.script_template,
          faq_content: template.faq_template,
          company_info: template.company_info_template,
          delay_seconds: template.default_delay_seconds,
          voice_name: template.default_voice_name,
          speech_speed: template.default_speech_speed,
          created_by: profile.id,
          status: 'inactive',
        })
        .select()
        .single();

      if (createError) throw createError;

      // Incrementar contador de uso do template
      await supabase
        .from('ai_agent_templates')
        .update({ usage_count: (template.usage_count || 0) + 1 })
        .eq('id', templateId);

      toast.success('Agente criado a partir do modelo!');
      await loadAgents();
      
      return {
        ...newAgent,
        company_info: newAgent.company_info || {},
        activation_triggers: newAgent.activation_triggers || [],
      } as AIAgent;
    } catch (err) {
      console.error('Erro ao criar agente do template:', err);
      toast.error('Erro ao criar agente do modelo');
      return null;
    }
  }, [profile?.company_id, profile?.id, loadAgents]);

  // Carregar dados iniciais
  useEffect(() => {
    loadAgents();
    loadTemplates();
  }, [loadAgents, loadTemplates]);

  // Separar agentes primários e secundários
  const primaryAgents = agents.filter(a => a.is_primary && !a.parent_agent_id);
  const secondaryAgents = agents.filter(a => !a.is_primary || a.parent_agent_id);

  // Função para obter sub-agentes de um agente pai
  const getSubAgents = useCallback((parentId: string): AIAgent[] => {
    return agents.filter(a => a.parent_agent_id === parentId);
  }, [agents]);

  // Função para obter o agente pai de um sub-agente
  const getParentAgent = useCallback((agentId: string): AIAgent | null => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent?.parent_agent_id) return null;
    return agents.find(a => a.id === agent.parent_agent_id) || null;
  }, [agents]);

  return {
    agents,
    primaryAgents,
    secondaryAgents,
    templates,
    isLoading,
    error,
    loadAgents,
    loadTemplates,
    createAgent,
    updateAgent,
    deleteAgent,
    setAgentStatus,
    addConnection,
    removeConnection,
    createFromTemplate,
    getSubAgents,
    getParentAgent,
  };
}
