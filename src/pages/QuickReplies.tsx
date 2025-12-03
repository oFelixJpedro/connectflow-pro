import { useState } from 'react';
import { 
  Plus, 
  Search, 
  Zap, 
  Edit2, 
  Trash2, 
  Copy,
  MoreHorizontal,
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mockQuickReplies } from '@/data/mockData';
import { toast } from '@/hooks/use-toast';

export default function QuickReplies() {
  const [quickReplies, setQuickReplies] = useState(mockQuickReplies);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  // Form state
  const [shortcut, setShortcut] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('');
  const [isGlobal, setIsGlobal] = useState(true);

  const categories = ['Saudações', 'Geral', 'Encerramento', 'Informações', 'Vendas'];

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

  const handleAdd = () => {
    const newReply = {
      id: `${Date.now()}`,
      companyId: '1',
      shortcut: shortcut.startsWith('/') ? shortcut : `/${shortcut}`,
      title,
      message,
      category,
      isGlobal,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setQuickReplies([...quickReplies, newReply]);
    setIsAddDialogOpen(false);
    setShortcut('');
    setTitle('');
    setMessage('');
    setCategory('');
    setIsGlobal(true);
    
    toast({
      title: 'Resposta criada!',
      description: `Use "${newReply.shortcut}" no chat para usar esta resposta.`,
    });
  };

  const handleDelete = (id: string) => {
    setQuickReplies(quickReplies.filter((r) => r.id !== id));
    toast({
      title: 'Resposta excluída',
      description: 'A resposta rápida foi removida.',
    });
  };

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
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
                  <Label htmlFor="shortcut">Atalho</Label>
                  <Input
                    id="shortcut"
                    value={shortcut}
                    onChange={(e) => setShortcut(e.target.value)}
                    placeholder="/ola"
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
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nome descritivo da resposta"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="message">Mensagem</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Conteúdo da mensagem..."
                  className="min-h-[120px]"
                />
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
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAdd} disabled={!shortcut || !title || !message}>
                Criar Resposta
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
                Durante um atendimento, digite o atalho (ex: /ola) no campo de mensagem 
                para inserir rapidamente a resposta. Você também pode pressionar "/" para 
                ver todas as respostas disponíveis.
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
            {categories.map((cat) => (
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
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {reply.shortcut}
                    </Badge>
                    {reply.isGlobal && (
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
                    <DropdownMenuItem>
                      <Edit2 className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={() => handleDelete(reply.id)}
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
              Nenhuma resposta encontrada
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Tente ajustar os filtros ou crie uma nova resposta
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
