import { useState, useMemo } from 'react';
import { Play, Pause, StopCircle, RotateCcw, Bot, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAIConversationState } from '@/hooks/useAIConversationState';
import { AIAgentPauseModal } from './AIAgentPauseModal';
import { AIAgentConfirmModal } from './AIAgentConfirmModal';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AIAgentActionsProps {
  conversationId: string | undefined;
}

type ConfirmModalType = 'stop' | 'restart' | null;

export function AIAgentActions({ conversationId }: AIAgentActionsProps) {
  const { toast } = useToast();
  const { state, isLoading, isActionLoading, startAI, pauseAI, stopAI, restartAI } = useAIConversationState({
    conversationId,
  });
  
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [confirmModalType, setConfirmModalType] = useState<ConfirmModalType>(null);

  // Determine current status
  const currentStatus = useMemo(() => {
    if (!state) return 'inactive';
    
    // Check if paused_until has passed
    if (state.status === 'paused' && state.paused_until) {
      const pausedUntil = new Date(state.paused_until);
      if (pausedUntil <= new Date()) {
        return 'active'; // Pause expired
      }
    }
    
    return state.status;
  }, [state]);

  // Status display config
  const statusConfig = useMemo(() => {
    switch (currentStatus) {
      case 'active':
        return {
          label: 'Ativa',
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          dotColor: 'bg-green-500',
        };
      case 'paused':
        const pausedUntil = state?.paused_until ? new Date(state.paused_until) : null;
        const timeRemaining = pausedUntil 
          ? formatDistanceToNow(pausedUntil, { locale: ptBR, addSuffix: false })
          : '';
        return {
          label: `Pausada (${timeRemaining})`,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          dotColor: 'bg-yellow-500',
        };
      case 'deactivated_permanently':
        return {
          label: 'Desativada',
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          dotColor: 'bg-red-500',
        };
      default:
        return {
          label: 'Inativa',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
          dotColor: 'bg-muted-foreground',
        };
    }
  }, [currentStatus, state?.paused_until]);

  // Button states based on current status
  const buttonStates = useMemo(() => ({
    start: currentStatus !== 'active',
    pause: currentStatus === 'active',
    stop: currentStatus === 'active' || currentStatus === 'paused',
    restart: currentStatus !== 'inactive',
  }), [currentStatus]);

  // Action handlers
  const handleStart = async () => {
    const success = await startAI();
    if (success) {
      toast({ title: 'IA Iniciada', description: 'A IA está ativa nesta conversa.' });
    } else {
      toast({ title: 'Erro', description: 'Não foi possível iniciar a IA.', variant: 'destructive' });
    }
  };

  const handlePause = async (durationMinutes: number) => {
    const success = await pauseAI(durationMinutes);
    if (success) {
      toast({ 
        title: 'IA Pausada', 
        description: `A IA foi pausada por ${durationMinutes} minutos.` 
      });
    } else {
      toast({ title: 'Erro', description: 'Não foi possível pausar a IA.', variant: 'destructive' });
    }
  };

  const handleStop = async () => {
    const success = await stopAI();
    if (success) {
      toast({ title: 'IA Parada', description: 'A IA foi desativada nesta conversa.' });
    } else {
      toast({ title: 'Erro', description: 'Não foi possível parar a IA.', variant: 'destructive' });
    }
  };

  const handleRestart = async () => {
    const success = await restartAI();
    if (success) {
      toast({ title: 'IA Reiniciada', description: 'O contexto da IA foi limpo.' });
    } else {
      toast({ title: 'Erro', description: 'Não foi possível reiniciar a IA.', variant: 'destructive' });
    }
  };

  if (!conversationId) return null;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Agente de IA</span>
        </div>
        <div className="flex items-center justify-center py-3">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        {/* Header with status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Agente de IA</span>
          </div>
          
          {/* Status badge */}
          <div className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
            statusConfig.bgColor,
            statusConfig.color
          )}>
            <span className={cn('w-2 h-2 rounded-full animate-pulse', statusConfig.dotColor)} />
            {statusConfig.label}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {/* Start button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!buttonStates.start || isActionLoading}
                onClick={handleStart}
                className={cn(
                  'flex-1 h-9',
                  buttonStates.start && 'border-green-500/50 text-green-600 hover:bg-green-500/10 hover:text-green-600'
                )}
              >
                {isActionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Ativa a IA para responder nesta conversa</p>
            </TooltipContent>
          </Tooltip>

          {/* Pause button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!buttonStates.pause || isActionLoading}
                onClick={() => setPauseModalOpen(true)}
                className={cn(
                  'flex-1 h-9',
                  buttonStates.pause && 'border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/10 hover:text-yellow-600'
                )}
              >
                <Pause className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Pausa a IA temporariamente por um período</p>
            </TooltipContent>
          </Tooltip>

          {/* Stop button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!buttonStates.stop || isActionLoading}
                onClick={() => setConfirmModalType('stop')}
                className={cn(
                  'flex-1 h-9',
                  buttonStates.stop && 'border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-600'
                )}
              >
                <StopCircle className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Desativa a IA permanentemente (pode ser reativada)</p>
            </TooltipContent>
          </Tooltip>

          {/* Restart button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!buttonStates.restart || isActionLoading}
                onClick={() => setConfirmModalType('restart')}
                className={cn(
                  'flex-1 h-9',
                  buttonStates.restart && 'border-blue-500/50 text-blue-600 hover:bg-blue-500/10 hover:text-blue-600'
                )}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Reseta a memória da IA para esta conversa</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Pause Modal */}
      <AIAgentPauseModal
        open={pauseModalOpen}
        onOpenChange={setPauseModalOpen}
        onConfirm={handlePause}
        isLoading={isActionLoading}
      />

      {/* Confirm Modal (Stop/Restart) */}
      {confirmModalType && (
        <AIAgentConfirmModal
          open={true}
          onOpenChange={(open) => !open && setConfirmModalType(null)}
          onConfirm={confirmModalType === 'stop' ? handleStop : handleRestart}
          isLoading={isActionLoading}
          type={confirmModalType}
        />
      )}
    </TooltipProvider>
  );
}
