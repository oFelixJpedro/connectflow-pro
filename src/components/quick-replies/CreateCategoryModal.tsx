import { useState } from 'react';
import { FolderPlus, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuickReplyCategories } from '@/hooks/useQuickReplyCategories';

interface CreateCategoryModalProps {
  trigger?: React.ReactNode;
}

export function CreateCategoryModal({ trigger }: CreateCategoryModalProps) {
  const { createCategory } = useQuickReplyCategories();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    
    setIsSubmitting(true);
    const result = await createCategory(name);
    setIsSubmitting(false);
    
    if (result) {
      setOpen(false);
      setName('');
    }
  };

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setName('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <FolderPlus className="w-4 h-4 mr-2" />
            Nova Categoria
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Categoria</DialogTitle>
          <DialogDescription>
            Crie uma categoria para organizar suas respostas rápidas
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Nome da Categoria *</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Vendas, Suporte, Financeiro..."
              maxLength={50}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim().length >= 3) {
                  handleSubmit();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              {name.length}/50 caracteres (mínimo 3)
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={name.trim().length < 3 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar Categoria'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
