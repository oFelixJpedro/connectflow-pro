import { useMemo } from 'react';
import { format, isSameDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, MapPin, User, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/calendar';

interface CalendarListViewProps {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

export function CalendarListView({
  events,
  onEventClick,
}: CalendarListViewProps) {
  // Agrupar eventos por dia
  const groupedEvents = useMemo(() => {
    const groups: { date: Date; events: CalendarEvent[] }[] = [];
    
    events.forEach(event => {
      const eventDate = new Date(event.start_date);
      const existingGroup = groups.find(g => isSameDay(g.date, eventDate));
      
      if (existingGroup) {
        existingGroup.events.push(event);
      } else {
        groups.push({ date: eventDate, events: [event] });
      }
    });
    
    return groups.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Clock className="w-12 h-12 mb-4" />
        <p>Nenhum evento encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedEvents.map(({ date, events: dayEvents }) => (
        <div key={date.toISOString()}>
          {/* Header do dia */}
          <div className={cn(
            'flex items-center gap-2 mb-3 pb-2 border-b',
            isToday(date) && 'text-primary'
          )}>
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-lg font-medium',
              isToday(date) ? 'bg-primary text-primary-foreground' : 'bg-muted'
            )}>
              {format(date, 'd')}
            </div>
            <div>
              <div className="font-medium capitalize">
                {format(date, 'EEEE', { locale: ptBR })}
              </div>
              <div className="text-sm text-muted-foreground">
                {format(date, "d 'de' MMMM", { locale: ptBR })}
              </div>
            </div>
          </div>

          {/* Lista de eventos */}
          <div className="space-y-2 pl-12">
            {dayEvents.map(event => (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-1 self-stretch rounded-full flex-shrink-0"
                    style={{ backgroundColor: event.color || '#3b82f6' }}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">{event.title}</span>
                      {event.status === 'completed' && (
                        <span className="text-xs bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded">
                          Concluído
                        </span>
                      )}
                      {event.status === 'cancelled' && (
                        <span className="text-xs bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded">
                          Cancelado
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {event.all_day ? (
                          'Dia inteiro'
                        ) : (
                          <>
                            {format(new Date(event.start_date), 'HH:mm')} - 
                            {format(new Date(event.end_date), 'HH:mm')}
                          </>
                        )}
                      </span>
                      
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {event.location}
                        </span>
                      )}
                      
                      {event.assigned_user && (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {event.assigned_user.full_name}
                        </span>
                      )}
                      
                      {event.contact && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {event.contact.name || event.contact.phone_number}
                        </span>
                      )}
                    </div>
                    
                    {event.description && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {event.description}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
