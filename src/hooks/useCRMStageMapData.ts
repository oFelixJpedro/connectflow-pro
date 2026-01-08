import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getStateFromPhone, StateCode } from '@/lib/dddMapping';

export interface CRMConnection {
  id: string;
  name: string;
}

export interface CRMStage {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface CRMStageMapData {
  countByState: Partial<Record<StateCode, number>>;
  total: number;
}

export function useCRMStageMapData(connectionId: string | null, stageId: string | null) {
  const { profile } = useAuth();
  const [connections, setConnections] = useState<CRMConnection[]>([]);
  const [stages, setStages] = useState<CRMStage[]>([]);
  const [stageData, setStageData] = useState<CRMStageMapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStages, setLoadingStages] = useState(false);

  // Fetch available connections
  useEffect(() => {
    if (!profile?.company_id) return;

    const fetchConnections = async () => {
      const { data } = await supabase
        .from('whatsapp_connections')
        .select('id, name')
        .eq('company_id', profile.company_id)
        .eq('active', true)
        .order('name');

      if (data) {
        setConnections(data);
      }
    };

    fetchConnections();
  }, [profile?.company_id]);

  // Fetch stages when connection is selected
  useEffect(() => {
    if (!connectionId || !profile?.company_id) {
      setStages([]);
      return;
    }

    const fetchStages = async () => {
      setLoadingStages(true);
      try {
        // First get the board for this connection
        const { data: board } = await supabase
          .from('kanban_boards')
          .select('id')
          .eq('whatsapp_connection_id', connectionId)
          .maybeSingle();

        if (!board) {
          setStages([]);
          return;
        }

        // Then get the columns for this board
        const { data: columns } = await supabase
          .from('kanban_columns')
          .select('id, name, color, position')
          .eq('board_id', board.id)
          .order('position');

        if (columns) {
          setStages(columns);
        }
      } catch (error) {
        console.error('Error fetching stages:', error);
      } finally {
        setLoadingStages(false);
      }
    };

    fetchStages();
  }, [connectionId, profile?.company_id]);

  // Fetch geographic data for the selected stage
  useEffect(() => {
    if (!stageId || !profile?.company_id) {
      setStageData(null);
      return;
    }

    const fetchStageData = async () => {
      setLoading(true);
      try {
        // Get all cards in this stage
        const { data: cards } = await supabase
          .from('kanban_cards')
          .select(`
            id,
            contact:contacts(phone_number)
          `)
          .eq('column_id', stageId);

        if (!cards) {
          setStageData({ countByState: {}, total: 0 });
          return;
        }

        // Count by state
        const countByState: Partial<Record<StateCode, number>> = {};
        let total = 0;

        cards.forEach(card => {
          const contact = card.contact as any;
          if (contact?.phone_number) {
            const stateInfo = getStateFromPhone(contact.phone_number);
            if (stateInfo) {
              countByState[stateInfo.state] = (countByState[stateInfo.state] || 0) + 1;
              total++;
            }
          }
        });

        setStageData({ countByState, total });
      } catch (error) {
        console.error('Error fetching stage data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStageData();
  }, [stageId, profile?.company_id]);

  return {
    connections,
    stages,
    stageData,
    loading,
    loadingStages,
  };
}
