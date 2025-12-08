import { Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface NoAccessStateProps {
  type: 'no-connections' | 'no-access';
}

export function NoAccessState({ type }: NoAccessStateProps) {
  if (type === 'no-connections') {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-md border-dashed">
          <CardContent className="pt-12 pb-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground mb-2">Sem acesso a conexões</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Você ainda não foi atribuído a nenhuma conexão WhatsApp. 
              Entre em contato com um administrador para solicitar acesso.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                // Could open email or notification
                window.location.href = 'mailto:admin@empresa.com?subject=Solicitação de acesso a conexão WhatsApp';
              }}
            >
              <Mail className="w-4 h-4 mr-2" />
              Contatar administrador
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="max-w-md border-dashed">
        <CardContent className="pt-12 pb-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-warning" />
          </div>
          <h3 className="font-medium text-foreground mb-2">Acesso removido</h3>
          <p className="text-sm text-muted-foreground">
            Seu acesso a esta conexão foi removido por um administrador.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
