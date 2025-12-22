import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare, 
  Users, 
  Bot, 
  BarChart3, 
  Zap, 
  Shield, 
  ChevronDown,
  Check,
  Star,
  ArrowRight,
  Smartphone,
  Clock,
  Target,
  TrendingUp
} from 'lucide-react';

// Hero Section
const HeroSection = () => (
  <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary/5 via-background to-info/5">
    {/* Background decoration */}
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-info/10 rounded-full blur-3xl" />
    </div>
    
    <div className="container mx-auto px-4 py-20 relative z-10">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
          <Zap className="w-4 h-4" />
          Plataforma #1 de Atendimento via WhatsApp
        </div>
        
        <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
          Transforme seu atendimento com{' '}
          <span className="gradient-text">Inteligência Artificial</span>
        </h1>
        
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Automatize conversas, qualifique leads e feche mais vendas com nossa plataforma completa de atendimento via WhatsApp.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/trial">
            <Button size="lg" className="text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all">
              Começar Teste Grátis
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          <Link to="/pricing">
            <Button variant="outline" size="lg" className="text-lg px-8 py-6 rounded-xl">
              Ver Planos
            </Button>
          </Link>
        </div>
        
        <p className="text-sm text-muted-foreground mt-4">
          ✓ 3 dias grátis • ✓ Sem cartão de crédito • ✓ Cancele quando quiser
        </p>
      </div>
    </div>
    
    {/* Scroll indicator */}
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
      <ChevronDown className="w-6 h-6 text-muted-foreground" />
    </div>
  </section>
);

// Features Section
const features = [
  {
    icon: MessageSquare,
    title: 'Caixa de Entrada Unificada',
    description: 'Gerencie todas as conversas do WhatsApp em um só lugar, com organização por departamentos e tags.'
  },
  {
    icon: Bot,
    title: 'Agentes de IA',
    description: 'Automatize atendimentos com agentes inteligentes que respondem 24/7 e qualificam seus leads.'
  },
  {
    icon: Users,
    title: 'CRM Integrado',
    description: 'Acompanhe seu funil de vendas com Kanban visual e histórico completo de cada cliente.'
  },
  {
    icon: BarChart3,
    title: 'Gerente Comercial',
    description: 'Relatórios detalhados com análise de performance e insights para melhorar suas vendas.'
  },
  {
    icon: Clock,
    title: 'Respostas Rápidas',
    description: 'Templates prontos para agilizar o atendimento e manter a consistência das mensagens.'
  },
  {
    icon: Shield,
    title: 'Segurança Total',
    description: 'Dados criptografados e backup automático para proteger suas conversas.'
  }
];

