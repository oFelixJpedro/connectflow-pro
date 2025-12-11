import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { KanbanColumn } from '@/hooks/useKanbanData';

const PASTEL_COLORS = [
  { value: '#FFD6E0', label: 'Rosa' },
  { value: '#D6E5FF', label: 'Azul' },
  { value: '#D6FFE0', label: 'Verde' },
  { value: '#FFF5D6', label: 'Amarelo' },
  { value: '#E8D6FF', label: 'Roxo' },
  { value: '#FFE5D6', label: 'Laranja' },
  { value: '#D6FFF5', label: 'Ciano' },
  { value: '#E8E8E8', label: 'Cinza' },
];

interface EditColumnDialogProps {
  column: KanbanColumn;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateColumn: (columnId: string, updates: Partial<KanbanColumn>) => Promise<boolean>;
}

export function EditColumnDialog({ column, open, onOpenChange, onUpdateColumn }: EditColumnDialogProps) {
  const [name, setName] = useState(column.name);
  const [color, setColor] = useState(column.color);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(column.name);
      setColor(column.color);
    }
  }, [open, column]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;

    setLoading(true);
    const result = await onUpdateColumn(column.id, { name: name.trim(), color });
    setLoading(false);

    if (result) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Coluna</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome da coluna</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Em Negociação"
            />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {PASTEL_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    color === c.value 
                      ? 'border-primary scale-110' 
                      : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
