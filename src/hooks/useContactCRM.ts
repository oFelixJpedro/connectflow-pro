import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface CRMConnection {
  id: string;
  name: string;
  phone_number: string;
}

export interface CRMColumn {
  id: string;
  board_id: string;
  name: string;
  color: string;
  position: number;
}

export interface CRMBoard {
  id: string;
  connection_id: string;
  columns: CRMColumn[];
}

export interface ContactCRMPosition {
  card_id: string;
  connection_id: string;
  board_id: string;
  column_id: string;
  column_name: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export function useContactCRM(contactId: string | null) {
  const { profile, company, userRole } = useAuth();
  const [connections, setConnections] = useState<CRMConnection[]>([]);
  const [boards, setBoards] = useState<Map<string, CRMBoard>>(new Map());
  const [currentPosition, setCurrentPosition] = useState<ContactCRMPosition | null>(null);
  const [loading, setLoading] = useState(false);

  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  // Load connections and their boards
  const loadData = useCallback(async () => {
    if (!company?.id) return;

    setLoading(true);
    try {
      // Load all WhatsApp connections
      const { data: connectionsData, error: connError } = await supabase
        .from('whatsapp_connections')
        .select('id, name, phone_number')
        .eq('company_id', company.id)
        .eq('status', 'connected');

      if (connError) throw connError;

      setConnections(connectionsData || []);

      // Load boards for each connection
      const boardsMap = new Map<string, CRMBoard>();

      for (const conn of connectionsData || []) {
        const { data: boardData } = await supabase
          .from('kanban_boards')
          .select('id')
          .eq('whatsapp_connection_id', conn.id)
          .maybeSingle();

        if (boardData) {
          const { data: columnsData } = await supabase
            .from('kanban_columns')
            .select('id, board_id, name, color, position')
            .eq('board_id', boardData.id)
            .order('position', { ascending: true });

          boardsMap.set(conn.id, {
            id: boardData.id,
            connection_id: conn.id,
            columns: columnsData || []
          });
        }
      }

      setBoards(boardsMap);

      // Load current position if contact exists
      if (contactId) {
        await loadCurrentPosition(contactId, boardsMap);
      }
    } catch (error) {
      console.error('Error loading CRM data:', error);
    } finally {
      setLoading(false);
    }
  }, [company?.id, contactId]);

  // Load current card position for contact
  const loadCurrentPosition = async (
    cId: string, 
    boardsMap: Map<string, CRMBoard>
  ) => {
    try {
      const { data: cardData, error } = await supabase
        .from('kanban_cards')
        .select(`
          id,
          column_id,
          priority,
          kanban_columns!inner(
            id,
            name,
            board_id,
            kanban_boards!inner(
              id,
              whatsapp_connection_id
            )
          )
        `)
        .eq('contact_id', cId)
        .maybeSingle();

      if (error) throw error;

      if (cardData) {
        const column = cardData.kanban_columns as any;
        const board = column?.kanban_boards;
        
        setCurrentPosition({
          card_id: cardData.id,
          connection_id: board?.whatsapp_connection_id || '',
          board_id: column?.board_id || '',
          column_id: cardData.column_id,
          column_name: column?.name || '',
          priority: cardData.priority as 'low' | 'medium' | 'high' | 'urgent'
        });
      } else {
        setCurrentPosition(null);
      }
    } catch (error) {
      console.error('Error loading card position:', error);
      setCurrentPosition(null);
    }
  };

  // Create or move card to a specific column
  const setCardPosition = async (
    cId: string,
    connectionId: string,
    columnId: string,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
  ): Promise<boolean> => {
    if (!profile?.id) return false;

    try {
      // Check if card already exists
      const { data: existingCard } = await supabase
        .from('kanban_cards')
        .select('id, column_id')
        .eq('contact_id', cId)
        .maybeSingle();

      if (existingCard) {
        // Move existing card
        const { error } = await supabase
          .from('kanban_cards')
          .update({ column_id: columnId, priority })
          .eq('id', existingCard.id);

        if (error) throw error;

        // Add history if column changed
        if (existingCard.column_id !== columnId) {
          const oldColumn = Array.from(boards.values())
            .flatMap(b => b.columns)
            .find(c => c.id === existingCard.column_id);
          const newColumn = Array.from(boards.values())
            .flatMap(b => b.columns)
            .find(c => c.id === columnId);

          await supabase.from('kanban_card_history').insert([{
            card_id: existingCard.id,
            user_id: profile.id,
            action_type: 'moved',
            old_value: { column: oldColumn?.name } as Json,
            new_value: { column: newColumn?.name } as Json,
          }]);
        }

        toast.success('Posição no CRM atualizada');
      } else {
        // Create new card
        const board = boards.get(connectionId);
        if (!board) {
          // Create board first if doesn't exist and user is admin
          if (isAdminOrOwner) {
            const { data: newBoard, error: boardError } = await supabase
              .from('kanban_boards')
              .insert({
                whatsapp_connection_id: connectionId,
                company_id: company?.id,
              })
              .select()
              .single();

            if (boardError) throw boardError;

            // Create default columns
            const defaultColumns = [
              { name: 'Novo', color: '#D6E5FF', position: 0 },
              { name: 'Em Contato', color: '#FFF5D6', position: 1 },
              { name: 'Negociando', color: '#E8D6FF', position: 2 },
              { name: 'Fechado', color: '#D6FFE0', position: 3 },
              { name: 'Perdido', color: '#FFD6E0', position: 4 },
            ];

            const { data: createdColumns } = await supabase
              .from('kanban_columns')
              .insert(defaultColumns.map(col => ({
                board_id: newBoard.id,
                ...col
              })))
              .select();

            // Use first column if columnId was not specified properly
            const firstColumn = createdColumns?.find(c => c.position === 0);
            if (firstColumn) {
              columnId = firstColumn.id;
            }
          } else {
            toast.error('Board CRM não existe para esta conexão');
            return false;
          }
        }

        // Get max position in column
        const { data: columnCards } = await supabase
          .from('kanban_cards')
          .select('position')
          .eq('column_id', columnId)
          .order('position', { ascending: false })
          .limit(1);

        const maxPosition = columnCards?.[0]?.position ?? -1;

        const { data: newCard, error: cardError } = await supabase
          .from('kanban_cards')
          .insert({
            column_id: columnId,
            contact_id: cId,
            priority,
            position: maxPosition + 1,
          })
          .select()
          .single();

        if (cardError) throw cardError;

        // Add history
        const column = Array.from(boards.values())
          .flatMap(b => b.columns)
          .find(c => c.id === columnId);

        await supabase.from('kanban_card_history').insert([{
          card_id: newCard.id,
          user_id: profile.id,
          action_type: 'created',
          new_value: { column: column?.name } as Json,
        }]);

        toast.success('Contato adicionado ao CRM');
      }

      // Reload position
      await loadCurrentPosition(cId, boards);
      return true;
    } catch (error) {
      console.error('Error setting card position:', error);
      toast.error('Erro ao atualizar posição no CRM');
      return false;
    }
  };

  // Remove card from CRM
  const removeFromCRM = async (cId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('kanban_cards')
        .delete()
        .eq('contact_id', cId);

      if (error) throw error;

      setCurrentPosition(null);
      toast.success('Contato removido do CRM');
      return true;
    } catch (error) {
      console.error('Error removing from CRM:', error);
      toast.error('Erro ao remover do CRM');
      return false;
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    connections,
    boards,
    currentPosition,
    loading,
    setCardPosition,
    removeFromCRM,
    refresh: loadData,
  };
}
