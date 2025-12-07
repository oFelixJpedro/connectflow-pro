import { useNavigate } from 'react-router-dom';
import { Smartphone, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NoConnectionsState() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Smartphone className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          Nenhuma conexão WhatsApp ativa
        </h3>
        <p className="text-muted-foreground mb-6">
          Conecte seu WhatsApp para começar a receber e enviar mensagens pelo sistema.
        </p>
        <Button
          onClick={() => navigate('/connections')}
          className="gap-2"
        >
          Conectar WhatsApp
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
