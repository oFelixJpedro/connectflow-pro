import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  Check, 
  X, 
  ArrowRight, 
  MessageSquare, 
  BarChart3,
  Plus,
  Minus,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Stripe Price IDs
const STRIPE_PRICES = {
  monthly: 'price_1Sh1ldHOTrHw8gZfWCxrSpBo',
  semiannual: 'price_1Sh1srHOTrHw8gZfAF7nujIj',
  annual: 'price_1Sh1uIHOTrHw8gZfCY7VVZEy',
  extraConnection: 'price_1Sh23yHOTrHw8gZfN1V0ZBMP',
  commercialManager: 'price_1Sh24PHOTrHw8gZfVI7mSliT',
};

const plans = [
  {
    id: 'monthly',
    name: 'Mensal',
    description: 'Para quem quer flexibilidade',
    price: 694,
    period: '/mês',
    billing: 'Cobrado mensalmente',
    popular: false,
    features: [
      { name: '1 Conexão WhatsApp', included: true },
      { name: 'Usuários ilimitados', included: true },
      { name: 'Agentes de IA ilimitados', included: true },
      { name: 'CRM Kanban', included: true },
      { name: 'Respostas Rápidas', included: true },
      { name: 'Departamentos', included: true },
      { name: 'Tags e Filtros', included: true },
      { name: 'Gerente Comercial', included: false, addon: true },
    ]
  },
  {
    id: 'semiannual',
    name: 'Semestral',
    description: 'Economize 37%',
    price: 437,
    originalPrice: 694,
    period: '/mês',
    billing: '6x de R$437',
    popular: true,
    features: [
      { name: '1 Conexão WhatsApp', included: true },
      { name: 'Usuários ilimitados', included: true },
      { name: 'Agentes de IA ilimitados', included: true },
      { name: 'CRM Kanban', included: true },
      { name: 'Respostas Rápidas', included: true },
      { name: 'Departamentos', included: true },
      { name: 'Tags e Filtros', included: true },
      { name: 'Gerente Comercial', included: false, addon: true },
    ]
  },
  {
    id: 'annual',
    name: 'Anual',
    description: 'Economize 50%',
    price: 347,
    originalPrice: 694,
    period: '/mês',
    billing: '12x de R$347',
    popular: false,
    features: [
      { name: '1 Conexão WhatsApp', included: true },
      { name: 'Usuários ilimitados', included: true },
      { name: 'Agentes de IA ilimitados', included: true },
      { name: 'CRM Kanban', included: true },
      { name: 'Respostas Rápidas', included: true },
      { name: 'Departamentos', included: true },
      { name: 'Tags e Filtros', included: true },
      { name: 'Gerente Comercial', included: false, addon: true },
    ]
  }
];

