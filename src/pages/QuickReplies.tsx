import { useState } from 'react';
import { 
  Plus, 
  Search, 
  Zap, 
  Edit2, 
  Trash2, 
  Copy,
  MoreHorizontal,
  FolderOpen,
  Loader2
} from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuickRepliesData, QuickReply } from '@/hooks/useQuickRepliesData';
import { toast } from '@/hooks/use-toast';

const defaultCategories = ['Saudações', 'Geral', 'Encerramento', 'Informações', 'Vendas', 'Suporte'];

export default function QuickReplies() {
  const { 
    quickReplies, 
    loading, 
    isAdminOrOwner,
    createQuickReply, 
    updateQuickReply, 
    deleteQuickReply,
    getCategories 
  } = useQuickRepliesData();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Add dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [shortcut, setShortcut] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');
  const [isGlobal, setIsGlobal] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [editShortcut, setEditShortcut] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editIsGlobal, setEditIsGlobal] = useState(true);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [replyToDelete, setReplyToDelete] = useState<QuickReply | null>(null);

  // Get all categories (existing + defaults)
  const existingCategories = getCategories();
  const allCategories = [...new Set([...defaultCategories, ...existingCategories])].sort();

  const filteredReplies = quickReplies.filter((reply) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesShortcut = reply.shortcut.toLowerCase().includes(query);
      const matchesTitle = reply.title.toLowerCase().includes(query);
      const matchesMessage = reply.message.toLowerCase().includes(query);
      if (!matchesShortcut && !matchesTitle && !matchesMessage) return false;
    }
    if (selectedCategory !== 'all' && reply.category !== selectedCategory) {
      return false;
    }
    return true;
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: 'Mensagem copiada para a área de transferência.',
    });
  };

  const resetAddForm = () => {
    setShortcut('');
    setTitle('');
    setMessage('');
    setCategory('');
    setIsGlobal(true);
  };

  const handleAdd = async () => {
    if (!shortcut.trim() || !title.trim() || !message.trim()) return;
    
    setIsSubmitting(true);
    const result = await createQuickReply({
      shortcut,
      title,
      message,
      category,
      is_global: isGlobal,
    });
    setIsSubmitting(false);

    if (result) {
      setIsAddDialogOpen(false);
      resetAddForm();
    }
  };

  const handleOpenEdit = (reply: QuickReply) => {
    setEditingReply(reply);
    setEditShortcut(reply.shortcut);
    setEditTitle(reply.title);
    setEditMessage(reply.message);
    setEditCategory(reply.category || '');
    setEditIsGlobal(reply.is_global);
    setIsEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!editingReply || !editShortcut.trim() || !editTitle.trim() || !editMessage.trim()) return;
    
    setIsSubmitting(true);
    const success = await updateQuickReply(editingReply.id, {
      shortcut: editShortcut,
      title: editTitle,
      message: editMessage,
      category: editCategory,
      is_global: editIsGlobal,
    });
    setIsSubmitting(false);

    if (success) {
      setIsEditDialogOpen(false);
      setEditingReply(null);
    }
  };

  const handleDeleteClick = (reply: QuickReply) => {
    setReplyToDelete(reply);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!replyToDelete) return;
    
    await deleteQuickReply(replyToDelete.id);
    setDeleteConfirmOpen(false);
    setReplyToDelete(null);
  };

  if (loading) {
    return (
      <div className="h-full overflow-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <Skeleton className="h-24 w-full" />
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1 max-w-md" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Respostas Rápidas</h1>
          <p className="text-muted-foreground">
            Crie atalhos para mensagens frequentes
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetAddForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Resposta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova Resposta Rápida</DialogTitle>
              <DialogDescription>
                Crie um atalho para usar durante os atendimentos
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="shortcut">Atalho *</Label>
                  <Input
                    id="shortcut"
                    value={shortcut}
                    onChange={(e) => setShortcut(e.target.value)}
                    placeholder="/ola"
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground">
                    Digite este comando no chat
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {allCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nome descritivo da resposta"
                  maxLength={100}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="message">Mensagem *</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Conteúdo da mensagem..."
                  className="min-h-[120px]"
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {message.length}/2000
                </p>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Resposta Global</Label>
                  <p className="text-xs text-muted-foreground">
                    Visível para toda a equipe
                  </p>
                </div>
                <Switch
                  checked={isGlobal}
                  onCheckedChange={setIsGlobal}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAdd} 
                disabled={!shortcut.trim() || !title.trim() || !message.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Resposta'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Card */}
      <Card className="bg-info/5 border-info/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-info/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-info" />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Como usar?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Durante um atendimento, digite "/" no campo de mensagem para ver todas as 
                respostas disponíveis. Continue digitando para filtrar por título ou atalho.
                Use as setas ↑↓ para navegar e Enter para selecionar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por atalho, título ou mensagem..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {allCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Quick Replies Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredReplies.map((reply) => (
          <Card key={reply.id} className="card-hover">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {reply.shortcut}
                    </Badge>
                    {reply.is_global && (
                      <Badge variant="outline" className="text-xs">
                        Global
                      </Badge>
                    )}
                  </div>
                  <h4 className="font-medium text-foreground mt-2 truncate">
                    {reply.title}
                  </h4>
                  {reply.category && (
                    <div className="flex items-center gap-1 mt-1">
                      <FolderOpen className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {reply.category}
                      </span>
                    </div>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleCopy(reply.message)}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar mensagem
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleOpenEdit(reply)}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => handleDeleteClick(reply)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                {reply.message}
              </p>

              {reply.use_count > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Usada {reply.use_count}x
                </p>
              )}
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full mt-4"
                onClick={() => handleCopy(reply.message)}
              >
                <Copy className="w-3 h-3 mr-2" />
                Copiar
              </Button>
            </CardContent>
          </Card>
        ))}

        {filteredReplies.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">
              {searchQuery || selectedCategory !== 'all' 
                ? 'Nenhuma resposta encontrada' 
                : 'Nenhuma resposta criada'
              }
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery || selectedCategory !== 'all'
                ? 'Tente ajustar os filtros ou crie uma nova resposta'
                : 'Crie sua primeira resposta rápida para agilizar os atendimentos'
              }
            </p>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) setEditingReply(null);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Resposta Rápida</DialogTitle>
            <DialogDescription>
              Atualize as informações da resposta
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-shortcut">Atalho *</Label>
                <Input
                  id="edit-shortcut"
                  value={editShortcut}
                  onChange={(e) => setEditShortcut(e.target.value)}
                  placeholder="/ola"
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Categoria</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-title">Título *</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Nome descritivo da resposta"
                maxLength={100}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-message">Mensagem *</Label>
              <Textarea
                id="edit-message"
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                placeholder="Conteúdo da mensagem..."
                className="min-h-[120px]"
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground text-right">
                {editMessage.length}/2000
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Resposta Global</Label>
                <p className="text-xs text-muted-foreground">
                  Visível para toda a equipe
                </p>
              </div>
              <Switch
                checked={editIsGlobal}
                onCheckedChange={setEditIsGlobal}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button 
              onClick={handleEdit} 
              disabled={!editShortcut.trim() || !editTitle.trim() || !editMessage.trim() || isSubmitting}
            >
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
            <AlertDialogTitle>Excluir resposta rápida</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a resposta "{replyToDelete?.title}"?
              Esta ação não pode ser desfeita.
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
