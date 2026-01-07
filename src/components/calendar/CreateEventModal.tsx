import { useState } from 'react';
import { format, addHours, setHours, setMinutes } from 'date-fns';
import { Calendar as CalendarIcon, Clock, MapPin, Users, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { CreateCalendarEventData, CalendarEventType } from '@/types/calendar';

interface CreateEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date | null;
  onSubmit: (data: CreateCalendarEventData) => void;
}

const eventTypeOptions: { value: CalendarEventType; label: string }[] = [
  { value: 'meeting', label: '📅 Reunião' },
  { value: 'reminder', label: '🔔 Lembrete' },
  { value: 'task', label: '✅ Tarefa' },
  { value: 'other', label: '📌 Outro' },
];

const colorOptions = [
  { value: '#3b82f6', label: 'Azul' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#f59e0b', label: 'Amarelo' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#ec4899', label: 'Rosa' },
  { value: '#06b6d4', label: 'Ciano' },
  { value: '#64748b', label: 'Cinza' },
];

export function CreateEventModal({
  open,
  onOpenChange,
  initialDate,
  onSubmit,
}: CreateEventModalProps) {
  const defaultStart = initialDate 
    ? setMinutes(setHours(initialDate, 9), 0) 
    : setMinutes(setHours(new Date(), 9), 0);
    
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(addHours(defaultStart, 1));
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [eventType, setEventType] = useState<CalendarEventType>('meeting');
  const [color, setColor] = useState('#3b82f6');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && initialDate) {
      const newStart = setMinutes(setHours(initialDate, 9), 0);
      setStartDate(newStart);
      setEndDate(addHours(newStart, 1));
    }
    if (!newOpen) {
      setTitle('');
      setDescription('');
      setLocation('');
      setEventType('meeting');
      setColor('#3b82f6');
      setAllDay(false);
    }
    onOpenChange(newOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        all_day: allDay,
        location: location.trim() || undefined,
        event_type: eventType,
        color,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartTimeChange = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const newStart = setMinutes(setHours(startDate, hours), minutes);
    setStartDate(newStart);
    // Auto-adjust end time to maintain duration
    if (newStart >= endDate) {
      setEndDate(addHours(newStart, 1));
    }
  };

  const handleEndTimeChange = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    setEndDate(setMinutes(setHours(endDate, hours), minutes));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Evento</DialogTitle>
          <DialogDescription>
            Crie um novo evento no calendário
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do evento"
              required
            />
          </div>

          {/* Tipo e Cor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={eventType} onValueChange={(v) => setEventType(v as CalendarEventType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventTypeOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-1">
                {colorOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setColor(opt.value)}
                    className={cn(
                      'w-6 h-6 rounded-full transition-transform',
                      color === opt.value && 'ring-2 ring-offset-2 ring-primary scale-110'
                    )}
                    style={{ backgroundColor: opt.value }}
                    title={opt.label}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Dia inteiro */}
          <div className="flex items-center justify-between">
            <Label htmlFor="allDay">Dia inteiro</Label>
            <Switch
              id="allDay"
              checked={allDay}
              onCheckedChange={setAllDay}
            />
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de início</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, 'dd/MM/yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {!allDay && (
              <div className="space-y-2">
                <Label>Hora início</Label>
                <Input
                  type="time"
                  value={format(startDate, 'HH:mm')}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                />
              </div>
            )}
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de término</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(endDate, 'dd/MM/yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => date && setEndDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Hora término</Label>
                <Input
                  type="time"
                  value={format(endDate, 'HH:mm')}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Local */}
          <div className="space-y-2">
            <Label htmlFor="location">Local</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Local ou link da reunião"
                className="pl-9"
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes do evento..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? 'Criando...' : 'Criar Evento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
