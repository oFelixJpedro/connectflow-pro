import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Check, 
  ArrowRight, 
  MessageSquare, 
  Bot, 
  Users, 
  Clock,
  Shield,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const benefits = [
  { icon: MessageSquare, text: '1 Conexão WhatsApp inclusa' },
  { icon: Bot, text: 'Agentes de IA ilimitados' },
  { icon: Users, text: 'Usuários ilimitados' },
  { icon: Clock, text: '3 dias grátis para testar' },
  { icon: Shield, text: 'Sem cartão de crédito' },
  { icon: Zap, text: 'Cancele quando quiser' },
];

export default function TrialPage() {
  const [formData, setFormData] = useState({
    companyName: '',
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // TODO: Implement trial registration with Supabase
    // This will create a new company with trial status
    
    toast({
      title: 'Conta criada com sucesso!',
      description: 'Redirecionando para o dashboard...',
    });
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      navigate('/auth');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold gradient-text">
            ChatGo
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost">Já tenho conta</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Benefits */}
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Comece seu teste grátis
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Experimente todos os recursos do ChatGo por 3 dias, sem compromisso.
            </p>
            
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <benefit.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-foreground">{benefit.text}</span>
                </div>
              ))}
            </div>
            
            <div className="mt-8 p-4 bg-muted rounded-xl">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">💡 Dica:</strong> Após o período de teste, você escolhe o plano que melhor se encaixa no seu negócio. Não se preocupe, avisaremos antes do teste acabar!
              </p>
            </div>
          </div>
          
          {/* Right side - Form */}
          <div className="bg-card border border-border rounded-2xl p-8">
            <h2 className="text-2xl font-semibold text-foreground mb-6">
              Criar conta gratuita
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="companyName">Nome da empresa</Label>
                <Input
                  id="companyName"
                  placeholder="Sua Empresa Ltda"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="name">Seu nome</Label>
                <Input
                  id="name"
                  placeholder="João Silva"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="joao@empresa.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="phone">WhatsApp</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={8}
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? 'Criando conta...' : 'Começar teste grátis'}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                Ao criar sua conta, você concorda com nossos{' '}
                <a href="#" className="text-primary hover:underline">Termos de Uso</a> e{' '}
                <a href="#" className="text-primary hover:underline">Política de Privacidade</a>.
              </p>
            </form>
            
            <div className="mt-6 pt-6 border-t border-border text-center">
              <p className="text-muted-foreground">
                Já tem uma conta?{' '}
                <Link to="/auth" className="text-primary hover:underline font-medium">
                  Entrar
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
