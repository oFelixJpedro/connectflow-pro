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
  addMonths,
  subMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/calendar';

interface CalendarMiniCalendarProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  events: CalendarEvent[];
}

export function CalendarMiniCalendar({
  currentDate,
  onDateSelect,
  events,
}: CalendarMiniCalendarProps) {
  // Gerar dias do mês
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // Dias com eventos
  const daysWithEvents = useMemo(() => {
    const set = new Set<string>();
    events.forEach(event => {
      set.add(format(new Date(event.start_date), 'yyyy-MM-dd'));
    });
    return set;
  }, [events]);

  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => onDateSelect(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <CardTitle className="text-sm font-medium capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={() => onDateSelect(addMonths(currentDate, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        {/* Header com dias da semana */}
        <div className="grid grid-cols-7 mb-1">
          {weekDays.map((day, i) => (
            <div 
              key={i} 
              className="text-center text-xs text-muted-foreground py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Grid de dias */}
        <div className="grid grid-cols-7 gap-0.5">
          {calendarDays.map((day, index) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const hasEvents = daysWithEvents.has(dateKey);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isSelectedDay = isSameDay(day, currentDate);
            const isTodayDay = isToday(day);

            return (
              <button
                key={index}
                onClick={() => onDateSelect(day)}
                className={cn(
                  'relative w-8 h-8 flex items-center justify-center text-sm rounded-full transition-colors',
                  !isCurrentMonth && 'text-muted-foreground/50',
                  isSelectedDay && 'bg-primary text-primary-foreground',
                  isTodayDay && !isSelectedDay && 'border border-primary text-primary',
                  !isSelectedDay && !isTodayDay && 'hover:bg-muted',
                )}
              >
                {format(day, 'd')}
                {hasEvents && !isSelectedDay && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
