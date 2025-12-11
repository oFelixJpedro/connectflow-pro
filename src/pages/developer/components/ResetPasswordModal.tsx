import React, { useState } from 'react';
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
import { Loader2, Key } from 'lucide-react';

interface ResetPasswordModalProps {
  userName: string;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ResetPasswordModal({
  userName,
  isLoading,
  onConfirm,
  onCancel
}: ResetPasswordModalProps) {
  return (
    <AlertDialog open onOpenChange={onCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Resetar Senha
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja resetar a senha de <strong>{userName}</strong>?
            <br /><br />
            A senha será alterada para: <code className="bg-muted px-2 py-1 rounded">padrao123</code>
            <br /><br />
            O usuário será obrigado a trocar a senha no próximo login.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Resetando...
              </>
            ) : (
              'Resetar Senha'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}