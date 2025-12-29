import { Lock, UserCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Conversation } from '@/types';

interface BlurredChatOverlayProps {
  conversation: Conversation;
  onTakeOver: () => void;
  isLoading: boolean;
}

export function BlurredChatOverlay({
  conversation,
  onTakeOver,
  isLoading,
}: BlurredChatOverlayProps) {
  const assignedUserName = conversation.assignedUser?.fullName || 'outro agente';
  const isAssigned = !!conversation.assignedUserId;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center p-6 bg-card rounded-xl border shadow-lg">
        <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center">
          <Lock className="w-7 h-7 text-muted-foreground" />
        </div>
        
        <div className="space-y-2">
          <h3 className="font-semibold text-foreground">
            {isAssigned 
              ? `Conversa atribuída a ${assignedUserName}`
              : 'Conversa não atribuída'
            }
          </h3>
          <p className="text-sm text-muted-foreground">
            {isAssigned
              ? 'Para visualizar e interagir com esta conversa, você precisa assumi-la.'
              : 'Esta conversa ainda não tem um responsável. Assuma para atendê-la.'
            }
          </p>
        </div>

        <Button 
          onClick={onTakeOver} 
          disabled={isLoading}
          className="gap-2 w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Assumindo...
            </>
          ) : (
            <>
              <UserCheck className="w-4 h-4" />
              Assumir conversa
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground">
          Ao assumir, você se tornará responsável pelo atendimento
        </p>
      </div>
    </div>
  );
}
