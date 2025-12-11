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
import { User as UserIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getDeveloperToken } from '@/contexts/DeveloperAuthContext';
import { toast } from 'sonner';

interface User {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  active: boolean;
  needs_password_change: boolean;
  created_at: string;
  last_seen_at: string | null;
  role?: string;
}

interface Company {
  id: string;
  name: string;
  slug: string;
}

interface EditUserModalProps {
  user: User;
  company: Company;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditUserModal({ user, company, onClose, onSuccess }: EditUserModalProps) {
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState(user.role || 'agent');
  const [active, setActive] = useState(user.active);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setIsLoading(true);
    try {
      const token = getDeveloperToken();
      const { data, error } = await supabase.functions.invoke('developer-actions', {
        body: { 
          action: 'update_user', 
          user_id: user.id,
          company_id: company.id,
          updates: {
            full_name: fullName.trim(),
            role,
            active
          }
        },
        headers: { Authorization: `Bearer ${token}` }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Usuário atualizado com sucesso');
      onSuccess();
    } catch (err) {
      console.error('Error updating user:', err);
      toast.error('Erro ao atualizar usuário');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Editar Usuário
          </DialogTitle>
          <DialogDescription>
            Atualize as informações de {user.full_name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nome Completo</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome completo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email (somente leitura)</Label>
            <Input
              id="email"
              value={user.email}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Empresa (somente leitura)</Label>
            <Input
              id="company"
              value={company.name}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Cargo</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Proprietário</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="agent">Atendente</SelectItem>
                <SelectItem value="viewer">Visualizador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="active">Usuário Ativo</Label>
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
