import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Star, Plus } from 'lucide-react';

interface KanbanBoard {
  id: string;
  name: string;
  is_default: boolean;
}

interface BoardSelectorProps {
  boards: KanbanBoard[];
  selectedBoardId: string | null;
  onBoardChange: (boardId: string) => void;
  onCreateBoard?: (name: string) => Promise<KanbanBoard | null>;
  isAdmin?: boolean;
  disabled?: boolean;
}

export function BoardSelector({
  boards,
  selectedBoardId,
  onBoardChange,
  onCreateBoard,
  isAdmin = false,
  disabled = false,
}: BoardSelectorProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateBoard = async () => {
    if (!newBoardName.trim() || !onCreateBoard) return;

    setCreating(true);
    try {
      const newBoard = await onCreateBoard(newBoardName.trim());
      if (newBoard) {
        onBoardChange(newBoard.id);
        setCreateDialogOpen(false);
        setNewBoardName('');
      }
    } finally {
      setCreating(false);
    }
  };

  const selectedBoard = boards.find(b => b.id === selectedBoardId);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedBoardId || ''}
        onValueChange={onBoardChange}
        disabled={disabled || boards.length === 0}
      >
        <SelectTrigger className="w-[180px] md:w-[200px]">
          <SelectValue placeholder="Selecionar board">
            {selectedBoard && (
              <div className="flex items-center gap-2">
                {selectedBoard.is_default && (
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                )}
                <span className="truncate">{selectedBoard.name}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-popover">
          {boards.map(board => (
            <SelectItem key={board.id} value={board.id}>
              <div className="flex items-center gap-2">
                {board.is_default && (
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                )}
                <span>{board.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isAdmin && onCreateBoard && (
        <>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCreateDialogOpen(true)}
            disabled={disabled}
            title="Criar novo board"
          >
            <Plus className="w-4 h-4" />
          </Button>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Criar Novo Board</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="board-name">Nome do Board</Label>
                  <Input
                    id="board-name"
                    placeholder="Ex: Pós-Venda, Suporte, Qualificação..."
                    value={newBoardName}
                    onChange={(e) => setNewBoardName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newBoardName.trim()) {
                        handleCreateBoard();
                      }
                    }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateBoard}
                  disabled={!newBoardName.trim() || creating}
                >
                  {creating ? 'Criando...' : 'Criar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
