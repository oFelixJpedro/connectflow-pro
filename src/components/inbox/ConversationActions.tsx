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
  Download,
  ImageIcon,
  RotateCcw,
} from 'lucide-react';
import { MediaGalleryModal } from './MediaGalleryModal';
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
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false);
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
        .select('id, full_name, avatar_url')
        .neq('id', currentUserId)
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
        release: 'Conversa retornada para a fila',
        close: 'Atendimento concluído',
        reopen: 'Conversa reaberta',
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
      title: 'Voltar para a fila?',
      description: 'A conversa ficará disponível para outros agentes.',
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

  const handleReopen = () => {
    setConfirmDialog({
      open: true,
      action: 'reopen',
      title: 'Reabrir conversa?',
      description: 'A conversa será reaberta e atribuída a você.',
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

  // Pode transferir/atribuir: owners/admins podem sempre, agents apenas se estiver atribuída a eles
  const canTransfer = !isClosed && (isAdminOrOwner || (isAssigned && isAssignedToMe));
  // Texto do botão muda se está atribuída ou não
  const transferLabel = isAssigned ? 'Transferir para...' : 'Atribuir para...';
  // Pode liberar: se está atribuída e (é admin/owner ou é o responsável)
  const canRelease = isAssigned && !isClosed && (isAdminOrOwner || isAssignedToMe);
  // Pode fechar: se está atribuída e não está fechada
  const canClose = isAssigned && !isClosed;
  // Pode mover departamento: sempre se não está fechada
  const canMoveDepartment = !isClosed;

  const handleExportConversation = async () => {
    setIsLoading(true);
    setLoadingAction('export');

    try {
      // Buscar todas as mensagens da conversa
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const contactName = conversation.contact?.name || conversation.contact?.phoneNumber || 'Contato';
      
      // Formatar data para o nome do arquivo
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      
      // Criar conteúdo do arquivo
      let content = `=== EXPORTAÇÃO DE CONVERSA ===\n`;
      content += `Contato: ${contactName}\n`;
      content += `Telefone: ${conversation.contact?.phoneNumber || 'N/A'}\n`;
      content += `Status: ${conversation.status}\n`;
      content += `Data de exportação: ${now.toLocaleString('pt-BR')}\n`;
      content += `Total de mensagens: ${messages?.length || 0}\n`;
      content += `${'='.repeat(40)}\n\n`;

      messages?.forEach((msg) => {
        const timestamp = new Date(msg.created_at).toLocaleString('pt-BR');
        const senderName = msg.direction === 'inbound' 
          ? contactName 
          : 'Atendente';
        const direction = msg.direction === 'inbound' ? '←' : '→';
        
        content += `[${timestamp}] ${direction} ${senderName}:\n`;
        
        if (msg.message_type === 'text') {
          content += `${msg.content || ''}\n`;
        } else if (msg.message_type === 'image') {
          content += `[Imagem${msg.content ? `: ${msg.content}` : ''}]\n`;
        } else if (msg.message_type === 'audio') {
          content += `[Áudio]\n`;
        } else if (msg.message_type === 'video') {
          content += `[Vídeo${msg.content ? `: ${msg.content}` : ''}]\n`;
        } else if (msg.message_type === 'document') {
          content += `[Documento${msg.content ? `: ${msg.content}` : ''}]\n`;
        } else if (msg.message_type === 'sticker') {
          content += `[Figurinha]\n`;
        } else {
          content += `[${msg.message_type}]\n`;
        }
        
        content += '\n';
      });

      // Criar e baixar arquivo
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversa_${contactName.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Conversa exportada',
        description: 'O arquivo foi baixado com sucesso.',
      });
    } catch (error: any) {
      console.error('[ConversationActions] Erro ao exportar:', error);
      toast({
        title: 'Erro ao exportar',
        description: error.message || 'Não foi possível exportar a conversa',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

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

          {/* Transferir/Atribuir */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger 
              disabled={!canTransfer}
              className={!canTransfer ? 'opacity-50 cursor-not-allowed' : ''}
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              <span>{transferLabel}</span>
            </DropdownMenuSubTrigger>
            {canTransfer && (
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
                        <AvatarImage src={agent.avatar_url || undefined} className="object-cover object-top" />
                        <AvatarFallback className="text-xs">
                          {getInitials(agent.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">{agent.full_name}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
            )}
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
            <span>Voltar para a fila</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Concluir ou Reabrir - baseado no status */}
          {isClosed ? (
            <DropdownMenuItem
              onClick={handleReopen}
              className="text-primary focus:text-primary"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              <span>Reabrir conversa</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={handleClose}
              disabled={!canClose}
              className="text-success focus:text-success"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              <span>Concluir atendimento</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Exportar conversa */}
          <DropdownMenuItem
            onClick={handleExportConversation}
            disabled={loadingAction === 'export'}
          >
            <Download className="w-4 h-4 mr-2" />
            <span>Exportar conversa</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Mídias */}
          <DropdownMenuItem onClick={() => setMediaGalleryOpen(true)}>
            <ImageIcon className="w-4 h-4 mr-2" />
            <span>Mídias</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Media Gallery Modal */}
      <MediaGalleryModal
        open={mediaGalleryOpen}
        onOpenChange={setMediaGalleryOpen}
        conversationId={conversation.id}
      />

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
