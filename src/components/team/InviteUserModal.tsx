import { useState } from 'react';
import { Loader2, UserPlus, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Role = 'admin' | 'agent' | 'viewer';

const roleLabels: Record<Role, { label: string; description: string }> = {
  admin: {
    label: 'Administrador',
    description: 'Pode gerenciar equipe, conexões, departamentos e atender conversas.',
  },
  agent: {
    label: 'Atendente',
    description: 'Pode atender conversas das conexões atribuídas.',
  },
  viewer: {
    label: 'Visualizador',
    description: 'Pode visualizar conversas mas não pode responder.',
  },
};

export function InviteUserModal({ open, onOpenChange, onSuccess }: InviteUserModalProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('agent');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdEmail, setCreatedEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const DEFAULT_PASSWORD = 'padrao123';

  const resetForm = () => {
    setEmail('');
    setFullName('');
    setRole('agent');
    setShowSuccess(false);
    setCreatedEmail('');
    setCopied(false);
  };

  const handleClose = () => {
    if (!isLoading) {
      resetForm();
      onOpenChange(false);
    }
  };

  const handleSuccessClose = () => {
    resetForm();
    onOpenChange(false);
    onSuccess();
  };

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(DEFAULT_PASSWORD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const validateForm = (): string | null => {
    if (!email.trim()) return 'Email é obrigatório';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Formato de email inválido';
    if (!fullName.trim()) return 'Nome é obrigatório';
    if (fullName.trim().length < 3) return 'Nome deve ter pelo menos 3 caracteres';
    return null;
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      toast({ title: 'Erro de validação', description: error, variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-user', {
        body: {
          email: email.trim().toLowerCase(),
          fullName: fullName.trim(),
          role,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Erro ao criar usuário');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setCreatedEmail(email.trim().toLowerCase());
      setShowSuccess(true);
    } catch (err) {
      console.error('Error creating user:', err);
      toast({
        title: 'Erro ao criar usuário',
        description: err instanceof Error ? err.message : 'Erro inesperado',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (showSuccess) {
    return (
      <Dialog open={open} onOpenChange={handleSuccessClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              Usuário criado com sucesso!
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Email</Label>
              <p className="font-medium">{createdEmail}</p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-muted-foreground">Senha temporária</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-lg">
                  {DEFAULT_PASSWORD}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyPassword}
                  className="shrink-0"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <Alert className="bg-amber-50 border-amber-200">
              <AlertDescription className="text-amber-800">
                ⚠️ <strong>Importante:</strong> O usuário será obrigado a trocar a senha no primeiro acesso.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button onClick={handleSuccessClose}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Convidar Novo Membro
          </DialogTitle>
          <DialogDescription>
            Adicione um novo membro à sua equipe
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Nome Completo *</Label>
            <Input
              id="fullName"
              placeholder="João Silva"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Permissão Inicial *</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(roleLabels).map(([value, { label, description }]) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex flex-col">
                      <span>{label}</span>
                      <span className="text-xs text-muted-foreground">{description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Alert className="bg-blue-50 border-blue-200">
            <AlertDescription className="text-blue-800 text-sm">
              O usuário receberá acesso com a senha temporária <strong>padrao123</strong> e será obrigado a alterá-la no primeiro login.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              'Criar usuário'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
