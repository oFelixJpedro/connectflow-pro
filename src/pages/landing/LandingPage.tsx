import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, 
  ArrowRight, 
  Menu, 
  X, 
  Clock, 
  Users, 
  BarChart3, 
  Check, 
  QrCode,
  Sparkles,
  Rocket,
  ChevronDown,
  Store,
  Scale,
  Building2,
  GraduationCap,
  HeartPulse,
  Bot,
  Smartphone,
  Globe,
  Image as ImageIcon
} from "lucide-react";

const LandingPage = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  const faqItems = [
    {
      question: "Preciso trocar meu número de WhatsApp?",
      answer: "Não. Você usa seu número atual. Basta escanear o QR Code e seu número estará conectado ao ChatGo em segundos."
    },
    {
      question: "A IA vai substituir meus atendentes?",
      answer: "Não, ela vai ajudá-los. A IA cuida de perguntas repetitivas e qualificação inicial. Atendimentos que precisam de toque humano são transferidos automaticamente para sua equipe."
    },
    {
      question: "É seguro? Minhas conversas ficam protegidas?",
      answer: "Totalmente. Usamos criptografia de ponta a ponta e seguimos todas as normas da LGPD. Seus dados e dos seus clientes estão seguros."
    },
    {
      question: "Quanto tempo leva para configurar?",
      answer: "Menos de 10 minutos para o básico. Conectar o número é instantâneo. Configurar departamentos e respostas automáticas leva alguns minutos a mais."
    },
    {
      question: "Posso cancelar a qualquer momento?",
      answer: "Sim, sem multas ou fidelidade. Você pode cancelar direto no painel, sem precisar ligar para ninguém."
    },
    {
      question: "Funciona no celular também?",
      answer: "Sim! Temos apps para iOS e Android. Sua equipe pode atender de qualquer lugar."
    }
  ];

  const features = [
    {
      number: "001",
      title: "HISTÓRICO COMPLETO",
      description: "Acesse todo o histórico de conversas de cada cliente, mesmo que outro atendente tenha iniciado.",
      dark: true
    },
    {
      number: "002",
      title: "RESPOSTAS RÁPIDAS",
      description: "Crie atalhos para mensagens frequentes. Responda em segundos, não minutos.",
      dark: false
    },
    {
      number: "003",
      title: "RELATÓRIOS DETALHADOS",
      description: "Métricas de tempo de resposta, satisfação e desempenho de cada atendente.",
      dark: true
    },
    {
      number: "004",
      title: "INTEGRAÇÕES",
      description: "Conecte com seu CRM, Zapier, Google Sheets e mais de 100 ferramentas.",
      dark: false
    }
  ];

  return (
    <div className="min-h-screen font-sans overflow-x-hidden">
      {/* ========================= */}
      {/* NAVIGATION */}
      {/* ========================= */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/90 backdrop-blur-lg shadow-sm' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-[#3B6BE8] flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-[#1E3A8A]">ChatGo</span>
            </Link>

            {/* Desktop Navigation - Underline style */}
            <div className="hidden md:flex items-center gap-8">
              <button 
                onClick={() => scrollToSection('features')} 
                className="text-[#64748B] hover:text-[#1E3A8A] transition-colors font-medium relative group"
              >
                Funcionalidades
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#3B6BE8] transition-all group-hover:w-full"></span>
              </button>
              <button 
                onClick={() => scrollToSection('how-it-works')} 
                className="text-[#64748B] hover:text-[#1E3A8A] transition-colors font-medium relative group"
              >
                Como Funciona
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#3B6BE8] transition-all group-hover:w-full"></span>
              </button>
              <button 
                onClick={() => scrollToSection('pricing')} 
                className="text-[#64748B] hover:text-[#1E3A8A] transition-colors font-medium relative group"
              >
                Planos
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#3B6BE8] transition-all group-hover:w-full"></span>
              </button>
              <button 
                onClick={() => scrollToSection('faq')} 
                className="text-[#64748B] hover:text-[#1E3A8A] transition-colors font-medium relative group"
              >
                FAQ
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#3B6BE8] transition-all group-hover:w-full"></span>
              </button>
            </div>

            {/* CTA Button */}
            <div className="hidden md:flex items-center gap-4">
              <Button
                onClick={() => navigate('/pricing')}
                className="bg-[#3B6BE8] hover:bg-[#2851B8] text-white px-6 py-2.5 rounded-full font-medium flex items-center gap-2 shadow-lg shadow-[#3B6BE8]/20 transition-all hover:shadow-xl hover:shadow-[#3B6BE8]/30"
              >
                Começar Agora
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-[#1E3A8A]"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-[#E2E8F0] shadow-lg">
            <div className="px-6 py-4 space-y-4">
              <button onClick={() => scrollToSection('features')} className="block w-full text-left text-[#64748B] hover:text-[#1E3A8A] py-2">
                Funcionalidades
              </button>
              <button onClick={() => scrollToSection('how-it-works')} className="block w-full text-left text-[#64748B] hover:text-[#1E3A8A] py-2">
                Como Funciona
              </button>
              <button onClick={() => scrollToSection('pricing')} className="block w-full text-left text-[#64748B] hover:text-[#1E3A8A] py-2">
                Planos
              </button>
              <button onClick={() => scrollToSection('faq')} className="block w-full text-left text-[#64748B] hover:text-[#1E3A8A] py-2">
                FAQ
              </button>
              <Button
                onClick={() => navigate('/pricing')}
                className="w-full bg-[#3B6BE8] hover:bg-[#2851B8] text-white rounded-full"
              >
                Começar Agora
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* ========================= */}
      {/* HERO SECTION - PAYROT STYLE */}
      {/* ========================= */}
      <section className="relative min-h-screen hero-bg-payrot overflow-hidden">
        {/* Giant Watermark "CHATGO" */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <span className="hero-watermark whitespace-nowrap">
            CHATGO
          </span>
        </div>

        {/* Decorative circle */}
        <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-[300px] h-[300px] circle-decorator opacity-30 hidden lg:block"></div>

        {/* Main Hero Content Container */}
        <div className="relative z-10 pt-32 pb-40">
          {/* Central Image Placeholder with Glow */}
          <div className="relative max-w-7xl mx-auto px-6 flex justify-center">
            <div className="relative">
              {/* Glow effect */}
              <div className="hero-glow"></div>
              
              {/* Main Image Placeholder */}
              <div className="placeholder-image w-[350px] h-[450px] md:w-[420px] md:h-[520px] lg:w-[480px] lg:h-[580px]">
                <div className="text-center">
                  <ImageIcon className="w-16 h-16 text-[#94A3B8] mb-4" />
                  <p className="text-[#64748B] font-medium">Imagem Principal</p>
                  <p className="text-[#94A3B8] text-sm mt-1">480 x 580px</p>
                </div>
              </div>
            </div>
          </div>

          {/* ========================= */}
          {/* LEFT GLASSMORPHISM CARD */}
          {/* ========================= */}
          <div className="hidden lg:block absolute left-[5%] xl:left-[10%] top-[35%] -translate-y-1/2 z-20">
            <div className="glass-card-payrot p-6 w-[280px] animate-float">
              {/* Card image placeholder */}
              <div className="placeholder-image w-full h-[140px] mb-4">
                <div className="text-center">
                  <ImageIcon className="w-8 h-8 text-[#94A3B8] mb-2" />
                  <p className="text-[#94A3B8] text-xs">Imagem Preview</p>
                </div>
              </div>
              
              {/* Card content */}
              <h3 className="text-[#1E3A8A] font-bold text-lg mb-2">Título Principal</h3>
              <p className="text-[#64748B] text-sm mb-3">Subtítulo descritivo aqui com mais informações</p>
              
              {/* Decorative line */}
              <div className="w-16 h-0.5 bg-[#E2E8F0]"></div>
            </div>
          </div>

          {/* ========================= */}
          {/* RIGHT STACKED CARDS */}
          {/* ========================= */}
          <div className="hidden lg:block absolute right-[5%] xl:right-[10%] top-[30%] z-20">
            {/* Decorative lines */}
            <div className="absolute -top-8 right-0 w-[100px] h-0.5 bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
            <div className="absolute -top-4 right-8 w-[60px] h-0.5 bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
            
            {/* Stacked cards container */}
            <div className="stacked-cards w-[260px] h-[160px] animate-float-delayed">
              {/* Card 1 - Back */}
              <div className="stacked-card stacked-card-1 w-[260px] h-[160px]"></div>
              
              {/* Card 2 - Middle */}
              <div className="stacked-card stacked-card-2 w-[260px] h-[160px]"></div>
              
              {/* Card 3 - Front */}
              <div className="stacked-card stacked-card-3 w-[260px] h-[160px] p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white/90 text-sm font-medium">Cartão Preview</span>
                </div>
                
                {/* Placeholder lines */}
                <div className="space-y-2 mt-4">
                  <div className="h-2 w-full bg-white/30 rounded"></div>
                  <div className="h-2 w-3/4 bg-white/20 rounded"></div>
                  <div className="h-2 w-1/2 bg-white/10 rounded"></div>
                </div>
                
                {/* Card number placeholder */}
                <div className="absolute bottom-4 left-5 right-5 flex justify-between items-center">
                  <div className="flex gap-1">
                    <div className="w-6 h-3 bg-white/30 rounded"></div>
                    <div className="w-6 h-3 bg-white/20 rounded"></div>
                    <div className="w-6 h-3 bg-white/20 rounded"></div>
                    <div className="w-6 h-3 bg-white/20 rounded"></div>
                  </div>
                  <div className="w-8 h-6 bg-white/20 rounded"></div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================= */}
          {/* FLOATING USERS BADGE */}
          {/* ========================= */}
          <div className="hidden lg:flex absolute left-[45%] top-[25%] z-30">
            <div className="floating-badge px-4 py-2 flex items-center gap-3">
              {/* Stacked avatars */}
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3B6BE8] to-[#60A5FA] border-2 border-white flex items-center justify-center"
                  >
                    <Users className="w-3 h-3 text-white" />
                  </div>
                ))}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-[#1E3A8A]">500+</span>
                <span className="text-xs text-[#64748B] uppercase tracking-wider">Users</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================= */}
        {/* BOTTOM SECTION (Wave Area) */}
        {/* ========================= */}
        <div className="absolute bottom-0 left-0 right-0 hero-bottom-section py-12 lg:py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-center">
              
              {/* Left Column */}
              <div className="text-center lg:text-left">
                <div className="flex items-center justify-center lg:justify-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-[#EBF0FF] flex items-center justify-center">
                    <Globe className="w-5 h-5 text-[#3B6BE8]" />
                  </div>
                  <div className="w-10 h-10 rounded-full bg-[#EBF0FF] flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-[#3B6BE8]" />
                  </div>
                </div>
                <p className="text-[#64748B] text-sm mb-2">
                  Descrição curta placeholder sobre nossos serviços
                </p>
                <button className="text-[#1E3A8A] text-sm font-semibold uppercase tracking-wider hover:underline inline-flex items-center gap-1">
                  Nossos Serviços
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              
              {/* Center Column - Main Headline */}
              <div className="text-center">
                <Button
                  onClick={() => navigate('/pricing')}
                  variant="outline"
                  className="btn-outline-payrot px-6 py-2 mb-6 text-sm font-semibold"
                >
                  Começar Agora
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight">
                  <span className="gradient-headline-payrot">ATENDIMENTO</span>
                  <br />
                  <span className="gradient-headline-payrot">INTELIGENTE</span>
                </h1>
              </div>
              
              {/* Right Column */}
              <div className="text-center lg:text-right">
                <div className="inline-block px-4 py-1.5 border border-[#1E3A8A] rounded-full text-xs font-semibold text-[#1E3A8A] uppercase tracking-wider mb-3">
                  Total de Atendimentos
                </div>
                <p className="text-5xl lg:text-6xl font-extrabold text-[#1E3A8A] mb-2">10M+</p>
                <p className="text-[#64748B] text-sm mb-2">
                  Mensagens processadas com ChatGo
                </p>
                <button className="text-[#1E3A8A] text-sm font-semibold uppercase tracking-wider hover:underline inline-flex items-center gap-1 justify-center lg:justify-end">
                  Ver Estatísticas
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              
            </div>
          </div>
        </div>
      </section>

      {/* ========================= */}
      {/* REST OF THE PAGE (Problems, Features, etc.) */}
      {/* ========================= */}
      
      {/* Problems Section */}
      <section className="py-20 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#1E3A8A] tracking-[-0.01em] mb-4">
              Seu atendimento está travando suas vendas?
            </h2>
            <p className="text-lg text-[#64748B] max-w-2xl mx-auto">
              Se você se identifica com algum desses problemas, o ChatGo foi feito para você.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Clock,
                title: "Clientes esperando horas",
                description: "Enquanto sua equipe está ocupada, leads quentes esfriam e vão para o concorrente."
              },
              {
                icon: Users,
                title: "Atendentes sem contexto",
                description: "Cada conversa começa do zero. Ninguém sabe o histórico do cliente."
              },
              {
                icon: BarChart3,
                title: "Zero visibilidade dos resultados",
                description: "Quantos leads viraram vendas? Qual atendente performa melhor? Mistério total."
              }
            ].map((problem, i) => (
              <div
                key={i}
                className="group p-8 rounded-3xl bg-white/60 backdrop-blur-xl border border-white/30 shadow-[0_8px_32px_rgba(59,107,232,0.08)] hover:shadow-[0_20px_50px_rgba(59,107,232,0.15)] hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#EBF0FF] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <problem.icon className="w-7 h-7 text-[#3B6BE8]" />
                </div>
                <h3 className="text-xl font-bold text-[#1E3A8A] mb-3">{problem.title}</h3>
                <p className="text-[#64748B] leading-relaxed">{problem.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - WHO WE SERVE style */}
      <section id="features" className="py-20 md:py-32 bg-gradient-to-b from-white to-[#F8FAFF]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#1E3A8A] tracking-[-0.01em] text-center mb-20">
            Uma plataforma completa para seu time vender mais
          </h2>

          {/* Feature Block 1 */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-24">
            <div className="relative h-[400px] rounded-3xl bg-gradient-to-br from-[#1E3A8A] to-[#3B6BE8] overflow-hidden shadow-2xl order-1">
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <div className="w-full h-full bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Users className="w-6 h-6 text-white" />
                    <span className="text-white font-semibold">Equipe Online</span>
                  </div>
                  <div className="space-y-3">
                    {['Carlos', 'Maria', 'João', 'Ana'].map((name, i) => (
                      <div key={i} className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/30 to-white/10 flex items-center justify-center text-white text-sm font-medium">
                          {name[0]}
                        </div>
                        <span className="text-white/90 text-sm">{name}</span>
                        <div className="ml-auto w-2 h-2 rounded-full bg-[#10B981]"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="order-2 space-y-6">
              <span className="text-[#3B6BE8] font-semibold uppercase tracking-wider text-sm">MULTI-ATENDIMENTO</span>
              <h3 className="text-3xl md:text-4xl font-bold text-[#1E3A8A] leading-tight">
                Toda sua equipe em um único número de WhatsApp
              </h3>
              <p className="text-[#64748B] text-lg leading-relaxed">
                Acabou a confusão de números pessoais. Todos os atendentes acessam o mesmo número, com conversas organizadas e sem perder nenhuma mensagem.
              </p>
              <ul className="space-y-4">
                {[
                  "Distribua conversas automaticamente por disponibilidade",
                  "Veja quem está atendendo quem em tempo real",
                  "Transfira conversas sem perder o histórico"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#10B981] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[#1E3A8A]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Feature Block 2 */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-24">
            <div className="space-y-6">
              <span className="text-[#3B6BE8] font-semibold uppercase tracking-wider text-sm">INTELIGÊNCIA ARTIFICIAL</span>
              <h3 className="text-3xl md:text-4xl font-bold text-[#1E3A8A] leading-tight">
                Chatbots que realmente entendem seus clientes
              </h3>
              <p className="text-[#64748B] text-lg leading-relaxed">
                Nossa IA não é aquele robô burro. Ela entende contexto, responde naturalmente e sabe quando passar para um humano.
              </p>
              <ul className="space-y-4">
                {[
                  "Responda perguntas frequentes automaticamente 24/7",
                  "Qualifique leads antes de transferir para vendedores",
                  "Aprenda com as conversas e melhore continuamente"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#10B981] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[#1E3A8A]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="relative h-[400px] rounded-3xl bg-gradient-to-br from-[#3B6BE8] to-[#60A5FA] overflow-hidden shadow-2xl">
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <div className="w-full h-full bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/30 to-white/10 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <span className="text-white font-semibold block">Assistente IA</span>
                      <span className="text-white/60 text-xs">Online</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="bg-white/20 rounded-2xl rounded-bl-none px-4 py-2 max-w-[80%]">
                      <p className="text-white text-sm">Olá! Qual produto você está interessado? 🛍️</p>
                    </div>
                    <div className="bg-white rounded-2xl rounded-br-none px-4 py-2 max-w-[80%] ml-auto">
                      <p className="text-[#1E3A8A] text-sm">Quero saber sobre o plano PRO</p>
                    </div>
                    <div className="bg-white/20 rounded-2xl rounded-bl-none px-4 py-2 max-w-[80%]">
                      <p className="text-white text-sm">O plano PRO inclui atendentes ilimitados e IA avançada! Posso te ajudar a contratar?</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Block 3 */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative h-[400px] rounded-3xl bg-gradient-to-br from-[#0F172A] to-[#1E3A8A] overflow-hidden shadow-2xl order-1 lg:order-1">
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <div className="w-full h-full bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-white font-semibold">Desempenho Semanal</span>
                    <BarChart3 className="w-5 h-5 text-white/60" />
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                      { label: 'Conversões', value: '127', trend: '+23%' },
                      { label: 'Tempo Médio', value: '2m 34s', trend: '-15%' },
                      { label: 'Satisfação', value: '98%', trend: '+5%' }
                    ].map((metric, i) => (
                      <div key={i} className="bg-white/10 rounded-xl p-3 text-center">
                        <p className="text-white/60 text-xs mb-1">{metric.label}</p>
                        <p className="text-white font-bold text-lg">{metric.value}</p>
                        <p className="text-[#10B981] text-xs">{metric.trend}</p>
                      </div>
                    ))}
                  </div>
                  <div className="h-20 flex items-end gap-1">
                    {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                      <div 
                        key={i} 
                        className="flex-1 bg-gradient-to-t from-[#3B6BE8] to-[#60A5FA] rounded-t-sm"
                        style={{ height: `${h}%` }}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="order-2 lg:order-2 space-y-6">
              <span className="text-[#3B6BE8] font-semibold uppercase tracking-wider text-sm">GERENTE COMERCIAL DEDICADO</span>
              <h3 className="text-3xl md:text-4xl font-bold text-[#1E3A8A] leading-tight">
                Insights que transformam conversas em vendas
              </h3>
              <p className="text-[#64748B] text-lg leading-relaxed">
                Nosso gerente comercial virtual analisa cada conversa e te mostra exatamente onde melhorar para fechar mais negócios.
              </p>
              <ul className="space-y-4">
                {[
                  "Análise em tempo real de cada atendimento",
                  "Identificação de gargalos e oportunidades perdidas",
                  "Relatórios semanais com recomendações práticas"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#10B981] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-[#1E3A8A]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Banner - Do it right & everywhere */}
      <section className="py-16 md:py-24 bg-[#1E3A8A] relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-6">
              Acesse de qualquer lugar
            </h2>
            <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8">
              Web, iOS ou Android. Seu atendimento na palma da mão.
            </p>
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
                <Smartphone className="w-5 h-5 text-white" />
                <span className="text-white text-sm font-medium">iOS & Android</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
                <Globe className="w-5 h-5 text-white" />
                <span className="text-white text-sm font-medium">Web App</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-20 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#1E3A8A] tracking-[-0.01em] mb-4">
              Comece em 3 passos simples
            </h2>
            <p className="text-lg text-[#64748B] max-w-2xl mx-auto">
              Sem configurações complicadas. Sem necessidade de técnico. Você mesmo faz.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connector line - hidden on mobile */}
            <div className="step-connector"></div>
            
            {[
              {
                step: "01",
                icon: QrCode,
                title: "Conecte seu WhatsApp",
                description: "Escaneie o QR Code com o celular. Pronto, seu número está conectado."
              },
              {
                step: "02",
                icon: Users,
                title: "Adicione sua equipe",
                description: "Convide seus atendentes por email. Eles recebem acesso instantâneo."
              },
              {
                step: "03",
                icon: Rocket,
                title: "Comece a atender",
                description: "Suas conversas aparecem na central. Distribua entre a equipe e venda mais."
              }
            ].map((item, i) => (
              <div key={i} className="relative group">
                <div className="text-center p-8 rounded-3xl bg-white shadow-[0_8px_32px_rgba(59,107,232,0.08)] hover:shadow-[0_20px_50px_rgba(59,107,232,0.15)] transition-all duration-300">
                  <div className="relative inline-flex items-center justify-center mb-6">
                    <span className="step-number text-6xl">{item.step}</span>
                  </div>
                  <div className="w-16 h-16 rounded-2xl bg-[#EBF0FF] flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <item.icon className="w-8 h-8 text-[#3B6BE8]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#1E3A8A] mb-3">{item.title}</h3>
                  <p className="text-[#64748B]">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who It's For Section */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-white to-[#F8FAFF]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#1E3A8A] tracking-[-0.01em] mb-4">
              Feito para quem vende pelo WhatsApp
            </h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {[
              { icon: Store, label: "E-commerces" },
              { icon: Scale, label: "Advogados" },
              { icon: Building2, label: "Imobiliárias" },
              { icon: GraduationCap, label: "Escolas" },
              { icon: HeartPulse, label: "Clínicas" },
              { icon: Sparkles, label: "Serviços" }
            ].map((item, i) => (
              <div 
                key={i}
                className="group p-6 rounded-2xl bg-white shadow-sm hover:shadow-lg border border-[#E2E8F0] hover:border-[#3B6BE8]/30 transition-all duration-300 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-[#EBF0FF] flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <item.icon className="w-6 h-6 text-[#3B6BE8]" />
                </div>
                <span className="text-[#1E3A8A] font-semibold">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features List */}
      <section className="py-20 md:py-32 bg-[#F8FAFF]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, i) => (
              <div 
                key={i}
                className={`p-8 rounded-3xl ${feature.dark ? 'bg-[#1E3A8A] text-white' : 'bg-white text-[#1E3A8A]'} shadow-lg`}
              >
                <span className={`text-sm font-mono ${feature.dark ? 'text-white/60' : 'text-[#3B6BE8]'}`}>
                  {feature.number}
                </span>
                <h3 className="text-2xl font-bold mt-2 mb-4">{feature.title}</h3>
                <p className={feature.dark ? 'text-white/80' : 'text-[#64748B]'}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#1E3A8A] tracking-[-0.01em] mb-4">
              Planos que cabem no seu bolso
            </h2>
            <p className="text-lg text-[#64748B] max-w-2xl mx-auto">
              Comece grátis por 7 dias. Sem cartão de crédito.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: "Starter",
                price: "97",
                description: "Para quem está começando",
                features: ["3 atendentes", "1 número WhatsApp", "500 conversas/mês", "Suporte por email"],
                popular: false
              },
              {
                name: "Pro",
                price: "197",
                description: "Para equipes em crescimento",
                features: ["10 atendentes", "3 números WhatsApp", "Conversas ilimitadas", "IA avançada", "Suporte prioritário"],
                popular: true
              },
              {
                name: "Enterprise",
                price: "397",
                description: "Para grandes operações",
                features: ["Atendentes ilimitados", "Números ilimitados", "API completa", "Gerente dedicado", "SLA garantido"],
                popular: false
              }
            ].map((plan, i) => (
              <div 
                key={i}
                className={`relative p-8 rounded-3xl ${
                  plan.popular 
                    ? 'bg-white pricing-card-popular shadow-2xl scale-105' 
                    : 'bg-white shadow-lg border border-[#E2E8F0]'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#3B6BE8] to-[#60A5FA] text-white text-sm font-semibold rounded-full">
                    Mais popular
                  </div>
                )}
                <h3 className="text-xl font-bold text-[#1E3A8A] mb-2">{plan.name}</h3>
                <p className="text-[#64748B] text-sm mb-4">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-extrabold text-[#1E3A8A]">R${plan.price}</span>
                  <span className="text-[#64748B]">/mês</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-[#64748B]">
                      <Check className="w-5 h-5 text-[#10B981]" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => navigate('/pricing')}
                  className={`w-full py-6 rounded-xl font-semibold ${
                    plan.popular 
                      ? 'bg-[#3B6BE8] hover:bg-[#2851B8] text-white shadow-lg shadow-[#3B6BE8]/30' 
                      : 'bg-[#EBF0FF] hover:bg-[#3B6BE8] text-[#3B6BE8] hover:text-white'
                  }`}
                >
                  Começar agora
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 md:py-32 bg-gradient-to-b from-white to-[#F8FAFF]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#1E3A8A] tracking-[-0.01em] mb-4">
              Perguntas frequentes
            </h2>
          </div>

          <div className="space-y-4">
            {faqItems.map((item, i) => (
              <div 
                key={i}
                className="bg-white rounded-2xl shadow-sm border border-[#E2E8F0] overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4"
                >
                  <span className="font-semibold text-[#1E3A8A]">{item.question}</span>
                  <ChevronDown className={`w-5 h-5 text-[#64748B] transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5">
                    <p className="text-[#64748B] leading-relaxed">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-32 cta-gradient relative">
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-6">
            Pronto para transformar seu atendimento?
          </h2>
          <p className="text-xl text-white/80 mb-8">
            Junte-se a mais de 500 empresas que já usam o ChatGo para vender mais.
          </p>
          <Button
            onClick={() => navigate('/pricing')}
            className="bg-white text-[#1E3A8A] hover:bg-white/90 px-8 py-6 text-lg rounded-full font-semibold shadow-2xl hover:scale-105 transition-all"
          >
            Começar teste grátis de 7 dias
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <p className="text-white/60 text-sm mt-4">
            Sem cartão de crédito • Cancele a qualquer momento
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0F172A] text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12">
            {/* Logo & Description */}
            <div className="md:col-span-2">
              <Link to="/" className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#3B6BE8] flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">ChatGo</span>
              </Link>
              <p className="text-white/60 max-w-sm">
                A plataforma completa para transformar seu WhatsApp em uma central de atendimento inteligente.
              </p>
            </div>
            
            {/* Product Links */}
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-white/60">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors">Funcionalidades</button></li>
                <li><button onClick={() => scrollToSection('pricing')} className="hover:text-white transition-colors">Preços</button></li>
                <li><button onClick={() => scrollToSection('faq')} className="hover:text-white transition-colors">FAQ</button></li>
              </ul>
            </div>
            
            {/* Legal Links */}
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-white/60">
                <li><a href="#" className="hover:text-white transition-colors">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacidade</a></li>
                <li><a href="#" className="hover:text-white transition-colors">LGPD</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/10 mt-12 pt-8 text-center text-white/40">
            <p>© {new Date().getFullYear()} ChatGo. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
