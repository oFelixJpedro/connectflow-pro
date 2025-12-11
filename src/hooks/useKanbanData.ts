import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface KanbanBoard {
  id: string;
  whatsapp_connection_id: string;
  company_id: string;
  created_at: string;
}

export interface KanbanColumn {
  id: string;
  board_id: string;
  name: string;
  color: string;
  position: number;
}

export interface KanbanCardTag {
  id: string;
  card_id: string;
  name: string;
  color: string;
}

export interface KanbanCardAttachment {
  id: string;
  card_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface KanbanCardChecklistItem {
  id: string;
  card_id: string;
  text: string;
  completed: boolean;
  position: number;
}

export interface KanbanCardComment {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export interface KanbanCardHistory {
  id: string;
  card_id: string;
  user_id: string | null;
  action_type: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  user?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export interface KanbanCard {
  id: string;
  column_id: string;
  contact_id: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_user_id: string | null;
  position: number;
  created_at: string;
  contact?: {
    id: string;
    name: string | null;
    phone_number: string;
    avatar_url: string | null;
    email: string | null;
  };
  assigned_user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  tags?: KanbanCardTag[];
  checklist_items?: KanbanCardChecklistItem[];
  attachments?: KanbanCardAttachment[];
  comments?: KanbanCardComment[];
}

const DEFAULT_COLUMNS = [
  { name: 'Novo', color: '#D6E5FF', position: 0 },
  { name: 'Em Contato', color: '#FFF5D6', position: 1 },
  { name: 'Negociando', color: '#E8D6FF', position: 2 },
  { name: 'Fechado', color: '#D6FFE0', position: 3 },
  { name: 'Perdido', color: '#FFD6E0', position: 4 },
];

export function useKanbanData(connectionId: string | null) {
  const { profile, company, userRole } = useAuth();
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<{ id: string; full_name: string; avatar_url: string | null }[]>([]);

  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  // Load team members for assignment dropdown
  const loadTeamMembers = useCallback(async () => {
    if (!company?.id) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('company_id', company.id)
      .eq('active', true);
    
    if (data) {
      setTeamMembers(data);
    }
  }, [company?.id]);

  // Load or create board
  const loadBoard = useCallback(async () => {
    if (!connectionId || !company?.id) {
      setBoard(null);
      setColumns([]);
      setCards([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Check if board exists
      let { data: existingBoard } = await supabase
        .from('kanban_boards')
        .select('*')
        .eq('whatsapp_connection_id', connectionId)
        .maybeSingle();

      if (!existingBoard && isAdminOrOwner) {
        // Create board with default columns
        const { data: newBoard, error: boardError } = await supabase
          .from('kanban_boards')
          .insert({
            whatsapp_connection_id: connectionId,
            company_id: company.id,
          })
          .select()
          .single();

        if (boardError) throw boardError;
        existingBoard = newBoard;

        // Create default columns
        const columnsToInsert = DEFAULT_COLUMNS.map(col => ({
          board_id: newBoard.id,
          name: col.name,
          color: col.color,
          position: col.position,
        }));

        await supabase.from('kanban_columns').insert(columnsToInsert);
      }

      if (existingBoard) {
        setBoard(existingBoard as KanbanBoard);
        await loadColumns(existingBoard.id);
        await loadCards(existingBoard.id);
      }
    } catch (error) {
      console.error('Error loading board:', error);
      toast.error('Erro ao carregar quadro Kanban');
    } finally {
      setLoading(false);
    }
  }, [connectionId, company?.id, isAdminOrOwner]);

  // Load columns
  const loadColumns = async (boardId: string) => {
    const { data, error } = await supabase
      .from('kanban_columns')
      .select('*')
      .eq('board_id', boardId)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading columns:', error);
      return;
    }

    setColumns(data || []);
  };

  // Load cards with relations
  const loadCards = async (boardId: string) => {
    // First get column IDs for this board
    const { data: boardColumns } = await supabase
      .from('kanban_columns')
      .select('id')
      .eq('board_id', boardId);

    if (!boardColumns?.length) {
      setCards([]);
      return;
    }

    const columnIds = boardColumns.map(c => c.id);

    const { data, error } = await supabase
      .from('kanban_cards')
      .select(`
        *,
        contact:contacts(id, name, phone_number, avatar_url, email),
        assigned_user:profiles!assigned_user_id(id, full_name, avatar_url),
        tags:kanban_card_tags(*),
        checklist_items:kanban_card_checklist_items(*)
      `)
      .in('column_id', columnIds)
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading cards:', error);
      return;
    }

    setCards((data || []) as KanbanCard[]);
  };

  // Create column (admin only)
  const createColumn = async (name: string, color: string) => {
    if (!board || !isAdminOrOwner) return null;

    const maxPosition = columns.reduce((max, col) => Math.max(max, col.position), -1);

    const { data, error } = await supabase
      .from('kanban_columns')
      .insert({
        board_id: board.id,
        name,
        color,
        position: maxPosition + 1,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao criar coluna');
      return null;
    }

    setColumns([...columns, data]);
    toast.success('Coluna criada');
    return data;
  };

  // Update column (admin only)
  const updateColumn = async (columnId: string, updates: Partial<KanbanColumn>) => {
    if (!isAdminOrOwner) return false;

    const { error } = await supabase
      .from('kanban_columns')
      .update(updates)
      .eq('id', columnId);

    if (error) {
      toast.error('Erro ao atualizar coluna');
      return false;
    }

    setColumns(columns.map(c => c.id === columnId ? { ...c, ...updates } : c));
    return true;
  };

  // Delete column (admin only)
  const deleteColumn = async (columnId: string, moveToColumnId?: string) => {
    if (!isAdminOrOwner) return false;

    // Move cards if specified
    if (moveToColumnId) {
      await supabase
        .from('kanban_cards')
        .update({ column_id: moveToColumnId })
        .eq('column_id', columnId);
    }

    const { error } = await supabase
      .from('kanban_columns')
      .delete()
      .eq('id', columnId);

    if (error) {
      toast.error('Erro ao excluir coluna');
      return false;
    }

    setColumns(columns.filter(c => c.id !== columnId));
    if (moveToColumnId) {
      setCards(cards.map(card => 
        card.column_id === columnId ? { ...card, column_id: moveToColumnId } : card
      ));
    } else {
      setCards(cards.filter(card => card.column_id !== columnId));
    }
    
    toast.success('Coluna excluída');
    return true;
  };

  // Reorder columns (admin only)
  const reorderColumns = async (newColumns: KanbanColumn[]) => {
    if (!isAdminOrOwner) return false;

    const updates = newColumns.map((col, index) => ({
      id: col.id,
      position: index,
    }));

    for (const update of updates) {
      await supabase
        .from('kanban_columns')
        .update({ position: update.position })
        .eq('id', update.id);
    }

    setColumns(newColumns.map((col, index) => ({ ...col, position: index })));
    return true;
  };

  // Move card
  const moveCard = async (cardId: string, toColumnId: string, newPosition: number) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return false;

    const oldColumnId = card.column_id;

    const { error } = await supabase
      .from('kanban_cards')
      .update({ column_id: toColumnId, position: newPosition })
      .eq('id', cardId);

    if (error) {
      toast.error('Erro ao mover card');
      return false;
    }

    // Add history entry
    if (oldColumnId !== toColumnId) {
      const oldColumn = columns.find(c => c.id === oldColumnId);
      const newColumn = columns.find(c => c.id === toColumnId);
      
      await supabase.from('kanban_card_history').insert([{
        card_id: cardId,
        user_id: profile?.id || null,
        action_type: 'moved',
        old_value: { column: oldColumn?.name } as Json,
        new_value: { column: newColumn?.name } as Json,
      }]);
    }

    setCards(cards.map(c => 
      c.id === cardId ? { ...c, column_id: toColumnId, position: newPosition } : c
    ));

    return true;
  };

  // Update card
  const updateCard = async (
    cardId: string, 
    updates: Partial<Pick<KanbanCard, 'priority' | 'assigned_user_id'>>,
    historyAction?: string,
    oldValue?: Record<string, unknown>,
    newValue?: Record<string, unknown>
  ) => {
    const { error } = await supabase
      .from('kanban_cards')
      .update(updates)
      .eq('id', cardId);

    if (error) {
      toast.error('Erro ao atualizar card');
      return false;
    }

    // Add history entry
    if (historyAction) {
      const historyEntry = {
        card_id: cardId,
        user_id: profile?.id || null,
        action_type: historyAction,
        old_value: (oldValue || null) as Json,
        new_value: (newValue || null) as Json,
      };
      await supabase.from('kanban_card_history').insert([historyEntry]);
    }

    // Update local state
    setCards(cards.map(c => {
      if (c.id !== cardId) return c;
      
      const updatedCard = { ...c, ...updates };
      
      // Update assigned_user reference if needed
      if ('assigned_user_id' in updates) {
        if (updates.assigned_user_id) {
          const member = teamMembers.find(m => m.id === updates.assigned_user_id);
          if (member) {
            updatedCard.assigned_user = member;
          }
        } else {
          updatedCard.assigned_user = undefined;
        }
      }
      
      return updatedCard;
    }));

    return true;
  };

  // Create card from existing contact
  const createCard = async (contactId: string) => {
    if (!board || !columns.length) return false;

    const firstColumn = columns.reduce((min, col) => 
      col.position < min.position ? col : min, columns[0]
    );

    const columnCards = cards.filter(c => c.column_id === firstColumn.id);
    const maxPosition = columnCards.reduce((max, c) => Math.max(max, c.position), -1);

    const { data, error } = await supabase
      .from('kanban_cards')
      .insert({
        column_id: firstColumn.id,
        contact_id: contactId,
        priority: 'medium' as const,
        position: maxPosition + 1,
      })
      .select(`
        *,
        contact:contacts(id, name, phone_number, avatar_url, email),
        assigned_user:profiles!assigned_user_id(id, full_name, avatar_url),
        tags:kanban_card_tags(*),
        checklist_items:kanban_card_checklist_items(*)
      `)
      .single();

    if (error) {
      toast.error('Erro ao criar card');
      return false;
    }

    // Add history
    await supabase.from('kanban_card_history').insert([{
      card_id: data.id,
      user_id: profile?.id || null,
      action_type: 'created',
      new_value: { column: firstColumn.name } as Json,
    }]);

    setCards([...cards, data as KanbanCard]);
    toast.success('Card adicionado');
    return true;
  };

  // Delete card
  const deleteCard = async (cardId: string) => {
    const { error } = await supabase
      .from('kanban_cards')
      .delete()
      .eq('id', cardId);

    if (error) {
      toast.error('Erro ao excluir card');
      return false;
    }

    setCards(cards.filter(c => c.id !== cardId));
    toast.success('Card excluído');
    return true;
  };

  // Add tag
  const addTag = async (cardId: string, name: string, color: string) => {
    const { data, error } = await supabase
      .from('kanban_card_tags')
      .insert({ card_id: cardId, name, color })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao adicionar tag');
      return null;
    }

    // Add history
    await supabase.from('kanban_card_history').insert([{
      card_id: cardId,
      user_id: profile?.id || null,
      action_type: 'tag_added',
      new_value: { tag: name } as Json,
    }]);

    setCards(cards.map(c => 
      c.id === cardId 
        ? { ...c, tags: [...(c.tags || []), data] }
        : c
    ));

    return data;
  };

