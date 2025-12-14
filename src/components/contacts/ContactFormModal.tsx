import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Loader2, LayoutGrid, Trash2, Smartphone, AlertTriangle } from 'lucide-react';
import { Contact, ContactFormData } from '@/hooks/useContactsData';
import { useContactCRM } from '@/hooks/useContactCRM';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ContactFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  tags: { id: string; name: string; color: string }[];
  onSave: (data: ContactFormData) => Promise<boolean | string>; // string = new contact ID
}

interface WhatsAppConnection {
  id: string;
  name: string;
  phone_number: string;
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
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    phone_number: '',
    email: '',
    tags: [],
    notes: ''
  });

  // Migration state
  const [allConnections, setAllConnections] = useState<WhatsAppConnection[]>([]);
  const [currentConnectionId, setCurrentConnectionId] = useState<string | null>(null);
  const [migrationEnabled, setMigrationEnabled] = useState(false);
  const [targetConnectionId, setTargetConnectionId] = useState<string>('');
  const [showMigrationConfirm, setShowMigrationConfirm] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<ContactFormData | null>(null);

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

  // Load all connections
  useEffect(() => {
    const loadConnections = async () => {
      if (!profile?.company_id) return;
      
      const { data } = await supabase
        .from('whatsapp_connections')
        .select('id, name, phone_number')
        .eq('company_id', profile.company_id)
        .eq('status', 'connected')
        .order('name');
      
      if (data) {
        setAllConnections(data);
      }
    };
    
    if (open) {
      loadConnections();
    }
  }, [open, profile?.company_id]);

  // Load current connection for the contact
  useEffect(() => {
    const loadContactConnection = async () => {
      if (!contact?.id) {
        setCurrentConnectionId(null);
        return;
      }
      
      // Get the connection from the contact's most recent conversation
      const { data } = await supabase
        .from('conversations')
        .select('whatsapp_connection_id')
        .eq('contact_id', contact.id)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data?.whatsapp_connection_id) {
        setCurrentConnectionId(data.whatsapp_connection_id);
      } else {
        setCurrentConnectionId(null);
      }
    };
    
    if (open && contact) {
      loadContactConnection();
    }
  }, [open, contact?.id]);

  // Reset migration state when modal opens/closes
  useEffect(() => {
    if (open) {
      setMigrationEnabled(false);
      setTargetConnectionId('');
    }
  }, [open]);

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

    // If migration is enabled and target connection is selected, show confirmation
    if (migrationEnabled && targetConnectionId && targetConnectionId !== currentConnectionId) {
      setPendingFormData(formData);
      setShowMigrationConfirm(true);
      return;
    }

    await executeSubmit(formData);
  };

  const executeSubmit = async (data: ContactFormData) => {
    setLoading(true);
    const result = await onSave(data);
    const success = result === true || typeof result === 'string';
    const contactId = contact?.id || (typeof result === 'string' ? result : null);
    
    // Handle CRM after save
    if (success && contactId && crmEnabled && selectedConnection && selectedColumn) {
      await setCardPosition(contactId, selectedConnection, selectedColumn, selectedPriority);
    } else if (success && contactId && !crmEnabled && currentPosition) {
      await removeFromCRM(contactId);
    }

    // Handle connection migration
    if (success && contactId && migrationEnabled && targetConnectionId && targetConnectionId !== currentConnectionId) {
      // Update all conversations for this contact to the new connection
      await supabase
        .from('conversations')
        .update({ whatsapp_connection_id: targetConnectionId })
        .eq('contact_id', contactId);
    }

    setLoading(false);

    if (success) {
      onOpenChange(false);
    }
  };

  const handleMigrationConfirm = async () => {
    setShowMigrationConfirm(false);
    if (pendingFormData) {
      await executeSubmit(pendingFormData);
      setPendingFormData(null);
    }
  };

  const handleMigrationCancel = () => {
    setShowMigrationConfirm(false);
    setPendingFormData(null);
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
  
  const currentConnection = allConnections.find(c => c.id === currentConnectionId);
  const targetConnection = allConnections.find(c => c.id === targetConnectionId);
  const availableConnectionsForMigration = allConnections.filter(c => c.id !== currentConnectionId);

  return (
    <>
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

            {/* Connection Migration Section - Only for existing contacts */}
            {contact && currentConnectionId && allConnections.length > 1 && (
              <>
                <Separator className="my-4" />
                
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-base font-medium">Conexão Atual</Label>
                  </div>
                  
                  {currentConnection && (
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-sm font-medium">{currentConnection.name}</p>
                      <p className="text-xs text-muted-foreground">{currentConnection.phone_number}</p>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="migration-enabled"
                      checked={migrationEnabled}
                      onCheckedChange={(checked) => {
                        setMigrationEnabled(checked === true);
                        if (!checked) {
                          setTargetConnectionId('');
                        }
                      }}
                    />
                    <Label 
                      htmlFor="migration-enabled" 
                      className="text-sm font-normal cursor-pointer"
                    >
                      Migrar para outra conexão
                    </Label>
                  </div>

                  {migrationEnabled && (
                    <div className="space-y-3 pl-6 border-l-2 border-muted">
                      <div className="space-y-2">
                        <Label htmlFor="target-connection" className="text-sm">Nova Conexão</Label>
                        <Select
                          value={targetConnectionId}
                          onValueChange={setTargetConnectionId}
                        >
                          <SelectTrigger id="target-connection">
                            <SelectValue placeholder="Selecione a nova conexão" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableConnectionsForMigration.map((conn) => (
                              <SelectItem key={conn.id} value={conn.id}>
                                {conn.name} ({conn.phone_number})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {targetConnectionId && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-sm text-amber-800 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            As conversas deste contato serão migradas para a nova conexão
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

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

      {/* Migration Confirmation Dialog */}
      <AlertDialog open={showMigrationConfirm} onOpenChange={setShowMigrationConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirmar Migração de Conexão
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Você está prestes a migrar este contato para outra conexão WhatsApp.</p>
                
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">De:</span>
                    <span className="font-medium">{currentConnection?.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Para:</span>
                    <span className="font-medium">{targetConnection?.name}</span>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    <strong>Atenção:</strong> Todas as conversas deste contato serão transferidas para a nova conexão.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleMigrationCancel}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleMigrationConfirm}>
              Confirmar Migração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}