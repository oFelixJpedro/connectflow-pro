import React, { useState } from 'react';
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
import { Building2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getDeveloperToken } from '@/contexts/DeveloperAuthContext';
import { toast } from 'sonner';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setIsLoading(true);
    try {
      const token = getDeveloperToken();
      const { data, error } = await supabase.functions.invoke('developer-actions', {
        body: { 
          action: 'update_company', 
          company_id: company.id,
          updates: {
            name: name.trim(),
            plan,
            active,
            trial_ends_at: trialEndsAt || null
          }
        },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Empresa atualizada com sucesso');
      onSuccess();
    } catch (err) {
      console.error('Error updating company:', err);
      toast.error('Erro ao atualizar empresa');
    } finally {
      setIsLoading(false);
    }
  };

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
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
