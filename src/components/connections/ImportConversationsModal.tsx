import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, ArrowRight, Archive } from 'lucide-react';
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

interface ArchivedConnection {
  id: string;
  name: string;
  phone_number: string;
  archived_at: string;
  archived_reason: string | null;
}

interface ImportConversationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetConnectionId: string;
  targetConnectionName: string;
  companyId: string;
  onSuccess?: () => void;
}

export function ImportConversationsModal({
  open,
  onOpenChange,
  targetConnectionId,
  targetConnectionName,
  companyId,
  onSuccess,
}: ImportConversationsModalProps) {
  const [archivedConnections, setArchivedConnections] = useState<ArchivedConnection[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');
  const [sourceStats, setSourceStats] = useState<{ conversations: number; contacts: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (open) {
      loadArchivedConnections();
    }
  }, [open, companyId]);

  useEffect(() => {
    if (selectedSourceId) {
      loadSourceStats(selectedSourceId);
    } else {
      setSourceStats(null);
    }
  }, [selectedSourceId]);

  async function loadArchivedConnections() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('id, name, phone_number, archived_at, archived_reason')
        .eq('company_id', companyId)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false });

      if (error) throw error;
      setArchivedConnections((data || []) as ArchivedConnection[]);
    } catch (error) {
      console.error('Error loading archived connections:', error);
      toast.error('Erro ao carregar conexões arquivadas');
    } finally {
      setLoading(false);
    }
  }

  async function loadSourceStats(sourceId: string) {
    try {
      const { count: conversationsCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('whatsapp_connection_id', sourceId);

      const { data: contactIds } = await supabase
        .from('conversations')
        .select('contact_id')
        .eq('whatsapp_connection_id', sourceId);

      const uniqueContacts = new Set(contactIds?.map(c => c.contact_id) || []);

      setSourceStats({
        conversations: conversationsCount || 0,
        contacts: uniqueContacts.size,
      });
    } catch (error) {
      console.error('Error loading source stats:', error);
    }
  }

  async function handleImport() {
    if (!selectedSourceId) {
      toast.error('Selecione uma conexão de origem');
      return;
    }

    setImporting(true);
    try {
      // Get user info for migration log
      const { data: { user } } = await supabase.auth.getUser();

      // Update all conversations from source to target
      const { data: updatedConversations, error: updateError } = await supabase
        .from('conversations')
        .update({ whatsapp_connection_id: targetConnectionId })
        .eq('whatsapp_connection_id', selectedSourceId)
        .select('id, contact_id');

      if (updateError) throw updateError;

      const migratedCount = updatedConversations?.length || 0;
      const uniqueContactIds = new Set(updatedConversations?.map(c => c.contact_id) || []);

      // Log the migration (using raw insert since types may not be updated)
      await supabase
        .from('connection_migrations' as any)
        .insert({
          company_id: companyId,
          source_connection_id: selectedSourceId,
          target_connection_id: targetConnectionId,
          migrated_by: user?.id || null,
          migration_type: 'import_all',
          migrated_conversations_count: migratedCount,
          migrated_contacts_count: uniqueContactIds.size,
        });

      toast.success(`${migratedCount} conversas migradas com sucesso!`);
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error importing conversations:', error);
      toast.error('Erro ao importar conversas');
    } finally {
      setImporting(false);
    }
  }

  const selectedSource = archivedConnections.find(c => c.id === selectedSourceId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5" />
            Importar Conversas
          </DialogTitle>
          <DialogDescription>
            Migre conversas de uma conexão desconectada para "{targetConnectionName}"
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : archivedConnections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma conexão desconectada encontrada</p>
            <p className="text-sm mt-1">
              As conexões arquivadas aparecerão aqui
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Selecione a conexão de origem:</label>
              <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma conexão desconectada" />
                </SelectTrigger>
                <SelectContent>
                  {archivedConnections.map((conn) => (
                    <SelectItem key={conn.id} value={conn.id}>
                      <div className="flex flex-col items-start">
                        <span className="line-through text-muted-foreground">{conn.name}</span>
                        <span className="text-xs text-muted-foreground">{conn.phone_number}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSource && sourceStats && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium line-through text-muted-foreground">
                      {selectedSource.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{selectedSource.phone_number}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1 text-right">
                    <p className="text-sm font-medium text-foreground">{targetConnectionName}</p>
                  </div>
                </div>

                <div className="flex items-center justify-around pt-2 border-t border-border">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{sourceStats.conversations}</p>
                    <p className="text-xs text-muted-foreground">conversas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{sourceStats.contacts}</p>
                    <p className="text-xs text-muted-foreground">contatos</p>
                  </div>
                </div>
              </div>
            )}

            {selectedSourceId && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                <div className="flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-warning">
                    Todas as conversas serão movidas permanentemente para a nova conexão.
                    Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!selectedSourceId || importing || archivedConnections.length === 0}
          >
            {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Importar Conversas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}