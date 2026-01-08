import { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  LayoutGrid,
  List,
  CalendarDays,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  format, 
  addMonths, 
  subMonths, 
  addWeeks, 
  subWeeks, 
  addDays, 
  subDays,
  startOfMonth,
  isToday as dateIsToday,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarWeekView } from './CalendarWeekView';
import { CalendarDayView } from './CalendarDayView';
import { CalendarListView } from './CalendarListView';
import { CalendarMiniCalendar } from './CalendarMiniCalendar';
import { CreateEventModal } from './CreateEventModal';
import { EventDetailDrawer } from './EventDetailDrawer';
import type { CalendarViewMode, CalendarEvent } from '@/types/calendar';

export function CalendarTab() {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [initialEventDate, setInitialEventDate] = useState<Date | null>(null);
  
  const { 
    events, 
    isLoading, 
    loadEventsByView,
    createEvent,
    updateEvent,
    deleteEvent,
    generateEventSummary,
  } = useCalendarEvents();

  // Carregar eventos quando mudar a data ou modo de visualização
  useEffect(() => {
    loadEventsByView(currentDate, viewMode);
  }, [currentDate, viewMode, loadEventsByView]);

  // Navegação
  const handlePrevious = () => {
    switch (viewMode) {
      case 'month':
        setCurrentDate(prev => subMonths(prev, 1));
        break;
      case 'week':
        setCurrentDate(prev => subWeeks(prev, 1));
        break;
      case 'day':
      case 'list':
        setCurrentDate(prev => subDays(prev, 1));
        break;
    }
  };

  const handleNext = () => {
    switch (viewMode) {
      case 'month':
        setCurrentDate(prev => addMonths(prev, 1));
        break;
      case 'week':
        setCurrentDate(prev => addWeeks(prev, 1));
        break;
      case 'day':
      case 'list':
        setCurrentDate(prev => addDays(prev, 1));
        break;
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateSelect = (date: Date) => {
    setCurrentDate(date);
    if (viewMode === 'month') {
      setViewMode('day');
    }
  };

  const handleCreateEvent = (date?: Date) => {
    setInitialEventDate(date || currentDate);
    setShowCreateModal(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  const handleEventCreated = async (data: any) => {
    const result = await createEvent(data);
    if (result) {
      setShowCreateModal(false);
      setInitialEventDate(null);
    }
  };

  const handleEventUpdated = async (eventId: string, data: any) => {
    await updateEvent(eventId, data);
  };

  const handleEventDeleted = async (eventId: string) => {
    await deleteEvent(eventId);
    setSelectedEvent(null);
  };

  const handleGenerateSummary = async (eventId: string) => {
    await generateEventSummary(eventId);
    // Recarregar eventos para mostrar o resumo atualizado
    loadEventsByView(currentDate, viewMode);
  };

  // Título baseado no modo de visualização
  const getTitle = () => {
    switch (viewMode) {
      case 'month':
        return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
      case 'week':
        return `Semana de ${format(currentDate, "d 'de' MMMM", { locale: ptBR })}`;
      case 'day':
        return format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
      case 'list':
        return `Próximos eventos a partir de ${format(currentDate, "d 'de' MMMM", { locale: ptBR })}`;
    }
  };

  const viewModeButtons = [
    { mode: 'month' as const, icon: LayoutGrid, label: 'Mês' },
    { mode: 'week' as const, icon: CalendarDays, label: 'Semana' },
    { mode: 'day' as const, icon: Clock, label: 'Dia' },
    { mode: 'list' as const, icon: List, label: 'Lista' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevious}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={handleToday}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" onClick={handleNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <h2 className="text-xl font-semibold capitalize">{getTitle()}</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* Modo de visualização */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            {viewModeButtons.map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                  viewMode === mode
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <Button onClick={() => handleCreateEvent()}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Evento
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex gap-6 flex-1 min-h-0">
        {/* Mini calendário (lateral) */}
        {viewMode !== 'month' && (
          <div className="hidden lg:block w-64 flex-shrink-0">
            <CalendarMiniCalendar
              currentDate={currentDate}
              onDateSelect={handleDateSelect}
              events={events}
            />
          </div>
        )}

        {/* Visualização principal */}
        <Card className="flex-1 min-h-0 overflow-hidden">
          <CardContent className="p-4 h-full overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <>
                {viewMode === 'month' && (
                  <CalendarMonthView
                    currentDate={currentDate}
                    events={events}
                    onDateSelect={handleDateSelect}
                    onEventClick={handleEventClick}
                    onCreateEvent={handleCreateEvent}
                  />
                )}
                {viewMode === 'week' && (
                  <CalendarWeekView
                    currentDate={currentDate}
                    events={events}
                    onEventClick={handleEventClick}
                    onCreateEvent={handleCreateEvent}
                  />
                )}
                {viewMode === 'day' && (
                  <CalendarDayView
                    currentDate={currentDate}
                    events={events}
                    onEventClick={handleEventClick}
                    onCreateEvent={handleCreateEvent}
                  />
                )}
                {viewMode === 'list' && (
                  <CalendarListView
                    events={events}
                    onEventClick={handleEventClick}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de criação */}
      <CreateEventModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        initialDate={initialEventDate}
        onSubmit={handleEventCreated}
      />

      {/* Drawer de detalhes do evento */}
      <EventDetailDrawer
        event={selectedEvent}
        open={!!selectedEvent}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
        onUpdate={handleEventUpdated}
        onDelete={handleEventDeleted}
        onGenerateSummary={handleGenerateSummary}
      />
    </div>
  );
}
