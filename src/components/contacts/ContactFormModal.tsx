import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Loader2, LayoutGrid, Trash2 } from 'lucide-react';
import { Contact, ContactFormData } from '@/hooks/useContactsData';
import { useContactCRM } from '@/hooks/useContactCRM';

interface ContactFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  tags: { id: string; name: string; color: string }[];
  onSave: (data: ContactFormData) => Promise<boolean | string>; // string = new contact ID
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa', color: 'bg-gray-100 text-gray-700' },
  { value: 'medium', label: 'Média', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'Alta', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Urgente', color: 'bg-red-100 text-red-700' },
];

export function ContactFormModal({
  open,
  onOpenChange,
  contact,
  tags,
  onSave
}: ContactFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    phone_number: '',
    email: '',
    tags: [],
    notes: ''
  });

  // CRM state
  const {
    connections,
    boards,
    currentPosition,
    loading: crmLoading,
    setCardPosition,
    removeFromCRM
  } = useContactCRM(contact?.id || null);

  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedPriority, setSelectedPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [crmEnabled, setCrmEnabled] = useState(false);

  // Initialize form data when contact changes
  useEffect(() => {
    if (contact) {
      setFormData({
        name: contact.name || '',
        phone_number: contact.phone_number || '',
        email: contact.email || '',
        tags: contact.tags || [],
        notes: contact.notes || ''
      });
    } else {
      setFormData({
        name: '',
        phone_number: '',
        email: '',
        tags: [],
        notes: ''
      });
    }
  }, [contact, open]);

  // Initialize CRM selection when position loads
  useEffect(() => {
    if (currentPosition) {
      setSelectedConnection(currentPosition.connection_id);
      setSelectedColumn(currentPosition.column_id);
      setSelectedPriority(currentPosition.priority);
      setCrmEnabled(true);
    } else {
      // Set defaults for new card
      if (connections.length > 0 && !selectedConnection) {
        const firstConn = connections[0].id;
        setSelectedConnection(firstConn);
        const board = boards.get(firstConn);
        if (board && board.columns.length > 0) {
          setSelectedColumn(board.columns[0].id);
        }
      }
      setCrmEnabled(false);
    }
  }, [currentPosition, connections, boards]);

  // Update columns when connection changes
  useEffect(() => {
    if (selectedConnection && !currentPosition) {
      const board = boards.get(selectedConnection);
      if (board && board.columns.length > 0) {
        setSelectedColumn(board.columns[0].id);
      }
    }
  }, [selectedConnection, boards]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.phone_number.replace(/\D/g, '')) {
      return;
    }

    setLoading(true);
    const result = await onSave(formData);
    const success = result === true || typeof result === 'string';
    const contactId = contact?.id || (typeof result === 'string' ? result : null);
    
    // Handle CRM after save
    if (success && contactId && crmEnabled && selectedConnection && selectedColumn) {
      await setCardPosition(contactId, selectedConnection, selectedColumn, selectedPriority);
    } else if (success && contactId && !crmEnabled && currentPosition) {
      await removeFromCRM(contactId);
    }

    setLoading(false);

    if (success) {
      onOpenChange(false);
    }
  };

  const toggleTag = (tagName: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tagName)
        ? prev.tags.filter(t => t !== tagName)
        : [...prev.tags, tagName]
    }));
  };

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  };

  const selectedBoard = boards.get(selectedConnection);
  const availableColumns = selectedBoard?.columns || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {contact ? 'Editar Contato' : 'Novo Contato'}
          </DialogTitle>
          <DialogDescription>
            {contact 
              ? 'Atualize as informações do contato'
              : 'Preencha as informações para criar um novo contato'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Nome do contato"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              value={formatPhoneNumber(formData.phone_number)}
              onChange={(e) => setFormData(prev => ({ ...prev, phone_number: e.target.value }))}
              placeholder="(00) 00000-0000"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@exemplo.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={formData.tags.includes(tag.name) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  style={formData.tags.includes(tag.name) ? { backgroundColor: tag.color } : {}}
                  onClick={() => toggleTag(tag.name)}
                >
                  {tag.name}
                  {formData.tags.includes(tag.name) && (
                    <X className="w-3 h-3 ml-1" />
                  )}
                </Badge>
              ))}
              {tags.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma tag disponível</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Observações sobre o contato..."
              rows={3}
            />
          </div>

          {/* CRM Section */}
          {connections.length > 0 && (
            <>
              <Separator className="my-4" />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-base font-medium">Posição no CRM</Label>
                  </div>
                  {crmLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : currentPosition ? (
                    <Badge variant="secondary" className="text-xs">
                      {currentPosition.column_name}
                    </Badge>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="crm-enabled"
                    checked={crmEnabled}
                    onChange={(e) => setCrmEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="crm-enabled" className="text-sm font-normal cursor-pointer">
                    {currentPosition ? 'Manter no Kanban do CRM' : 'Adicionar ao Kanban do CRM'}
                  </Label>
                </div>

                {crmEnabled && (
                  <div className="space-y-3 pl-6 border-l-2 border-muted">
                    <div className="space-y-2">
                      <Label htmlFor="connection" className="text-sm">Conexão</Label>
                      <Select
                        value={selectedConnection}
                        onValueChange={setSelectedConnection}
                      >
                        <SelectTrigger id="connection">
                          <SelectValue placeholder="Selecione a conexão" />
                        </SelectTrigger>
                        <SelectContent>
                          {connections.map((conn) => (
                            <SelectItem key={conn.id} value={conn.id}>
                              {conn.name} ({conn.phone_number})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {availableColumns.length > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="column" className="text-sm">Coluna</Label>
                        <Select
                          value={selectedColumn}
                          onValueChange={setSelectedColumn}
                        >
                          <SelectTrigger id="column">
                            <SelectValue placeholder="Selecione a coluna" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableColumns.map((col) => (
                              <SelectItem key={col.id} value={col.id}>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: col.color }}
                                  />
                                  {col.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="priority" className="text-sm">Prioridade</Label>
                      <Select
                        value={selectedPriority}
                        onValueChange={(v) => setSelectedPriority(v as typeof selectedPriority)}
                      >
                        <SelectTrigger id="priority">
                          <SelectValue placeholder="Selecione a prioridade" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className={opt.color}>
                                  {opt.label}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {availableColumns.length === 0 && selectedConnection && (
                      <p className="text-sm text-muted-foreground">
                        Nenhum quadro CRM encontrado para esta conexão. 
                        Um novo quadro será criado automaticamente.
                      </p>
                    )}
                  </div>
                )}

                {currentPosition && !crmEnabled && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <Trash2 className="w-3 h-3" />
                    O card será removido do CRM ao salvar
                  </p>
                )}
              </div>
            </>
          )}

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {contact ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