  // Remove tag
  const removeTag = async (cardId: string, tagId: string) => {
    const card = cards.find(c => c.id === cardId);
    const tag = card?.tags?.find(t => t.id === tagId);

    const { error } = await supabase
      .from('kanban_card_tags')
      .delete()
      .eq('id', tagId);

    if (error) {
      toast.error('Erro ao remover tag');
      return false;
    }

    // Add history
    if (tag) {
      await supabase.from('kanban_card_history').insert([{
        card_id: cardId,
        user_id: profile?.id || null,
        action_type: 'tag_removed',
        old_value: { tag: tag.name } as Json,
      }]);
    }

    setCards(cards.map(c => 
      c.id === cardId 
        ? { ...c, tags: c.tags?.filter(t => t.id !== tagId) }
        : c
    ));

    return true;
  };

  // Add checklist item
  const addChecklistItem = async (cardId: string, text: string) => {
    const card = cards.find(c => c.id === cardId);
    const maxPosition = (card?.checklist_items || []).reduce((max, item) => Math.max(max, item.position), -1);

    const { data, error } = await supabase
      .from('kanban_card_checklist_items')
      .insert({ card_id: cardId, text, position: maxPosition + 1 })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao adicionar item');
      return null;
    }

    setCards(cards.map(c => 
      c.id === cardId 
        ? { ...c, checklist_items: [...(c.checklist_items || []), data] }
        : c
    ));

