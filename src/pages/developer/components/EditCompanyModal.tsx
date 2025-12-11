import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getDeveloperToken } from '@/contexts/DeveloperAuthContext';
import { toast } from 'sonner';
import { useDeveloperPermissions } from '@/hooks/useDeveloperPermissions';
import PermissionWaitingModal from './PermissionWaitingModal';

interface Company {
  id: string;
  name: string;
  slug: string;
  plan: string;
  active: boolean;
  created_at: string;
  trial_ends_at: string | null;
}

interface EditCompanyModalProps {
  company: Company;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditCompanyModal({ company, onClose, onSuccess }: EditCompanyModalProps) {
  const [name, setName] = useState(company.name);
  const [plan, setPlan] = useState(company.plan);
  const [active, setActive] = useState(company.active);
  const [trialEndsAt, setTrialEndsAt] = useState(
    company.trial_ends_at ? company.trial_ends_at.split('T')[0] : ''
  );
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [companyOwner, setCompanyOwner] = useState<{ id: string; full_name: string } | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<any>(null);

  const { requestPermission, cancelRequest, isRequesting } = useDeveloperPermissions();

  // Fetch company owner for permission request
  useEffect(() => {
    const fetchOwner = async () => {
      const token = getDeveloperToken();
      const { data } = await supabase.functions.invoke('developer-data', {
        body: { action: 'get_company_owner', company_id: company.id },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data?.owner) {
        setCompanyOwner(data.owner);
      }
    };
    fetchOwner();
  }, [company.id]);

  // Listen for permission approval
  useEffect(() => {
    if (!pendingRequestId) return;

    const channel = supabase
      .channel(`permission-${pendingRequestId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'developer_permission_requests',
          filter: `id=eq.${pendingRequestId}`
        },
        async (payload: any) => {
          const newStatus = payload.new?.status;
          
          if (newStatus === 'approved') {
            // Execute the actual update
            await executeUpdate();
          } else if (newStatus === 'denied') {
            toast.error('Permissão negada pelo usuário');
            setPendingRequestId(null);
            setPendingUpdates(null);
          } else if (newStatus === 'expired') {
            toast.error('Solicitação expirou');
            setPendingRequestId(null);
            setPendingUpdates(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pendingRequestId, pendingUpdates]);

  const executeUpdate = async () => {
    if (!pendingUpdates) return;
    
    setIsLoading(true);
    try {
      const token = getDeveloperToken();
      const { data, error } = await supabase.functions.invoke('developer-actions', {
        body: { 
          action: 'update_company', 
          company_id: company.id,
          updates: pendingUpdates,
          permission_request_id: pendingRequestId
        },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Empresa atualizada com sucesso');
      setPendingRequestId(null);
      setPendingUpdates(null);
      onSuccess();
    } catch (err) {
      console.error('Error updating company:', err);
      toast.error('Erro ao atualizar empresa');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (!companyOwner) {
      toast.error('Não foi possível encontrar o proprietário da empresa');
      return;
    }

    const updates = {
      name: name.trim(),
      plan,
      active,
      trial_ends_at: trialEndsAt || null
    };

    // Request permission from company owner
    const result = await requestPermission(
      'edit_company',
      company.id,
      null,
      companyOwner.id
    );

    if (result) {
      setPendingRequestId(result.requestId);
      setPendingUpdates(updates);
    }
  };

  const handleCancelRequest = async () => {
    if (pendingRequestId) {
      await cancelRequest(pendingRequestId);
      setPendingRequestId(null);
      setPendingUpdates(null);
    }
  };

  if (pendingRequestId) {
    return (
      <PermissionWaitingModal
        requestId={pendingRequestId}
        targetName={companyOwner?.full_name || 'Proprietário'}
        actionDescription={`editar a empresa "${company.name}"`}
        onCancel={handleCancelRequest}
        onClose={() => {
          handleCancelRequest();
          onClose();
        }}
      />
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Editar Empresa
          </DialogTitle>
          <DialogDescription>
            Atualize as informações da empresa {company.name}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">Aprovação Necessária</p>
              <p className="text-amber-700 dark:text-amber-300">
                Esta ação requer aprovação do proprietário da empresa ({companyOwner?.full_name || 'carregando...'})
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Empresa</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da empresa"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug (somente leitura)</Label>
            <Input
              id="slug"
              value={company.slug}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan">Plano</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Gratuito</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trial_ends_at">Data de Expiração (Trial)</Label>
            <Input
              id="trial_ends_at"
              type="date"
              value={trialEndsAt}
              onChange={(e) => setTrialEndsAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Deixe vazio para sem expiração
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="active">Empresa Ativa</Label>
            <Switch
              id="active"
              checked={active}
              onCheckedChange={setActive}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading || isRequesting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || isRequesting || !companyOwner}>
              {(isLoading || isRequesting) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Solicitar Aprovação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
