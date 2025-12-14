import { useState } from 'react';
import { Plus, Search, Tag as TagIcon, Edit2, Trash2, MoreHorizontal, Loader2 } from 'lucide-react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useTagsData, Tag } from '@/hooks/useTagsData';
import { cn } from '@/lib/utils';

const colorOptions = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', 
  '#14B8A6', '#3B82F6', '#6366F1', '#8B5CF6', 
  '#EC4899', '#64748B'
];

export default function Tags() {
  const { tags, loading, createTag, updateTag, deleteTag } = useTagsData();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(colorOptions[0]);
  const [tagDescription, setTagDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');
  const [editTagDescription, setEditTagDescription] = useState('');

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

  const filteredTags = tags.filter((tag) => {
    if (!searchQuery) return true;
    return tag.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleAdd = async () => {
    if (!tagName.trim()) return;
    
    setIsSubmitting(true);
    const result = await createTag({
      name: tagName,
      color: tagColor,
      description: tagDescription,
    });
    setIsSubmitting(false);

    if (result) {
      setIsAddDialogOpen(false);
      resetAddForm();
    }
  };

  const resetAddForm = () => {
    setTagName('');
    setTagColor(colorOptions[0]);
    setTagDescription('');
  };

  const handleOpenEdit = (tag: Tag) => {
    setEditingTag(tag);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
    setEditTagDescription(tag.description || '');
    setIsEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!editingTag || !editTagName.trim()) return;
    
    setIsSubmitting(true);
    const success = await updateTag(editingTag.id, {
      name: editTagName,
      color: editTagColor,
      description: editTagDescription,
    });
    setIsSubmitting(false);

    if (success) {
      setIsEditDialogOpen(false);
      setEditingTag(null);
    }
  };

  const handleDeleteClick = (tag: Tag) => {
    setTagToDelete(tag);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!tagToDelete) return;
    
    await deleteTag(tagToDelete.id);
    setDeleteConfirmOpen(false);
    setTagToDelete(null);
  };

  if (loading) {
    return (
      <div className="h-full overflow-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-28" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-80" />
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Tags</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Organize conversas e contatos com etiquetas
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetAddForm();
        }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nova Tag
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Tag</DialogTitle>
              <DialogDescription>
                Crie uma tag para organizar conversas e contatos
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tag-name">Nome da Tag *</Label>
                <Input
                  id="tag-name"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="Ex: VIP, Urgente, Lead Quente..."
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tag-description">Descrição (opcional)</Label>
                <Textarea
                  id="tag-description"
                  value={tagDescription}
                  onChange={(e) => setTagDescription(e.target.value)}
                  placeholder="Descreva quando usar esta tag..."
                  rows={2}
                  maxLength={200}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Cor</Label>
                <div className="flex gap-2 flex-wrap">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
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
            
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting} className="w-full sm:w-auto">
                Cancelar
              </Button>
              <Button onClick={handleAdd} disabled={!tagName.trim() || isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Tag'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info */}
      <Card className="bg-warning/5 border-warning/20">
        <CardContent className="pt-4 md:pt-6 px-4 md:px-6">
          <div className="flex items-start gap-3 md:gap-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-warning/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <TagIcon className="w-4 h-4 md:w-5 md:h-5 text-warning" />
            </div>
            <div>
              <h3 className="font-medium text-foreground text-sm md:text-base">Dica</h3>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">
                Use tags para categorizar conversas por tipo de atendimento, prioridade, 
                status do cliente ou qualquer outra classificação relevante para sua equipe.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative w-full md:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tags Grid */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredTags.map((tag) => (
          <Card key={tag.id} className="card-hover">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="font-medium text-foreground truncate">{tag.name}</span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenEdit(tag)}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => handleDeleteClick(tag)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {tag.description && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {tag.description}
                </p>
              )}
              
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Conversas</span>
                  <span className="font-medium">{tag.conversationsCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Contatos</span>
                  <span className="font-medium">{tag.contactsCount ?? 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredTags.length === 0 && (
          <div className="col-span-full text-center py-12">
            <TagIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              {searchQuery ? 'Nenhuma tag encontrada' : 'Nenhuma tag criada'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery 
                ? 'Tente buscar com outros termos' 
                : 'Crie sua primeira tag para começar a organizar'
              }
            </p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) setEditingTag(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Tag</DialogTitle>
            <DialogDescription>
              Atualize as informações da tag
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-tag-name">Nome da Tag *</Label>
              <Input
                id="edit-tag-name"
                value={editTagName}
                onChange={(e) => setEditTagName(e.target.value)}
                placeholder="Ex: VIP, Urgente, Lead Quente..."
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tag-description">Descrição (opcional)</Label>
              <Textarea
                id="edit-tag-description"
                value={editTagDescription}
                onChange={(e) => setEditTagDescription(e.target.value)}
                placeholder="Descreva quando usar esta tag..."
                rows={2}
                maxLength={200}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setEditTagColor(color)}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all',
                      editTagColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''
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
                    backgroundColor: `${editTagColor}20`, 
                    color: editTagColor,
                    borderColor: `${editTagColor}40`
                  }}
                  variant="outline"
                  className="text-sm"
                >
                  {editTagName || 'Nome da tag'}
                </Badge>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={!editTagName.trim() || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tag</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a tag "{tagToDelete?.name}"? 
              {((tagToDelete?.conversationsCount ?? 0) > 0 || (tagToDelete?.contactsCount ?? 0) > 0) && (
                <span className="block mt-2 text-warning">
                  Esta tag está sendo usada em {tagToDelete?.conversationsCount ?? 0} conversa(s) e {tagToDelete?.contactsCount ?? 0} contato(s).
                  A tag será removida dessas associações.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