    return data;
  };

  // Toggle checklist item
  const toggleChecklistItem = async (cardId: string, itemId: string) => {
    const card = cards.find(c => c.id === cardId);
    const item = card?.checklist_items?.find(i => i.id === itemId);
    if (!item) return false;

    const newCompleted = !item.completed;

    const { error } = await supabase
      .from('kanban_card_checklist_items')
      .update({ completed: newCompleted })
      .eq('id', itemId);

    if (error) {
      toast.error('Erro ao atualizar item');
      return false;
    }

    // Add history
    await supabase.from('kanban_card_history').insert([{
      card_id: cardId,
      user_id: profile?.id || null,
      action_type: 'checklist_updated',
      old_value: { item: item.text, completed: item.completed } as Json,
      new_value: { item: item.text, completed: newCompleted } as Json,
    }]);

    setCards(cards.map(c => 
      c.id === cardId 
        ? { 
            ...c, 
            checklist_items: c.checklist_items?.map(i => 
              i.id === itemId ? { ...i, completed: newCompleted } : i
            )
          }
        : c
    ));

    return true;
  };

  // Delete checklist item
  const deleteChecklistItem = async (cardId: string, itemId: string) => {
    const { error } = await supabase
      .from('kanban_card_checklist_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      toast.error('Erro ao excluir item');
      return false;
    }

    setCards(cards.map(c => 
      c.id === cardId 
        ? { ...c, checklist_items: c.checklist_items?.filter(i => i.id !== itemId) }
        : c
    ));

    return true;
  };