export default function PricingPage() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState('semiannual');
  const [extraConnections, setExtraConnections] = useState(0);
  const [includeCommercialManager, setIncludeCommercialManager] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const currentPlan = plans.find(p => p.id === selectedPlan)!;
  
  const calculateTotal = () => {
    let total = currentPlan.price;
    total += extraConnections * 97;
    if (includeCommercialManager) total += 197;
    return total;
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    
    try {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.info('Você precisa estar logado para assinar');
        navigate('/auth', { state: { returnTo: '/precos' } });
        return;
      }

      // Build line items array
      const lineItems: { priceId: string; quantity: number }[] = [];
      
      // Add main plan
      const planPriceId = STRIPE_PRICES[selectedPlan as keyof typeof STRIPE_PRICES];
      lineItems.push({ priceId: planPriceId, quantity: 1 });
      
      // Add extra connections if selected
      if (extraConnections > 0) {
        lineItems.push({ priceId: STRIPE_PRICES.extraConnection, quantity: extraConnections });
      }
      
      // Add commercial manager if selected
      if (includeCommercialManager) {
        lineItems.push({ priceId: STRIPE_PRICES.commercialManager, quantity: 1 });
      }
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { lineItems }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Erro ao iniciar checkout. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
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
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link to="/trial">
              <Button>Teste Grátis</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Escolha o plano ideal para você
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Todos os planos incluem os recursos essenciais. Adicione extras conforme sua necessidade.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
          {plans.map((plan) => (
            <div 
              key={plan.id}
              className={`bg-card rounded-2xl border-2 transition-all cursor-pointer ${
                selectedPlan === plan.id 
                  ? 'border-primary shadow-lg scale-105' 
                  : 'border-border hover:border-primary/50'
              } ${plan.popular ? 'relative' : ''}`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-sm font-medium rounded-full">
                  Mais Popular
                </div>
              )}
              
              <div className="p-8">
                <h3 className="text-xl font-semibold text-foreground mb-1">{plan.name}</h3>
                <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                
                <div className="mb-2">
                  {plan.originalPrice && (
                    <span className="text-muted-foreground line-through text-lg mr-2">
                      R${plan.originalPrice}
                    </span>
                  )}
                  <span className="text-4xl font-bold text-foreground">
                    R${plan.price}
                  </span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-6">{plan.billing}</p>
                
                <div className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {feature.included ? (
                        <Check className="w-5 h-5 text-success" />
                      ) : feature.addon ? (
                        <Plus className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <X className="w-5 h-5 text-muted-foreground" />
                      )}
                      <span className={feature.included ? 'text-foreground' : 'text-muted-foreground'}>
                        {feature.name}
                        {feature.addon && <span className="text-xs ml-1">(add-on)</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add-ons Section */}
        <div className="max-w-3xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
            Personalize seu plano
          </h2>
          
          <div className="space-y-4">
            {/* Extra Connections */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Conexões WhatsApp Adicionais</h3>
                    <p className="text-sm text-muted-foreground">R$97/mês por conexão</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setExtraConnections(Math.max(0, extraConnections - 1))}
                    disabled={extraConnections === 0}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-8 text-center font-semibold text-foreground">{extraConnections}</span>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setExtraConnections(extraConnections + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Commercial Manager */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Gerente Comercial</h3>
                    <p className="text-sm text-muted-foreground">Relatórios avançados e análise de IA • R$197/mês</p>
                  </div>
                </div>
                <Switch 
                  checked={includeCommercialManager}
                  onCheckedChange={setIncludeCommercialManager}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary Card */}
        <div className="max-w-lg mx-auto">
          <div className="bg-card border border-border rounded-2xl p-8">
            <h3 className="text-xl font-semibold text-foreground mb-6">Resumo do pedido</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plano {currentPlan.name}</span>
                <span className="text-foreground">R${currentPlan.price}/mês</span>
              </div>
              
              {extraConnections > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{extraConnections}x Conexão adicional</span>
                  <span className="text-foreground">R${(extraConnections * 97)}/mês</span>
                </div>
              )}
              
              {includeCommercialManager && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gerente Comercial</span>
                  <span className="text-foreground">R$197/mês</span>
                </div>
              )}
              
              <div className="border-t border-border pt-3">
                <div className="flex justify-between text-lg font-semibold">
                  <span className="text-foreground">Total</span>
                  <span className="text-foreground">R${calculateTotal()}/mês</span>
                </div>
              </div>
            </div>
            
            <Button 
              className="w-full" 
              size="lg"
              onClick={handleSubscribe}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  Assinar agora
                  <ArrowRight className="ml-2 w-5 h-5" />
                </>
              )}
            </Button>
            
            <p className="text-center text-sm text-muted-foreground mt-4">
              Ou <Link to="/trial" className="text-primary hover:underline">comece com 3 dias grátis</Link>
            </p>
          </div>
        </div>

        {/* FAQ Link */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            Tem dúvidas?{' '}
            <Link to="/#faq" className="text-primary hover:underline">
              Veja nossas perguntas frequentes
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
