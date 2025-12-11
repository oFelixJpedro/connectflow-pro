import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface PermissionRequest {
  id: string;
  request_type: string;
  target_company_id: string | null;
  target_user_id: string | null;
  status: string;
  created_at: string;
  expires_at: string;
}

export default function PermissionRequestListener() {
  const { profile } = useAuth();
  const [pendingRequest, setPendingRequest] = useState<PermissionRequest | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;

    // Check for existing pending requests
    const checkExisting = async () => {
      const { data } = await supabase
        .from('developer_permission_requests')
        .select('*')
        .eq('approver_id', profile.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setPendingRequest(data[0] as PermissionRequest);
      }
    };

    checkExisting();

    // Subscribe to new permission requests
    const channel = supabase
      .channel(`permission-requests-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'developer_permission_requests',
          filter: `approver_id=eq.${profile.id}`
        },
        (payload) => {
          const request = payload.new as PermissionRequest;
          if (request.status === 'pending') {
            setPendingRequest(request);
            // Play notification sound
            try {
              const audio = new Audio('/notification.mp3');
              audio.volume = 0.5;
              audio.play().catch(() => {});
            } catch {}
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'developer_permission_requests',
          filter: `approver_id=eq.${profile.id}`
        },
        (payload) => {
          const request = payload.new as PermissionRequest;
          // If request was cancelled by developer, close modal
          if (request.id === pendingRequest?.id && 
              (request as any).status !== 'pending') {
            setPendingRequest(null);
            setUnderstood(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const handleRespond = async (approved: boolean) => {
    if (!pendingRequest) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('developer_permission_requests')
        .update({ 
          status: approved ? 'approved' : 'denied',
          responded_at: new Date().toISOString()
        })
        .eq('id', pendingRequest.id);

      if (error) throw error;

      toast.success(approved ? 'Permissão concedida' : 'Permissão negada');
      setPendingRequest(null);
      setUnderstood(false);
    } catch (err) {
      console.error('Error responding to permission:', err);
      toast.error('Erro ao responder solicitação');
    } finally {
      setIsLoading(false);
    }
  };

  const getRequestDescription = () => {
    if (!pendingRequest) return '';
    
    switch (pendingRequest.request_type) {
      case 'edit_company':
        return 'O desenvolvedor do sistema está solicitando permissão para editar os dados da sua empresa.';
      case 'edit_user':
        return 'O desenvolvedor do sistema está solicitando permissão para editar seus dados de usuário.';
      case 'access_user':
        return 'O desenvolvedor do sistema está solicitando permissão para acessar o sistema como você. Isso permite que ele veja exatamente o que você vê para fins de suporte.';
      case 'delete_company':
        return 'O desenvolvedor do sistema está solicitando permissão para excluir sua empresa. Esta ação é irreversível.';
      case 'delete_user':
        return 'O desenvolvedor do sistema está solicitando permissão para excluir sua conta. Esta ação é irreversível.';
      default:
        return 'O desenvolvedor do sistema está solicitando permissão para realizar uma ação.';
    }
  };

  const isDestructive = pendingRequest?.request_type?.includes('delete');

  if (!pendingRequest) return null;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent 
        className={`sm:max-w-md ${isDestructive ? 'border-destructive' : 'border-yellow-500'} border-2`}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isDestructive ? 'text-destructive' : 'text-yellow-600'}`}>
            {isDestructive ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <Shield className="h-5 w-5" />
            )}
            Solicitação do Desenvolvedor
          </DialogTitle>
          <DialogDescription className="text-base">
            {getRequestDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className={`p-3 rounded-md ${isDestructive ? 'bg-destructive/10' : 'bg-yellow-500/10'}`}>
            <p className="text-sm font-medium">
              {isDestructive 
                ? '⚠️ Esta é uma ação destrutiva e não pode ser desfeita.'
                : '🔒 Sua privacidade é importante. Apenas autorize se você confia nesta ação.'}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="understand-toggle"
              checked={understood}
              onCheckedChange={setUnderstood}
            />
            <Label htmlFor="understand-toggle" className="text-sm">
              Entendo e autorizo esta ação
            </Label>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => handleRespond(false)}
            disabled={isLoading}
          >
            Recusar
          </Button>
          <Button 
            onClick={() => handleRespond(true)}
            disabled={!understood || isLoading}
            variant={isDestructive ? 'destructive' : 'default'}
          >
            Permitir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}