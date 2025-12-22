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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Building2, 
  Loader2, 
  ShieldAlert,
  Wifi,
  Users,
  Bot,
  TrendingUp,
  Infinity
} from 'lucide-react';
import { developerData, developerActions } from '@/lib/developerApi';
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
  max_connections?: number | null;
  max_users?: number | null;
  max_ai_agents?: number | null;
  commercial_manager_enabled?: boolean;
  subscription_status?: string;
}

interface EditCompanyModalProps {
  company: Company;
  onClose: () => void;
  onSuccess: () => void;
}

type PlanType = 'monthly' | 'semiannual' | 'annual' | 'lifetime' | 'trial' | 'free' | 'starter' | 'professional' | 'enterprise';

const PLAN_LABELS: Record<string, string> = {
  monthly: 'Mensal - R$695,00/mês',
  semiannual: 'Semestral - 6x R$437,85',
  annual: 'Anual - 12x R$347,00',
  lifetime: 'Vitalício (Ilimitado)',
  trial: 'Teste',
  free: 'Gratuito (Legado)',
  starter: 'Starter (Legado)',
  professional: 'Professional (Legado)',
  enterprise: 'Enterprise (Legado)'
};

export default function EditCompanyModal({ company, onClose, onSuccess }: EditCompanyModalProps) {
  const [name, setName] = useState(company.name);
  const [plan, setPlan] = useState<string>(company.plan);
  const [active, setActive] = useState(company.active);
  const [trialEndsAt, setTrialEndsAt] = useState(
    company.trial_ends_at ? company.trial_ends_at.split('T')[0] : ''
  );
  
  // Limit fields
  const [maxConnections, setMaxConnections] = useState(company.max_connections ?? 1);
  const [unlimitedUsers, setUnlimitedUsers] = useState(company.max_users === null);
  const [maxUsers, setMaxUsers] = useState<number | null>(company.max_users);
  const [unlimitedAgents, setUnlimitedAgents] = useState(company.max_ai_agents === null);
  const [maxAiAgents, setMaxAiAgents] = useState<number | null>(company.max_ai_agents);
  const [commercialManagerEnabled, setCommercialManagerEnabled] = useState(company.commercial_manager_enabled ?? false);
  const [subscriptionStatus, setSubscriptionStatus] = useState(company.subscription_status ?? 'trial');

  const [isLoading, setIsLoading] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [companyOwner, setCompanyOwner] = useState<{ id: string; full_name: string } | null>(null);
  
  // Store pending updates in ref to persist across re-renders
  const pendingUpdatesRef = React.useRef<any>(null);

  const { requestPermission, cancelRequest, isRequesting } = useDeveloperPermissions();

  // Auto-set limits for lifetime plan
  useEffect(() => {
    if (plan === 'lifetime') {
      setMaxConnections(999);
      setUnlimitedUsers(true);
      setMaxUsers(null);
      setUnlimitedAgents(true);
      setMaxAiAgents(null);
      setCommercialManagerEnabled(true);
      setSubscriptionStatus('active');
    }
  }, [plan]);

  // Fetch company owner for permission request
  useEffect(() => {
    const fetchOwner = async () => {
      const { data } = await developerData({ action: 'get_company_owner', company_id: company.id });
      if (data?.owner) {
        setCompanyOwner(data.owner);
      }
    };
    fetchOwner();
  }, [company.id]);

  // Handle permission approved callback
  const handlePermissionApproved = async () => {
    console.log('handlePermissionApproved called, pendingUpdatesRef:', pendingUpdatesRef.current);
    await executeUpdate();
  };

  const handlePermissionDenied = () => {
    toast.error('Permissão negada pelo usuário');
    setPendingRequestId(null);
    pendingUpdatesRef.current = null;
  };

  const executeUpdate = async () => {
    const updates = pendingUpdatesRef.current;
    console.log('executeUpdate called with updates:', updates);
    
    if (!updates) {
      console.error('No pending updates found');
      toast.error('Erro: dados pendentes não encontrados');
      return;
    }
    
    setIsLoading(true);
    try {
      const { error } = await developerActions({ 
        action: 'update_company', 
        company_id: company.id,
        updates: updates,
        permission_request_id: pendingRequestId
      });

      if (error) throw new Error(error);

      toast.success('Empresa atualizada com sucesso');
      setPendingRequestId(null);
      pendingUpdatesRef.current = null;
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
      trial_ends_at: trialEndsAt || null,
      max_connections: maxConnections,
      max_users: unlimitedUsers ? null : maxUsers,
      max_ai_agents: unlimitedAgents ? null : maxAiAgents,
      commercial_manager_enabled: commercialManagerEnabled,
      subscription_status: subscriptionStatus
    };

    // Store in ref for later use
    pendingUpdatesRef.current = updates;
    console.log('Setting pendingUpdatesRef:', updates);

    // Request permission from company owner
    const result = await requestPermission(
      'edit_company',
      company.id,
      null,
      companyOwner.id
    );

    if (result) {
      setPendingRequestId(result.requestId);
    }
  };

  const handleCancelRequest = async () => {
    if (pendingRequestId) {
      await cancelRequest(pendingRequestId);
      setPendingRequestId(null);
      pendingUpdatesRef.current = null;
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
        onApproved={handlePermissionApproved}
        onDenied={handlePermissionDenied}
      />
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Editar Empresa
          </DialogTitle>
          <DialogDescription>
            Atualize as informações da empresa {company.name}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4 flex-shrink-0">
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

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-2">
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
                <SelectItem value="monthly">Mensal - R$695,00/mês</SelectItem>
                <SelectItem value="semiannual">Semestral - 6x R$437,85</SelectItem>
                <SelectItem value="annual">Anual - 12x R$347,00</SelectItem>
                <SelectItem value="lifetime">Vitalício (Ilimitado)</SelectItem>
                <SelectItem value="trial">Teste</SelectItem>
                {/* Legacy plans for existing companies */}
                {['free', 'starter', 'professional', 'enterprise'].includes(company.plan) && (
                  <SelectItem value={company.plan}>{PLAN_LABELS[company.plan] || company.plan}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subscription_status">Status da Assinatura</Label>
            <Select value={subscriptionStatus} onValueChange={setSubscriptionStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Período de Teste</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trial_ends_at">Data de Expiração</Label>
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

          <Separator />

          {/* Limits Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm">Limites e Recursos</h3>
            
            <div className="grid gap-4">
              {/* Max Connections */}
              <div className="space-y-2">
                <Label htmlFor="max-connections" className="flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  Conexões WhatsApp
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="max-connections"
                    type="number"
                    min={1}
                    max={999}
                    value={maxConnections}
                    onChange={(e) => setMaxConnections(parseInt(e.target.value) || 1)}
                    disabled={plan === 'lifetime'}
                    className="w-24"
                  />
                  {plan === 'lifetime' && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Infinity className="h-4 w-4" /> Ilimitadas
                    </span>
                  )}
                </div>
              </div>

              {/* Max Users */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Usuários
                </Label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="unlimited-users"
                      checked={unlimitedUsers}
                      onCheckedChange={(checked) => {
                        setUnlimitedUsers(checked as boolean);
                        if (checked) setMaxUsers(null);
                        else setMaxUsers(10);
                      }}
                      disabled={plan === 'lifetime'}
                    />
                    <Label htmlFor="unlimited-users" className="text-sm">Ilimitados</Label>
                  </div>
                  {!unlimitedUsers && (
                    <Input
                      type="number"
                      min={1}
                      value={maxUsers || ''}
                      onChange={(e) => setMaxUsers(parseInt(e.target.value) || 1)}
                      className="w-24"
                      placeholder="Limite"
                    />
                  )}
                </div>
              </div>

              {/* Max AI Agents */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Agentes de IA
                </Label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="unlimited-agents"
                      checked={unlimitedAgents}
                      onCheckedChange={(checked) => {
                        setUnlimitedAgents(checked as boolean);
                        if (checked) setMaxAiAgents(null);
                        else setMaxAiAgents(5);
                      }}
                      disabled={plan === 'lifetime'}
                    />
                    <Label htmlFor="unlimited-agents" className="text-sm">Ilimitados</Label>
                  </div>
                  {!unlimitedAgents && (
                    <Input
                      type="number"
                      min={1}
                      value={maxAiAgents || ''}
                      onChange={(e) => setMaxAiAgents(parseInt(e.target.value) || 1)}
                      className="w-24"
                      placeholder="Limite"
                    />
                  )}
                </div>
              </div>

              {/* Commercial Manager */}
              <div className="flex items-center justify-between">
                <Label htmlFor="commercial-manager" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Gerente Comercial
                </Label>
                <Switch
                  id="commercial-manager"
                  checked={commercialManagerEnabled}
                  onCheckedChange={setCommercialManagerEnabled}
                  disabled={plan === 'lifetime'}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Label htmlFor="active">Empresa Ativa</Label>
            <Switch
              id="active"
              checked={active}
              onCheckedChange={setActive}
            />
          </div>

          <DialogFooter className="flex-shrink-0 pt-4">
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
