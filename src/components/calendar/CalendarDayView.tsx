import { useMemo } from 'react';
import { 
  eachHourOfInterval,
  format,
  getHours,
  getMinutes,
  differenceInMinutes,
  isSameDay,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/calendar';

interface CalendarDayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onCreateEvent: (date: Date) => void;
}

export function CalendarDayView({
  currentDate,
  events,
  onEventClick,
  onCreateEvent,
}: CalendarDayViewProps) {
  // Horas do dia (0h às 23h)
  const hours = useMemo(() => {
    const start = new Date(currentDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(currentDate);
    end.setHours(23, 0, 0, 0);
    return eachHourOfInterval({ start, end });
  }, [currentDate]);

  // Filtrar eventos do dia
  const dayEvents = useMemo(() => {
    return events.filter(event => 
      isSameDay(new Date(event.start_date), currentDate)
    );
  }, [events, currentDate]);

  // Eventos de dia inteiro
  const allDayEvents = dayEvents.filter(e => e.all_day);
  const timedEvents = dayEvents.filter(e => !e.all_day);

  const getEventPosition = (event: CalendarEvent) => {
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    
    const startHour = getHours(start) + getMinutes(start) / 60;
    const duration = differenceInMinutes(end, start);
    
    const top = startHour * 60; // 60px por hora
    const height = Math.max(30, duration);
    
    return { top, height };
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Eventos de dia inteiro */}
      {allDayEvents.length > 0 && (
        <div className="border-b p-2 space-y-1 bg-muted/20">
          <div className="text-xs text-muted-foreground mb-1">Dia inteiro</div>
          {allDayEvents.map(event => (
            <button
              key={event.id}
              onClick={() => onEventClick(event)}
              className="w-full text-left text-sm px-2 py-1 rounded hover:opacity-80 text-white"
              style={{ backgroundColor: event.color || '#3b82f6' }}
            >
              {event.title}
            </button>
          ))}
        </div>
      )}

      {/* Grid de horas */}
      <div 
        className="flex-1 relative pt-2"
        onDoubleClick={() => onCreateEvent(currentDate)}
      >
        {/* Linhas das horas */}
        {hours.map((hour, index) => (
          <div key={index} className="flex h-[60px] border-b border-dashed relative">
            <div className="w-16 flex-shrink-0 text-xs text-muted-foreground text-right pr-2 absolute -top-2">
              {format(hour, 'HH:mm')}
            </div>
            <div className="flex-1 ml-16 border-l" />
          </div>
        ))}

        {/* Eventos com horário */}
        <div className="absolute top-0 left-16 right-0 bottom-0">
          {timedEvents.map(event => {
            const { top, height } = getEventPosition(event);
            
            return (
              <button
                key={event.id}
                onClick={() => onEventClick(event)}
                className={cn(
                  'absolute left-1 right-1 rounded px-2 py-1 text-sm overflow-hidden',
                  'hover:opacity-80 transition-opacity text-white text-left'
                )}
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  backgroundColor: event.color || '#3b82f6',
                }}
              >
                <div className="font-medium truncate">{event.title}</div>
                <div className="opacity-80 text-xs truncate">
                  {format(new Date(event.start_date), 'HH:mm')} - 
                  {format(new Date(event.end_date), 'HH:mm')}
                </div>
                {event.location && (
                  <div className="opacity-70 text-xs truncate">
                    📍 {event.location}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
