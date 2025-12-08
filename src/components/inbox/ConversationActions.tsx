import { useState, useEffect } from 'react';
import {
  MoreVertical,
  User,
  UserMinus,
  ArrowRight,
  FolderInput,
  CheckCircle,
  Loader2,
  Contact,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Conversation } from '@/types';

interface Agent {
  id: string;
  full_name: string;
  avatar_url: string | null;
  status: string;
}

interface Department {
  id: string;
  name: string;
  is_default: boolean;
}

interface ConversationActionsProps {
  conversation: Conversation;
  currentUserId: string;
  currentUserRole?: string;
  onAction: () => void;
  onOpenContactDetails?: () => void;
}

export function ConversationActions({
  conversation,
  currentUserId,
  currentUserRole = 'agent',
  onAction,
  onOpenContactDetails,
}: ConversationActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: string;
    title: string;
    description: string;
  }>({ open: false, action: '', title: '', description: '' });

  const isAssigned = !!conversation.assignedUserId;
  const isAssignedToMe = conversation.assignedUserId === currentUserId;
  const isClosed = conversation.status === 'closed';
  const isAdminOrOwner = ['owner', 'admin'].includes(currentUserRole);

  // Carregar agentes
  useEffect(() => {
    async function loadAgents() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, status')
        .neq('id', currentUserId)
        .order('status', { ascending: true })
        .order('full_name');

      if (!error && data) {
        setAgents(data);
      }
    }
    loadAgents();
  }, [currentUserId]);

  // Carregar departamentos
  useEffect(() => {
    if (!conversation.whatsappConnectionId) return;

    async function loadDepartments() {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, is_default')
        .eq('whatsapp_connection_id', conversation.whatsappConnectionId!)
        .eq('active', true)
        .order('is_default', { ascending: false })
        .order('name');

      if (!error && data) {
        setDepartments(data);
      }
    }
    loadDepartments();
  }, [conversation.whatsappConnectionId]);

  const executeAction = async (action: string, payload: Record<string, string> = {}) => {
    setIsLoading(true);
    setLoadingAction(action);

    console.log('[ConversationActions] Executando ação:', action, 'para conversa:', conversation.id);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error('Não autenticado');
      }

      const response = await supabase.functions.invoke('conversation-management', {
        body: {
          action,
          conversationId: conversation.id,
          ...payload,
        },
      });

      console.log('[ConversationActions] Resposta da edge function:', response);

      // Verificar erro do Supabase ou erro no body da resposta
      if (response.error) {
        console.error('[ConversationActions] Erro Supabase:', response.error);
        throw new Error(response.error.message || 'Erro ao executar ação');
      }

      // Verificar se a resposta indica sucesso
      if (response.data && response.data.success === false) {
        console.error('[ConversationActions] Erro no body:', response.data);
        throw new Error(response.data.error || 'Erro ao executar ação');
      }

      console.log('[ConversationActions] Ação executada com sucesso');

      // Toast de sucesso baseado na ação
      const messages: Record<string, string> = {
        transfer: `Conversa transferida com sucesso`,
        release: 'Conversa liberada',
        close: 'Atendimento concluído',
        move_department: 'Conversa movida para departamento',
      };
      
      toast({
        title: messages[action] || 'Ação executada',
        description: 'A conversa foi atualizada.',
      });

      onAction();
    } catch (error: any) {
      console.error(`[ConversationActions] Erro ao executar ${action}:`, error);
      toast({
        title: 'Erro',
        description: error.message || 'Ocorreu um erro ao executar a ação',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(true);
      setLoadingAction(null);
      setConfirmDialog({ open: false, action: '', title: '', description: '' });
      // Aguardar um pouco e resetar o loading
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }
  };

  const handleTransfer = (agentId: string) => {
    executeAction('transfer', { userId: agentId });
  };

  const handleMoveDepartment = (departmentId: string) => {
    executeAction('move_department', { departmentId });
  };

  const handleRelease = () => {
    setConfirmDialog({
      open: true,
      action: 'release',
      title: 'Liberar conversa?',
      description: 'A conversa voltará para a fila de não atribuídas.',
    });
  };

  const handleClose = () => {
    setConfirmDialog({
      open: true,
      action: 'close',
      title: 'Concluir atendimento?',
      description: 'A conversa será marcada como fechada. Esta ação não pode ser desfeita.',
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Pode transferir: se está atribuída e (é admin/owner ou é o responsável)
  const canTransfer = isAssigned && !isClosed && (isAdminOrOwner || isAssignedToMe);
  // Pode liberar: se está atribuída e (é admin/owner ou é o responsável)
  const canRelease = isAssigned && !isClosed && (isAdminOrOwner || isAssignedToMe);
  // Pode fechar: se está atribuída e não está fechada
  const canClose = isAssigned && !isClosed;
  // Pode mover departamento: sempre se não está fechada
  const canMoveDepartment = !isClosed;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MoreVertical className="w-4 h-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 z-[100]">
          {/* Detalhes do contato */}
          <DropdownMenuItem 
            onClick={() => {
              console.log('[ConversationActions] Abrindo detalhes do contato');
              onOpenContactDetails?.();
            }}
          >
            <Contact className="w-4 h-4 mr-2" />
            <span>Detalhes do contato</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Transferir */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!canTransfer}>
              <ArrowRight className="w-4 h-4 mr-2" />
              <span>Transferir para...</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="max-h-64 overflow-y-auto z-[110]">
                {agents.length === 0 ? (
                  <DropdownMenuItem disabled>
                    Nenhum atendente disponível
                  </DropdownMenuItem>
                ) : (
                  agents.map((agent) => (
                    <DropdownMenuItem
                      key={agent.id}
                      onClick={() => {
                        console.log('[ConversationActions] Transferindo para:', agent.id);
                        handleTransfer(agent.id);
                      }}
                      disabled={loadingAction === 'transfer'}
                    >
                      <Avatar className="w-6 h-6 mr-2">
                        <AvatarImage src={agent.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(agent.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">{agent.full_name}</span>
                      <Badge
                        variant="outline"
                        className={`ml-2 text-xs ${
                          agent.status === 'online'
                            ? 'bg-success/10 text-success border-success/30'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {agent.status === 'online' ? 'Online' : 'Offline'}
                      </Badge>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          {/* Mover para departamento */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!canMoveDepartment}>
              <FolderInput className="w-4 h-4 mr-2" />
              <span>Mover para departamento...</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="z-[110]">
                {departments.length === 0 ? (
                  <DropdownMenuItem disabled>
                    Nenhum departamento
                  </DropdownMenuItem>
                ) : (
                  departments.map((dept) => (
                    <DropdownMenuItem
                      key={dept.id}
                      onClick={() => handleMoveDepartment(dept.id)}
                      disabled={
                        dept.id === conversation.departmentId ||
                        loadingAction === 'move_department'
                      }
                    >
                      <span className="flex-1">{dept.name}</span>
                      {dept.id === conversation.departmentId && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Atual
                        </Badge>
                      )}
                      {dept.is_default && dept.id !== conversation.departmentId && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          Padrão
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          {/* Liberar */}
          <DropdownMenuItem
            onClick={handleRelease}
            disabled={!canRelease}
            className="text-muted-foreground"
          >
            <UserMinus className="w-4 h-4 mr-2" />
            <span>Liberar conversa</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Concluir */}
          <DropdownMenuItem
            onClick={handleClose}
            disabled={!canClose}
            className="text-success focus:text-success"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            <span>Concluir atendimento</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialog de confirmação */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog({ ...confirmDialog, open })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executeAction(confirmDialog.action)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
