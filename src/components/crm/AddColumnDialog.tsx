import { useState } from 'react';
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

interface AddColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateColumn: (name: string, color: string) => Promise<KanbanColumn | null>;
}

export function AddColumnDialog({ open, onOpenChange, onCreateColumn }: AddColumnDialogProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PASTEL_COLORS[0].value);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;

    setLoading(true);
    const result = await onCreateColumn(name.trim(), color);
    setLoading(false);

    if (result) {
      setName('');
      setColor(PASTEL_COLORS[0].value);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Coluna</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da coluna</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Em Negociação"
              autoFocus
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
              {loading ? 'Criando...' : 'Criar Coluna'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
