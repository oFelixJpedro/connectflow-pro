import { useState } from 'react';
import { UserPlus, Check, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Conversation } from '@/types';

interface AssignButtonProps {
  conversation: Conversation;
  currentUserId: string;
  onAssigned: () => void;
  isRestricted?: boolean; // true if user has 'assigned_only' access level
}

export function AssignButton({
  conversation,
  currentUserId,
  onAssigned,
  isRestricted = false,
}: AssignButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const isAssigned = !!conversation.assignedUserId;
  const isAssignedToMe = conversation.assignedUserId === currentUserId;
  const isClosed = conversation.status === 'closed';

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
        description: 'Esta conversa foi atribuída a você.',
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
      <Button size="sm" onClick={handleAssign} disabled={isLoading} className="gap-2">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <UserPlus className="w-4 h-4" />
        )}
        {isLoading ? 'Atribuindo...' : 'Atribuir para mim'}
      </Button>
    );
  }

  // Está atribuída a outro - não mostrar botão (só admin/owner podem reatribuir via menu)
  return null;
}
