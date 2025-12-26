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
  Smartphone
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
    <div className="min-h-screen bg-gradient-to-b from-[#E8F4FC] via-[#F5F9FF] to-white font-sans overflow-x-hidden">
      {/* Navigation */}
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

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <button onClick={() => scrollToSection('features')} className="text-[#64748B] hover:text-[#1E3A8A] transition-colors font-medium">
                Funcionalidades
              </button>
              <button onClick={() => scrollToSection('how-it-works')} className="text-[#64748B] hover:text-[#1E3A8A] transition-colors font-medium">
                Como Funciona
              </button>
              <button onClick={() => scrollToSection('pricing')} className="text-[#64748B] hover:text-[#1E3A8A] transition-colors font-medium">
                Planos
              </button>
              <button onClick={() => scrollToSection('faq')} className="text-[#64748B] hover:text-[#1E3A8A] transition-colors font-medium">
                FAQ
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

      {/* Hero Section */}
      <section className="relative min-h-screen pt-24 pb-20 overflow-hidden">
        {/* Giant Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <span className="text-[20vw] font-black text-[#1E3A8A]/[0.03] tracking-tight select-none whitespace-nowrap">
            CHATGO
          </span>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[80vh]">
            {/* Left Content */}
            <div className="space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-xl border border-white/30 shadow-lg">
                <Sparkles className="w-4 h-4 text-[#3B6BE8]" />
                <span className="text-sm font-medium text-[#1E3A8A]">Inteligência Artificial Integrada</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl md:text-5xl lg:text-[56px] font-extrabold text-[#1E3A8A] leading-[1.1] tracking-[-0.02em]">
                Transforme seu WhatsApp em uma Central de Atendimento Inteligente
              </h1>

              {/* Subheadline */}
              <p className="text-lg md:text-xl text-[#64748B] leading-relaxed max-w-xl">
                Múltiplos atendentes em um único número. Chatbots com IA que entendem seus clientes. E um gerente comercial dedicado para otimizar seus resultados.
              </p>

              {/* CTA */}
              <div className="space-y-4">
                <Button
                  onClick={() => navigate('/pricing')}
                  className="bg-[#3B6BE8] hover:bg-[#2851B8] text-white px-8 py-6 text-lg rounded-full font-semibold flex items-center gap-3 shadow-xl shadow-[#3B6BE8]/25 transition-all hover:shadow-2xl hover:shadow-[#3B6BE8]/30 hover:scale-[1.02]"
                >
                  Testar Grátis por 7 Dias
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <p className="text-sm text-[#64748B]">
                  Sem cartão de crédito • Setup em 5 minutos
                </p>
              </div>

              {/* Social Proof */}
              <div className="flex items-center gap-4 pt-4">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3B6BE8] to-[#60A5FA] border-2 border-white flex items-center justify-center"
                    >
                      <Users className="w-4 h-4 text-white" />
                    </div>
                  ))}
                </div>
                <div>
                  <span className="text-lg font-bold text-[#1E3A8A]">500+</span>
                  <span className="text-[#64748B] ml-2">empresas já automatizaram</span>
                </div>
              </div>
            </div>

            {/* Right Content - Floating Cards */}
            <div className="relative h-[600px] hidden lg:block">
              {/* Main Chat Interface Card */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] bg-white/70 backdrop-blur-2xl rounded-3xl shadow-[0_20px_50px_rgba(59,107,232,0.15)] border border-white/50 overflow-hidden">
                {/* Header */}
                <div className="bg-white/80 px-6 py-4 border-b border-[#E2E8F0]">
                  <h3 className="font-semibold text-[#1E3A8A]">Caixa de Entrada</h3>
                  <p className="text-sm text-[#64748B]">3 conversas ativas</p>
                </div>
                
                {/* Conversations */}
                <div className="p-4 space-y-3">
                  {[
                    { name: "Maria Silva", message: "Olá, gostaria de saber sobre...", status: "online", unread: 2 },
                    { name: "João Santos", message: "Obrigado pelo atendimento!", status: "responded", unread: 0 },
                    { name: "Ana Costa", message: "Quando posso agendar?", status: "pending", unread: 1 }
                  ].map((chat, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-white/80 hover:bg-white transition-colors cursor-pointer">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3B6BE8] to-[#60A5FA] flex items-center justify-center text-white font-semibold">
                          {chat.name.charAt(0)}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${
                          chat.status === 'online' ? 'bg-[#10B981]' : 
                          chat.status === 'responded' ? 'bg-[#3B6BE8]' : 'bg-[#F59E0B]'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[#1E3A8A]">{chat.name}</span>
                          {chat.unread > 0 && (
                            <span className="w-5 h-5 rounded-full bg-[#3B6BE8] text-white text-xs flex items-center justify-center">
                              {chat.unread}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[#64748B] truncate">{chat.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating Card - AI Bot */}
              <div className="absolute top-16 right-0 bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl p-4 flex items-center gap-3 animate-float border border-white/50">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B6BE8] to-[#60A5FA] flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1E3A8A]">IA respondendo...</p>
                  <p className="text-xs text-[#64748B]">Qualificando lead</p>
                </div>
              </div>

              {/* Floating Card - Stats */}
              <div className="absolute bottom-24 left-0 bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl p-4 animate-float border border-white/50" style={{ animationDelay: '1s' }}>
                <p className="text-3xl font-bold text-[#1E3A8A]">847</p>
                <p className="text-sm text-[#64748B]">Atendimentos hoje</p>
              </div>

              {/* Floating Card - Agent */}
              <div className="absolute top-32 left-8 bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl p-4 flex items-center gap-3 animate-float border border-white/50" style={{ animationDelay: '0.5s' }}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#10B981] to-[#34D399] flex items-center justify-center text-white font-semibold">
                  J
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1E3A8A]">João está atendendo</p>
                  <p className="text-xs text-[#10B981]">Online agora</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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
                      <div key={i} className="flex items-center gap-3 p-3 bg-white/10 rounded-xl">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-medium">
                          {name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium">{name}</p>
                          <p className="text-white/60 text-sm">{i + 2} conversas ativas</p>
                        </div>
                        <div className="w-3 h-3 rounded-full bg-[#10B981]" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="order-2">
              <p className="text-sm font-semibold text-[#3B6BE8] tracking-wider mb-4">MULTIATENDIMENTO</p>
              <h3 className="text-2xl md:text-3xl font-bold text-[#1E3A8A] mb-6">
                Todo seu time no mesmo número de WhatsApp
              </h3>
              <p className="text-[#64748B] text-lg leading-relaxed mb-6">
                Distribua conversas automaticamente entre atendentes. Transfira chats entre departamentos. Mantenha o histórico completo.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Atendentes ilimitados no mesmo número",
                  "Distribuição inteligente por disponibilidade",
                  "Transferência entre setores com contexto"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#3B6BE8] flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[#475569]">{item}</span>
                  </li>
                ))}
              </ul>
              <button className="text-[#3B6BE8] font-semibold flex items-center gap-2 hover:gap-3 transition-all group">
                SAIBA MAIS
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* Feature Block 2 */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-24">
            <div className="order-2 lg:order-1">
              <p className="text-sm font-semibold text-[#3B6BE8] tracking-wider mb-4">INTELIGÊNCIA ARTIFICIAL</p>
              <h3 className="text-2xl md:text-3xl font-bold text-[#1E3A8A] mb-6">
                Chatbot que realmente entende seus clientes
              </h3>
              <p className="text-[#64748B] text-lg leading-relaxed mb-6">
                Esqueça bots robóticos. Nossa IA conversa naturalmente, qualifica leads e só transfere para humanos quando necessário.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Respostas naturais 24/7",
                  "Qualificação automática de leads",
                  "Aprende com suas conversas"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#3B6BE8] flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[#475569]">{item}</span>
                  </li>
                ))}
              </ul>
              <button className="text-[#3B6BE8] font-semibold flex items-center gap-2 hover:gap-3 transition-all group">
                SAIBA MAIS
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            <div className="relative h-[400px] rounded-3xl bg-gradient-to-br from-[#3B6BE8] to-[#60A5FA] overflow-hidden shadow-2xl order-1 lg:order-2">
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#EBF0FF] flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-[#3B6BE8]" />
                    </div>
                    <div className="bg-[#F1F5F9] rounded-2xl rounded-tl-none px-4 py-3">
                      <p className="text-sm text-[#475569]">Olá! Gostaria de saber mais sobre os planos</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 justify-end">
                    <div className="bg-[#3B6BE8] rounded-2xl rounded-tr-none px-4 py-3">
                      <p className="text-sm text-white">Olá! Claro, ficarei feliz em ajudar. Temos 3 planos disponíveis. Qual é o tamanho da sua equipe?</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#3B6BE8] flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#64748B]">
                    <Sparkles className="w-3 h-3 text-[#3B6BE8]" />
                    IA respondendo automaticamente
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Block 3 */}
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative h-[400px] rounded-3xl bg-gradient-to-br from-[#0F172A] to-[#1E3A8A] overflow-hidden shadow-2xl order-1">
              <div className="absolute inset-0 flex items-center justify-center p-8">
                <div className="w-full h-full bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-white font-semibold">Dashboard Comercial</span>
                    <span className="text-[#10B981] text-sm">+23% este mês</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white/10 rounded-xl p-4">
                      <p className="text-2xl font-bold text-white">1.234</p>
                      <p className="text-white/60 text-sm">Leads qualificados</p>
                    </div>
                    <div className="bg-white/10 rounded-xl p-4">
                      <p className="text-2xl font-bold text-[#10B981]">89%</p>
                      <p className="text-white/60 text-sm">Taxa de resposta</p>
                    </div>
                  </div>
                  <div className="h-24 flex items-end gap-2">
                    {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                      <div key={i} className="flex-1 bg-[#3B6BE8] rounded-t-lg" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="order-2">
              <p className="text-sm font-semibold text-[#3B6BE8] tracking-wider mb-4">GERENTE COMERCIAL DEDICADO</p>
              <h3 className="text-2xl md:text-3xl font-bold text-[#1E3A8A] mb-6">
                Seu parceiro para otimizar resultados
              </h3>
              <p className="text-[#64748B] text-lg leading-relaxed mb-6">
                Não é só software. Você tem um especialista analisando seus dados e ajudando seu time a converter mais.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Reuniões mensais de acompanhamento",
                  "Análise de métricas e conversão",
                  "Sugestões personalizadas de melhoria"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#3B6BE8] flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-[#475569]">{item}</span>
                  </li>
                ))}
              </ul>
              <button className="text-[#3B6BE8] font-semibold flex items-center gap-2 hover:gap-3 transition-all group">
                SAIBA MAIS
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Banner - GROW BEYOND BORDERS style */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="relative bg-[#0F172A] rounded-[32px] overflow-hidden py-20 px-8 md:px-16">
            {/* Floating Icon */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#3B6BE8] to-[#60A5FA] flex items-center justify-center shadow-2xl">
                <Smartphone className="w-10 h-10 text-white" />
              </div>
            </div>
            
            <div className="text-center pt-8">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-6 tracking-[-0.01em]">
                Atenda de qualquer lugar, a qualquer hora
              </h2>
              <p className="text-lg text-white/70 max-w-2xl mx-auto mb-10">
                Seu time pode responder clientes pelo celular, tablet ou computador. A conversa nunca para.
              </p>
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white hover:text-[#0F172A] px-8 py-6 rounded-full text-lg font-medium transition-all"
              >
                Ver Demonstração
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#1E3A8A] tracking-[-0.01em] mb-4">
              Funcionando em menos de 10 minutos
            </h2>
            <p className="text-lg text-[#64748B]">
              Sem instalação. Sem configuração técnica. Só conectar e atender.
            </p>
          </div>

          <div className="relative">
            {/* Connector Line (Desktop) */}
            <div className="hidden md:block absolute top-16 left-[12.5%] right-[12.5%] h-[2px] border-b-2 border-dashed border-[#CBD5E1]" />
            
            <div className="grid md:grid-cols-4 gap-8 relative">
              {[
                { number: "01", icon: QrCode, title: "Conecte seu WhatsApp", desc: "Escaneie o QR Code. Pronto, seu número está integrado." },
                { number: "02", icon: Users, title: "Adicione sua equipe", desc: "Convide atendentes por email. Defina departamentos em cliques." },
                { number: "03", icon: Sparkles, title: "Configure o chatbot", desc: "Ative a IA, personalize respostas e defina regras de transferência." },
                { number: "04", icon: Rocket, title: "Comece a vender mais", desc: "Sua equipe já pode atender. Acompanhe métricas em tempo real." }
              ].map((step, i) => (
                <div key={i} className="text-center relative">
                  {/* Number Circle */}
                  <div className="w-12 h-12 rounded-full border-2 border-[#3B6BE8] flex items-center justify-center mx-auto mb-6 bg-white relative z-10">
                    <span className="text-[#3B6BE8] font-bold text-sm">{step.number}</span>
                  </div>
                  
                  {/* Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-[#EBF0FF] flex items-center justify-center mx-auto mb-6">
                    <step.icon className="w-8 h-8 text-[#3B6BE8]" />
                  </div>
                  
                  <h3 className="text-lg font-bold text-[#1E3A8A] mb-3">{step.title}</h3>
                  <p className="text-[#64748B] text-sm leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center mt-16">
            <Button
              onClick={() => navigate('/pricing')}
              className="bg-[#3B6BE8] hover:bg-[#2851B8] text-white px-8 py-6 rounded-full text-lg font-medium shadow-xl shadow-[#3B6BE8]/20"
            >
              Começar Minha Configuração
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Who It's For Section */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-white to-[#F8FAFF]">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#1E3A8A] tracking-[-0.01em] text-center mb-16">
            Ideal para quem leva atendimento a sério
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Store, title: "Lojas e E-commerces", desc: "Responda pedidos e processe trocas automaticamente" },
              { icon: Scale, title: "Escritórios e Consultórios", desc: "Agende consultas e mantenha comunicação profissional" },
              { icon: Building2, title: "Empresas de Serviços", desc: "Gerencie orçamentos e fidelize clientes" },
              { icon: GraduationCap, title: "Escolas e Cursos", desc: "Atenda alunos e gerencie matrículas" },
              { icon: HeartPulse, title: "Clínicas e Saúde", desc: "Confirme consultas e humanize o atendimento" },
              { icon: Rocket, title: "Startups e PMEs", desc: "Escale atendimento sem escalar custos" }
            ].map((item, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white hover:shadow-lg transition-shadow border border-[#E2E8F0]">
                <div className="w-12 h-12 rounded-xl bg-[#EBF0FF] flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-[#3B6BE8]" />
                </div>
                <h3 className="text-lg font-bold text-[#1E3A8A] mb-2">{item.title}</h3>
                <p className="text-[#64748B] text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features List - Payrot numbered style */}
      <section className="py-20 md:py-32 bg-white relative overflow-hidden">
        {/* Giant Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[15vw] font-black text-[#1E3A8A]/[0.03] tracking-tight select-none">
            FEATURES
          </span>
        </div>

        <div className="max-w-5xl mx-auto px-6 relative z-10">
          {features.map((feature, i) => (
            <div key={i} className="flex items-center gap-6 md:gap-12 py-8 border-b border-[#E2E8F0] last:border-0">
              {/* Number */}
              <div className="w-16 h-16 rounded-full border-2 border-[#3B6BE8] flex items-center justify-center flex-shrink-0">
                <span className="text-[#3B6BE8] font-bold text-sm">{feature.number}</span>
              </div>
              
              {/* Content */}
              <div className="flex-1">
                <h3 className="text-xl md:text-2xl font-extrabold text-[#1E3A8A] tracking-[-0.01em] mb-1">
                  {feature.title}
                </h3>
                <p className="text-[#64748B] hidden md:block">{feature.description}</p>
              </div>
              
              {/* Arrow Button */}
              <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${
                feature.dark ? 'bg-[#0F172A]' : 'bg-[#CBD5E1]'
              }`}>
                <ArrowRight className={`w-5 h-5 ${feature.dark ? 'text-white' : 'text-[#0F172A]'}`} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 md:py-32 bg-gradient-to-b from-[#F8FAFF] to-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#1E3A8A] tracking-[-0.01em] mb-4">
              Planos que cabem no seu bolso
            </h2>
            <p className="text-lg text-[#64748B]">
              Comece grátis. Escale quando precisar.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                name: "Mensal",
                price: "R$ 694",
                period: "/mês",
                desc: "Flexibilidade total",
                features: ["5 atendentes", "1 número WhatsApp", "IA básica", "Histórico 90 dias", "Suporte por email"],
                highlighted: false
              },
              {
                name: "Semestral",
                price: "R$ 437",
                period: "/mês",
                desc: "6x R$ 437",
                features: ["10 atendentes", "3 números WhatsApp", "IA avançada", "Histórico ilimitado", "Integrações", "Suporte prioritário"],
                highlighted: true
              },
              {
                name: "Anual",
                price: "R$ 347",
                period: "/mês",
                desc: "12x R$ 347",
                features: ["Atendentes ilimitados", "Números ilimitados", "IA customizada", "API completa", "Gerente dedicado", "SLA garantido"],
                highlighted: false
              }
            ].map((plan, i) => (
              <div
                key={i}
                className={`relative p-8 rounded-3xl transition-all duration-300 ${
                  plan.highlighted
                    ? 'bg-white shadow-[0_20px_50px_rgba(59,107,232,0.2)] scale-105 border-2 border-[#3B6BE8]'
                    : 'bg-white border border-[#E2E8F0] hover:shadow-lg'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#3B6BE8] to-[#60A5FA] text-white text-sm font-medium">
                    Mais Popular
                  </div>
                )}
                
                <h3 className="text-xl font-bold text-[#1E3A8A] mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-extrabold text-[#1E3A8A]">{plan.price}</span>
                  <span className="text-[#64748B]">{plan.period}</span>
                </div>
                <p className="text-[#64748B] text-sm mb-6">{plan.desc}</p>
                
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-[#10B981]" />
                      <span className="text-[#475569] text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  onClick={() => navigate('/pricing')}
                  className={`w-full py-6 rounded-xl font-medium ${
                    plan.highlighted
                      ? 'bg-[#3B6BE8] hover:bg-[#2851B8] text-white'
                      : 'bg-white border border-[#3B6BE8] text-[#3B6BE8] hover:bg-[#EBF0FF]'
                  }`}
                >
                  {plan.highlighted ? 'Assinar Agora' : 'Ver Detalhes'}
                </Button>
              </div>
            ))}
          </div>

          <p className="text-center text-[#64748B] mt-12">
            Todos os planos incluem 7 dias grátis. Cancele quando quiser.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 md:py-32 bg-[#F8FAFC]">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[#1E3A8A] tracking-[-0.01em] text-center mb-16">
            Dúvidas Frequentes
          </h2>

          <div className="space-y-4">
            {faqItems.map((item, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <span className="font-semibold text-[#1E3A8A]">{item.question}</span>
                  <ChevronDown className={`w-5 h-5 text-[#64748B] transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6">
                    <p className="text-[#64748B] leading-relaxed">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-32 bg-gradient-to-br from-[#1E3A8A] via-[#3B6BE8] to-[#60A5FA]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white tracking-[-0.01em] mb-6">
            Pronto para transformar seu atendimento?
          </h2>
          <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto">
            Junte-se a centenas de empresas que já automatizaram suas vendas no WhatsApp.
          </p>
          <Button
            onClick={() => navigate('/pricing')}
            className="bg-white text-[#3B6BE8] hover:bg-white/90 px-10 py-6 rounded-full text-lg font-semibold shadow-2xl shadow-black/20 hover:scale-[1.02] transition-all"
          >
            Começar Meu Teste Grátis
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <p className="text-white/60 mt-6 text-sm">
            7 dias grátis • Sem cartão • Setup em 5 minutos
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0F172A] text-white py-16 relative overflow-hidden">
        {/* Watermark */}
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none overflow-hidden">
          <span className="block text-[15vw] font-black text-white/[0.02] tracking-tight text-center -mb-[5vw]">
            CHATGO
          </span>
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Logo & Description */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#3B6BE8] flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">ChatGo</span>
              </div>
              <p className="text-white/60 text-sm leading-relaxed">
                Transformando a comunicação empresarial com inteligência artificial e automação.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-3 text-white/60">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors">Funcionalidades</button></li>
                <li><button onClick={() => scrollToSection('pricing')} className="hover:text-white transition-colors">Preços</button></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrações</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold mb-4">Empresa</h4>
              <ul className="space-y-3 text-white/60">
                <li><a href="#" className="hover:text-white transition-colors">Sobre</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Carreiras</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contato</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-3 text-white/60">
                <li><a href="#" className="hover:text-white transition-colors">Termos de Uso</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacidade</a></li>
                <li><a href="#" className="hover:text-white transition-colors">LGPD</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8">
            <p className="text-white/40 text-sm text-center">
              © 2025 ChatGo. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
