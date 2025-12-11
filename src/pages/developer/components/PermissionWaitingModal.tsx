import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getDeveloperToken } from '@/contexts/DeveloperAuthContext';

interface PermissionWaitingModalProps {
  requestId: string;
  requestType: 'edit_company' | 'edit_user' | 'access_user' | 'delete_company' | 'delete_user';
  targetName: string;
  onApproved: () => void;
  onDenied: () => void;
  onCancelled: () => void;
}

export default function PermissionWaitingModal({
  requestId,
  requestType,
  targetName,
  onApproved,
  onDenied,
  onCancelled
}: PermissionWaitingModalProps) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'denied' | 'expired'>('pending');
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds

  useEffect(() => {
    // Subscribe to permission request changes
    const channel = supabase
      .channel(`permission-${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'developer_permission_requests',
          filter: `id=eq.${requestId}`
        },
        (payload) => {
          const newStatus = payload.new.status;
          if (newStatus === 'approved') {
            setStatus('approved');
            setTimeout(onApproved, 1000);
          } else if (newStatus === 'denied') {
            setStatus('denied');
            setTimeout(onDenied, 2000);
          }
        }
      )
      .subscribe();

    // Timer countdown
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setStatus('expired');
          clearInterval(timer);
          setTimeout(onCancelled, 2000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, [requestId, onApproved, onDenied, onCancelled]);

  const handleCancel = async () => {
    const token = getDeveloperToken();
    await supabase
      .from('developer_permission_requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId);
    
    onCancelled();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRequestTypeText = () => {
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
            {status === 'approved' && <span className="text-green-600">✓</span>}
            {status === 'denied' && <span className="text-destructive">✗</span>}
            {status === 'expired' && <span className="text-muted-foreground">⏱</span>}
            
            {status === 'pending' && 'Aguardando Permissão'}
            {status === 'approved' && 'Permissão Concedida'}
            {status === 'denied' && 'Permissão Negada'}
            {status === 'expired' && 'Tempo Expirado'}
          </DialogTitle>
          <DialogDescription>
            {status === 'pending' && (
              <>
                Solicitando permissão para {getRequestTypeText()} <strong>{targetName}</strong>.
                <br />
                O usuário responsável foi notificado e precisa aprovar esta ação.
              </>
            )}
            {status === 'approved' && 'A permissão foi concedida. Prosseguindo...'}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}