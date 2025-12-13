import { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, Loader2, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useQuickReplyCategories, QuickReplyCategory } from '@/hooks/useQuickReplyCategories';
import { QuickReplyVisibility } from '@/hooks/useQuickRepliesData';
import { VisibilitySelector } from './VisibilitySelector';
import { VisibilityBadge } from './VisibilityBadge';

interface ManageCategoriesModalProps {
  trigger?: React.ReactNode;
}

export function ManageCategoriesModal({ trigger }: ManageCategoriesModalProps) {
  const { categories, loading, createCategory, updateCategory, deleteCategory } = useQuickReplyCategories();
  const [open, setOpen] = useState(false);
  
  // Create form state
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newVisibility, setNewVisibility] = useState<QuickReplyVisibility>('all');
  const [newDepartmentId, setNewDepartmentId] = useState<string | null>(null);
  const [newConnectionId, setNewConnectionId] = useState<string | null>(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  
  // Edit state
  const [editingCategory, setEditingCategory] = useState<QuickReplyCategory | null>(null);
  const [editName, setEditName] = useState('');
  const [editVisibility, setEditVisibility] = useState<QuickReplyVisibility>('all');
  const [editDepartmentId, setEditDepartmentId] = useState<string | null>(null);
  const [editConnectionId, setEditConnectionId] = useState<string | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  
  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<QuickReplyCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const resetCreateForm = () => {
    setNewName('');
    setNewVisibility('all');
    setNewDepartmentId(null);
    setNewConnectionId(null);
    setIsCreating(false);
  };

  const handleCreate = async () => {
    if (!newName.trim() || newName.trim().length < 3) return;
    
    setIsSubmittingCreate(true);
    const result = await createCategory(newName, {
      visibility_type: newVisibility,
      department_id: newVisibility === 'department' ? newDepartmentId : null,
      whatsapp_connection_id: newVisibility === 'connection' ? newConnectionId : null,
    });
    setIsSubmittingCreate(false);
    
    if (result) {
      resetCreateForm();
    }
  };

  const handleStartEdit = (category: QuickReplyCategory) => {
    setEditingCategory(category);
    setEditName(category.name);
    setEditVisibility(category.visibility_type || 'all');
    setEditDepartmentId(category.department_id);
    setEditConnectionId(category.whatsapp_connection_id);
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditName('');
    setEditVisibility('all');
    setEditDepartmentId(null);
    setEditConnectionId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingCategory || !editName.trim() || editName.trim().length < 3) return;
    
    setIsSubmittingEdit(true);
    const success = await updateCategory(editingCategory.id, {
      name: editName.trim(),
      visibility_type: editVisibility,
      department_id: editVisibility === 'department' ? editDepartmentId : null,
      whatsapp_connection_id: editVisibility === 'connection' ? editConnectionId : null,
    });
    setIsSubmittingEdit(false);
    
    if (success) {
      handleCancelEdit();
    }
  };

  const handleDeleteClick = (category: QuickReplyCategory) => {
    setCategoryToDelete(category);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    
    setIsDeleting(true);
    const success = await deleteCategory(categoryToDelete.id);
    setIsDeleting(false);
    
    if (success) {
      setDeleteConfirmOpen(false);
      setCategoryToDelete(null);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      resetCreateForm();
      handleCancelEdit();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline">
              <Settings className="w-4 h-4 mr-2" />
              Gerenciar Categorias
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
            <DialogDescription>
              Crie, edite e gerencie as categorias das respostas rápidas
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Create new category button/form */}
            {!isCreating ? (
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2"
                onClick={() => setIsCreating(true)}
              >
                <Plus className="w-4 h-4" />
                Nova Categoria
              </Button>
            ) : (
              <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                <div className="space-y-2">
                  <Label htmlFor="new-category-name">Nome da Categoria *</Label>
                  <Input
                    id="new-category-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ex: Vendas, Suporte, Financeiro..."
                    maxLength={50}
                  />
                  <p className="text-xs text-muted-foreground">
                    {newName.length}/50 caracteres (mínimo 3)
                  </p>
                </div>
                
                <VisibilitySelector
                  visibility={newVisibility}
                  onVisibilityChange={setNewVisibility}
                  selectedDepartmentId={newDepartmentId}
                  onDepartmentChange={setNewDepartmentId}
                  selectedConnectionId={newConnectionId}
                  onConnectionChange={setNewConnectionId}
                />
                
                <div className="flex gap-2 justify-end">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={resetCreateForm}
                    disabled={isSubmittingCreate}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleCreate}
                    disabled={newName.trim().length < 3 || isSubmittingCreate}
                  >
                    {isSubmittingCreate ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Criar'
                    )}
                  </Button>
                </div>
              </div>
            )}
            
            <Separator />
            
            {/* Categories list */}
            <ScrollArea className="flex-1 pr-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhuma categoria criada</p>
                  <p className="text-sm">Clique em "Nova Categoria" para começar</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div key={category.id}>
                      {editingCategory?.id === category.id ? (
                        // Edit form
                        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                          <div className="space-y-2">
                            <Label>Nome da Categoria *</Label>
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Nome da categoria"
                              maxLength={50}
                            />
                            <p className="text-xs text-muted-foreground">
                              {editName.length}/50 caracteres (mínimo 3)
                            </p>
                          </div>
                          
                          <VisibilitySelector
                            visibility={editVisibility}
                            onVisibilityChange={setEditVisibility}
                            selectedDepartmentId={editDepartmentId}
                            onDepartmentChange={setEditDepartmentId}
                            selectedConnectionId={editConnectionId}
                            onConnectionChange={setEditConnectionId}
                          />
                          
                          <div className="flex gap-2 justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={handleCancelEdit}
                              disabled={isSubmittingEdit}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Cancelar
                            </Button>
                            <Button 
                              size="sm"
                              onClick={handleSaveEdit}
                              disabled={editName.trim().length < 3 || isSubmittingEdit}
                            >
                              {isSubmittingEdit ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-4 h-4 mr-1" />
                                  Salvar
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // Display row
                        <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="font-medium truncate">{category.name}</span>
                            <VisibilityBadge 
                              visibility={category.visibility_type || 'all'}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleStartEdit(category)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteClick(category)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a categoria "{categoryToDelete?.name}"? 
              As respostas rápidas associadas a esta categoria ficarão sem categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
