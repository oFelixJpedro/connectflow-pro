import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  History,
  Phone,
  Trash2,
  User,
  Filter,
  X,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  fetchUniqueContactsFromLogs, 
  UniqueContactFromLogs, 
  ContactEventType,
  ContactLogsFilters 
} from '@/lib/contactHistory';
import { ContactTimelineModal } from './ContactTimelineModal';

interface ContactHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getEventLabel = (eventType: ContactEventType): string => {
  const labels: Record<ContactEventType, string> = {
    created: 'Criado',
    updated: 'Editado',
    deleted: 'Excluído',
    tag_added: 'Tag adicionada',
    tag_removed: 'Tag removida',
    imported: 'Importado',
    exported: 'Exportado',
    conversation_started: 'Conversa iniciada',
    crm_added: 'Adicionado ao CRM'
  };
  return labels[eventType] || eventType;
};

export function ContactHistoryModal({
  open,
  onOpenChange
}: ContactHistoryModalProps) {
  const { profile } = useAuth();
  const [contacts, setContacts] = useState<UniqueContactFromLogs[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Timeline modal state
  const [selectedContact, setSelectedContact] = useState<UniqueContactFromLogs | null>(null);
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);

  const loadContacts = async () => {
    if (!profile?.company_id) return;
    
    setLoading(true);
    const filters: ContactLogsFilters = {
      searchQuery: searchQuery || undefined,
      eventType: eventTypeFilter !== 'all' ? eventTypeFilter as ContactEventType : undefined
    };
    
    const data = await fetchUniqueContactsFromLogs(profile.company_id, filters);
    setContacts(data);
    setLoading(false);
  };

  useEffect(() => {
    if (open && profile?.company_id) {
      loadContacts();
    }
  }, [open, profile?.company_id]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    
    const timer = setTimeout(() => {
      loadContacts();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery, eventTypeFilter]);

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 13) {
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  const handleContactClick = (contact: UniqueContactFromLogs) => {
    setSelectedContact(contact);
    setTimelineModalOpen(true);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setEventTypeFilter('all');
  };

  const hasActiveFilters = searchQuery || eventTypeFilter !== 'all';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Histórico de Contatos
            </DialogTitle>
          </DialogHeader>

          {/* Search and Filters */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou telefone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button
                variant={showFilters ? "secondary" : "outline"}
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="w-4 h-4" />
              </Button>
            </div>

            {showFilters && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tipo de evento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os eventos</SelectItem>
                      <SelectItem value="created">Criado</SelectItem>
                      <SelectItem value="updated">Editado</SelectItem>
                      <SelectItem value="deleted">Excluído</SelectItem>
                      <SelectItem value="imported">Importado</SelectItem>
                      <SelectItem value="conversation_started">Conversa iniciada</SelectItem>
                      <SelectItem value="crm_added">Adicionado ao CRM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="w-4 h-4 mr-1" />
                    Limpar
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Contacts List */}
          <ScrollArea className="h-[50vh] pr-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Nenhum registro encontrado</p>
                <p className="text-sm">
                  {hasActiveFilters 
                    ? 'Tente ajustar os filtros'
                    : 'Eventos de contatos aparecerão aqui'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {contacts.map((contact, index) => (
                  <div
                    key={`${contact.contact_snapshot.phone_number}-${index}`}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleContactClick(contact)}
                  >
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      contact.is_deleted 
                        ? 'bg-destructive/10' 
                        : 'bg-primary/10'
                    }`}>
                      {contact.is_deleted ? (
                        <Trash2 className="w-5 h-5 text-destructive" />
                      ) : (
                        <User className="w-5 h-5 text-primary" />
                      )}
                    </div>

                    {/* Contact Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium truncate ${
                          contact.is_deleted ? 'text-muted-foreground line-through' : ''
                        }`}>
                          {contact.contact_snapshot.name || 'Sem nome'}
                        </span>
                        {contact.is_deleted && (
                          <Badge variant="destructive" className="text-xs">
                            Excluído
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        <span>{formatPhone(contact.contact_snapshot.phone_number)}</span>
                        <span>•</span>
                        <span>{contact.event_count} evento{contact.event_count !== 1 ? 's' : ''}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Último: {getEventLabel(contact.last_event_type)} em{' '}
                        {format(new Date(contact.last_event_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {contact.last_performed_by_name && (
                          <> por {contact.last_performed_by_name}</>
                        )}
                      </p>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
            <span>{contacts.length} contato{contacts.length !== 1 ? 's' : ''} no histórico</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Timeline Modal */}
      {selectedContact && (
        <ContactTimelineModal
          open={timelineModalOpen}
          onOpenChange={setTimelineModalOpen}
          phoneNumber={selectedContact.contact_snapshot.phone_number}
          contactName={selectedContact.contact_snapshot.name}
          isDeleted={selectedContact.is_deleted}
        />
      )}
    </>
  );
}
