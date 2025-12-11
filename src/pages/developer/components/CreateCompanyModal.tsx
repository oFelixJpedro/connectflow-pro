import React, { useState } from 'react';
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
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addDays, addWeeks, addMonths, addYears } from 'date-fns';

interface CreateCompanyModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateCompanyModal({ onClose, onSuccess }: CreateCompanyModalProps) {
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);

  // Company fields
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState<string>('free');
  const [trialDuration, setTrialDuration] = useState(14);
  const [trialUnit, setTrialUnit] = useState<'days' | 'weeks' | 'months' | 'years'>('days');

  // Owner fields
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [forcePasswordChange, setForcePasswordChange] = useState(true);

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
        return addDays(now, 14);
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

      // Map plan to valid enum value
      const validPlan = (plan === 'lifetime' || plan === 'trial') 
        ? 'free' 
        : plan;

      // Get developer token
      const token = localStorage.getItem('developer_auth_token');

      // Call edge function to create company
      const { data, error } = await supabase.functions.invoke('developer-actions', {
        body: {
          action: 'create_company',
          company_name: companyName.trim(),
          slug: slug.trim(),
          plan: validPlan,
          trial_ends_at: trialEndsAt,
          owner_name: ownerName.trim(),
          owner_email: ownerEmail.trim(),
          owner_password: ownerPassword,
          force_password_change: forcePasswordChange
        },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (error || data?.error) {
        const errorMsg = data?.error || error?.message || 'Erro ao criar empresa';
        if (data?.code === '23505' || errorMsg.includes('slug')) {
          toast.error('Slug já existe. Escolha outro nome.');
        } else if (errorMsg.includes('already')) {
          toast.error('Email já cadastrado');
        } else {
          toast.error(errorMsg);
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
        <AlertDialogContent>
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
                  <p><strong>Plano:</strong> {plan === 'lifetime' ? 'Vitalício' : plan === 'trial' ? 'Teste' : plan}</p>
                  {plan === 'trial' && (
                    <p><strong>Duração:</strong> {trialDuration} {trialUnit}</p>
                  )}
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Nova Empresa
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para criar uma nova empresa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
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
                <Select value={plan} onValueChange={setPlan}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Gratuito</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="lifetime">Vitalício</SelectItem>
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