  // Add comment
  const addComment = async (cardId: string, content: string) => {
    const { data, error } = await supabase
      .from('kanban_card_comments')
      .insert({ card_id: cardId, user_id: profile?.id, content })
      .select(`
        *,
        user:profiles!user_id(full_name, avatar_url)
      `)
      .single();

    if (error) {
      toast.error('Erro ao adicionar comentário');
      return null;
    }

    // Add history
    await supabase.from('kanban_card_history').insert([{
      card_id: cardId,
      user_id: profile?.id || null,
      action_type: 'comment_added',
      new_value: { comment: content.substring(0, 100) } as Json,
    }]);

    return data as KanbanCardComment;
  };

  // Load card comments
  const loadCardComments = async (cardId: string): Promise<KanbanCardComment[]> => {
    const { data, error } = await supabase
      .from('kanban_card_comments')
      .select(`
        *,
        user:profiles!user_id(full_name, avatar_url)
      `)
      .eq('card_id', cardId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading comments:', error);
      return [];
    }

    return (data || []) as KanbanCardComment[];
  };

  // Load card history
  const loadCardHistory = async (cardId: string): Promise<KanbanCardHistory[]> => {
    const { data, error } = await supabase
      .from('kanban_card_history')
      .select(`
        *,
        user:profiles!user_id(full_name, avatar_url)
      `)
      .eq('card_id', cardId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading history:', error);
      return [];
    }

    return (data || []) as KanbanCardHistory[];
  };

  // Load card attachments
  const loadCardAttachments = async (cardId: string): Promise<KanbanCardAttachment[]> => {
    const { data, error } = await supabase
      .from('kanban_card_attachments')
      .select('*')
      .eq('card_id', cardId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading attachments:', error);
      return [];
    }

    return data || [];
  };

  // Upload attachment
  const uploadAttachment = async (cardId: string, file: File) => {
    // Sanitize filename - remove accents and special characters
    const sanitizeFileName = (name: string) => {
      return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-zA-Z0-9._-]/g, '_'); // Replace other special chars with underscore
    };
    
    const sanitizedName = sanitizeFileName(file.name);
    const fileName = `${Date.now()}_${sanitizedName}`;
    const filePath = `${company?.id}/${cardId}/${fileName}`;

    console.log('Storage upload attempt:', { filePath, fileType: file.type, fileSize: file.size, originalName: file.name });

