import { useState, useEffect } from 'react';
import { 
  Plus, 
  Building2, 
  MoreHorizontal,
  Loader2,
  Check,
  X,
  Star,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  ChevronDown,
  Wifi
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import type { Tables } from '@/integrations/supabase/types';

type Department = Tables<'departments'>;
type WhatsAppConnection = Tables<'whatsapp_connections'>;

interface ConnectionOption {
  id: string;
  name: string;
  phone_number: string;
  status: string;
}

export default function Departments() {
  const { company, userRole } = useAuth();
  const [connections, setConnections] = useState<ConnectionOption[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  
  // Dialog states
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);
  
  // Form states
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasConversations, setHasConversations] = useState(false);

  // Check permissions
  const isAdminOrOwner = userRole?.role === 'owner' || userRole?.role === 'admin';

  // Redirect if not admin/owner
  if (!isAdminOrOwner) {
    return <Navigate to="/dashboard" replace />;
  }

  useEffect(() => {
    if (company?.id) {
      loadConnections();
    }
  }, [company?.id]);

  useEffect(() => {
    if (selectedConnectionId) {
      loadDepartments();
    } else {
      setDepartments([]);
    }
  }, [selectedConnectionId]);

  async function loadConnections() {
    if (!company?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('id, name, phone_number, status')
        .eq('company_id', company.id)
        .eq('status', 'connected')
        .order('name', { ascending: true });

      if (error) throw error;
      
      setConnections(data || []);
      
      // Auto-select first connection if available
      if (data && data.length > 0 && !selectedConnectionId) {
        setSelectedConnectionId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading connections:', error);
      toast.error('Erro ao carregar conexões');
    } finally {
      setLoading(false);
    }
  }

  async function loadDepartments() {
    if (!selectedConnectionId) return;
    
    setLoadingDepartments(true);
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('whatsapp_connection_id', selectedConnectionId)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
      toast.error('Erro ao carregar departamentos');
    } finally {
      setLoadingDepartments(false);
    }
  }

  async function checkDepartmentHasConversations(departmentId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', departmentId);
    
    if (error) {
      console.error('Error checking conversations:', error);
      return false;
    }
    
    return (count || 0) > 0;
  }

  async function checkDepartmentHasOpenConversations(departmentId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', departmentId)
      .in('status', ['open', 'in_progress', 'pending', 'waiting']);
    
    if (error) {
      console.error('Error checking open conversations:', error);
      return false;
    }
    
    return (count || 0) > 0;
  }

  function openCreateDialog() {
    setEditingDepartment(null);
    setFormName('');
    setFormDescription('');
    setFormIsDefault(departments.length === 0); // Default to true if first department
    setHasConversations(false);
    setIsFormDialogOpen(true);
  }

  async function openEditDialog(department: Department) {
    setEditingDepartment(department);
    setFormName(department.name);
    setFormDescription(department.description || '');
    setFormIsDefault(department.is_default || false);
    
    // Check if has conversations (to disable name editing)
    const hasConvs = await checkDepartmentHasConversations(department.id);
    setHasConversations(hasConvs);
    
    setIsFormDialogOpen(true);
  }

  function closeFormDialog() {
    setIsFormDialogOpen(false);
    setEditingDepartment(null);
    setFormName('');
    setFormDescription('');
    setFormIsDefault(false);
    setHasConversations(false);
  }

  async function handleSubmit() {
    if (!selectedConnectionId) return;
    
    // Validate name
    const trimmedName = formName.trim();
    if (!trimmedName) {
      toast.error('Digite um nome para o departamento');
      return;
    }
    
    if (trimmedName.length > 50) {
      toast.error('O nome deve ter no máximo 50 caracteres');
      return;
    }
    
    // Check for duplicate name (case insensitive)
    const existingDept = departments.find(
      d => d.name.toLowerCase() === trimmedName.toLowerCase() && d.id !== editingDepartment?.id
    );
    if (existingDept) {
      toast.error('Já existe um departamento com este nome nesta conexão');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // If setting as default, unset other defaults first
      if (formIsDefault) {
        await supabase
          .from('departments')
          .update({ is_default: false })
          .eq('whatsapp_connection_id', selectedConnectionId)
          .neq('id', editingDepartment?.id || '');
      }
      
      if (editingDepartment) {
        // Update existing
        const updateData: Partial<Department> = {
          name: trimmedName,
          description: formDescription.trim() || null,
          is_default: formIsDefault,
        };
        
        const { error } = await supabase
          .from('departments')
          .update(updateData)
          .eq('id', editingDepartment.id);
        
        if (error) throw error;
        toast.success('Departamento atualizado com sucesso');
      } else {
        // Create new
        const { error } = await supabase
          .from('departments')
          .insert({
            whatsapp_connection_id: selectedConnectionId,
            name: trimmedName,
            description: formDescription.trim() || null,
            is_default: formIsDefault,
            active: true,
          });
        
        if (error) throw error;
        toast.success('Departamento criado com sucesso');
      }
      
      closeFormDialog();
      loadDepartments();
    } catch (error: any) {
      console.error('Error saving department:', error);
      toast.error(error.message || 'Erro ao salvar departamento');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSetDefault(department: Department) {
    if (department.is_default) return;
    
    try {
      // Unset all other defaults
      await supabase
        .from('departments')
        .update({ is_default: false })
        .eq('whatsapp_connection_id', selectedConnectionId!);
      
      // Set this one as default
      await supabase
        .from('departments')
        .update({ is_default: true })
        .eq('id', department.id);
      
      toast.success('Departamento padrão atualizado');
      loadDepartments();
    } catch (error) {
      console.error('Error setting default:', error);
      toast.error('Erro ao definir departamento padrão');
    }
  }

  async function handleToggleActive(department: Department) {
    // Cannot deactivate default
    if (department.is_default && department.active) {
      toast.error('Não é possível desativar o departamento padrão');
      return;
    }
    
    // Cannot deactivate if has open conversations
    if (department.active) {
      const hasOpen = await checkDepartmentHasOpenConversations(department.id);
      if (hasOpen) {
        toast.error('Não é possível desativar um departamento com conversas abertas');
        return;
      }
    }
    
    try {
      await supabase
        .from('departments')
        .update({ active: !department.active })
        .eq('id', department.id);
      
      toast.success(department.active ? 'Departamento desativado' : 'Departamento ativado');
      loadDepartments();
    } catch (error) {
      console.error('Error toggling active:', error);
      toast.error('Erro ao alterar status do departamento');
    }
  }

  async function handleDelete() {
    if (!deletingDepartment) return;
    
    // Cannot delete default
    if (deletingDepartment.is_default) {
      toast.error('Não é possível remover o departamento padrão');
      setIsDeleteDialogOpen(false);
      setDeletingDepartment(null);
      return;
    }
    
    // Cannot delete if has any conversations
    const hasConvs = await checkDepartmentHasConversations(deletingDepartment.id);
    if (hasConvs) {
      toast.error('Não é possível remover um departamento que possui conversas');
      setIsDeleteDialogOpen(false);
      setDeletingDepartment(null);
      return;
    }
    
    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', deletingDepartment.id);
      
      if (error) throw error;
      
      toast.success('Departamento removido');
      setIsDeleteDialogOpen(false);
      setDeletingDepartment(null);
      loadDepartments();
    } catch (error: any) {
      console.error('Error deleting department:', error);
      toast.error(error.message || 'Erro ao remover departamento');
    }
  }

  function formatPhoneNumber(phone: string): string {
    if (!phone || phone === 'Aguardando...') return phone;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 13 && digits.startsWith('55')) {
      const ddd = digits.slice(2, 4);
      const part1 = digits.slice(4, 9);
      const part2 = digits.slice(9);
      return `+55 (${ddd}) ${part1}-${part2}`;
    }
    return phone;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Departamentos</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Organize suas conversas em departamentos por conexão WhatsApp
          </p>
        </div>
        <Button 
          onClick={openCreateDialog}
          disabled={!selectedConnectionId}
          className="w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Departamento
        </Button>
      </div>

      {/* Connection Selector */}
      {connections.length === 0 ? (
        <Card className="bg-muted/50">
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhuma conexão disponível
            </h3>
            <p className="text-muted-foreground mb-4">
              Você precisa ter pelo menos uma conexão WhatsApp ativa para gerenciar departamentos.
            </p>
            <Button variant="outline" onClick={() => window.location.href = '/connections'}>
              Ir para Conexões
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Connection Selector Dropdown */}
          <div className="w-full max-w-xs">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between gap-2 h-auto py-2 px-3 bg-card border-border"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Wifi className="w-4 h-4 text-success shrink-0" />
                    <div className="text-left min-w-0">
                      <p className="text-sm font-medium truncate">
                        {connections.find(c => c.id === selectedConnectionId)?.name || 'Selecione uma conexão'}
                      </p>
                      {selectedConnectionId && (
                        <p className="text-xs text-muted-foreground truncate">
                          {formatPhoneNumber(connections.find(c => c.id === selectedConnectionId)?.phone_number || '')}
                        </p>
                      )}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="start" 
                className="w-[280px] bg-popover border-border"
                sideOffset={4}
              >
                {connections.map((connection) => (
                  <DropdownMenuItem
                    key={connection.id}
                    onClick={() => setSelectedConnectionId(connection.id)}
                    className={cn(
                      'flex items-center gap-3 py-3 px-3 cursor-pointer',
                      connection.id === selectedConnectionId && 'bg-muted'
                    )}
                  >
                    <Wifi className="w-4 h-4 text-success shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{connection.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {formatPhoneNumber(connection.phone_number)}
                      </p>
                    </div>
                    {connection.id === selectedConnectionId && (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Departments List */}
          {loadingDepartments ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : departments.length === 0 ? (
            <Card className="bg-muted/50">
              <CardContent className="py-12 text-center">
                <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Nenhum departamento criado
                </h3>
                <p className="text-muted-foreground mb-4">
                  Crie departamentos para organizar as conversas desta conexão.
                </p>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar primeiro departamento
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-center">Padrão</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((dept) => (
                    <TableRow key={dept.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center',
                            dept.active ? 'bg-primary/10' : 'bg-muted'
                          )}>
                            <Building2 className={cn(
                              'w-5 h-5',
                              dept.active ? 'text-primary' : 'text-muted-foreground'
                            )} />
                          </div>
                          {dept.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {dept.description || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {dept.is_default && (
                          <Badge className="bg-primary/10 text-primary border-primary/20">
                            <Star className="w-3 h-3 mr-1 fill-current" />
                            Padrão
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            dept.active 
                              ? 'bg-success/10 text-success border-success/20' 
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {dept.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(dept)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            {!dept.is_default && (
                              <DropdownMenuItem onClick={() => handleSetDefault(dept)}>
                                <Star className="w-4 h-4 mr-2" />
                                Definir como padrão
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleToggleActive(dept)}>
                              {dept.active ? (
                                <>
                                  <PowerOff className="w-4 h-4 mr-2" />
                                  Desativar
                                </>
                              ) : (
                                <>
                                  <Power className="w-4 h-4 mr-2" />
                                  Ativar
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => {
                                setDeletingDepartment(dept);
                                setIsDeleteDialogOpen(true);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDepartment ? 'Editar Departamento' : 'Novo Departamento'}
            </DialogTitle>
            <DialogDescription>
              {editingDepartment 
                ? 'Atualize as informações do departamento.'
                : 'Preencha as informações para criar um novo departamento.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Vendas, Suporte, Financeiro..."
                maxLength={50}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Descreva a função deste departamento..."
                maxLength={200}
                rows={3}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isDefault"
                checked={formIsDefault}
                onCheckedChange={(checked) => setFormIsDefault(checked === true)}
              />
              <Label htmlFor="isDefault" className="text-sm font-normal cursor-pointer">
                Definir como departamento padrão desta conexão
              </Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={closeFormDialog} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingDepartment ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover departamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O departamento "{deletingDepartment?.name}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingDepartment(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
