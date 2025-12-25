import { LogOut, Monitor } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SessionEndedModalProps {
  open: boolean;
  deviceInfo?: {
    device?: string;
    timestamp?: string;
  };
  onLogin: () => void;
}

export function SessionEndedModal({ open, deviceInfo, onLogin }: SessionEndedModalProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md" onEscapeKeyDown={(e) => e.preventDefault()}>
        <AlertDialogHeader className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <LogOut className="w-8 h-8 text-destructive" />
          </div>
          <AlertDialogTitle className="text-xl">Sessão Encerrada</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Sua conta foi acessada em outro dispositivo. Por segurança, apenas uma sessão ativa é permitida por vez.
            </p>
            
            {deviceInfo && (
              <div className="bg-muted rounded-lg p-3 text-left text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Monitor className="w-4 h-4" />
                  <span>Novo acesso detectado</span>
                </div>
                {deviceInfo.timestamp && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(deviceInfo.timestamp).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            )}
            
            <p className="text-muted-foreground text-sm">
              Seus dados estão seguros. Faça login novamente para continuar.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogAction onClick={onLogin} className="w-full sm:w-auto">
            Fazer Login Novamente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
