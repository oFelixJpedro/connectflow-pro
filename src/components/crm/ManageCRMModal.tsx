import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ManageCRMModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string | null;
}

export function ManageCRMModal({ open, onOpenChange, connectionId }: ManageCRMModalProps) {
  const [autoAddNewContacts, setAutoAddNewContacts] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      if (!connectionId || !open) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('kanban_boards')
          .select('auto_add_new_contacts')
          .eq('whatsapp_connection_id', connectionId)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setAutoAddNewContacts(data.auto_add_new_contacts ?? true);
        }
      } catch (error) {
        console.error('Error loading CRM settings:', error);
        toast.error('Erro ao carregar configurações');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [connectionId, open]);

  const handleToggleAutoAdd = async (checked: boolean) => {
    if (!connectionId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('kanban_boards')
        .update({ auto_add_new_contacts: checked })
        .eq('whatsapp_connection_id', connectionId);

      if (error) throw error;
      
      setAutoAddNewContacts(checked);
      toast.success(checked 
        ? 'Novos contatos serão adicionados automaticamente ao CRM' 
        : 'Adição automática de contatos desativada'
      );
    } catch (error) {
      console.error('Error saving CRM settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Gerenciar CRM</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="auto-add" className="text-sm font-medium">
                  Adicionar novos contatos automaticamente
                </Label>
                <p className="text-sm text-muted-foreground">
                  Novos contatos que chegarem serão inseridos automaticamente na primeira coluna do CRM
                </p>
              </div>
              <Switch
                id="auto-add"
                checked={autoAddNewContacts}
                onCheckedChange={handleToggleAutoAdd}
                disabled={saving}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
