import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, X, CheckCircle, XCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getDeveloperToken } from '@/contexts/DeveloperAuthContext';

interface PermissionWaitingModalProps {
  requestId: string;
  targetName: string;
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
  actionDescription,
  requestType,
  onCancel,
  onClose,
  onApproved,
  onDenied
}: PermissionWaitingModalProps) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'denied' | 'expired'>('pending');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const hasCalledCallback = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Poll for permission status using Edge Function
  const checkPermissionStatus = useCallback(async () => {
    if (hasCalledCallback.current) return;
    
    try {
      const token = getDeveloperToken();
      console.log('Checking permission status for:', requestId);
      
      const { data, error } = await supabase.functions.invoke('developer-data', {
        body: { action: 'check_permission_status', request_id: requestId },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (error) {
        console.error('Error checking permission status:', error);
        return;
      }

      const permStatus = data?.status;
      console.log('Permission status response:', permStatus);

      if (!permStatus || permStatus === 'pending') return;

      // Clear intervals first
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setStatus(permStatus);

      // Only call callback once
      if (!hasCalledCallback.current) {
        hasCalledCallback.current = true;
        
        if (permStatus === 'approved') {
          console.log('Permission APPROVED - calling onApproved callback');
          if (onApproved) {
            // Small delay to ensure UI updates
            setTimeout(() => {
              onApproved();
            }, 500);
          }
        } else if (permStatus === 'denied' || permStatus === 'expired' || permStatus === 'cancelled') {
          console.log('Permission DENIED/EXPIRED - calling onDenied callback');
          if (onDenied) {
            setTimeout(() => {
              onDenied();
            }, 1500);
          } else {
            setTimeout(onClose, 2000);
          }
        }
      }
    } catch (err) {
      console.error('Error polling permission:', err);
    }
  }, [requestId, onApproved, onDenied, onClose]);

  useEffect(() => {
    // Initial check
    checkPermissionStatus();

    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(checkPermissionStatus, 2000);

    // Timer countdown
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
    
    const token = getDeveloperToken();
    await supabase.functions.invoke('developer-actions', {
      body: { action: 'cancel_permission_request', request_id: requestId },
      headers: { Authorization: `Bearer ${token}` }
    });
    
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRequestTypeText = () => {
    if (actionDescription) return actionDescription;
    
    switch (requestType) {
      case 'edit_company':
        return 'editar a empresa';
      case 'edit_user':
        return 'editar o usuário';
      case 'access_user':
        return 'acessar como o usuário';
      case 'delete_company':
        return 'excluir a empresa';
      case 'delete_user':
        return 'excluir o usuário';
      default:
        return 'realizar esta ação';
    }
  };

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {status === 'pending' && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            {status === 'approved' && <CheckCircle className="h-5 w-5 text-green-600" />}
            {status === 'denied' && <XCircle className="h-5 w-5 text-destructive" />}
            {status === 'expired' && <Clock className="h-5 w-5 text-muted-foreground" />}
            
            {status === 'pending' && 'Aguardando Permissão'}
            {status === 'approved' && 'Permissão Concedida'}
            {status === 'denied' && 'Permissão Negada'}
            {status === 'expired' && 'Tempo Expirado'}
          </DialogTitle>
          <DialogDescription>
            {status === 'pending' && (
              <>
                Solicitando permissão para {getRequestTypeText()} de <strong>{targetName}</strong>.
                <br />
                O usuário responsável foi notificado e precisa aprovar esta ação.
              </>
            )}
            {status === 'approved' && 'A permissão foi concedida. Executando ação...'}
            {status === 'denied' && 'O usuário negou a permissão para esta ação.'}
            {status === 'expired' && 'O tempo de espera expirou. Tente novamente.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {status === 'pending' && (
            <>
              <div className="text-4xl font-mono text-muted-foreground">
                {formatTime(timeLeft)}
              </div>
              <p className="text-sm text-muted-foreground text-center">
                A solicitação expira automaticamente após 5 minutos
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
              <span className="text-green-600 font-medium">Processando...</span>
            </div>
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
