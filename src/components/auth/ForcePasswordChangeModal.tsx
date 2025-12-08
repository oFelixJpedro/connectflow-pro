import { useState, useMemo } from 'react';
import { Loader2, Eye, EyeOff, Check, X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  validatePassword,
  isPasswordStrong,
  getPasswordStrength,
  PASSWORD_REQUIREMENTS,
  type PasswordValidation,
} from '@/lib/passwordValidation';

interface ForcePasswordChangeModalProps {
  open: boolean;
  userEmail: string;
  onSuccess: () => void;
}

export function ForcePasswordChangeModal({
  open,
  userEmail,
  onSuccess,
}: ForcePasswordChangeModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validation = useMemo<PasswordValidation>(
    () => validatePassword(newPassword),
    [newPassword]
  );

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);

  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const isNewPasswordDefault = newPassword === 'padrao123';
  const canSubmit =
    currentPassword.length > 0 &&
    isPasswordStrong(newPassword) &&
    passwordsMatch &&
    !isNewPasswordDefault;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsLoading(true);
    try {
      // Verify current password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });

      if (signInError) {
        toast({
          title: 'Senha atual incorreta',
          description: 'Verifique a senha digitada e tente novamente.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        toast({
          title: 'Erro ao atualizar senha',
          description: updateError.message,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Update profile flag
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ needs_password_change: false })
          .eq('id', user.id);
      }

      toast({
        title: 'Senha alterada com sucesso!',
        description: 'Você pode acessar o sistema normalmente.',
      });

      onSuccess();
    } catch (error) {
      console.error('Password change error:', error);
      toast({
        title: 'Erro inesperado',
        description: 'Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStrengthColor = () => {
    if (strength.color === 'destructive') return 'bg-destructive';
    if (strength.color === 'warning') return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Troca de Senha Obrigatória
          </DialogTitle>
          <DialogDescription>
            Por segurança, você precisa alterar sua senha temporária antes de acessar o sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Senha atual (padrao123)</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isLoading}
                placeholder="Digite sua senha atual"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nova senha</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
                placeholder="Digite sua nova senha"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>

            {/* Strength Indicator */}
            {newPassword.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Força da senha:</span>
                  <span
                    className={`font-medium ${
                      strength.color === 'destructive'
                        ? 'text-destructive'
                        : strength.color === 'warning'
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }`}
                  >
                    {strength.label}
                  </span>
                </div>
                <Progress value={(strength.score / 5) * 100} className={`h-2 ${getStrengthColor()}`} />
              </div>
            )}

            {/* Password is default warning */}
            {isNewPasswordDefault && (
              <p className="text-sm text-destructive">
                A nova senha não pode ser igual à senha temporária
              </p>
            )}
          </div>

          {/* Password Requirements */}
          <div className="space-y-2 p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium text-muted-foreground">Requisitos da senha:</p>
            <ul className="space-y-1">
              {PASSWORD_REQUIREMENTS.map(({ key, label }) => {
                const met = validation[key];
                return (
                  <li
                    key={key}
                    className={`flex items-center gap-2 text-sm ${
                      met ? 'text-green-600' : 'text-muted-foreground'
                    }`}
                  >
                    {met ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <X className="w-4 h-4 text-muted-foreground/50" />
                    )}
                    {label}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirme a nova senha</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                placeholder="Digite novamente a nova senha"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-sm text-destructive">As senhas não coincidem</p>
            )}
            {passwordsMatch && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <Check className="w-4 h-4" /> Senhas coincidem
              </p>
            )}
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={!canSubmit || isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Alterando senha...
            </>
          ) : (
            'Alterar senha e continuar'
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
