import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight } from 'lucide-react';

export default function CheckoutSuccess() {
  useEffect(() => {
    // Could verify the session here if needed
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="w-20 h-20 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-success" />
        </div>
        
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Assinatura confirmada!
        </h1>
        
        <p className="text-muted-foreground mb-8">
          Sua assinatura foi ativada com sucesso. Você já pode acessar todos os recursos do ChatGo.
        </p>
        
        <Link to="/inbox">
          <Button size="lg" className="w-full">
            Acessar o ChatGo
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
