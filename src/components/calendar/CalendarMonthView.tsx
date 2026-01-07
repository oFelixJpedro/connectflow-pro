import { useMemo } from 'react';
import { 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/calendar';

interface CalendarMonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onDateSelect: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onCreateEvent: (date: Date) => void;
}

export function CalendarMonthView({
  currentDate,
  events,
  onDateSelect,
  onEventClick,
  onCreateEvent,
}: CalendarMonthViewProps) {
  // Gerar dias do calendário
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // Agrupar eventos por dia
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    
    events.forEach(event => {
      const dateKey = format(new Date(event.start_date), 'yyyy-MM-dd');
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, event]);
    });
    
    return map;
  }, [events]);

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="flex flex-col h-full">
      {/* Header com dias da semana */}
      <div className="grid grid-cols-7 border-b">
        {weekDays.map(day => (
          <div 
            key={day} 
            className="py-2 text-center text-sm font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grid de dias */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {calendarDays.map((day, index) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isSelectedDay = isSameDay(day, currentDate);
          const isTodayDay = isToday(day);

          return (
            <div
              key={index}
              className={cn(
                'border-r border-b p-1 min-h-[100px] cursor-pointer transition-colors hover:bg-muted/50',
                !isCurrentMonth && 'bg-muted/20',
                isSelectedDay && 'bg-primary/10',
              )}
              onClick={() => onDateSelect(day)}
              onDoubleClick={() => onCreateEvent(day)}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    'text-sm w-7 h-7 flex items-center justify-center rounded-full',
                    !isCurrentMonth && 'text-muted-foreground',
                    isTodayDay && 'bg-primary text-primary-foreground font-medium',
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Eventos do dia */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(event => (
                  <button
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                    className={cn(
                      'w-full text-left text-xs px-1.5 py-0.5 rounded truncate',
                      'hover:opacity-80 transition-opacity'
                    )}
                    style={{ 
                      backgroundColor: event.color || '#3b82f6',
                      color: 'white',
                    }}
                    title={event.title}
                  >
                    {event.all_day ? (
                      event.title
                    ) : (
                      <>
                        <span className="font-medium">
                          {format(new Date(event.start_date), 'HH:mm')}
                        </span>
                        {' '}
                        {event.title}
                      </>
                    )}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDateSelect(day);
                    }}
                    className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
                  >
                    +{dayEvents.length - 3} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
