import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, Phone, Loader2, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Contact {
  id: string;
  name: string | null;
  phone_number: string;
  avatar_url: string | null;
  connection_id?: string;
  connection_name?: string;
}

interface AddCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingContactIds: string[];
  onAddCard: (contactId: string) => Promise<boolean>;
  connectionId?: string | null;
  departmentId?: string | null;
}

export function AddCardDialog({ 
  open, 
  onOpenChange, 
  existingContactIds,
  onAddCard,
  connectionId,
  departmentId
}: AddCardDialogProps) {
  const { company } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (open && company?.id && connectionId) {
      loadContacts();
    }
  }, [open, company?.id, connectionId, departmentId]);

  const loadContacts = async () => {
    if (!company?.id || !connectionId) return;
    
    setLoading(true);
    try {
      // Build query to get contacts
      let query = supabase
        .from('contacts')
        .select(`
          id, 
          name, 
          phone_number, 
          avatar_url
        `)
        .eq('company_id', company.id)
        .order('name', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;

      // Get conversations to find which contacts are associated with this connection AND department
      let conversationsQuery = supabase
        .from('conversations')
        .select('contact_id, whatsapp_connection_id, department_id')
        .eq('company_id', company.id)
        .eq('whatsapp_connection_id', connectionId);

      // Add department filter if a specific department is selected
      if (departmentId) {
        conversationsQuery = conversationsQuery.eq('department_id', departmentId);
      }

      const { data: conversations } = await conversationsQuery;

      const contactIdsForConnection = new Set(
        conversations?.map(c => c.contact_id) || []
      );

      // Filter contacts that have conversations on this connection (and department if selected)
      const filteredContacts = (data || []).filter(contact => 
        contactIdsForConnection.has(contact.id)
      );

      setContacts(filteredContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const availableContacts = contacts.filter(c => !existingContactIds.includes(c.id));

  const filteredContacts = availableContacts.filter(contact => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      contact.name?.toLowerCase().includes(query) ||
      contact.phone_number.includes(query)
    );
  });

  const handleAddCard = async (contactId: string) => {
    setAddingId(contactId);
    const success = await onAddCard(contactId);
    setAddingId(null);
    if (success) {
      onOpenChange(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Card</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contato..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Info about filtering */}
          {connectionId && (
            <p className="text-xs text-muted-foreground">
              Mostrando contatos da conexão{departmentId ? ' e departamento selecionados' : ' selecionada'} que ainda não estão no Kanban.
            </p>
          )}

          {/* Contacts List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {availableContacts.length === 0 
                ? 'Todos os contatos já estão no Kanban'
                : 'Nenhum contato encontrado'}
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {filteredContacts.map(contact => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={contact.avatar_url || undefined} className="object-cover object-top" />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(contact.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">
                          {contact.name || 'Sem nome'}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {contact.phone_number}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAddCard(contact.id)}
                      disabled={addingId === contact.id}
                    >
                      {addingId === contact.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Adicionar'
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
