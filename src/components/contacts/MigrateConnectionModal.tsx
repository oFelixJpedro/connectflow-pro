import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, ArrowRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ActiveConnection {
  id: string;
  name: string;
  phone_number: string;
}

interface MigrateConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactIds: string[];
  companyId: string;
  onSuccess?: () => void;
}

export function MigrateConnectionModal({
  open,
  onOpenChange,
  contactIds,
  companyId,
  onSuccess,
}: MigrateConnectionModalProps) {
  const [activeConnections, setActiveConnections] = useState<ActiveConnection[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    if (open) {
      loadActiveConnections();
    }
  }, [open, companyId]);

  async function loadActiveConnections() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('id, name, phone_number')
        .eq('company_id', companyId)
        .eq('status', 'connected')
        .is('archived_at', null)
        .order('name');

      if (error) throw error;
      setActiveConnections(data || []);
    } catch (error) {
      console.error('Error loading active connections:', error);
      toast.error('Erro ao carregar conexões ativas');
    } finally {
      setLoading(false);
    }
  }

  async function handleMigrate() {
    if (!selectedTargetId) {
      toast.error('Selecione uma conexão de destino');
      return;
    }

    setMigrating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get conversations for selected contacts
      const { data: conversations, error: fetchError } = await supabase
        .from('conversations')
        .select('id, contact_id, whatsapp_connection_id')
        .in('contact_id', contactIds);

      if (fetchError) throw fetchError;

      const conversationIds = conversations?.map(c => c.id) || [];
      const sourceConnectionIds = [...new Set(conversations?.map(c => c.whatsapp_connection_id).filter(Boolean) || [])];

      if (conversationIds.length === 0) {
        toast.warning('Nenhuma conversa encontrada para os contatos selecionados');
        onOpenChange(false);
        return;
      }

      // Update conversations to target connection
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ whatsapp_connection_id: selectedTargetId })
        .in('id', conversationIds);

      if (updateError) throw updateError;

      // Log each source migration separately
      for (const sourceId of sourceConnectionIds) {
        if (sourceId && sourceId !== selectedTargetId) {
          const migratedFromSource = conversations?.filter(c => c.whatsapp_connection_id === sourceId) || [];
          const uniqueContacts = new Set(migratedFromSource.map(c => c.contact_id));
          
          await supabase
            .from('connection_migrations' as any)
            .insert({
              company_id: companyId,
              source_connection_id: sourceId,
              target_connection_id: selectedTargetId,
              migrated_by: user?.id || null,
              migration_type: contactIds.length === 1 ? 'manual_single' : 'manual_bulk',
              migrated_conversations_count: migratedFromSource.length,
              migrated_contacts_count: uniqueContacts.size,
            });
        }
      }

      toast.success(`${conversationIds.length} conversas de ${contactIds.length} contatos migradas!`);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error migrating contacts:', error);
      toast.error('Erro ao migrar contatos');
    } finally {
      setMigrating(false);
    }
  }

  const selectedTarget = activeConnections.find(c => c.id === selectedTargetId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Migrar {contactIds.length} Contato{contactIds.length !== 1 ? 's' : ''}
          </DialogTitle>
          <DialogDescription>
            Mova as conversas dos contatos selecionados para outra conexão
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeConnections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma conexão ativa encontrada</p>
            <p className="text-sm mt-1">
              Conecte um número do WhatsApp primeiro
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold">{contactIds.length}</p>
              <p className="text-sm text-muted-foreground">
                contato{contactIds.length !== 1 ? 's' : ''} selecionado{contactIds.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3">
              <span className="text-muted-foreground text-sm">Mover para</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Conexão de destino:</label>
              <Select value={selectedTargetId} onValueChange={setSelectedTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma conexão ativa" />
                </SelectTrigger>
                <SelectContent>
                  {activeConnections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      <div className="flex flex-col items-start">
                        <span>{conn.name}</span>
                        <span className="text-xs text-muted-foreground">{conn.phone_number}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTarget && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-sm text-center">
                  As conversas serão movidas para <strong>{selectedTarget.name}</strong>
                </p>
              </div>
            )}

            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-warning">
                  As conversas serão permanentemente associadas à nova conexão.
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={migrating}>
            Cancelar
          </Button>
          <Button 
            onClick={handleMigrate} 
            disabled={!selectedTargetId || migrating || activeConnections.length === 0}
          >
            {migrating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Migrar Contatos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}