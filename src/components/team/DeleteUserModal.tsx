import { useState, useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface DeleteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  } | null;
  onSuccess: () => void;
}

export function DeleteUserModal({ open, onOpenChange, user, onSuccess }: DeleteUserModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [conversationsCount, setConversationsCount] = useState(0);
  const [isLoadingCount, setIsLoadingCount] = useState(false);

  useEffect(() => {
    if (open && user) {
      loadConversationsCount();
    }
  }, [open, user]);

  const loadConversationsCount = async () => {
    if (!user) return;
    
    setIsLoadingCount(true);
    try {
      const { count, error } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_user_id', user.id)
        .not('status', 'in', '("resolved","closed")');

      if (error) throw error;
      setConversationsCount(count || 0);
    } catch (error) {
      console.error('Error loading conversations count:', error);
      setConversationsCount(0);
    } finally {
      setIsLoadingCount(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;

    setIsDeleting(true);
    try {
      // 1. Unassign all conversations from this user
      const { error: unassignError } = await supabase
        .from('conversations')
        .update({ assigned_user_id: null, assigned_at: null })
        .eq('assigned_user_id', user.id);

      if (unassignError) {
        console.error('Error unassigning conversations:', unassignError);
        throw new Error('Erro ao desatribuir conversas');
      }

      // 2. Delete connection_users assignments
      const { error: connUsersError } = await supabase
        .from('connection_users')
        .delete()
        .eq('user_id', user.id);

      if (connUsersError) {
        console.error('Error deleting connection_users:', connUsersError);
      }

      // 3. Delete department_users assignments
      const { error: deptUsersError } = await supabase
        .from('department_users')
        .delete()
        .eq('user_id', user.id);

      if (deptUsersError) {
        console.error('Error deleting department_users:', deptUsersError);
      }

      // 4. Delete user_roles
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', user.id);

      if (rolesError) {
        console.error('Error deleting user_roles:', rolesError);
      }

      // 5. Delete profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
        throw new Error('Erro ao deletar perfil do usuário');
      }

      toast.success('Usuário deletado com sucesso!');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Erro ao deletar usuário');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            Confirmar Exclusão
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Tem certeza que deseja deletar o usuário{' '}
                <strong className="text-foreground">{user.full_name}</strong>?
              </p>

              {isLoadingCount ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando conversas...
                </div>
              ) : conversationsCount > 0 ? (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <p className="text-amber-800 dark:text-amber-200 font-semibold">
                    ⚠️ Este usuário possui {conversationsCount}{' '}
                    {conversationsCount === 1 ? 'conversa atribuída' : 'conversas atribuídas'}
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 text-sm mt-2">
                    As conversas serão desatribuídas e ficarão disponíveis para outros atendentes assumirem.
                  </p>
                </div>
              ) : null}

              <p className="text-sm text-muted-foreground">
                Esta ação não pode ser desfeita.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || isLoadingCount}
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deletando...
              </>
            ) : (
              'Sim, Deletar Usuário'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
