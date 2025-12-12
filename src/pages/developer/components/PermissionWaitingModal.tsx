import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, X, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import { developerData, developerActions, developerImpersonate } from '@/lib/developerApi';
import { toast } from 'sonner';

interface PermissionWaitingModalProps {
  requestId: string;
  targetName: string;
  targetUserId?: string;
  actionDescription?: string;
  requestType?: 'edit_company' | 'edit_user' | 'access_user' | 'delete_company' | 'delete_user';
  onCancel: () => void;
  onClose: () => void;
  onApproved?: () => void;
  onDenied?: () => void;
}

export default function PermissionWaitingModal({
  requestId,
  targetName,
  targetUserId,
  actionDescription,
  requestType,
  onCancel,
  onClose,
  onApproved,
  onDenied
}: PermissionWaitingModalProps) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'denied' | 'expired' | 'ready'>('pending');
  const [timeLeft, setTimeLeft] = useState(300);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const hasCalledCallback = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Função para buscar o magic link com URL dinâmica
  const fetchMagicLink = async () => {
    if (!targetUserId || requestType !== 'access_user') return;
    
    try {
      // Passar a URL atual do frontend
      const redirectUrl = `${window.location.origin}/dashboard`;
      
      const { data, error } = await developerImpersonate({ 
        action: 'impersonate', 
        target_user_id: targetUserId,
        redirect_url: redirectUrl
      });

      if (error) {
        toast.error(error);
        setStatus('denied');
        return;
      }

      if (data?.magic_link) {
        setMagicLink(data.magic_link);
        setStatus('ready');
      }
    } catch (err) {
      console.error('Error fetching magic link:', err);
      toast.error('Erro ao gerar link de acesso');
      setStatus('denied');
    }
  };

  const checkPermissionStatus = useCallback(async () => {
    if (hasCalledCallback.current) return;
    
    try {
      const { data, error } = await developerData({ action: 'check_permission_status', request_id: requestId });

      if (error) return;

      const permStatus = data?.status;
      if (!permStatus || permStatus === 'pending') return;

      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);

      if (permStatus === 'approved') {
        hasCalledCallback.current = true;
        setStatus('approved');
        
        // Para access_user, buscar o magic link
        if (requestType === 'access_user' && targetUserId) {
          await fetchMagicLink();
        } else if (onApproved) {
          setTimeout(() => onApproved(), 500);
        }
      } else if (permStatus === 'denied' || permStatus === 'expired' || permStatus === 'cancelled') {
        hasCalledCallback.current = true;
        setStatus(permStatus === 'cancelled' ? 'denied' : permStatus);
        if (onDenied) {
          setTimeout(() => onDenied(), 1500);
        } else {
          setTimeout(onClose, 2000);
        }
      }
    } catch (err) {
      console.error('Error polling permission:', err);
    }
  }, [requestId, targetUserId, requestType, onApproved, onDenied, onClose]);

  useEffect(() => {
    checkPermissionStatus();
    pollIntervalRef.current = setInterval(checkPermissionStatus, 2000);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setStatus('expired');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
          if (!hasCalledCallback.current) {
            hasCalledCallback.current = true;
            setTimeout(onClose, 2000);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [checkPermissionStatus, onClose]);

  const handleCancel = async () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    
    await developerActions({ action: 'cancel_permission_request', request_id: requestId });
    
    onCancel();
  };

  const handleOpenMagicLink = () => {
    if (magicLink) {
      window.open(magicLink, '_blank');
      toast.success(`Sessão aberta como ${targetName}`);
      onClose();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRequestTypeText = () => {
    if (actionDescription) return actionDescription;
    switch (requestType) {
      case 'edit_company': return 'editar a empresa';
      case 'edit_user': return 'editar o usuário';
      case 'access_user': return 'acessar como o usuário';
      case 'delete_company': return 'excluir a empresa';
      case 'delete_user': return 'excluir o usuário';
      default: return 'realizar esta ação';
    }
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === 'pending' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            {status === 'approved' && <Loader2 className="h-5 w-5 animate-spin text-green-600" />}
            {status === 'ready' && <CheckCircle className="h-5 w-5 text-green-600" />}
            {status === 'denied' && <XCircle className="h-5 w-5 text-destructive" />}
            {status === 'expired' && <Clock className="h-5 w-5 text-muted-foreground" />}
            
            {status === 'pending' && 'Aguardando Permissão'}
            {status === 'approved' && 'Gerando Acesso...'}
            {status === 'ready' && 'Acesso Pronto!'}
            {status === 'denied' && 'Permissão Negada'}
            {status === 'expired' && 'Tempo Expirado'}
          </DialogTitle>
          <DialogDescription>
            {status === 'pending' && (
              <>
                Solicitando permissão para {getRequestTypeText()} de <strong>{targetName}</strong>.
                <br />
                O usuário foi notificado e precisa aprovar.
              </>
            )}
            {status === 'approved' && 'Permissão concedida! Gerando link de acesso...'}
            {status === 'ready' && (
              <>
                Clique no botão abaixo para acessar como <strong>{targetName}</strong>.
              </>
            )}
            {status === 'denied' && 'O usuário negou a permissão.'}
            {status === 'expired' && 'O tempo expirou. Tente novamente.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {status === 'pending' && (
            <>
              <div className="text-4xl font-mono text-muted-foreground">
                {formatTime(timeLeft)}
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Expira automaticamente após 5 minutos
              </p>
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </>
          )}
          
          {status === 'approved' && (
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-green-600" />
              <span className="text-green-600 font-medium">Gerando link seguro...</span>
            </div>
          )}

          {status === 'ready' && magicLink && (
            <Button onClick={handleOpenMagicLink} className="w-full" size="lg">
              <ExternalLink className="h-4 w-4 mr-2" />
              Acessar como {targetName}
            </Button>
          )}
          
          {(status === 'denied' || status === 'expired') && (
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
