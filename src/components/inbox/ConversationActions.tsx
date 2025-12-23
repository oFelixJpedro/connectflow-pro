import { useState, useEffect, useMemo } from 'react';
import {
  MoreVertical,
  User,
  UserMinus,
  ArrowRight,
  Building2,
  CheckCircle,
  Loader2,
  Contact,
  Download,
  ImageIcon,
  RotateCcw,
  Star,
  MailWarning,
  Kanban,
} from 'lucide-react';
import { MediaGalleryModal } from './MediaGalleryModal';
import { useContactCRM } from '@/hooks/useContactCRM';
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
  const [isFollowing, setIsFollowing] = useState(false);
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

  // CRM hook for funnel stages
  const {
    boards: crmBoards,
    currentPosition: crmPosition,
    setCardPosition,
    refresh: refreshCRM,
  } = useContactCRM(conversation.contactId || null);

  // Get available CRM columns for current connection
  const availableCrmColumns = useMemo(() => {
    if (!conversation.whatsappConnectionId || crmBoards.size === 0) return [];
    
    // Find the board for this connection
    const board = crmBoards.get(conversation.whatsappConnectionId);
    
    return board?.columns || [];
  }, [crmBoards, conversation.whatsappConnectionId]);

  // Handler to move contact to a CRM stage
  const handleMoveToStage = async (columnId: string) => {
    if (!conversation.contactId || !conversation.whatsappConnectionId) return;
    
    setLoadingAction('move_stage');
    try {
      await setCardPosition(
        conversation.contactId,
        conversation.whatsappConnectionId,
        columnId
      );
      toast({
        title: 'Posição atualizada',
        description: 'O contato foi movido no funil.',
      });
      refreshCRM();
      onAction();
    } catch (error: any) {
      console.error('[ConversationActions] Erro ao mover no funil:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível mover o contato.',
        variant: 'destructive',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  // Check if user is following this conversation
  useEffect(() => {
    async function checkFollowing() {
      if (!isAdminOrOwner) return;
      
      const { data, error } = await supabase
        .from('conversation_followers')
        .select('id')
        .eq('conversation_id', conversation.id)
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (!error && data) {
        setIsFollowing(true);
      } else {
        setIsFollowing(false);
      }
    }
    checkFollowing();
  }, [conversation.id, currentUserId, isAdminOrOwner]);

  // Carregar agentes que têm acesso à conexão e departamento da conversa
  useEffect(() => {
    async function loadAgents() {
      if (!conversation.whatsappConnectionId) return;

      // Buscar o company_id do usuário atual
      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', currentUserId)
        .single();

      if (!profileData) return;

      // Buscar todos os profiles ativos da empresa (exceto usuário atual)
      const { data: allProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('company_id', profileData.company_id)
        .neq('id', currentUserId)
        .eq('active', true)
        .order('full_name');

      if (profilesError || !allProfiles || allProfiles.length === 0) {
        setAgents([]);
        return;
      }

      // Buscar roles dos usuários da empresa (filtrar pelos IDs para evitar problemas com RLS)
      const userIds = allProfiles.map(p => p.id);
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const rolesMap = new Map((userRoles || []).map(r => [r.user_id, r.role]));

      // Buscar quem tem acesso a esta conexão (com department_access_mode)
      const { data: connectionUsers } = await supabase
        .from('connection_users')
        .select('user_id, department_access_mode')
        .eq('connection_id', conversation.whatsappConnectionId!);

      const connectionAccessMap = new Map(
        (connectionUsers || []).map(cu => [cu.user_id, cu.department_access_mode])
      );

      // Se a conversa tem departamento, buscar quem tem acesso ao departamento
      let departmentUsersSet = new Set<string>();
      if (conversation.departmentId) {
        const { data: departmentUsers } = await supabase
          .from('department_users')
          .select('user_id')
          .eq('department_id', conversation.departmentId);
        
        departmentUsersSet = new Set((departmentUsers || []).map(du => du.user_id));
      }

      // Filtrar agentes com acesso à conexão E departamento
      const filteredAgents = allProfiles.filter(agent => {
        const role = rolesMap.get(agent.id);
        
        // Owner e admin SEMPRE têm acesso (bypass completo)
        if (role === 'owner' || role === 'admin') return true;
        
        // Para outros roles, verificar acesso à conexão
        const departmentAccessMode = connectionAccessMap.get(agent.id);
        if (!departmentAccessMode) return false; // Sem acesso à conexão
        
        // Se conversa não tem departamento, apenas verificar conexão
        if (!conversation.departmentId) return true;
        
        // Verificar acesso ao departamento
        if (departmentAccessMode === 'all') return true;
        if (departmentAccessMode === 'none') return false;
        if (departmentAccessMode === 'specific') {
          return departmentUsersSet.has(agent.id);
        }
        
        return false;
      });

      setAgents(filteredAgents);
    }
    loadAgents();
  }, [currentUserId, conversation.whatsappConnectionId, conversation.departmentId]);

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
        mark_unread: 'Conversa marcada como não lida',
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

  const handleToggleFollow = async () => {
    setIsLoading(true);
    setLoadingAction('follow');

    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('conversation_followers')
          .delete()
          .eq('conversation_id', conversation.id)
          .eq('user_id', currentUserId);

        if (error) throw error;

        setIsFollowing(false);
        toast({
          title: 'Conversa removida dos seguidos',
          description: 'Você não está mais seguindo esta conversa.',
        });
      } else {
        // Follow
        const { error } = await supabase
          .from('conversation_followers')
          .insert({
            conversation_id: conversation.id,
            user_id: currentUserId,
          });

        if (error) throw error;

        setIsFollowing(true);
        toast({
          title: 'Conversa adicionada aos seguidos',
          description: 'Você está seguindo esta conversa.',
        });
      }
    } catch (error: any) {
      console.error('[ConversationActions] Erro ao seguir/deixar de seguir:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível atualizar o status de seguindo.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
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

  // Função auxiliar para escapar HTML
  const escapeHTML = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Função para gerar HTML da conversa
  const generateConversationHTML = (
    contactName: string,
    contactPhone: string,
    status: string,
    exportDate: string,
    messages: any[]
  ): string => {
    const statusMap: Record<string, string> = {
      open: 'Aberta',
      pending: 'Pendente',
      in_progress: 'Em Atendimento',
      waiting: 'Aguardando',
      resolved: 'Resolvida',
      closed: 'Fechada',
    };

    let messagesHTML = '';
    
    messages.forEach((msg) => {
      if (msg.is_deleted) return; // Pular mensagens deletadas
      
      const timestamp = new Date(msg.created_at).toLocaleString('pt-BR');
      const senderName = msg.direction === 'inbound' ? contactName : 'Atendente';
      const direction = msg.direction === 'inbound' ? 'inbound' : 'outbound';
      const isInternal = msg.is_internal_note;
      
      // Notas internas com estilo diferenciado
      if (isInternal) {
        messagesHTML += `
          <div class="message internal">
            <div class="timestamp">📝 Nota interna - ${timestamp}</div>
            <p>${escapeHTML(msg.content || '')}</p>
            ${msg.media_url ? `<a href="${msg.media_url}" target="_blank" class="media-link">📎 Anexo</a>` : ''}
          </div>
        `;
        return;
      }

      let contentHTML = '';
      const metadata = msg.metadata as Record<string, any> | null;
      
      switch (msg.message_type) {
        case 'text':
          contentHTML = `<p>${escapeHTML(msg.content || '')}</p>`;
          break;
          
        case 'image':
          contentHTML = `
            <p>📷 Imagem</p>
            ${msg.media_url ? `
              <a href="${msg.media_url}" target="_blank" class="media-link">
                <img src="${msg.media_url}" class="media-preview" alt="Imagem" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                <span style="display:none;">⚠️ Imagem não disponível</span>
              </a>
              <br><a href="${msg.media_url}" target="_blank" class="media-link">📥 Abrir imagem em nova aba</a>
            ` : '<p><em>Mídia não disponível</em></p>'}
            ${msg.content ? `<br><small>Legenda: ${escapeHTML(msg.content)}</small>` : ''}
          `;
          break;
          
        case 'video':
          contentHTML = `
            <p>🎬 Vídeo</p>
            ${msg.media_url ? `
              <video controls class="media-preview" src="${msg.media_url}"></video>
              <br><a href="${msg.media_url}" target="_blank" class="media-link">📥 Baixar vídeo</a>
            ` : '<p><em>Mídia não disponível</em></p>'}
            ${msg.content ? `<br><small>Legenda: ${escapeHTML(msg.content)}</small>` : ''}
          `;
          break;
          
        case 'audio':
          contentHTML = `
            <p>🎵 Áudio</p>
            ${msg.media_url ? `
              <audio controls src="${msg.media_url}"></audio>
              <br><a href="${msg.media_url}" target="_blank" class="media-link">📥 Baixar áudio</a>
            ` : '<p><em>Mídia não disponível</em></p>'}
          `;
          break;
          
        case 'document':
          const fileName = metadata?.fileName || 'documento';
          contentHTML = `
            <p>📄 Documento: ${escapeHTML(fileName)}</p>
            ${msg.media_url ? `
              <a href="${msg.media_url}" target="_blank" class="media-link">📥 Baixar documento (${escapeHTML(fileName)})</a>
            ` : '<p><em>Documento não disponível</em></p>'}
            ${msg.content ? `<br><small>Descrição: ${escapeHTML(msg.content)}</small>` : ''}
          `;
          break;
          
        case 'sticker':
          contentHTML = `
            <p>🎨 Figurinha</p>
            ${msg.media_url ? `
              <img src="${msg.media_url}" class="sticker-preview" alt="Figurinha" onerror="this.outerHTML='<p><em>Figurinha não disponível</em></p>';">
            ` : '<p><em>Figurinha não disponível</em></p>'}
          `;
          break;
          
        default:
          contentHTML = `<p>[${msg.message_type}]</p>`;
      }
      
      messagesHTML += `
        <div class="message ${direction}">
          <div class="timestamp">${timestamp} - ${escapeHTML(senderName)}</div>
          ${contentHTML}
        </div>
      `;
    });

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conversa - ${escapeHTML(contactName)} - ${new Date().toISOString().split('T')[0]}</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
      max-width: 800px; 
      margin: 0 auto; 
      padding: 20px; 
      background: #f0f2f5;
    }
    .header { 
      background: white; 
      padding: 20px; 
      border-radius: 12px; 
      margin-bottom: 20px; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header h2 { margin-top: 0; color: #075e54; }
    .messages { display: flex; flex-direction: column; gap: 8px; }
    .message { 
      padding: 12px 16px; 
      border-radius: 12px; 
      max-width: 80%;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }
    .inbound { 
      background: white; 
      align-self: flex-start;
      border-bottom-left-radius: 4px;
    }
    .outbound { 
      background: #dcf8c6; 
      align-self: flex-end;
      border-bottom-right-radius: 4px;
    }
    .internal {
      background: #fff9c4;
      align-self: center;
      font-style: italic;
      border: 1px dashed #f9a825;
      max-width: 90%;
    }
    .timestamp { 
      font-size: 11px; 
      color: #667781; 
      margin-bottom: 4px;
    }
    .message p { margin: 4px 0; word-wrap: break-word; }
    .media-link { color: #0066cc; text-decoration: none; }
    .media-link:hover { text-decoration: underline; }
    .media-preview { 
      max-width: 100%; 
      max-height: 300px; 
      border-radius: 8px; 
      margin: 8px 0;
      display: block;
    }
    .sticker-preview {
      max-width: 150px;
      max-height: 150px;
      margin: 8px 0;
    }
    audio { width: 100%; max-width: 300px; margin: 8px 0; }
    video { max-width: 100%; border-radius: 8px; }
    small { color: #667781; }
  </style>
</head>
<body>
  <div class="header">
    <h2>📱 Exportação de Conversa</h2>
    <p><strong>Contato:</strong> ${escapeHTML(contactName)}</p>
    <p><strong>Telefone:</strong> ${escapeHTML(contactPhone)}</p>
    <p><strong>Status:</strong> ${statusMap[status] || status}</p>
    <p><strong>Exportado em:</strong> ${exportDate}</p>
    <p><strong>Total de mensagens:</strong> ${messages.filter(m => !m.is_deleted).length}</p>
  </div>
  
  <div class="messages">
    ${messagesHTML}
  </div>
</body>
</html>`;
  };

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
      const contactPhone = conversation.contact?.phoneNumber || 'N/A';
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      
      // Gerar HTML
      const htmlContent = generateConversationHTML(
        contactName,
        contactPhone,
        conversation.status,
        now.toLocaleString('pt-BR'),
        messages || []
      );

      // Criar e baixar arquivo HTML
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversa_${contactName.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Conversa exportada',
        description: 'O arquivo HTML foi baixado com sucesso.',
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
              <Building2 className="w-4 h-4 mr-2" />
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

          {/* Mover no funil CRM */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={availableCrmColumns.length === 0}>
              <Kanban className="w-4 h-4 mr-2" />
              <span>Mover no funil...</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="z-[110]">
                {availableCrmColumns.length === 0 ? (
                  <DropdownMenuItem disabled>
                    Nenhuma etapa disponível
                  </DropdownMenuItem>
                ) : (
                  availableCrmColumns.map((column) => (
                    <DropdownMenuItem
                      key={column.id}
                      onClick={() => handleMoveToStage(column.id)}
                      disabled={
                        column.id === crmPosition?.column_id ||
                        loadingAction === 'move_stage'
                      }
                    >
                      <span className="flex-1">{column.name}</span>
                      {column.id === crmPosition?.column_id && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Atual
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

          {/* Marcar como não lido */}
          {!isClosed && (
            <DropdownMenuItem
              onClick={() => executeAction('mark_unread')}
              disabled={loadingAction === 'mark_unread'}
            >
              <MailWarning className="w-4 h-4 mr-2" />
              <span>Marcar como não lido</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Concluir ou Reabrir - baseado no status */}
          {isClosed ? (
            <DropdownMenuItem
              onClick={handleReopen}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              <span>Reabrir conversa</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={handleClose}
              disabled={!canClose}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              <span>Concluir atendimento</span>
            </DropdownMenuItem>
          )}

          {/* Seguir/Deixar de seguir - apenas admin/owner */}
          {isAdminOrOwner && (
            <DropdownMenuItem
              onClick={handleToggleFollow}
              disabled={loadingAction === 'follow'}
              className="text-violet-600 focus:text-violet-600 dark:text-violet-400 dark:focus:text-violet-400"
            >
              <Star className={`w-4 h-4 mr-2 ${isFollowing ? 'fill-current' : ''}`} />
              <span>{isFollowing ? 'Deixar de seguir' : 'Seguir atendimento'}</span>
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