const FeaturesSection = () => (
  <section className="py-20 bg-muted/30">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Tudo que você precisa em uma só plataforma
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Recursos poderosos para transformar seu atendimento e aumentar suas vendas.
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map((feature, index) => (
          <div 
            key={index}
            className="bg-card p-6 rounded-2xl border border-border hover:border-primary/30 transition-all duration-300 card-hover"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <feature.icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
            <p className="text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// Pricing Preview Section
const PricingPreviewSection = () => (
  <section className="py-20">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Planos que cabem no seu bolso
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Escolha o plano ideal para o seu negócio e comece a vender mais hoje.
        </p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {/* Mensal */}
        <div className="bg-card p-8 rounded-2xl border border-border">
          <h3 className="text-xl font-semibold text-foreground mb-2">Mensal</h3>
          <p className="text-muted-foreground text-sm mb-4">Para quem quer flexibilidade</p>
          <div className="mb-6">
            <span className="text-4xl font-bold text-foreground">R$695</span>
            <span className="text-muted-foreground">/mês</span>
          </div>
          <Link to="/pricing">
            <Button variant="outline" className="w-full">Ver detalhes</Button>
          </Link>
        </div>
        
        {/* Semestral - Destaque */}
        <div className="bg-card p-8 rounded-2xl border-2 border-primary relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-sm font-medium rounded-full">
            Mais Popular
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">Semestral</h3>
          <p className="text-muted-foreground text-sm mb-4">Economize 37%</p>
          <div className="mb-6">
            <span className="text-4xl font-bold text-foreground">R$437</span>
            <span className="text-muted-foreground">/mês</span>
          </div>
          <Link to="/pricing">
            <Button className="w-full">Ver detalhes</Button>
          </Link>
        </div>
        
        {/* Anual */}
        <div className="bg-card p-8 rounded-2xl border border-border">
          <h3 className="text-xl font-semibold text-foreground mb-2">Anual</h3>
          <p className="text-muted-foreground text-sm mb-4">Economize 50%</p>
          <div className="mb-6">
            <span className="text-4xl font-bold text-foreground">R$347</span>
            <span className="text-muted-foreground">/mês</span>
          </div>
          <Link to="/pricing">
            <Button variant="outline" className="w-full">Ver detalhes</Button>
          </Link>
        </div>
      </div>
      
      <div className="text-center mt-8">
        <Link to="/pricing" className="text-primary hover:underline font-medium inline-flex items-center gap-2">
          Comparar todos os planos
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  </section>
);

// Testimonials Section
const testimonials = [
  {
    name: 'Carlos Silva',
    role: 'CEO, TechVendas',
    content: 'Triplicamos nossas vendas em 3 meses. O agente de IA responde 24 horas e qualifica os leads automaticamente.',
    rating: 5
  },
  {
    name: 'Ana Martins',
    role: 'Gerente Comercial, Imobiliária Prime',
    content: 'O CRM integrado mudou nossa forma de trabalhar. Agora não perdemos nenhum lead no funil.',
    rating: 5
  },
  {
    name: 'Roberto Costa',
    role: 'Diretor, Clínica Saúde+',
    content: 'Reduzimos 70% do tempo de atendimento com as respostas rápidas e o agente de IA para agendamentos.',
    rating: 5
  }
];

const TestimonialsSection = () => (
  <section className="py-20 bg-muted/30">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          O que nossos clientes dizem
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Empresas reais, resultados reais.
        </p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {testimonials.map((testimonial, index) => (
          <div key={index} className="bg-card p-6 rounded-2xl border border-border">
            <div className="flex gap-1 mb-4">
              {[...Array(testimonial.rating)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-warning text-warning" />
              ))}
            </div>
            <p className="text-foreground mb-4">"{testimonial.content}"</p>
            <div>
              <p className="font-semibold text-foreground">{testimonial.name}</p>
              <p className="text-sm text-muted-foreground">{testimonial.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// FAQ Section
const faqs = [
  {
    question: 'Como funciona o período de teste?',
    answer: 'Você tem 3 dias para testar todas as funcionalidades da plataforma gratuitamente. Não pedimos cartão de crédito.'
  },
  {
    question: 'Posso adicionar mais conexões WhatsApp?',
    answer: 'Sim! Cada conexão adicional custa R$97/mês. Você pode adicionar quantas precisar.'
  },
  {
    question: 'O agente de IA substitui minha equipe?',
    answer: 'Não, ele complementa. O agente responde perguntas frequentes e qualifica leads, liberando sua equipe para focar nas vendas.'
  },
  {
    question: 'Meus dados estão seguros?',
    answer: 'Sim! Usamos criptografia de ponta a ponta e servidores seguros. Seus dados são apenas seus.'
  },
  {
    question: 'Posso cancelar a qualquer momento?',
    answer: 'Claro! Não há fidelidade. Você pode cancelar quando quiser sem taxas adicionais.'
  }
];

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Perguntas Frequentes
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Tire suas dúvidas sobre a plataforma.
          </p>
        </div>
        
        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((faq, index) => (
            <div 
              key={index}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              <button
                className="w-full px-6 py-4 flex items-center justify-between text-left"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                <span className="font-medium text-foreground">{faq.question}</span>
                <ChevronDown 
                  className={`w-5 h-5 text-muted-foreground transition-transform ${openIndex === index ? 'rotate-180' : ''}`} 
                />
              </button>
              {openIndex === index && (
                <div className="px-6 pb-4 text-muted-foreground">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// CTA Section
const CTASection = () => (
  <section className="py-20 bg-gradient-to-br from-primary to-primary/80">
    <div className="container mx-auto px-4 text-center">
      <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
        Pronto para transformar seu atendimento?
      </h2>
      <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
        Junte-se a centenas de empresas que já estão vendendo mais com ChatGo.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link to="/trial">
          <Button 
            size="lg" 
            variant="secondary"
            className="text-lg px-8 py-6 rounded-xl"
          >
            Começar Teste Grátis
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </Link>
        <Link to="/pricing">
          <Button 
            size="lg" 
            variant="outline"
            className="text-lg px-8 py-6 rounded-xl border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
          >
            Ver Planos
          </Button>
        </Link>
      </div>
    </div>
  </section>
);

// Footer
const Footer = () => (
  <footer className="py-12 bg-foreground text-background">
    <div className="container mx-auto px-4">
      <div className="grid md:grid-cols-4 gap-8 mb-8">
        <div>
          <h3 className="text-xl font-bold mb-4">ChatGo</h3>
          <p className="text-background/70">
            A plataforma completa para atendimento via WhatsApp com IA.
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Produto</h4>
          <ul className="space-y-2 text-background/70">
            <li><Link to="/pricing" className="hover:text-background">Preços</Link></li>
            <li><a href="#features" className="hover:text-background">Funcionalidades</a></li>
            <li><Link to="/trial" className="hover:text-background">Teste Grátis</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Empresa</h4>
          <ul className="space-y-2 text-background/70">
            <li><a href="#" className="hover:text-background">Sobre</a></li>
            <li><a href="#" className="hover:text-background">Blog</a></li>
            <li><a href="#" className="hover:text-background">Contato</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Legal</h4>
          <ul className="space-y-2 text-background/70">
            <li><a href="#" className="hover:text-background">Termos de Uso</a></li>
            <li><a href="#" className="hover:text-background">Privacidade</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-background/10 pt-8 text-center text-background/50">
        <p>© {new Date().getFullYear()} ChatGo. Todos os direitos reservados.</p>
      </div>
    </div>
  </footer>
);

// Main Landing Page
export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold gradient-text">
            ChatGo
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Funcionalidades
            </a>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Preços
            </Link>
            <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </a>
          </nav>
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
      
      <main>
        <HeroSection />
        <div id="features">
          <FeaturesSection />
        </div>
        <PricingPreviewSection />
        <TestimonialsSection />
        <div id="faq">
          <FAQSection />
        </div>
        <CTASection />
      </main>
      
      <Footer />
    </div>
  );
}
