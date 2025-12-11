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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  type: 'company' | 'user';
  name: string;
  details?: string[];
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({
  type,
  name,
  details,
  isLoading,
  onConfirm,
  onCancel
}: DeleteConfirmModalProps) {
  const [confirmed, setConfirmed] = useState(false);

  const title = type === 'company' ? 'Excluir Empresa' : 'Excluir Usuário';
  const description = type === 'company'
    ? `Você está prestes a excluir a empresa "${name}" e todos os seus dados.`
    : `Você está prestes a excluir o usuário "${name}".`;

  return (
    <AlertDialog open onOpenChange={onCancel}>
      <AlertDialogContent className="border-destructive border-2">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-md">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">ATENÇÃO: Esta ação é irreversível!</p>
                  <p className="text-sm text-muted-foreground mt-1">{description}</p>
                </div>
              </div>

              {details && details.length > 0 && (
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm font-medium mb-2">Serão excluídos:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {details.map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="delete-confirm"
                  checked={confirmed}
                  onCheckedChange={setConfirmed}
                  disabled={isLoading}
                />
                <Label htmlFor="delete-confirm" className="text-sm">
                  Entendo que todos os dados serão permanentemente excluídos
                </Label>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={!confirmed || isLoading}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Excluir'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}