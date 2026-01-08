import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Star, Pencil, Trash2, Check, X, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface KanbanBoard {
  id: string;
  name: string;
  is_default: boolean;
  auto_add_new_contacts: boolean;
}

interface ManageCRMModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string | null;
  onBoardsChanged?: () => void;
}

export function ManageCRMModal({ open, onOpenChange, connectionId, onBoardsChanged }: ManageCRMModalProps) {
  const [boards, setBoards] = useState<KanbanBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [saving, setSaving] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [creatingBoard, setCreatingBoard] = useState(false);

  useEffect(() => {
    const loadBoards = async () => {
      if (!connectionId || !open) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('kanban_boards')
          .select('id, name, is_default, auto_add_new_contacts')
          .eq('whatsapp_connection_id', connectionId)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true });

        if (error) throw error;
        setBoards(data || []);
      } catch (error) {
        console.error('Error loading boards:', error);
        toast.error('Erro ao carregar boards');
      } finally {
        setLoading(false);
      }
    };

    loadBoards();
  }, [connectionId, open]);

  const handleToggleAutoAdd = async (boardId: string, checked: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('kanban_boards')
        .update({ auto_add_new_contacts: checked })
        .eq('id', boardId);

      if (error) throw error;
      
      setBoards(boards.map(b => b.id === boardId ? { ...b, auto_add_new_contacts: checked } : b));
      toast.success(checked 
        ? 'Novos contatos serão adicionados automaticamente' 
        : 'Adição automática desativada'
      );
    } catch (error) {
      console.error('Error saving setting:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (boardId: string) => {
    if (!connectionId) return;
    
    setSaving(true);
    try {
      // Unset current default
      await supabase
        .from('kanban_boards')
        .update({ is_default: false })
        .eq('whatsapp_connection_id', connectionId)
        .eq('is_default', true);

      // Set new default
      const { error } = await supabase
        .from('kanban_boards')
        .update({ is_default: true })
        .eq('id', boardId);

      if (error) throw error;
      
      setBoards(boards.map(b => ({ ...b, is_default: b.id === boardId })));
      onBoardsChanged?.();
      toast.success('Board definido como padrão');
    } catch (error) {
      console.error('Error setting default:', error);
      toast.error('Erro ao definir board padrão');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (board: KanbanBoard) => {
    setEditingBoardId(board.id);
    setEditingName(board.name);
  };

  const handleSaveEdit = async () => {
    if (!editingBoardId || !editingName.trim()) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('kanban_boards')
        .update({ name: editingName.trim() })
        .eq('id', editingBoardId);

      if (error) throw error;
      
      setBoards(boards.map(b => b.id === editingBoardId ? { ...b, name: editingName.trim() } : b));
      setEditingBoardId(null);
      onBoardsChanged?.();
      toast.success('Nome atualizado');
    } catch (error) {
      console.error('Error updating name:', error);
      toast.error('Erro ao atualizar nome');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    const board = boards.find(b => b.id === boardId);
    if (board?.is_default) {
      toast.error('Não é possível excluir o board padrão');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir este board? Todos os cards serão removidos.')) {
      return;
    }

    setSaving(true);
    try {
      // Delete cards first
      const { data: cols } = await supabase
        .from('kanban_columns')
        .select('id')
        .eq('board_id', boardId);

      if (cols?.length) {
        const colIds = cols.map(c => c.id);
        await supabase.from('kanban_cards').delete().in('column_id', colIds);
      }

      await supabase.from('kanban_columns').delete().eq('board_id', boardId);
      const { error } = await supabase.from('kanban_boards').delete().eq('id', boardId);

      if (error) throw error;
      
      setBoards(boards.filter(b => b.id !== boardId));
      onBoardsChanged?.();
      toast.success('Board excluído');
    } catch (error) {
      console.error('Error deleting board:', error);
      toast.error('Erro ao excluir board');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBoard = async () => {
    if (!connectionId || !newBoardName.trim()) return;

    setCreatingBoard(true);
    try {
      // Get company_id from existing board or connection
      const { data: existingBoard } = await supabase
        .from('kanban_boards')
        .select('company_id')
        .eq('whatsapp_connection_id', connectionId)
        .limit(1)
        .maybeSingle();

      let companyId = existingBoard?.company_id;

      if (!companyId) {
        const { data: connection } = await supabase
          .from('whatsapp_connections')
          .select('company_id')
          .eq('id', connectionId)
          .single();
        companyId = connection?.company_id;
      }

      if (!companyId) {
        toast.error('Erro ao identificar empresa');
        return;
      }

      const { data: newBoard, error } = await supabase
        .from('kanban_boards')
        .insert({
          whatsapp_connection_id: connectionId,
          company_id: companyId,
          name: newBoardName.trim(),
          is_default: false,
          auto_add_new_contacts: false,
        })
        .select('id, name, is_default, auto_add_new_contacts')
        .single();

      if (error) throw error;

      // Create default columns
      const defaultColumns = [
        { name: 'Novo', color: '#D6E5FF', position: 0 },
        { name: 'Em Contato', color: '#FFF5D6', position: 1 },
        { name: 'Negociando', color: '#E8D6FF', position: 2 },
        { name: 'Fechado', color: '#D6FFE0', position: 3 },
        { name: 'Perdido', color: '#FFD6E0', position: 4 },
      ];

      await supabase
        .from('kanban_columns')
        .insert(defaultColumns.map(col => ({ board_id: newBoard.id, ...col })));

      setBoards([...boards, newBoard]);
      setNewBoardName('');
      onBoardsChanged?.();
      toast.success('Board criado com sucesso');
    } catch (error) {
      console.error('Error creating board:', error);
      toast.error('Erro ao criar board');
    } finally {
      setCreatingBoard(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Gerenciar CRM</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Create new board */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nome do novo board..."
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newBoardName.trim()) {
                    handleCreateBoard();
                  }
                }}
              />
              <Button
                onClick={handleCreateBoard}
                disabled={!newBoardName.trim() || creatingBoard}
                size="icon"
              >
                {creatingBoard ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>

            {/* Boards list */}
            <div className="space-y-3">
              {boards.map(board => (
                <div
                  key={board.id}
                  className={cn(
                    "p-4 border rounded-lg space-y-3",
                    board.is_default && "border-yellow-500/50 bg-yellow-500/5"
                  )}
                >
                  <div className="flex items-center justify-between">
                    {editingBoardId === board.id ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') setEditingBoardId(null);
                          }}
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" onClick={handleSaveEdit} disabled={saving}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditingBoardId(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {board.is_default && (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        )}
                        <span className="font-medium">{board.name}</span>
                      </div>
                    )}
                    
                    {editingBoardId !== board.id && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleStartEdit(board)}
                          disabled={saving}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {!board.is_default && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleSetDefault(board.id)}
                              disabled={saving}
                              title="Definir como padrão"
                            >
                              <Star className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteBoard(board.id)}
                              disabled={saving}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Auto-add toggle - only for default board */}
                  {board.is_default && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="space-y-0.5">
                        <Label className="text-sm">Adicionar novos contatos automaticamente</Label>
                        <p className="text-xs text-muted-foreground">
                          Novos contatos serão inseridos na primeira coluna
                        </p>
                      </div>
                      <Switch
                        checked={board.auto_add_new_contacts}
                        onCheckedChange={(checked) => handleToggleAutoAdd(board.id, checked)}
                        disabled={saving}
                      />
                    </div>
                  )}
                </div>
              ))}

              {boards.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum board encontrado. Crie um novo board acima.
                </p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

