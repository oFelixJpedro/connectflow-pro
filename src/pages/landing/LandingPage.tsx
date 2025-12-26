import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  MessageSquare, 
  Users, 
  Bot, 
  BarChart3, 
  ChevronDown,
  Check,
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
  HeartPulse,
  Menu,
  X,
  Shuffle,
  EyeOff,
  Send,
  Phone,
  Mail
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
            <Button className={isScrolled ? "" : "bg-white text-[hsl(222,78%,57%)] hover:bg-white/90"}>
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
// HERO SECTION - Premium Fintech Style
// =====================
const HeroSection = () => (
  <section className="relative min-h-screen flex items-center justify-center overflow-hidden hero-gradient">
    {/* Decorative orbs */}
    <div className="orb orb-light-blue w-[500px] h-[500px] -top-20 -right-20" />
    <div className="orb orb-blue w-[400px] h-[400px] top-1/3 -left-40" />
    <div className="orb orb-light-blue w-[300px] h-[300px] bottom-20 right-1/4" />
    
    {/* Background pattern */}
    <div className="absolute inset-0 pattern-dots opacity-30" />
    
    <div className="container mx-auto px-4 py-32 relative z-10">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Left Column - Text */}
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-badge text-sm font-medium mb-6 animate-fade-up">
            <Sparkles className="w-4 h-4" />
            Inteligência Artificial Integrada
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-[56px] font-extrabold text-white mb-6 leading-[1.1] tracking-[-0.02em] animate-fade-up" style={{ animationDelay: '0.1s' }}>
            Transforme seu WhatsApp em uma{' '}
            <span className="text-white">Central de Atendimento Inteligente</span>
          </h1>
          
          <p className="text-lg md:text-xl text-white/80 mb-8 max-w-xl leading-[1.7] animate-fade-up" style={{ animationDelay: '0.2s' }}>
            Múltiplos atendentes, um único número. Chatbots com IA que entendem seus clientes. 
            E um gerente comercial dedicado para otimizar seus resultados.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-6 animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <Link to="/trial">
              <Button size="lg" className="text-lg px-8 py-6 rounded-xl bg-white text-[hsl(222,78%,57%)] hover:bg-white/90 shadow-[0_8px_30px_rgba(255,255,255,0.3)] hover:shadow-[0_12px_40px_rgba(255,255,255,0.4)] transition-all hover:scale-[1.02] font-semibold">
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
                <div key={i} className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/30 backdrop-blur-sm" />
              ))}
            </div>
            <p className="text-white/70 text-sm">
              Mais de <span className="font-semibold text-white">500 empresas</span> já automatizaram seu atendimento
            </p>
          </div>
        </div>
        
        {/* Right Column - Elaborate Mockup */}
        <div className="hidden lg:block animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <div className="relative">
            {/* Glow effect behind mockup */}
            <div className="absolute inset-0 bg-gradient-to-r from-[hsl(210,100%,70%)] to-[hsl(222,78%,57%)] opacity-20 blur-[60px] scale-110" />
            
            <div className="relative bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-6 shadow-2xl">
              <div className="bg-background rounded-2xl overflow-hidden shadow-xl">
                {/* Mock Dashboard Header */}
                <div className="bg-[hsl(222,47%,11%)] p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-white font-semibold">ChatGo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span className="text-white/70 text-sm">Online</span>
                  </div>
                </div>
                
                <div className="flex">
                  {/* Sidebar with conversations */}
                  <div className="w-72 border-r border-border bg-muted/30">
                    <div className="p-3 border-b border-border">
                      <div className="bg-background rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Buscar conversas...
                      </div>
                    </div>
                    
                    <div className="p-2 space-y-1">
                      {/* Active conversation */}
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-medium">
                            JS
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-background" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground text-sm">João Silva</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium flex items-center gap-1">
                              <Bot className="w-2.5 h-2.5" />
                              IA
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">Olá, gostaria de saber mais...</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] text-muted-foreground">14:32</span>
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] text-white font-medium">3</div>
                        </div>
                      </div>
                      
                      {/* Other conversations */}
                      {[
                        { name: 'Maria Santos', initials: 'MS', msg: 'Qual o prazo de entrega?', time: '14:28', color: 'from-blue-400 to-blue-600' },
                        { name: 'Pedro Costa', initials: 'PC', msg: 'Fechado! Vamos fazer...', time: '14:15', color: 'from-purple-400 to-purple-600' },
                        { name: 'Ana Oliveira', initials: 'AO', msg: 'Obrigada pelo atendimento!', time: '13:45', color: 'from-pink-400 to-pink-600' },
                      ].map((conv, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${conv.color} flex items-center justify-center text-white font-medium text-sm`}>
                            {conv.initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-foreground text-sm">{conv.name}</span>
                            <p className="text-xs text-muted-foreground truncate">{conv.msg}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{conv.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Chat area */}
                  <div className="flex-1 flex flex-col w-64">
                    {/* Chat header */}
                    <div className="p-4 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-medium">
                          JS
                        </div>
                        <div>
                          <span className="font-medium text-foreground">João Silva</span>
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-success" />
                            <span className="text-xs text-muted-foreground">Digitando...</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                          <Users className="w-3 h-3" />
                          <span>Vendas</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Messages */}
                    <div className="flex-1 p-4 space-y-3 bg-muted/20">
                      <div className="flex gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-[10px] flex-shrink-0">
                          JS
                        </div>
                        <div className="bg-background rounded-2xl rounded-tl-sm px-3 py-2 text-sm max-w-[180px]">
                          Olá, gostaria de saber mais sobre os planos
                        </div>
                      </div>
                      
                      <div className="flex gap-2 justify-end">
                        <div className="bg-primary text-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm max-w-[180px]">
                          <div className="flex items-center gap-1 text-[10px] text-white/70 mb-1">
                            <Bot className="w-3 h-3" />
                            <span>IA ChatGo</span>
                          </div>
                          Claro! Temos planos a partir de R$347/mês 😊
                        </div>
                      </div>
                    </div>
                    
                    {/* Input */}
                    <div className="p-3 border-t border-border bg-background">
                      <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
                        <input 
                          type="text" 
                          placeholder="Digite uma mensagem..." 
                          className="flex-1 bg-transparent text-sm outline-none"
                          disabled
                        />
                        <button className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                          <Send className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>
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
// PAIN POINTS SECTION - Icons instead of emojis
// =====================
const painPoints = [
  {
    icon: Clock,
    title: 'Clientes esperando horas por resposta',
    description: 'Enquanto sua equipe está ocupada, leads quentes esfriam e vão para o concorrente.'
  },
  {
    icon: Shuffle,
    title: 'Atendentes perdidos sem contexto',
    description: 'Cada conversa começa do zero. Ninguém sabe o histórico do cliente.'
  },
  {
    icon: EyeOff,
    title: 'Zero visibilidade dos resultados',
    description: 'Quantos leads viraram vendas? Qual atendente performa melhor? Mistério total.'
  }
];

const PainPointsSection = () => (
  <section className="py-24 bg-background">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-[40px] font-bold text-foreground mb-4 tracking-[-0.01em]">
          Seu atendimento está travando suas vendas?
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-[1.7]">
          Se você se identifica com algum desses problemas, o ChatGo foi feito para você.
        </p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {painPoints.map((point, index) => (
          <div 
            key={index}
            className="glass-card p-8 rounded-[20px] text-center"
          >
            <div className="icon-container mx-auto mb-5">
              <point.icon className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-3">{point.title}</h3>
            <p className="text-muted-foreground leading-[1.7]">{point.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// =====================
// FEATURES/SOLUTION SECTION - With Mockups
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
    mockupType: 'multi-agent'
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
    mockupType: 'ai-chat'
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
    mockupType: 'dashboard'
  }
];

// Feature mockup component
const FeatureMockup = ({ type }: { type: string }) => {
  if (type === 'multi-agent') {
    return (
      <div className="feature-mockup p-6">
        <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="bg-muted/50 p-3 border-b border-border flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Painel de Atendentes</span>
          </div>
          <div className="p-4 space-y-3">
            {['Carlos', 'Ana', 'Pedro'].map((name, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-medium">
                  {name[0]}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium">{name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-success" />
                    <span className="text-xs text-muted-foreground">{3 - i} conversas ativas</span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{90 + i * 3}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (type === 'ai-chat') {
    return (
      <div className="feature-mockup p-6">
        <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="bg-muted/50 p-3 border-b border-border flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">IA Respondendo</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">C</div>
              <div className="bg-muted rounded-xl rounded-tl-sm px-3 py-2 text-sm">
                Qual o prazo de entrega?
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <div className="bg-primary/10 text-foreground rounded-xl rounded-tr-sm px-3 py-2 text-sm max-w-[200px]">
                <div className="flex items-center gap-1 text-xs text-primary mb-1">
                  <Bot className="w-3 h-3" />
                  <span>IA ChatGo</span>
                </div>
                Entregamos em até 3 dias úteis para sua região! Quer que eu calcule o frete?
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="feature-mockup p-6">
      <div className="bg-background rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="bg-muted/50 p-3 border-b border-border flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Dashboard de Métricas</span>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Conversões', value: '89%' },
              { label: 'Tempo Resp.', value: '2min' },
              { label: 'Satisfação', value: '4.8' }
            ].map((stat, i) => (
              <div key={i} className="text-center p-2 rounded-lg bg-muted/30">
                <div className="text-lg font-bold text-primary">{stat.value}</div>
                <div className="text-[10px] text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
          <div className="h-16 bg-muted/30 rounded-lg flex items-end gap-1 p-2">
            {[40, 65, 45, 80, 60, 90, 70].map((h, i) => (
              <div key={i} className="flex-1 bg-primary/60 rounded-sm" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const FeaturesSection = () => (
  <section id="funcionalidades" className="py-24 section-gradient-light">
    <div className="container mx-auto px-4">
      <div className="text-center mb-20">
        <h2 className="text-3xl md:text-[40px] font-bold text-foreground mb-4 tracking-[-0.01em]">
          Uma plataforma completa para seu time vender mais
        </h2>
      </div>
      
      <div className="space-y-32 max-w-6xl mx-auto">
        {features.map((feature, index) => (
          <div 
            key={index}
            className={`grid md:grid-cols-2 gap-12 items-center ${index % 2 === 1 ? 'md:flex-row-reverse' : ''}`}
          >
            <div className={index % 2 === 1 ? 'md:order-2' : ''}>
              <span className="text-sm font-semibold text-[hsl(222,78%,57%)] tracking-wider">{feature.overline}</span>
              <h3 className="text-2xl md:text-3xl font-bold text-foreground mt-2 mb-4">{feature.title}</h3>
              <p className="text-muted-foreground mb-6 leading-[1.7]">{feature.description}</p>
              <ul className="space-y-3">
                {feature.bullets.map((bullet, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[hsl(160,84%,39%)]/20 flex items-center justify-center">
                      <Check className="w-3 h-3 text-[hsl(160,84%,39%)]" />
                    </div>
                    <span className="text-foreground">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`${index % 2 === 1 ? 'md:order-1' : ''}`}>
              <FeatureMockup type={feature.mockupType} />
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// =====================
// HOW IT WORKS SECTION - With connector lines
// =====================
const steps = [
  { number: '01', icon: QrCode, title: 'Conecte seu WhatsApp', description: 'Escaneie o QR Code com seu celular. Pronto, seu número está integrado.' },
  { number: '02', icon: UserPlus, title: 'Adicione sua equipe', description: 'Convide atendentes por email. Defina departamentos e permissões em cliques.' },
  { number: '03', icon: Sparkles, title: 'Configure o chatbot', description: 'Ative a IA, personalize as respostas iniciais e defina quando transferir para humanos.' },
  { number: '04', icon: Rocket, title: 'Comece a vender mais', description: 'Sua equipe já pode atender. Acompanhe métricas em tempo real.' }
];

const HowItWorksSection = () => (
  <section id="como-funciona" className="py-24 bg-background">
    <div className="container mx-auto px-4">
      <div className="text-center mb-20">
        <h2 className="text-3xl md:text-[40px] font-bold text-foreground mb-4 tracking-[-0.01em]">
          Funcionando em menos de 10 minutos
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-[1.7]">
          Sem instalação. Sem configuração técnica. Só conectar e atender.
        </p>
      </div>
      
      <div className="relative max-w-5xl mx-auto">
        {/* Connector line */}
        <div className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-[2px]" style={{
          background: 'repeating-linear-gradient(90deg, hsl(214, 32%, 85%) 0px, hsl(214, 32%, 85%) 8px, transparent 8px, transparent 16px)'
        }} />
        
        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="text-center relative">
              <div className="text-5xl md:text-6xl font-extrabold step-number mb-4">{step.number}</div>
              <div className="w-14 h-14 rounded-2xl bg-[hsl(222,100%,96%)] flex items-center justify-center mx-auto mb-4">
                <step.icon className="w-7 h-7 text-[hsl(222,78%,57%)]" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-[1.7]">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
      
      <div className="text-center mt-16">
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
// WHO IT'S FOR SECTION - Icons instead of emojis
// =====================
const useCases = [
  { icon: Store, title: 'Lojas e E-commerces', description: 'Responda pedidos, tire dúvidas de produtos e processe trocas automaticamente.' },
  { icon: Scale, title: 'Escritórios e Consultórios', description: 'Agende consultas, envie lembretes e mantenha comunicação profissional.' },
  { icon: Building2, title: 'Empresas de Serviços', description: 'Gerencie orçamentos, acompanhe projetos e fidelize clientes.' },
  { icon: GraduationCap, title: 'Escolas e Cursos', description: 'Atenda alunos e responsáveis, envie comunicados, gerencie matrículas.' },
  { icon: HeartPulse, title: 'Clínicas e Saúde', description: 'Confirme consultas, envie resultados e humanize o atendimento.' },
  { icon: Rocket, title: 'Startups e PMEs', description: 'Escale seu atendimento sem escalar custos operacionais.' }
];

const WhoItsForSection = () => (
  <section className="py-24 section-gradient-light">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-[40px] font-bold text-foreground mb-4 tracking-[-0.01em]">
          Ideal para quem leva atendimento a sério
        </h2>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {useCases.map((useCase, index) => (
          <div 
            key={index}
            className="landing-card p-6 rounded-xl flex items-start gap-4"
          >
            <div className="icon-container">
              <useCase.icon strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">{useCase.title}</h3>
              <p className="text-sm text-muted-foreground leading-[1.7]">{useCase.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// =====================
// PRICING SECTION - Highlighted middle card
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
  <section id="planos" className="py-24 bg-background">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-[40px] font-bold text-foreground mb-4 tracking-[-0.01em]">
          Planos que cabem no seu bolso
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-[1.7]">
          Comece grátis. Escale quando precisar.
        </p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-start">
        {pricingPlans.map((plan, index) => (
          <div 
            key={index}
            className={`rounded-[20px] p-8 relative transition-all duration-300 ${
              plan.popular 
                ? 'bg-background scale-105 shadow-[0_20px_50px_rgba(59,107,232,0.2)] border-2 border-transparent pricing-card-popular z-10' 
                : 'bg-card border-2 border-[hsl(214,32%,91%)]'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[hsl(222,78%,57%)] to-[hsl(210,100%,60%)] text-white text-sm font-medium rounded-full shadow-lg">
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
                  <Check className="w-5 h-5 text-[hsl(160,84%,39%)]" />
                  <span className="text-foreground">{feature}</span>
                </li>
              ))}
            </ul>
            
            <Link to="/pricing">
              <Button 
                className={`w-full ${plan.popular ? 'landing-btn-primary' : ''}`}
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
    <section id="faq" className="py-24 section-gradient-light">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-[40px] font-bold text-foreground mb-4 tracking-[-0.01em]">
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
                <div className="px-6 pb-4 text-muted-foreground leading-[1.7]">
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
// FINAL CTA SECTION - Rich gradient with pattern
// =====================
const FinalCTASection = () => (
  <section className="py-24 cta-gradient relative overflow-hidden">
    {/* Pattern overlay */}
    <div className="absolute inset-0 pattern-dots" />
    
    {/* Decorative orbs */}
    <div className="orb orb-light-blue w-[300px] h-[300px] -top-20 -left-20" />
    <div className="orb orb-blue w-[250px] h-[250px] bottom-10 right-10" />
    
    <div className="container mx-auto px-4 text-center relative z-10">
      <h2 className="text-3xl md:text-[40px] font-bold text-white mb-4 tracking-[-0.01em]">
        Pronto para transformar seu atendimento?
      </h2>
      <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto leading-[1.7]">
        Junte-se a centenas de empresas que já automatizaram suas vendas no WhatsApp.
      </p>
      <Link to="/trial">
        <Button size="lg" className="text-lg px-8 py-6 rounded-xl bg-white text-[hsl(222,78%,57%)] hover:bg-white/90 shadow-[0_8px_30px_rgba(255,255,255,0.3)] hover:shadow-[0_12px_40px_rgba(255,255,255,0.4)] transition-all hover:scale-[1.02] font-semibold">
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
          <p className="text-white/60 text-sm leading-[1.7]">
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
