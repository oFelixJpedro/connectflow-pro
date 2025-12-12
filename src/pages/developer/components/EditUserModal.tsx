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
import { User as UserIcon, Loader2, ShieldAlert } from 'lucide-react';
import { developerActions } from '@/lib/developerApi';
import { toast } from 'sonner';
import { useDeveloperPermissions } from '@/hooks/useDeveloperPermissions';
import PermissionWaitingModal from './PermissionWaitingModal';

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
  companyUsers: User[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditUserModal({ user, company, companyUsers, onClose, onSuccess }: EditUserModalProps) {
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState(user.role || 'agent');
  
  // Check if another user (not the current one) is already owner
  const existingOwner = companyUsers.find(u => u.role === 'owner' && u.id !== user.id);
  const currentUserIsOwner = user.role === 'owner';
  
  // Show owner option only if: current user is owner OR no other owner exists
  const showOwnerOption = currentUserIsOwner || !existingOwner;
  const [active, setActive] = useState(user.active);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  
  // Store pending updates in ref to persist across re-renders
  const pendingUpdatesRef = React.useRef<any>(null);

  const { requestPermission, cancelRequest, isRequesting } = useDeveloperPermissions();

  // Handle permission approved callback
  const handlePermissionApproved = async () => {
    console.log('User edit - handlePermissionApproved called');
    await executeUpdate();
  };

  const handlePermissionDenied = () => {
    toast.error('Permissão negada pelo usuário');
    setPendingRequestId(null);
    pendingUpdatesRef.current = null;
  };

  const executeUpdate = async () => {
    const updates = pendingUpdatesRef.current;
    console.log('User edit - executeUpdate with updates:', updates);
    
    if (!updates) {
      console.error('No pending updates found');
      toast.error('Erro: dados pendentes não encontrados');
      return;
    }
    
    setIsLoading(true);
    try {
      const { error } = await developerActions({ 
        action: 'update_user', 
        user_id: user.id,
        company_id: company.id,
        updates: updates,
        permission_request_id: pendingRequestId
      });

      if (error) throw new Error(error);

      toast.success('Usuário atualizado com sucesso');
      setPendingRequestId(null);
      pendingUpdatesRef.current = null;
      onSuccess();
    } catch (err) {
      console.error('Error updating user:', err);
      toast.error('Erro ao atualizar usuário');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    const updates = {
      full_name: fullName.trim(),
      role,
      active
    };

    // Store in ref BEFORE requesting permission to avoid race conditions
    pendingUpdatesRef.current = updates;
    console.log('User edit - Setting pendingUpdatesRef BEFORE request:', updates);

    // Request permission from the user being edited
    const result = await requestPermission(
      'edit_user',
      company.id,
      user.id,
      user.id // The user being edited is the approver
    );

    if (result) {
      setPendingRequestId(result.requestId);
    } else {
      // Clear ref if request failed
      pendingUpdatesRef.current = null;
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
        targetName={user.full_name}
        actionDescription={`editar o usuário "${user.full_name}"`}
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

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">Aprovação Necessária</p>
              <p className="text-amber-700 dark:text-amber-300">
                Esta ação requer aprovação do usuário ({user.full_name})
              </p>
            </div>
          </div>
        </div>

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
                {showOwnerOption && <SelectItem value="owner">Proprietário</SelectItem>}
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
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading || isRequesting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || isRequesting}>
              {(isLoading || isRequesting) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Solicitar Aprovação
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