    const { error: uploadError, data: uploadData } = await supabase.storage
      .from('kanban-attachments')
      .upload(filePath, file);

    console.log('Storage upload result:', { uploadError, uploadData });

    if (uploadError) {
      console.error('Storage upload error details:', uploadError);
      toast.error('Erro ao fazer upload do arquivo: ' + uploadError.message);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('kanban-attachments')
      .getPublicUrl(filePath);

    const { data, error } = await supabase
      .from('kanban_card_attachments')
      .insert({
        card_id: cardId,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: profile?.id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao salvar anexo');
      return null;
    }

    // Add history
    await supabase.from('kanban_card_history').insert([{
      card_id: cardId,
      user_id: profile?.id || null,
      action_type: 'attachment_added',
      new_value: { file: file.name } as Json,
    }]);

    toast.success('Arquivo anexado');
    return data as KanbanCardAttachment;
  };

  // Delete attachment
  const deleteAttachment = async (cardId: string, attachmentId: string, filePath: string) => {
    // Delete from storage
    await supabase.storage.from('kanban-attachments').remove([filePath]);

    const { error } = await supabase
      .from('kanban_card_attachments')
      .delete()
      .eq('id', attachmentId);

    if (error) {
      toast.error('Erro ao excluir anexo');
      return false;
    }

    toast.success('Anexo excluído');
    return true;
  };

  // Initialize cards for existing contacts
  const initializeCardsForContacts = async () => {
    if (!board || !columns.length || !connectionId) return;

    const firstColumn = columns[0];

    // Get contacts that don't have cards yet
    // First, get conversations for this connection to find contacts
    const { data: conversations } = await supabase
      .from('conversations')
      .select('contact_id')
      .eq('whatsapp_connection_id', connectionId);

    if (!conversations?.length) return;

    const contactIds = [...new Set(conversations.map(c => c.contact_id))];

    // Get existing cards
    const { data: existingCards } = await supabase
      .from('kanban_cards')
      .select('contact_id')
      .in('contact_id', contactIds);

    const existingContactIds = new Set(existingCards?.map(c => c.contact_id) || []);
    const newContactIds = contactIds.filter(id => !existingContactIds.has(id));

    if (newContactIds.length === 0) return;

    // Get max position in first column
    const columnCards = cards.filter(c => c.column_id === firstColumn.id);
    const maxPosition = columnCards.reduce((max, c) => Math.max(max, c.position), -1);

    // Create cards for new contacts one by one to avoid type issues
    for (let i = 0; i < newContactIds.length; i++) {
      await supabase.from('kanban_cards').insert({
        column_id: firstColumn.id,
        contact_id: newContactIds[i],
        priority: 'medium' as const,
        position: maxPosition + 1 + i,
      });
    }

    // Reload cards after insertion
    if (board) {
      await loadCards(board.id);
    }
  };

  // Setup realtime subscriptions
  useEffect(() => {
    if (!board) return;

    const cardsChannel = supabase
      .channel('kanban-cards-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'kanban_cards',
      }, () => {
        loadCards(board.id);
      })
      .subscribe();

    const columnsChannel = supabase
      .channel('kanban-columns-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'kanban_columns',
        filter: `board_id=eq.${board.id}`,
      }, () => {
        loadColumns(board.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(cardsChannel);
      supabase.removeChannel(columnsChannel);
    };
  }, [board?.id]);

  // Load data on mount
  useEffect(() => {
    loadBoard();
    loadTeamMembers();
  }, [loadBoard, loadTeamMembers]);

  // Note: Removed automatic card initialization on every load
  // Cards should only be created manually via "Adicionar Card" button
  // This prevents deleted cards from reappearing

  return {
    board,
    columns,
    cards,
    loading,
    teamMembers,
    isAdminOrOwner,
    refresh: loadBoard,
    createColumn,
    updateColumn,
    deleteColumn,
    reorderColumns,
    createCard,
    moveCard,
    updateCard,
    deleteCard,
    addTag,
    removeTag,
    addChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem,
    addComment,
    loadCardComments,
    loadCardHistory,
    loadCardAttachments,
    uploadAttachment,
    deleteAttachment,
  };
}
