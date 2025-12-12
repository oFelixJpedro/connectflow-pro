import { useState } from 'react';
import { UserPlus, Check, Loader2, Lock, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Conversation } from '@/types';

interface AssignButtonProps {
  conversation: Conversation;
  currentUserId: string;
  currentUserRole?: string;
  onAssigned: () => void;
  isRestricted?: boolean; // true if user has 'assigned_only' access level
}

export function AssignButton({
  conversation,
  currentUserId,
  currentUserRole = 'agent',
  onAssigned,
  isRestricted = false,
}: AssignButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const isAssigned = !!conversation.assignedUserId;
  const isAssignedToMe = conversation.assignedUserId === currentUserId;
  const isClosed = conversation.status === 'closed';
  const isAdminOrOwner = ['owner', 'admin'].includes(currentUserRole);
  const assignedUserName = conversation.assignedUser?.fullName || 'outro agente';

  const handleAssign = async () => {
    setIsLoading(true);

    try {
      const response = await supabase.functions.invoke('conversation-management', {
        body: {
          action: 'assign',
          conversationId: conversation.id,
        },
      });

      if (response.error) {
        throw new Error(response.data?.error || 'Erro ao atribuir conversa');
      }

      toast({
        title: 'Conversa atribuída',
        description: isAssigned 
          ? 'Esta conversa foi assumida por você.'
          : 'Esta conversa foi atribuída a você.',
      });

      onAssigned();
    } catch (error: any) {
      console.error('Erro ao atribuir:', error);
      toast({
        title: 'Erro ao atribuir',
        description: error.message || 'Ocorreu um erro ao atribuir a conversa',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setShowConfirmDialog(false);
    }
  };

  const handleClick = () => {
    // Se é admin/owner e está atribuída a outro, mostrar confirmação
    if (isAdminOrOwner && isAssigned && !isAssignedToMe) {
      setShowConfirmDialog(true);
    } else {
      handleAssign();
    }
  };

  // Não mostrar se está fechada
  if (isClosed) {
    return null;
  }

  // Se está atribuída ao usuário logado
  if (isAssignedToMe) {
    return (
      <Button size="sm" variant="outline" disabled className="gap-2">
        <Check className="w-4 h-4" />
        Atribuída a você
      </Button>
    );
  }

  // Se não está atribuída
  if (!isAssigned) {
    // Block assign button if user has restricted access
    if (isRestricted) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline" disabled className="gap-2">
              <Lock className="w-4 h-4" />
              Atribuir para mim
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Você não tem permissão para puxar conversas da fila</p>
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Button size="sm" onClick={handleClick} disabled={isLoading} className="gap-2">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <UserPlus className="w-4 h-4" />
        )}
        {isLoading ? 'Atribuindo...' : 'Atribuir para mim'}
      </Button>
    );
  }

  // Está atribuída a outro - só admin/owner podem assumir
  if (isAdminOrOwner) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={handleClick} 
              disabled={isLoading} 
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
              {isLoading ? 'Assumindo...' : 'Assumir conversa'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Assumir esta conversa de {assignedUserName}</p>
          </TooltipContent>
        </Tooltip>

        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Assumir conversa atribuída?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta conversa está atualmente atribuída a <strong>{assignedUserName}</strong>. 
                Ao assumir, você se tornará o responsável pelo atendimento e o agente anterior 
                será notificado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleAssign} disabled={isLoading}>
                {isLoading ? 'Assumindo...' : 'Assumir conversa'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // Agente comum - não pode assumir conversa de outro
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button size="sm" variant="outline" disabled className="gap-2">
          <Lock className="w-4 h-4" />
          Atribuída
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Esta conversa está sendo atendida por {assignedUserName}</p>
      </TooltipContent>
    </Tooltip>
  );
}
