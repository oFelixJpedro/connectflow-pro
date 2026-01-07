import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, User, Phone } from 'lucide-react';
import type { WhatsAppNotification } from '@/types/notifications';
import { formatPhoneForDisplay } from '@/lib/phoneUtils';

interface RecipientsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: WhatsAppNotification | null;
  onAddRecipient: (notificationId: string, phone: string, name?: string) => Promise<unknown>;
  onRemoveRecipient: (id: string) => Promise<boolean>;
}

export function RecipientsModal({
  open,
  onOpenChange,
  notification,
  onAddRecipient,
  onRemoveRecipient
}: RecipientsModalProps) {
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (!notification) return null;

  const recipients = notification.recipients || [];

  const handleAdd = async () => {
    if (!newPhone.trim()) return;

    setIsAdding(true);
    try {
      await onAddRecipient(notification.id, newPhone, newName || undefined);
      setNewPhone('');
      setNewName('');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    await onRemoveRecipient(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar Destinatários</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <Badge variant="secondary">{notification.name}</Badge>
          </div>

          {/* Add new recipient */}
          <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
            <h4 className="font-medium text-sm">Adicionar Destinatário</h4>
            
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    placeholder="(17) 99999-9999"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome (opcional)</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    placeholder="Nome do destinatário"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <Button
              onClick={handleAdd}
              disabled={!newPhone.trim() || isAdding}
              size="sm"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>

          {/* Recipients list */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">
              Destinatários Cadastrados ({recipients.length})
            </h4>
            
            {recipients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum destinatário cadastrado</p>
                <p className="text-xs">Adicione números para receber as notificações</p>
              </div>
            ) : (
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {recipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-background"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {recipient.name || 'Sem nome'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatPhoneForDisplay(recipient.phone_number)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemove(recipient.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
