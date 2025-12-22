import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { 
  Building2, 
  AlertTriangle,
  Loader2,
  Infinity,
  Wifi,
  Users,
  Bot,
  TrendingUp
} from 'lucide-react';
import { developerActions } from '@/lib/developerApi';
import { toast } from 'sonner';
import { addDays, addWeeks, addMonths, addYears } from 'date-fns';

interface CreateCompanyModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type PlanType = 'monthly' | 'semiannual' | 'annual' | 'lifetime' | 'trial';

const PLAN_LABELS: Record<PlanType, string> = {
  monthly: 'Mensal - R$695,00/mês',
  semiannual: 'Semestral - 6x R$437,85',
  annual: 'Anual - 12x R$347,00',
  lifetime: 'Vitalício (Todos recursos ilimitados)',
  trial: 'Teste (Período personalizado)'
};

export default function CreateCompanyModal({ onClose, onSuccess }: CreateCompanyModalProps) {
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);

  // Company fields
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState<PlanType>('trial');
  const [trialDuration, setTrialDuration] = useState(3);
  const [trialUnit, setTrialUnit] = useState<'days' | 'weeks' | 'months' | 'years'>('days');

  // Limit fields
  const [maxConnections, setMaxConnections] = useState(1);
  const [unlimitedUsers, setUnlimitedUsers] = useState(true);
  const [maxUsers, setMaxUsers] = useState<number | null>(null);
  const [unlimitedAgents, setUnlimitedAgents] = useState(true);
  const [maxAiAgents, setMaxAiAgents] = useState<number | null>(null);
  const [commercialManagerEnabled, setCommercialManagerEnabled] = useState(false);

  // Owner fields
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [forcePasswordChange, setForcePasswordChange] = useState(true);

  // Auto-set limits for lifetime plan
  useEffect(() => {
    if (plan === 'lifetime') {
      setMaxConnections(999);
      setUnlimitedUsers(true);
      setMaxUsers(null);
      setUnlimitedAgents(true);
      setMaxAiAgents(null);
      setCommercialManagerEnabled(true);
    }
  }, [plan]);

  // Auto-generate slug from company name
  const handleCompanyNameChange = (value: string) => {
    setCompanyName(value);
    const generatedSlug = value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(generatedSlug);
  };

  const calculateTrialEndDate = () => {
    const now = new Date();
    switch (trialUnit) {
      case 'days':
        return addDays(now, trialDuration);
      case 'weeks':
        return addWeeks(now, trialDuration);
      case 'months':
        return addMonths(now, trialDuration);
      case 'years':
        return addYears(now, trialDuration);
      default:
        return addDays(now, 3);
    }
  };

  const validateForm = () => {
    if (!companyName.trim()) {
      toast.error('Nome da empresa é obrigatório');
      return false;
    }
    if (!slug.trim()) {
      toast.error('Slug é obrigatório');
      return false;
    }
    if (!ownerName.trim()) {
      toast.error('Nome do proprietário é obrigatório');
      return false;
    }
    if (!ownerEmail.trim()) {
      toast.error('Email do proprietário é obrigatório');
      return false;
    }
    if (!ownerPassword || ownerPassword.length < 8) {
      toast.error('Senha deve ter no mínimo 8 caracteres');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!confirmToggle) return;

    setIsLoading(true);
    try {
      // Calculate trial_ends_at based on plan
      let trialEndsAt: string | null = null;
      if (plan === 'trial') {
        trialEndsAt = calculateTrialEndDate().toISOString();
      } else if (plan !== 'lifetime') {
        trialEndsAt = addDays(new Date(), 14).toISOString();
      }

      // Determine subscription status
      const subscriptionStatus = plan === 'trial' ? 'trial' : (plan === 'lifetime' ? 'active' : 'active');

      const { data, error } = await developerActions({
        action: 'create_company',
        company_name: companyName.trim(),
        slug: slug.trim(),
        plan: plan,
        trial_ends_at: trialEndsAt,
        owner_name: ownerName.trim(),
        owner_email: ownerEmail.trim(),
        owner_password: ownerPassword,
        force_password_change: forcePasswordChange,
        // New limit fields
        max_connections: maxConnections,
        max_users: unlimitedUsers ? null : maxUsers,
        max_ai_agents: unlimitedAgents ? null : maxAiAgents,
        commercial_manager_enabled: commercialManagerEnabled,
        subscription_status: subscriptionStatus
      });

      if (error) {
        if (error.includes('slug')) {
          toast.error('Slug já existe. Escolha outro nome.');
        } else if (error.includes('already')) {
          toast.error('Email já cadastrado');
        } else {
          toast.error(error);
        }
        setStep('form');
        return;
      }

      toast.success('Empresa criada com sucesso!');
      onSuccess();
    } catch (err: any) {
      console.error('Error creating company:', err);
      toast.error(err.message || 'Erro ao criar empresa');
      setStep('form');
    } finally {
      setIsLoading(false);
      setConfirmToggle(false);
    }
  };

  if (step === 'confirm') {
    return (
      <AlertDialog open onOpenChange={() => setStep('form')}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Criação
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Você está prestes a criar:</p>
                
                <div className="bg-muted p-3 rounded-md space-y-2 text-sm">
                  <p><strong>Empresa:</strong> {companyName}</p>
                  <p><strong>Slug:</strong> {slug}</p>
                  <p><strong>Plano:</strong> {PLAN_LABELS[plan]}</p>
                  {plan === 'trial' && (
                    <p><strong>Duração do Teste:</strong> {trialDuration} {trialUnit}</p>
                  )}
                  <Separator className="my-2" />
                  <p className="font-medium">Limites:</p>
                  <p><strong>Conexões:</strong> {maxConnections === 999 ? 'Ilimitadas' : maxConnections}</p>
                  <p><strong>Usuários:</strong> {unlimitedUsers ? 'Ilimitados' : maxUsers}</p>
                  <p><strong>Agentes IA:</strong> {unlimitedAgents ? 'Ilimitados' : maxAiAgents}</p>
                  <p><strong>Gerente Comercial:</strong> {commercialManagerEnabled ? 'Habilitado' : 'Desabilitado'}</p>
                  <Separator className="my-2" />
                  <p><strong>Proprietário:</strong> {ownerName}</p>
                  <p><strong>Email:</strong> {ownerEmail}</p>
                  <p><strong>Forçar troca de senha:</strong> {forcePasswordChange ? 'Sim' : 'Não'}</p>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="confirm-toggle"
                    checked={confirmToggle}
                    onCheckedChange={setConfirmToggle}
                  />
                  <Label htmlFor="confirm-toggle" className="text-sm">
                    Confirmo que os dados estão corretos
                  </Label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={!confirmToggle || isLoading}
              className="bg-primary"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Empresa'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Nova Empresa
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para criar uma nova empresa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 overflow-y-auto flex-1 pr-2">
          {/* Company Data */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm">Dados da Empresa</h3>
            
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Nome da Empresa *</Label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  placeholder="Minha Empresa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="minha-empresa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan">Plano</Label>
                <Select value={plan} onValueChange={(v) => setPlan(v as PlanType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal - R$695,00/mês</SelectItem>
                    <SelectItem value="semiannual">Semestral - 6x R$437,85</SelectItem>
                    <SelectItem value="annual">Anual - 12x R$347,00</SelectItem>
                    <SelectItem value="lifetime">Vitalício (Ilimitado)</SelectItem>
                    <SelectItem value="trial">Teste</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {plan === 'trial' && (
                <div className="flex gap-2">
                  <div className="flex-1 space-y-2">
                    <Label>Duração do Teste</Label>
                    <Input
                      type="number"
                      min={1}
                      value={trialDuration}
                      onChange={(e) => setTrialDuration(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Label>Unidade</Label>
                    <Select value={trialUnit} onValueChange={(v) => setTrialUnit(v as typeof trialUnit)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="days">Dias</SelectItem>
                        <SelectItem value="weeks">Semanas</SelectItem>
                        <SelectItem value="months">Meses</SelectItem>
                        <SelectItem value="years">Anos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
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

          {/* Owner Data */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm">Dados do Proprietário</h3>
            
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="owner-name">Nome Completo *</Label>
                <Input
                  id="owner-name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="João Silva"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="owner-email">Email *</Label>
                <Input
                  id="owner-email"
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="joao@empresa.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="owner-password">Senha Inicial *</Label>
                <Input
                  id="owner-password"
                  type="password"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="force-password"
                  checked={forcePasswordChange}
                  onCheckedChange={(checked) => setForcePasswordChange(checked as boolean)}
                />
                <Label htmlFor="force-password" className="text-sm">
                  Forçar troca de senha no primeiro acesso
                </Label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>
              Continuar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
