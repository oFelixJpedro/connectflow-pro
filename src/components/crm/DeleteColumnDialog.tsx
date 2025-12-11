import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { KanbanColumn } from '@/hooks/useKanbanData';

interface DeleteColumnDialogProps {
  column: KanbanColumn;
  allColumns: KanbanColumn[];
  cardsCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteColumn: (columnId: string, moveToColumnId?: string) => Promise<boolean>;
}

export function DeleteColumnDialog({
  column,
  allColumns,
  cardsCount,
  open,
  onOpenChange,
  onDeleteColumn,
}: DeleteColumnDialogProps) {
  const [moveToColumnId, setMoveToColumnId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const otherColumns = allColumns.filter(c => c.id !== column.id);

  const handleDelete = async () => {
    setLoading(true);
    
    const moveId = cardsCount > 0 && moveToColumnId ? moveToColumnId : undefined;
    const result = await onDeleteColumn(column.id, moveId);
    
    setLoading(false);
    
    if (result) {
      setMoveToColumnId('');
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir coluna "{column.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita.
            {cardsCount > 0 && (
              <span className="block mt-2 font-medium text-foreground">
                Esta coluna possui {cardsCount} card{cardsCount > 1 ? 's' : ''}.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {cardsCount > 0 && otherColumns.length > 0 && (
          <div className="space-y-2 py-4">
            <Label>Mover cards para:</Label>
            <Select value={moveToColumnId} onValueChange={setMoveToColumnId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma coluna ou exclua os cards" />
              </SelectTrigger>
              <SelectContent>
                {otherColumns.map(col => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se não selecionar uma coluna, os cards serão excluídos junto com a coluna.
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? 'Excluindo...' : 'Excluir'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
