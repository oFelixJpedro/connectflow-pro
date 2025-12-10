import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, MessageSquare } from 'lucide-react';
import { Contact } from '@/hooks/useContactsData';

interface StartConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact | null;
  connections: { id: string; name: string; phone_number: string }[];
  onStart: (contactId: string, connectionId: string) => Promise<string | null>;
}

export function StartConversationModal({
  open,
  onOpenChange,
  contact,
  connections,
  onStart
}: StartConversationModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string>('');

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

  const handleStart = async () => {
    if (!contact || !selectedConnection) return;

    setLoading(true);
    const conversationId = await onStart(contact.id, selectedConnection);
    setLoading(false);

    if (conversationId) {
      onOpenChange(false);
      navigate(`/inbox?conversation=${conversationId}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Iniciar Conversa
          </DialogTitle>
          <DialogDescription>
            Escolha qual conexão WhatsApp usar para conversar com{' '}
            <strong>{contact?.name || formatPhone(contact?.phone_number || '')}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Conexão WhatsApp</Label>
            <Select value={selectedConnection} onValueChange={setSelectedConnection}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conexão" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((conn) => (
                  <SelectItem key={conn.id} value={conn.id}>
                    <div className="flex flex-col">
                      <span>{conn.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatPhone(conn.phone_number)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {connections.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma conexão WhatsApp disponível
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleStart}
            disabled={loading || !selectedConnection}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Iniciar Conversa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
