import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type {
  FollowUpSequence,
  FollowUpSequenceStep,
  CreateSequenceData,
  CreateStepData,
  UpdateSequenceData,
  UpdateStepData,
  FollowUpStatus
} from '@/types/follow-up';

export function useFollowUpSequences() {
  const { profile } = useAuth();
  const [sequences, setSequences] = useState<FollowUpSequence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSequences = useCallback(async () => {
    if (!profile?.company_id) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data: sequencesData, error: sequencesError } = await supabase
        .from('follow_up_sequences')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (sequencesError) throw sequencesError;

      // Fetch steps for each sequence
      const sequenceIds = sequencesData?.map(s => s.id) || [];
      
      if (sequenceIds.length > 0) {
        const { data: stepsData, error: stepsError } = await supabase
          .from('follow_up_sequence_steps')
          .select('*')
          .in('sequence_id', sequenceIds)
          .order('step_order', { ascending: true });

        if (stepsError) throw stepsError;

        // Fetch active contacts count
        const { data: contactStates, error: contactsError } = await supabase
          .from('follow_up_contact_state')
          .select('active_sequence_id')
          .in('active_sequence_id', sequenceIds)
          .eq('opted_out', false);

        if (contactsError) throw contactsError;

        // Map steps and contact counts to sequences
        const sequencesWithData = sequencesData?.map(seq => ({
          ...seq,
          steps: stepsData?.filter(step => step.sequence_id === seq.id) || [],
          active_contacts_count: contactStates?.filter(cs => cs.active_sequence_id === seq.id).length || 0
        })) as FollowUpSequence[];

        setSequences(sequencesWithData);
      } else {
        setSequences([]);
      }
    } catch (err: any) {
      console.error('Error fetching follow-up sequences:', err);
      setError(err.message);
      toast.error('Erro ao carregar sequências de follow-up');
    } finally {
      setIsLoading(false);
    }
  }, [profile?.company_id]);

  useEffect(() => {
    fetchSequences();
  }, [fetchSequences]);

  const createSequence = async (data: CreateSequenceData): Promise<FollowUpSequence | null> => {
    if (!profile?.company_id) return null;

    try {
      const { data: newSequence, error } = await supabase
        .from('follow_up_sequences')
        .insert({
          company_id: profile.company_id,
          created_by: profile.id,
          name: data.name,
          description: data.description || null,
          follow_up_type: data.follow_up_type,
          ai_model_type: data.ai_model_type || 'standard',
          persona_prompt: data.persona_prompt || null,
          rules_content: data.rules_content || null,
          knowledge_base_content: data.knowledge_base_content || null,
          connection_ids: data.connection_ids || [],
          crm_stage_ids: data.crm_stage_ids || [],
          tag_filters: data.tag_filters || [],
          operating_hours_enabled: data.operating_hours_enabled || false,
          operating_start_time: data.operating_start_time || '09:00',
          operating_end_time: data.operating_end_time || '18:00',
          operating_days: data.operating_days || [1, 2, 3, 4, 5],
          priority: data.priority || 0,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Sequência criada com sucesso');
      await fetchSequences();
      return newSequence as FollowUpSequence;
    } catch (err: any) {
      console.error('Error creating sequence:', err);
      toast.error('Erro ao criar sequência');
      return null;
    }
  };

  const updateSequence = async (id: string, data: UpdateSequenceData): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('follow_up_sequences')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      toast.success('Sequência atualizada');
      await fetchSequences();
      return true;
    } catch (err: any) {
      console.error('Error updating sequence:', err);
      toast.error('Erro ao atualizar sequência');
      return false;
    }
  };

  const deleteSequence = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('follow_up_sequences')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Sequência excluída');
      await fetchSequences();
      return true;
    } catch (err: any) {
      console.error('Error deleting sequence:', err);
      toast.error('Erro ao excluir sequência');
      return false;
    }
  };

  const toggleStatus = async (id: string, status: FollowUpStatus): Promise<boolean> => {
    return updateSequence(id, { status });
  };

  // Step management
  const addStep = async (sequenceId: string, data: CreateStepData): Promise<FollowUpSequenceStep | null> => {
    try {
      const { data: newStep, error } = await supabase
        .from('follow_up_sequence_steps')
        .insert({
          sequence_id: sequenceId,
          step_order: data.step_order,
          delay_value: data.delay_value,
          delay_unit: data.delay_unit,
          manual_content: data.manual_content || null,
          manual_media_url: data.manual_media_url || null,
          manual_media_type: data.manual_media_type || null,
          ai_instruction: data.ai_instruction || null,
          stop_if_replied: data.stop_if_replied ?? true,
          stop_if_opened: data.stop_if_opened ?? false
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Etapa adicionada');
      await fetchSequences();
      return newStep as FollowUpSequenceStep;
    } catch (err: any) {
      console.error('Error adding step:', err);
      toast.error('Erro ao adicionar etapa');
      return null;
    }
  };

  const updateStep = async (stepId: string, data: UpdateStepData): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('follow_up_sequence_steps')
        .update(data)
        .eq('id', stepId);

      if (error) throw error;

      toast.success('Etapa atualizada');
      await fetchSequences();
      return true;
    } catch (err: any) {
      console.error('Error updating step:', err);
      toast.error('Erro ao atualizar etapa');
      return false;
    }
  };

  const deleteStep = async (stepId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('follow_up_sequence_steps')
        .delete()
        .eq('id', stepId);

      if (error) throw error;

      toast.success('Etapa removida');
      await fetchSequences();
      return true;
    } catch (err: any) {
      console.error('Error deleting step:', err);
      toast.error('Erro ao remover etapa');
      return false;
    }
  };

  const reorderSteps = async (sequenceId: string, stepIds: string[]): Promise<boolean> => {
    try {
      // Update each step's order
      const updates = stepIds.map((id, index) => 
        supabase
          .from('follow_up_sequence_steps')
          .update({ step_order: index + 1 })
          .eq('id', id)
      );

      await Promise.all(updates);

      await fetchSequences();
      return true;
    } catch (err: any) {
      console.error('Error reordering steps:', err);
      toast.error('Erro ao reordenar etapas');
      return false;
    }
  };

  return {
    sequences,
    isLoading,
    error,
    refetch: fetchSequences,
    createSequence,
    updateSequence,
    deleteSequence,
    toggleStatus,
    addStep,
    updateStep,
    deleteStep,
    reorderSteps
  };
}
