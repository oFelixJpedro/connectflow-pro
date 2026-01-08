import { useState, useEffect, useCallback, useRef } from 'react';
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
  name: string;
  is_default: boolean;
  columns: CRMColumn[];
}

export interface ContactCRMPosition {
  card_id: string;
  connection_id: string;
  board_id: string;
  board_name: string;
  column_id: string;
  column_name: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

// Custom event name for local CRM updates
const CRM_POSITION_CHANGED_EVENT = 'crm-position-changed';

export function useContactCRM(contactId: string | null) {
  const { profile, company, userRole } = useAuth();
  const [connections, setConnections] = useState<CRMConnection[]>([]);
  // Changed: Now stores an ARRAY of boards per connection (multi-board support)
  const [boards, setBoards] = useState<Map<string, CRMBoard[]>>(new Map());
  const [currentPosition, setCurrentPosition] = useState<ContactCRMPosition | null>(null);
  const [loading, setLoading] = useState(false);

  // Refs to avoid stale closures in realtime handler
  const boardsRef = useRef<Map<string, CRMBoard[]>>(new Map());
  const contactIdRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => {
    boardsRef.current = boards;
  }, [boards]);

  useEffect(() => {
    contactIdRef.current = contactId;
  }, [contactId]);

  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  // Load connections and their boards
  const loadData = useCallback(async () => {
    if (!company?.id || !profile?.id) return;

    setLoading(true);
    try {
      let connectionsData: CRMConnection[] = [];

      if (isAdminOrOwner) {
        // Admin/Owner: Load all WhatsApp connections
        const { data, error } = await supabase
          .from('whatsapp_connections')
          .select('id, name, phone_number')
          .eq('company_id', company.id)
          .eq('active', true)
          .eq('status', 'connected');

        if (error) throw error;
        connectionsData = data || [];
      } else {
        // Other roles: Only load connections with crm_access = true
        const { data: connectionUsers, error: cuError } = await supabase
          .from('connection_users')
          .select('connection_id')
          .eq('user_id', profile.id)
          .eq('crm_access', true);

        if (cuError) throw cuError;

        if (connectionUsers?.length) {
          const allowedIds = connectionUsers.map(cu => cu.connection_id);
          const { data, error } = await supabase
            .from('whatsapp_connections')
            .select('id, name, phone_number')
            .eq('company_id', company.id)
            .eq('active', true)
            .eq('status', 'connected')
            .in('id', allowedIds);

          if (error) throw error;
          connectionsData = data || [];
        }
      }

      setConnections(connectionsData);

      // Load ALL boards for each connection (multi-board support)
      const boardsMap = new Map<string, CRMBoard[]>();

      for (const conn of connectionsData || []) {
        // Fetch ALL boards for this connection, ordered by is_default (true first) then name
        const { data: boardsData } = await supabase
          .from('kanban_boards')
          .select('id, name, is_default')
          .eq('whatsapp_connection_id', conn.id)
          .order('is_default', { ascending: false })
          .order('name');

        if (boardsData && boardsData.length > 0) {
          const connectionBoards: CRMBoard[] = [];

          for (const boardData of boardsData) {
            const { data: columnsData } = await supabase
              .from('kanban_columns')
              .select('id, board_id, name, color, position')
              .eq('board_id', boardData.id)
              .order('position', { ascending: true });

            connectionBoards.push({
              id: boardData.id,
              connection_id: conn.id,
              name: boardData.name || 'CRM Principal',
              is_default: boardData.is_default || false,
              columns: columnsData || []
            });
          }

          boardsMap.set(conn.id, connectionBoards);
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
  }, [company?.id, profile?.id, isAdminOrOwner, contactId]);

  // Load current card position for contact
  const loadCurrentPosition = async (
    cId: string, 
    boardsMap: Map<string, CRMBoard[]>
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
              name,
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
          board_name: board?.name || 'CRM Principal',
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

  // Dispatch local event for immediate update in same browser
  const dispatchPositionChangedEvent = (cId: string) => {
    window.dispatchEvent(
      new CustomEvent(CRM_POSITION_CHANGED_EVENT, { detail: { contactId: cId } })
    );
  };

  // Create or move card to a specific column
  // Updated: Now accepts optional boardId parameter for multi-board support
  const setCardPosition = async (
    cId: string,
    connectionId: string,
    columnId: string,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
    boardId?: string
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
            .flatMap(boardList => boardList.flatMap(b => b.columns))
            .find(c => c.id === existingCard.column_id);
          const newColumn = Array.from(boards.values())
            .flatMap(boardList => boardList.flatMap(b => b.columns))
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
        // Create new card - need to determine board
        const connectionBoards = boards.get(connectionId);
        
        // Find the target board
        let targetBoard: CRMBoard | undefined;
        if (boardId) {
          targetBoard = connectionBoards?.find(b => b.id === boardId);
        } else {
          // Use default board if no boardId specified
          targetBoard = connectionBoards?.find(b => b.is_default) || connectionBoards?.[0];
        }

        if (!targetBoard) {
          // Create board first if doesn't exist and user is admin
          if (isAdminOrOwner) {
            const { data: newBoard, error: boardError } = await supabase
              .from('kanban_boards')
              .insert({
                whatsapp_connection_id: connectionId,
                company_id: company?.id,
                name: 'CRM Principal',
                is_default: true,
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
          .flatMap(boardList => boardList.flatMap(b => b.columns))
          .find(c => c.id === columnId);

        await supabase.from('kanban_card_history').insert([{
          card_id: newCard.id,
          user_id: profile.id,
          action_type: 'created',
          new_value: { column: column?.name } as Json,
        }]);

        toast.success('Contato adicionado ao CRM');
      }

      // Reload position immediately
      await loadCurrentPosition(cId, boards);
      
      // Dispatch local event for other instances of this hook
      dispatchPositionChangedEvent(cId);
      
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
      
      // Dispatch local event
      dispatchPositionChangedEvent(cId);
      
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

  // ============================================================
  // LOCAL EVENT: Listen for position changes from same browser
  // ============================================================
  useEffect(() => {
    const handlePositionChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ contactId: string }>;
      const changedContactId = customEvent.detail?.contactId;
      
      if (changedContactId && changedContactId === contactIdRef.current) {
        console.log('[useContactCRM] Local event received, reloading position');
        loadCurrentPosition(changedContactId, boardsRef.current);
      }
    };

    window.addEventListener(CRM_POSITION_CHANGED_EVENT, handlePositionChanged);
    
    return () => {
      window.removeEventListener(CRM_POSITION_CHANGED_EVENT, handlePositionChanged);
    };
  }, []); // Empty deps - uses refs

  // ============================================================
  // REALTIME: Subscription para atualizar posição do card
  // ============================================================
  useEffect(() => {
    if (!contactId) return;

    console.log('[useContactCRM] Iniciando subscription real-time para contactId:', contactId);

    const channel = supabase
      .channel(`crm-card-${contactId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'kanban_cards',
          filter: `contact_id=eq.${contactId}`,
        },
        async (payload) => {
          console.log('[useContactCRM] Evento real-time recebido:', payload.eventType, payload);
          
          const currentContactId = contactIdRef.current;
          if (!currentContactId) return;
          
          if (payload.eventType === 'DELETE') {
            setCurrentPosition(null);
          } else {
            // Recarrega a posição com os dados completos (incluindo nome da coluna)
            await loadCurrentPosition(currentContactId, boardsRef.current);
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[useContactCRM] Subscription status:', status, err || '');
        
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[useContactCRM] Realtime subscription failed:', status, err);
        }
        
        if (status === 'SUBSCRIBED') {
          console.log('[useContactCRM] Realtime subscription active');
        }
      });

    return () => {
      console.log('[useContactCRM] Removendo subscription real-time');
      supabase.removeChannel(channel);
    };
  }, [contactId]); // Only depends on contactId, uses refs for boards

  // Helper function to get all boards as flat array
  const getAllBoards = useCallback((): CRMBoard[] => {
    return Array.from(boards.values()).flat();
  }, [boards]);

  // Helper function to get default board for a connection
  const getDefaultBoard = useCallback((connectionId: string): CRMBoard | undefined => {
    const connectionBoards = boards.get(connectionId);
    return connectionBoards?.find(b => b.is_default) || connectionBoards?.[0];
  }, [boards]);

  return {
    connections,
    boards,
    currentPosition,
    loading,
    setCardPosition,
    removeFromCRM,
    refresh: loadData,
    getAllBoards,
    getDefaultBoard,
  };
}
