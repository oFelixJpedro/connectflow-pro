import { useState, useEffect } from 'react';
import { Plus, Search, Tag as TagIcon, Edit2, Trash2, MoreHorizontal, Loader2, Building2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useTagsData, Tag } from '@/hooks/useTagsData';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const colorOptions = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', 
  '#14B8A6', '#3B82F6', '#6366F1', '#8B5CF6', 
  '#EC4899', '#64748B'
];

interface Department {
  id: string;
  name: string;
  color: string | null;
}

export default function Tags() {
  const { tags, loading, createTag, updateTag, deleteTag } = useTagsData();
  const { profile, userRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [userDepartmentIds, setUserDepartmentIds] = useState<string[]>([]);

  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';
  
  // Filter state
  const [filterDepartmentId, setFilterDepartmentId] = useState<string>('all');
  
  // Add dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(colorOptions[0]);
  const [tagDescription, setTagDescription] = useState('');
  const [tagDepartmentId, setTagDepartmentId] = useState<string>('global');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');
  const [editTagDescription, setEditTagDescription] = useState('');
  const [editTagDepartmentId, setEditTagDepartmentId] = useState<string>('global');

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

  // Load departments
  useEffect(() => {
    const loadDepartments = async () => {
      if (!profile?.company_id) return;

      const { data, error } = await supabase
        .from('departments')
        .select('id, name, color')
        .eq('active', true)
        .order('name');

      if (!error && data) {
        setDepartments(data);
      }
    };

    const loadUserDepartments = async () => {
      if (!profile?.id) return;

      const { data, error } = await supabase
        .from('department_users')
        .select('department_id')
        .eq('user_id', profile.id);

      if (!error && data) {
        setUserDepartmentIds(data.map(d => d.department_id));
      }
    };

    loadDepartments();
    loadUserDepartments();
  }, [profile?.company_id, profile?.id]);

  // Filter departments user can assign to
  const availableDepartments = isAdminOrOwner 
    ? departments 
    : departments.filter(d => userDepartmentIds.includes(d.id));

  const filteredTags = tags.filter((tag) => {
    // Filter by search
    if (searchQuery && !tag.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    // Filter by department
    if (filterDepartmentId === 'global') {
      return !tag.department_id;
    }
    if (filterDepartmentId !== 'all') {
      return tag.department_id === filterDepartmentId;
    }
    return true;
  });

  const handleAdd = async () => {
    if (!tagName.trim()) return;
    
    setIsSubmitting(true);
    const result = await createTag({
      name: tagName,
      color: tagColor,
      description: tagDescription,
      department_id: tagDepartmentId === 'global' ? null : tagDepartmentId,
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
    setTagDepartmentId('global');
  };

  const handleOpenEdit = (tag: Tag) => {
    setEditingTag(tag);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
    setEditTagDescription(tag.description || '');
    setEditTagDepartmentId(tag.department_id || 'global');
    setIsEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!editingTag || !editTagName.trim()) return;
    
    setIsSubmitting(true);
    const success = await updateTag(editingTag.id, {
      name: editTagName,
      color: editTagColor,
      description: editTagDescription,
      department_id: editTagDepartmentId === 'global' ? null : editTagDepartmentId,
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
                <Label>Departamento (opcional)</Label>
                <Select value={tagDepartmentId} onValueChange={setTagDepartmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span>Global (todos podem usar)</span>
                      </div>
                    </SelectItem>
                    {availableDepartments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: dept.color || '#6366F1' }}
                          />
                          <span>{dept.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Tags vinculadas a um departamento só podem ser usadas por membros desse departamento.
                </p>
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

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterDepartmentId} onValueChange={setFilterDepartmentId}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filtrar por departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os departamentos</SelectItem>
            <SelectItem value="global">Apenas globais</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: dept.color || '#6366F1' }}
                  />
                  <span>{dept.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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

              {/* Department Badge */}
              {tag.department && (
                <div className="mt-2">
                  <Badge 
                    variant="secondary" 
                    className="text-xs"
                    style={{
                      backgroundColor: `${tag.department.color || '#6366F1'}20`,
                      color: tag.department.color || '#6366F1',
                      borderColor: `${tag.department.color || '#6366F1'}40`
                    }}
                  >
                    <Building2 className="w-3 h-3 mr-1" />
                    {tag.department.name}
                  </Badge>
                </div>
              )}

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
              {searchQuery || filterDepartmentId !== 'all' ? 'Nenhuma tag encontrada' : 'Nenhuma tag criada'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery || filterDepartmentId !== 'all'
                ? 'Tente ajustar os filtros' 
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
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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
              <Label>Departamento (opcional)</Label>
              <Select value={editTagDepartmentId} onValueChange={setEditTagDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span>Global (todos podem usar)</span>
                    </div>
                  </SelectItem>
                  {availableDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: dept.color || '#6366F1' }}
                        />
                        <span>{dept.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tags vinculadas a um departamento só podem ser usadas por membros desse departamento.
              </p>
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