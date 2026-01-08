import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Clock, 
  MapPin, 
  User, 
  MessageSquare, 
  Trash2, 
  Edit2, 
  Sparkles,
  CheckCircle,
  XCircle,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { CalendarEvent, UpdateCalendarEventData } from '@/types/calendar';

interface EventDetailDrawerProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (eventId: string, data: UpdateCalendarEventData) => void;
  onDelete: (eventId: string) => void;
  onGenerateSummary: (eventId: string) => void;
}

const eventTypeLabels: Record<string, string> = {
  meeting: '📅 Reunião',
  reminder: '🔔 Lembrete',
  task: '✅ Tarefa',
  other: '📌 Outro',
};

const statusLabels: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Agendado', color: 'bg-blue-500' },
  completed: { label: 'Concluído', color: 'bg-green-500' },
  cancelled: { label: 'Cancelado', color: 'bg-red-500' },
};

export function EventDetailDrawer({
  event,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  onGenerateSummary,
}: EventDetailDrawerProps) {
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  if (!event) return null;

  const handleStatusChange = (status: 'scheduled' | 'completed' | 'cancelled') => {
    onUpdate(event.id, { status });
  };

  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      await onGenerateSummary(event.id);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const statusInfo = statusLabels[event.status];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-auto">
        <SheetHeader>
          <div className="flex items-start gap-3">
            <div
              className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
              style={{ backgroundColor: event.color || '#3b82f6' }}
            />
            <div className="flex-1">
              <SheetTitle className="text-left">{event.title}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <span>{eventTypeLabels[event.event_type]}</span>
                <Badge 
                  variant="secondary" 
                  className={`${statusInfo.color} text-white`}
                >
                  {statusInfo.label}
                </Badge>
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Data e Hora */}
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <div className="font-medium">
                {format(new Date(event.start_date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </div>
              {event.all_day ? (
                <div className="text-sm text-muted-foreground">Dia inteiro</div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  {format(new Date(event.start_date), 'HH:mm')} - 
                  {format(new Date(event.end_date), 'HH:mm')}
                </div>
              )}
            </div>
          </div>

          {/* Local */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium">Local</div>
                <div className="text-sm text-muted-foreground">{event.location}</div>
              </div>
            </div>
          )}

          {/* Responsável */}
          {event.assigned_user && (
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium">Responsável</div>
                <div className="text-sm text-muted-foreground">
                  {event.assigned_user.full_name}
                </div>
              </div>
            </div>
          )}

          {/* Contato */}
          {event.contact && (
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <div className="font-medium">Contato</div>
                <div className="text-sm text-muted-foreground">
                  {event.contact.name || event.contact.phone_number}
                </div>
              </div>
            </div>
          )}

          {/* Descrição */}
          {event.description && (
            <>
              <Separator />
              <div>
                <div className="font-medium mb-2">Descrição</div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>
            </>
          )}

          {/* Resumo IA */}
          <Separator />
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="font-medium">Resumo por IA</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateSummary}
                disabled={isGeneratingSummary}
              >
                {isGeneratingSummary ? 'Gerando...' : event.summary ? 'Regenerar' : 'Gerar'}
              </Button>
            </div>
            {event.summary ? (
              <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                {event.summary}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Clique em "Gerar" para criar um resumo completo deste evento com IA.
              </p>
            )}
          </div>

          {/* Ações de status */}
          <Separator />
          <div>
            <div className="font-medium mb-3">Alterar Status</div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={event.status === 'scheduled' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStatusChange('scheduled')}
              >
                <Calendar className="w-4 h-4 mr-1" />
                Agendado
              </Button>
              <Button
                variant={event.status === 'completed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStatusChange('completed')}
                className={event.status === 'completed' ? 'bg-green-500 hover:bg-green-600' : ''}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Concluído
              </Button>
              <Button
                variant={event.status === 'cancelled' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStatusChange('cancelled')}
                className={event.status === 'cancelled' ? 'bg-red-500 hover:bg-red-600' : ''}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Cancelado
              </Button>
            </div>
          </div>

          {/* Ações */}
          <Separator />
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="flex-1">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir evento</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir o evento "{event.title}"? 
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(event.id)}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
