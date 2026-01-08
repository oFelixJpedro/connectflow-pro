import { useMemo } from 'react';
import { 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval,
  eachHourOfInterval,
  startOfDay,
  endOfDay,
  isSameDay,
  isToday,
  format,
  getHours,
  getMinutes,
  differenceInMinutes,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/calendar';

interface CalendarWeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onCreateEvent: (date: Date) => void;
}

export function CalendarWeekView({
  currentDate,
  events,
  onEventClick,
  onCreateEvent,
}: CalendarWeekViewProps) {
  // Dias da semana
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Horas do dia (6h às 22h)
  const hours = useMemo(() => {
    const start = new Date();
    start.setHours(6, 0, 0, 0);
    const end = new Date();
    end.setHours(22, 0, 0, 0);
    return eachHourOfInterval({ start, end });
  }, []);

  // Eventos por dia
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    
    events.forEach(event => {
      const dateKey = format(new Date(event.start_date), 'yyyy-MM-dd');
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, event]);
    });
    
    return map;
  }, [events]);

  const getEventPosition = (event: CalendarEvent) => {
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    
    const startHour = getHours(start) + getMinutes(start) / 60;
    const duration = differenceInMinutes(end, start);
    
    const top = Math.max(0, (startHour - 6) * 60); // 60px por hora, começando às 6h
    const height = Math.max(20, duration);
    
    return { top, height };
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header com dias */}
      <div className="flex border-b sticky top-0 bg-background z-10">
        <div className="w-16 flex-shrink-0" />
        {weekDays.map(day => (
          <div
            key={day.toISOString()}
            className={cn(
              'flex-1 py-3 text-center border-l',
              isToday(day) && 'bg-primary/10',
            )}
          >
            <div className="text-sm text-muted-foreground">
              {format(day, 'EEE', { locale: ptBR })}
            </div>
            <div
              className={cn(
                'text-lg font-medium',
                isToday(day) && 'text-primary',
              )}
            >
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Grid de horas */}
      <div className="flex flex-1 relative pt-2">
        {/* Coluna de horas */}
        <div className="w-16 flex-shrink-0">
          {hours.map((hour, index) => (
            <div
              key={index}
              className="h-[60px] text-xs text-muted-foreground text-right pr-2 flex items-start"
            >
              <span className="w-full -translate-y-2">{format(hour, 'HH:mm')}</span>
            </div>
          ))}
        </div>

        {/* Colunas dos dias */}
        {weekDays.map(day => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(dateKey) || [];

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'flex-1 border-l relative',
                isToday(day) && 'bg-primary/5',
              )}
              onDoubleClick={() => onCreateEvent(day)}
            >
              {/* Linhas das horas */}
              {hours.map((_, index) => (
                <div
                  key={index}
                  className="h-[60px] border-b border-dashed border-muted"
                />
              ))}

              {/* Eventos */}
              {dayEvents.filter(e => !e.all_day).map(event => {
                const { top, height } = getEventPosition(event);
                
                return (
                  <button
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className={cn(
                      'absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-xs overflow-hidden',
                      'hover:opacity-80 transition-opacity text-white text-left'
                    )}
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      backgroundColor: event.color || '#3b82f6',
                    }}
                    title={event.title}
                  >
                    <div className="font-medium truncate">{event.title}</div>
                    <div className="opacity-80 truncate">
                      {format(new Date(event.start_date), 'HH:mm')} - 
                      {format(new Date(event.end_date), 'HH:mm')}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
