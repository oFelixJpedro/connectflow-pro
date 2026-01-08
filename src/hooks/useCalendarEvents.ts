import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay, addDays } from 'date-fns';
import type { 
  CalendarEvent, 
  CreateCalendarEventData, 
  UpdateCalendarEventData,
  CalendarViewMode 
} from '@/types/calendar';

export function useCalendarEvents() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar eventos por período
  const loadEvents = useCallback(async (startDate: Date, endDate: Date) => {
    if (!profile?.company_id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('calendar_events')
        .select(`
          *,
          contact:contacts(id, name, phone_number),
          assigned_user:profiles!calendar_events_assigned_to_fkey(id, full_name, avatar_url),
          attendees:calendar_event_attendees(*)
        `)
        .eq('company_id', profile.company_id)
        .gte('start_date', startDate.toISOString())
        .lte('end_date', endDate.toISOString())
        .order('start_date', { ascending: true });

      if (fetchError) throw fetchError;
      
      setEvents((data || []) as unknown as CalendarEvent[]);
    } catch (err) {
      console.error('Erro ao carregar eventos:', err);
      setError('Erro ao carregar eventos');
    } finally {
      setIsLoading(false);
    }
  }, [profile?.company_id]);

  // Carregar eventos baseado no modo de visualização
  const loadEventsByView = useCallback((date: Date, viewMode: CalendarViewMode) => {
    let start: Date;
    let end: Date;

    switch (viewMode) {
      case 'month':
        start = startOfWeek(startOfMonth(date), { weekStartsOn: 0 });
        end = endOfWeek(endOfMonth(date), { weekStartsOn: 0 });
        break;
      case 'week':
        start = startOfWeek(date, { weekStartsOn: 0 });
        end = endOfWeek(date, { weekStartsOn: 0 });
        break;
      case 'day':
        start = startOfDay(date);
        end = endOfDay(date);
        break;
      case 'list':
        start = startOfDay(date);
        end = addDays(start, 30);
        break;
      default:
        start = startOfMonth(date);
        end = endOfMonth(date);
    }

    loadEvents(start, end);
  }, [loadEvents]);

  // Criar novo evento
  const createEvent = useCallback(async (data: CreateCalendarEventData): Promise<CalendarEvent | null> => {
    if (!profile?.company_id || !profile?.id) {
      toast.error('Usuário não autenticado');
      return null;
    }

    try {
      const { attendees, ...eventData } = data;
      
      const { data: newEvent, error: createError } = await supabase
        .from('calendar_events')
        .insert({
          company_id: profile.company_id,
          created_by: profile.id,
          ...eventData,
        })
        .select(`
          *,
          contact:contacts(id, name, phone_number),
          assigned_user:profiles!calendar_events_assigned_to_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (createError) throw createError;

      // Adicionar participantes se houver
      if (attendees && attendees.length > 0) {
        const { error: attendeesError } = await supabase
          .from('calendar_event_attendees')
          .insert(
            attendees.map(a => ({
              event_id: newEvent.id,
              ...a,
            }))
          );
        
        if (attendeesError) {
          console.warn('Erro ao adicionar participantes:', attendeesError);
        }
      }

      toast.success('Evento criado com sucesso!');
      
      // Atualizar lista de eventos
      setEvents(prev => [...prev, newEvent as unknown as CalendarEvent].sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      ));
      
      return newEvent as unknown as CalendarEvent;
    } catch (err) {
      console.error('Erro ao criar evento:', err);
      toast.error('Erro ao criar evento');
      return null;
    }
  }, [profile?.company_id, profile?.id]);

  // Atualizar evento
  const updateEvent = useCallback(async (eventId: string, data: UpdateCalendarEventData): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('calendar_events')
        .update(data)
        .eq('id', eventId);

      if (updateError) throw updateError;

      toast.success('Evento atualizado com sucesso!');
      
      // Atualizar no estado local
      setEvents(prev => prev.map(e => 
        e.id === eventId ? { ...e, ...data } : e
      ));
      
      return true;
    } catch (err) {
      console.error('Erro ao atualizar evento:', err);
      toast.error('Erro ao atualizar evento');
      return false;
    }
  }, []);

  // Excluir evento
  const deleteEvent = useCallback(async (eventId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId);

      if (deleteError) throw deleteError;

      toast.success('Evento excluído com sucesso!');
      
      // Remover do estado local
      setEvents(prev => prev.filter(e => e.id !== eventId));
      
      return true;
    } catch (err) {
      console.error('Erro ao excluir evento:', err);
      toast.error('Erro ao excluir evento');
      return false;
    }
  }, []);

  // Alterar status do evento
  const setEventStatus = useCallback(async (
    eventId: string, 
    status: 'scheduled' | 'completed' | 'cancelled'
  ): Promise<boolean> => {
    return updateEvent(eventId, { status });
  }, [updateEvent]);

  // Gerar resumo do evento por IA
  const generateEventSummary = useCallback(async (eventId: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-event-summary', {
        body: { eventId, companyId: profile?.company_id },
      });

      if (error) throw error;

      // 💰 Handle insufficient credits
      if (data?.code === 'INSUFFICIENT_CREDITS') {
        toast.error('Créditos insuficientes. Recarregue para gerar resumos.');
        return null;
      }

      if (data?.summary) {
        // Atualizar evento com o resumo
        await updateEvent(eventId, { summary: data.summary });
        return data.summary;
      }

      return null;
    } catch (err) {
      console.error('Erro ao gerar resumo:', err);
      toast.error('Erro ao gerar resumo do evento');
      return null;
    }
  }, [updateEvent, profile?.company_id]);

  // Obter eventos de um dia específico
  const getEventsForDay = useCallback((date: Date): CalendarEvent[] => {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);
    
    return events.filter(event => {
      const eventStart = new Date(event.start_date);
      const eventEnd = new Date(event.end_date);
      
      // Evento começa ou termina neste dia, ou atravessa o dia
      return (
        (eventStart >= dayStart && eventStart <= dayEnd) ||
        (eventEnd >= dayStart && eventEnd <= dayEnd) ||
        (eventStart <= dayStart && eventEnd >= dayEnd)
      );
    });
  }, [events]);

  return {
    events,
    isLoading,
    error,
    loadEvents,
    loadEventsByView,
    createEvent,
    updateEvent,
    deleteEvent,
    setEventStatus,
    generateEventSummary,
    getEventsForDay,
  };
}
