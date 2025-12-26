import { useState, useEffect, useRef } from 'react';
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
  Clock,
  QrCode,
  UserPlus,
  Sparkles,
  Rocket,
  Store,
  Scale,
  Building2,
  GraduationCap,
  Hospital,
  Menu,
  X
} from 'lucide-react';

// =====================
// NAVIGATION
// =====================
const Navigation = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled ? 'bg-background/95 backdrop-blur-lg shadow-sm border-b border-border' : 'bg-transparent'
    }`}>
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className={`text-xl font-bold ${isScrolled ? 'text-foreground' : 'text-white'}`}>
            ChatGo
          </span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-8">
          <a href="#funcionalidades" className={`transition-colors ${isScrolled ? 'text-muted-foreground hover:text-foreground' : 'text-white/80 hover:text-white'}`}>
            Funcionalidades
          </a>
          <a href="#como-funciona" className={`transition-colors ${isScrolled ? 'text-muted-foreground hover:text-foreground' : 'text-white/80 hover:text-white'}`}>
            Como Funciona
          </a>
          <a href="#planos" className={`transition-colors ${isScrolled ? 'text-muted-foreground hover:text-foreground' : 'text-white/80 hover:text-white'}`}>
            Planos
          </a>
          <a href="#faq" className={`transition-colors ${isScrolled ? 'text-muted-foreground hover:text-foreground' : 'text-white/80 hover:text-white'}`}>
            FAQ
          </a>
        </nav>
        
        <div className="hidden md:flex items-center gap-3">
          <Link to="/auth">
            <Button variant={isScrolled ? "ghost" : "outline"} className={!isScrolled ? "border-white/30 text-white hover:bg-white/10" : ""}>
              Entrar
            </Button>
          </Link>
          <Link to="/trial">
            <Button className={isScrolled ? "" : "bg-white text-primary hover:bg-white/90"}>
              Começar Agora
            </Button>
          </Link>
        </div>

        {/* Mobile menu button */}
        <button 
          className="md:hidden p-2"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? (
            <X className={`w-6 h-6 ${isScrolled ? 'text-foreground' : 'text-white'}`} />
          ) : (
            <Menu className={`w-6 h-6 ${isScrolled ? 'text-foreground' : 'text-white'}`} />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-background border-t border-border">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-4">
            <a href="#funcionalidades" className="text-foreground py-2" onClick={() => setIsMobileMenuOpen(false)}>
              Funcionalidades
            </a>
            <a href="#como-funciona" className="text-foreground py-2" onClick={() => setIsMobileMenuOpen(false)}>
              Como Funciona
            </a>
            <a href="#planos" className="text-foreground py-2" onClick={() => setIsMobileMenuOpen(false)}>
              Planos
            </a>
            <a href="#faq" className="text-foreground py-2" onClick={() => setIsMobileMenuOpen(false)}>
              FAQ
            </a>
            <div className="flex flex-col gap-2 pt-4 border-t border-border">
              <Link to="/auth">
                <Button variant="outline" className="w-full">Entrar</Button>
              </Link>
              <Link to="/trial">
                <Button className="w-full">Começar Agora</Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

// =====================
// HERO SECTION
// =====================
const HeroSection = () => (
  <section className="relative min-h-screen flex items-center justify-center overflow-hidden hero-gradient">
    {/* Background decorations */}
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute top-20 left-10 w-20 h-20 bg-white/5 rounded-full blur-xl" />
      <div className="absolute top-40 right-20 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
      <div className="absolute bottom-40 left-1/4 w-24 h-24 bg-white/5 rounded-full blur-xl" />
      {/* Floating chat bubbles */}
      <div className="absolute top-1/4 left-[10%] opacity-10 animate-float">
        <MessageSquare className="w-12 h-12 text-white" />
      </div>
      <div className="absolute top-1/3 right-[15%] opacity-10 animate-float" style={{ animationDelay: '1s' }}>
        <MessageSquare className="w-8 h-8 text-white" />
      </div>
      <div className="absolute bottom-1/3 left-[20%] opacity-10 animate-float" style={{ animationDelay: '2s' }}>
        <Bot className="w-10 h-10 text-white" />
      </div>
    </div>
    
    <div className="container mx-auto px-4 py-32 relative z-10">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Left Column - Text */}
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-badge text-sm font-medium mb-6 animate-fade-up">
            <Sparkles className="w-4 h-4" />
            Inteligência Artificial Integrada
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight animate-fade-up" style={{ animationDelay: '0.1s' }}>
            Transforme seu WhatsApp em uma{' '}
            <span className="text-white/90">Central de Atendimento Inteligente</span>
          </h1>
          
          <p className="text-lg md:text-xl text-white/80 mb-8 max-w-xl animate-fade-up" style={{ animationDelay: '0.2s' }}>
            Múltiplos atendentes, um único número. Chatbots com IA que entendem seus clientes. 
            E um gerente comercial dedicado para otimizar seus resultados.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-6 animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <Link to="/trial">
              <Button size="lg" className="text-lg px-8 py-6 rounded-xl bg-white text-primary hover:bg-white/90 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]">
                Testar Grátis por 7 Dias
              </Button>
            </Link>
          </div>
          
          <p className="text-white/60 text-sm animate-fade-up" style={{ animationDelay: '0.4s' }}>
            Sem cartão de crédito • Setup em 5 minutos
          </p>
          
          <div className="flex items-center gap-3 mt-8 justify-center lg:justify-start animate-fade-up" style={{ animationDelay: '0.5s' }}>
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/30" />
              ))}
            </div>
            <p className="text-white/70 text-sm">
              Mais de <span className="font-semibold text-white">500 empresas</span> já automatizaram seu atendimento
            </p>
          </div>
        </div>
        
        {/* Right Column - Mockup */}
        <div className="hidden lg:block animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <div className="relative">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 shadow-2xl">
              <div className="bg-background rounded-xl overflow-hidden">
                {/* Mock Dashboard */}
                <div className="bg-muted/50 p-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                    <span className="ml-4 text-sm text-muted-foreground">Caixa de Entrada</span>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  {/* Mock conversation items */}
                  {[
                    { name: 'João Silva', msg: 'Olá, gostaria de saber mais...', badge: 'AI', unread: true },
                    { name: 'Maria Santos', msg: 'Qual o prazo de entrega?', badge: null, unread: false },
                    { name: 'Pedro Costa', msg: 'Fechado! Vamos fazer o...', badge: null, unread: true },
                  ].map((conv, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${conv.unread ? 'bg-primary/5' : 'bg-muted/30'}`}>
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">{conv.name[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground text-sm">{conv.name}</span>
                          {conv.badge && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/20 text-success font-medium">
                              {conv.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{conv.msg}</p>
                      </div>
                      {conv.unread && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    {/* Scroll indicator */}
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
      <ChevronDown className="w-6 h-6 text-white/50" />
    </div>
  </section>
);

// =====================
// PAIN POINTS SECTION
// =====================
const painPoints = [
  {
    icon: Clock,
    emoji: '😤',
    title: 'Clientes esperando horas por resposta',
    description: 'Enquanto sua equipe está ocupada, leads quentes esfriam e vão para o concorrente.'
  },
  {
    icon: Users,
    emoji: '🔀',
    title: 'Atendentes perdidos sem contexto',
    description: 'Cada conversa começa do zero. Ninguém sabe o histórico do cliente.'
  },
  {
    icon: BarChart3,
    emoji: '📊',
    title: 'Zero visibilidade dos resultados',
    description: 'Quantos leads viraram vendas? Qual atendente performa melhor? Mistério total.'
  }
];

const PainPointsSection = () => (
  <section className="py-20 bg-background">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Seu atendimento está travando suas vendas?
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Se você se identifica com algum desses problemas, o ChatGo foi feito para você.
        </p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {painPoints.map((point, index) => (
          <div 
            key={index}
            className="glass-card p-8 rounded-2xl text-center landing-card"
          >
            <div className="text-4xl mb-4">{point.emoji}</div>
            <h3 className="text-xl font-semibold text-foreground mb-3">{point.title}</h3>
            <p className="text-muted-foreground">{point.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// =====================
// FEATURES/SOLUTION SECTION
// =====================
const features = [
  {
    overline: 'MULTIATENDIMENTO',
    title: 'Todo seu time no mesmo número de WhatsApp',
    description: 'Distribua conversas automaticamente entre atendentes. Transfira chats entre departamentos. Mantenha o histórico completo de cada cliente — tudo em um único número.',
    bullets: [
      'Atendentes ilimitados no mesmo número',
      'Distribuição inteligente por disponibilidade',
      'Transferência entre setores com contexto'
    ],
    icon: Users
  },
  {
    overline: 'INTELIGÊNCIA ARTIFICIAL',
    title: 'Chatbot que realmente entende seus clientes',
    description: 'Esqueça bots robóticos. Nossa IA conversa naturalmente, qualifica leads, responde dúvidas e só transfere para humanos quando necessário.',
    bullets: [
      'Respostas naturais 24/7',
      'Qualificação automática de leads',
      'Aprende com suas conversas'
    ],
    icon: Bot
  },
  {
    overline: 'GERENTE COMERCIAL DEDICADO',
    title: 'Seu parceiro para otimizar resultados',
    description: 'Não é só software. Você tem um especialista analisando seus dados, sugerindo melhorias e ajudando seu time a converter mais.',
    bullets: [
      'Relatórios semanais automatizados',
      'Análise de métricas e conversão',
      'Sugestões personalizadas de melhoria'
    ],
    icon: BarChart3
  }
];

const FeaturesSection = () => (
  <section id="funcionalidades" className="py-20 section-gradient-light">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Uma plataforma completa para seu time vender mais
        </h2>
      </div>
      
      <div className="space-y-24 max-w-6xl mx-auto">
        {features.map((feature, index) => (
          <div 
            key={index}
            className={`grid md:grid-cols-2 gap-12 items-center ${index % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
          >
            <div className={index % 2 === 1 ? 'md:order-2' : ''}>
              <span className="text-sm font-semibold text-primary tracking-wider">{feature.overline}</span>
              <h3 className="text-2xl md:text-3xl font-bold text-foreground mt-2 mb-4">{feature.title}</h3>
              <p className="text-muted-foreground mb-6">{feature.description}</p>
              <ul className="space-y-3">
                {feature.bullets.map((bullet, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-success" />
                    </div>
                    <span className="text-foreground">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`${index % 2 === 1 ? 'md:order-1' : ''}`}>
              <div className="bg-card rounded-2xl border border-border p-8 shadow-landing">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <feature.icon className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-3 bg-muted rounded-full" style={{ width: `${100 - i * 15}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// =====================
// HOW IT WORKS SECTION
// =====================
const steps = [
  { number: '01', icon: QrCode, title: 'Conecte seu WhatsApp', description: 'Escaneie o QR Code com seu celular. Pronto, seu número está integrado.' },
  { number: '02', icon: UserPlus, title: 'Adicione sua equipe', description: 'Convide atendentes por email. Defina departamentos e permissões em cliques.' },
  { number: '03', icon: Sparkles, title: 'Configure o chatbot', description: 'Ative a IA, personalize as respostas iniciais e defina quando transferir para humanos.' },
  { number: '04', icon: Rocket, title: 'Comece a vender mais', description: 'Sua equipe já pode atender. Acompanhe métricas em tempo real.' }
];

const HowItWorksSection = () => (
  <section id="como-funciona" className="py-20 bg-background">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Funcionando em menos de 10 minutos
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Sem instalação. Sem configuração técnica. Só conectar e atender.
        </p>
      </div>
      
      <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
        {steps.map((step, index) => (
          <div key={index} className="text-center">
            <div className="text-5xl md:text-6xl font-bold step-number mb-4">{step.number}</div>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <step.icon className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.description}</p>
          </div>
        ))}
      </div>
      
      <div className="text-center mt-12">
        <Link to="/trial">
          <Button size="lg" className="landing-btn-primary text-lg px-8 py-6">
            Começar Minha Configuração
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </Link>
      </div>
    </div>
  </section>
);

// =====================
// WHO IT'S FOR SECTION
// =====================
const useCases = [
  { icon: Store, emoji: '🏪', title: 'Lojas e E-commerces', description: 'Responda pedidos, tire dúvidas de produtos e processe trocas automaticamente.' },
  { icon: Scale, emoji: '⚖️', title: 'Escritórios e Consultórios', description: 'Agende consultas, envie lembretes e mantenha comunicação profissional.' },
  { icon: Building2, emoji: '🏢', title: 'Empresas de Serviços', description: 'Gerencie orçamentos, acompanhe projetos e fidelize clientes.' },
  { icon: GraduationCap, emoji: '🎓', title: 'Escolas e Cursos', description: 'Atenda alunos e responsáveis, envie comunicados, gerencie matrículas.' },
  { icon: Hospital, emoji: '🏥', title: 'Clínicas e Saúde', description: 'Confirme consultas, envie resultados e humanize o atendimento.' },
  { icon: Rocket, emoji: '🚀', title: 'Startups e PMEs', description: 'Escale seu atendimento sem escalar custos operacionais.' }
];

const WhoItsForSection = () => (
  <section className="py-20 section-gradient-light">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Ideal para quem leva atendimento a sério
        </h2>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {useCases.map((useCase, index) => (
          <div 
            key={index}
            className="landing-card p-6 rounded-xl flex items-start gap-4"
          >
            <div className="text-3xl">{useCase.emoji}</div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">{useCase.title}</h3>
              <p className="text-sm text-muted-foreground">{useCase.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// =====================
// PRICING SECTION
// =====================
const pricingPlans = [
  {
    name: 'Mensal',
    price: 694,
    period: '/mês',
    description: 'Para quem quer flexibilidade',
    billing: 'Cobrado mensalmente',
    features: ['1 Conexão WhatsApp', 'Usuários ilimitados', 'Agentes de IA', 'CRM Kanban', 'Respostas Rápidas', 'Suporte por email'],
    popular: false
  },
  {
    name: 'Semestral',
    price: 437,
    period: '/mês',
    description: 'Para times que querem crescer',
    billing: '6x de R$437',
    features: ['1 Conexão WhatsApp', 'Usuários ilimitados', 'IA avançada', 'CRM Kanban', 'Integrações completas', 'Suporte prioritário'],
    popular: true
  },
  {
    name: 'Anual',
    price: 347,
    period: '/mês',
    description: 'Máxima economia',
    billing: '12x de R$347',
    features: ['1 Conexão WhatsApp', 'Usuários ilimitados', 'IA avançada', 'CRM Kanban', 'API completa', 'Suporte VIP'],
    popular: false
  }
];

const PricingSection = () => (
  <section id="planos" className="py-20 bg-background">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
          Planos que cabem no seu bolso
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Comece grátis. Escale quando precisar.
        </p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {pricingPlans.map((plan, index) => (
          <div 
            key={index}
            className={`bg-card rounded-2xl border-2 p-8 relative ${
              plan.popular ? 'border-primary shadow-landing-hover scale-105' : 'border-border'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-sm font-medium rounded-full">
                Mais Popular
              </div>
            )}
            
            <h3 className="text-xl font-semibold text-foreground mb-1">{plan.name}</h3>
            <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
            
            <div className="mb-2">
              <span className="text-4xl font-bold text-foreground">R${plan.price}</span>
              <span className="text-muted-foreground">{plan.period}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-6">{plan.billing}</p>
            
            <ul className="space-y-3 mb-8">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-success" />
                  <span className="text-foreground">{feature}</span>
                </li>
              ))}
            </ul>
            
            <Link to="/pricing">
              <Button 
                className={`w-full ${plan.popular ? '' : ''}`}
                variant={plan.popular ? 'default' : 'outline'}
              >
                Ver detalhes
              </Button>
            </Link>
          </div>
        ))}
      </div>
      
      <p className="text-center text-muted-foreground mt-8">
        Todos os planos incluem 7 dias grátis para testar. Cancele quando quiser.
      </p>
    </div>
  </section>
);

// =====================
// FAQ SECTION
// =====================
const faqs = [
  {
    question: 'Preciso trocar meu número de WhatsApp?',
    answer: 'Não. Você usa seu número atual. Basta escanear o QR Code e seu número estará conectado ao ChatGo em segundos.'
  },
  {
    question: 'A IA vai substituir meus atendentes?',
    answer: 'Não, ela vai ajudá-los. A IA cuida de perguntas repetitivas e qualificação inicial. Atendimentos que precisam de toque humano são transferidos automaticamente para sua equipe.'
  },
  {
    question: 'É seguro? Minhas conversas ficam protegidas?',
    answer: 'Totalmente. Usamos criptografia de ponta a ponta e seguimos todas as normas da LGPD. Seus dados e dos seus clientes estão seguros.'
  },
  {
    question: 'Quanto tempo leva para configurar?',
    answer: 'Menos de 10 minutos para o básico. Conectar o número é instantâneo. Configurar departamentos e respostas automáticas leva alguns minutos a mais.'
  },
  {
    question: 'Posso cancelar a qualquer momento?',
    answer: 'Sim, sem multas ou fidelidade. Você pode cancelar direto no painel, sem precisar ligar para ninguém.'
  },
  {
    question: 'Funciona no celular também?',
    answer: 'Sim! Nossa plataforma é totalmente responsiva. Sua equipe pode atender de qualquer dispositivo, em qualquer lugar.'
  }
];

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  
  return (
    <section id="faq" className="py-20 section-gradient-light">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Dúvidas Frequentes
          </h2>
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
                  className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${openIndex === index ? 'rotate-180' : ''}`} 
                />
              </button>
              <div className={`overflow-hidden transition-all duration-200 ${openIndex === index ? 'max-h-40' : 'max-h-0'}`}>
                <div className="px-6 pb-4 text-muted-foreground">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// =====================
// FINAL CTA SECTION
// =====================
const FinalCTASection = () => (
  <section className="py-20 hero-gradient">
    <div className="container mx-auto px-4 text-center">
      <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
        Pronto para transformar seu atendimento?
      </h2>
      <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
        Junte-se a centenas de empresas que já automatizaram suas vendas no WhatsApp.
      </p>
      <Link to="/trial">
        <Button size="lg" className="text-lg px-8 py-6 rounded-xl bg-white text-primary hover:bg-white/90 shadow-xl hover:shadow-2xl transition-all hover:scale-[1.02]">
          Começar Meu Teste Grátis
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </Link>
      <p className="text-white/60 text-sm mt-4">
        7 dias grátis • Sem cartão • Setup em 5 minutos
      </p>
    </div>
  </section>
);

// =====================
// FOOTER
// =====================
const Footer = () => (
  <footer className="py-12 bg-[hsl(222,47%,6%)] text-white">
    <div className="container mx-auto px-4">
      <div className="grid md:grid-cols-4 gap-8 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">ChatGo</span>
          </div>
          <p className="text-white/60 text-sm">
            A plataforma completa para atendimento via WhatsApp com Inteligência Artificial.
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Produto</h4>
          <ul className="space-y-2 text-white/60 text-sm">
            <li><a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a></li>
            <li><Link to="/pricing" className="hover:text-white transition-colors">Preços</Link></li>
            <li><a href="#" className="hover:text-white transition-colors">Integrações</a></li>
            <li><a href="#" className="hover:text-white transition-colors">API</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Empresa</h4>
          <ul className="space-y-2 text-white/60 text-sm">
            <li><a href="#" className="hover:text-white transition-colors">Sobre</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Carreiras</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Contato</a></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-4">Legal</h4>
          <ul className="space-y-2 text-white/60 text-sm">
            <li><a href="#" className="hover:text-white transition-colors">Termos de Uso</a></li>
            <li><a href="#" className="hover:text-white transition-colors">Privacidade</a></li>
            <li><a href="#" className="hover:text-white transition-colors">LGPD</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 pt-8 text-center text-white/40 text-sm">
        <p>© {new Date().getFullYear()} ChatGo. Todos os direitos reservados.</p>
      </div>
    </div>
  </footer>
);

// =====================
// MAIN LANDING PAGE
// =====================
export default function LandingPage() {
  return (
    <div className="min-h-screen scroll-smooth">
      <Navigation />
      <main>
        <HeroSection />
        <PainPointsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <WhoItsForSection />
        <PricingSection />
        <FAQSection />
        <FinalCTASection />
      </main>
      <Footer />
    </div>
  );
}