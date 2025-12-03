import { useState } from 'react';
import { Plus, Search, Tag as TagIcon, Edit2, Trash2, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { mockTags } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const colorOptions = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', 
  '#14B8A6', '#3B82F6', '#6366F1', '#8B5CF6', 
  '#EC4899', '#64748B'
];

export default function Tags() {
  const [tags, setTags] = useState(mockTags);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(colorOptions[0]);

  const filteredTags = tags.filter((tag) => {
    if (!searchQuery) return true;
    return tag.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleAdd = () => {
    if (!tagName.trim()) return;
    
    const newTag = {
      id: `${Date.now()}`,
      companyId: '1',
      name: tagName.trim(),
      color: tagColor,
      createdAt: new Date().toISOString(),
    };
    
    setTags([...tags, newTag]);
    setIsAddDialogOpen(false);
    setTagName('');
    setTagColor(colorOptions[0]);
    
    toast({
      title: 'Tag criada!',
      description: `A tag "${newTag.name}" foi criada com sucesso.`,
    });
  };

  const handleDelete = (id: string) => {
    setTags(tags.filter((t) => t.id !== id));
    toast({
      title: 'Tag excluída',
      description: 'A tag foi removida com sucesso.',
    });
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tags</h1>
          <p className="text-muted-foreground">
            Organize conversas e contatos com etiquetas
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Tag
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nova Tag</DialogTitle>
              <DialogDescription>
                Crie uma tag para organizar conversas e contatos
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tag-name">Nome da Tag</Label>
                <Input
                  id="tag-name"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="Ex: VIP, Urgente, Lead Quente..."
                />
              </div>
              
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex gap-2 flex-wrap">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      onClick={() => setTagColor(color)}
                      className={cn(
                        'w-8 h-8 rounded-full transition-all',
                        tagColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              
              {/* Preview */}
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="p-4 bg-muted rounded-lg">
                  <Badge 
                    style={{ 
                      backgroundColor: `${tagColor}20`, 
                      color: tagColor,
                      borderColor: `${tagColor}40`
                    }}
                    variant="outline"
                    className="text-sm"
                  >
                    {tagName || 'Nome da tag'}
                  </Badge>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAdd} disabled={!tagName.trim()}>
                Criar Tag
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info */}
      <Card className="bg-warning/5 border-warning/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <TagIcon className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Dica</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Use tags para categorizar conversas por tipo de atendimento, prioridade, 
                status do cliente ou qualquer outra classificação relevante para sua equipe.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tags Grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filteredTags.map((tag) => (
          <Card key={tag.id} className="card-hover">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="font-medium text-foreground">{tag.name}</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => handleDelete(tag.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Conversas</span>
                  <span className="font-medium">12</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Contatos</span>
                  <span className="font-medium">8</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredTags.length === 0 && (
          <div className="col-span-full text-center py-12">
            <TagIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              Nenhuma tag encontrada
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Crie sua primeira tag para começar a organizar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
