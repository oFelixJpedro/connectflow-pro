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
  Image as ImageIcon,
  Send,
  CreditCard,
  Zap
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
    <div className="main-container overflow-hidden">
      {/* ========================= */}
      {/* FOLD 1 - HERO SECTION (PAYROT STRUCTURE) */}
      {/* ========================= */}
      <div className="relative w-full min-h-screen bg-[rgba(0,0,0,0)] overflow-hidden">
        
        {/* Background gradient image placeholder */}
        <div 
          className="absolute top-0 left-0 right-0 h-[35%] bg-gradient-to-b from-[#e8f4fc] via-[#f0f7fc] to-transparent z-[1]"
        />
        
        {/* Bottom background gradient */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-[70%] bg-gradient-to-t from-[#d4e9f7] via-[#e5f1fa] to-transparent z-[2]"
        />

        {/* ========================= */}
        {/* NAVBAR - Top section */}
        {/* ========================= */}
        <div className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
          scrolled ? 'bg-white/90 backdrop-blur-lg shadow-sm' : 'bg-transparent'
        }`}>
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center gap-2">
                <div className="w-[9px] h-[10px] md:w-[12px] md:h-[14px] bg-gradient-to-br from-[#3B6BE8] to-[#1E3A8A] rounded-sm" />
                <span className="font-['Inter'] text-[12px] md:text-[14px] font-light text-[#7b8fa2]">
                  CHATGO
                </span>
              </div>

              {/* Desktop Nav Links */}
              <div className="hidden md:flex items-center gap-6">
                <span 
                  onClick={() => scrollToSection('features')}
                  className="font-['Inter'] text-[11px] font-normal text-[#9bb6cc] cursor-pointer hover:text-[#3B6BE8] transition-colors"
                >
                  Recursos
                </span>
                <span 
                  onClick={() => scrollToSection('how-it-works')}
                  className="font-['Inter'] text-[11px] font-normal text-[#9bb7ce] cursor-pointer hover:text-[#3B6BE8] transition-colors"
                >
                  Empresas
                </span>
                <span 
                  onClick={() => scrollToSection('pricing')}
                  className="font-['Inter'] text-[11px] font-light text-[#93b1c9] cursor-pointer hover:text-[#3B6BE8] transition-colors"
                >
                  Marketplace
                </span>
                <span 
                  onClick={() => scrollToSection('faq')}
                  className="font-['Inter'] text-[11px] font-light text-[#8dabc4] cursor-pointer hover:text-[#3B6BE8] transition-colors"
                >
                  FAQ
                </span>
              </div>

              {/* CTA Button */}
              <div className="hidden md:block">
                <button 
                  onClick={() => navigate('/auth')}
                  className="bg-[#1e80f1] rounded-[9px] border border-[#2d85ed] px-4 py-2 flex items-center gap-2"
                >
                  <span className="font-['Inter'] text-[10px] font-light text-[#75b7ea]">
                    Contato
                  </span>
                  <div className="w-[11px] h-[4px] bg-white/60 rounded-sm" />
                </button>
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
            <div className="md:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-[#E2E8F0] shadow-lg z-[101]">
              <div className="px-6 py-4 space-y-4">
                <button onClick={() => scrollToSection('features')} className="block w-full text-left text-[#64748B] hover:text-[#1E3A8A] py-2">
                  Recursos
                </button>
                <button onClick={() => scrollToSection('how-it-works')} className="block w-full text-left text-[#64748B] hover:text-[#1E3A8A] py-2">
                  Empresas
                </button>
                <button onClick={() => scrollToSection('pricing')} className="block w-full text-left text-[#64748B] hover:text-[#1E3A8A] py-2">
                  Marketplace
                </button>
                <button onClick={() => scrollToSection('faq')} className="block w-full text-left text-[#64748B] hover:text-[#1E3A8A] py-2">
                  FAQ
                </button>
                <Button
                  onClick={() => navigate('/auth')}
                  className="w-full bg-[#1e80f1] hover:bg-[#1670d1] text-white rounded-full"
                >
                  Contato
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ========================= */}
        {/* GIANT WATERMARK "CHATGO" */}
        {/* ========================= */}
        <div className="absolute top-[80px] left-0 right-0 flex justify-center z-[3] pointer-events-none">
          <span className="font-['Inter'] text-[60px] md:text-[92px] lg:text-[120px] font-light leading-[1] text-[#e4edf5] tracking-[0.2em] whitespace-nowrap">
            CHATGO
          </span>
        </div>

        {/* ========================= */}
        {/* MAIN HERO CONTENT */}
        {/* ========================= */}
        <div className="relative z-[10] pt-[160px] md:pt-[180px] lg:pt-[200px] px-4 md:px-8">
          <div className="max-w-7xl mx-auto">
            
            {/* Hero content row */}
            <div className="relative flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-4">
              
              {/* ========================= */}
              {/* LEFT CARD - Glassmorphism (like Payrot left card) */}
              {/* ========================= */}
              <div className="relative w-full lg:w-[280px] order-2 lg:order-1">
                {/* Small icons above */}
                <div className="hidden lg:flex items-center gap-2 mb-4">
                  <div className="w-[62px] h-[61px] rounded-full bg-gradient-to-br from-[#3B6BE8] to-[#60A5FA] flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                </div>

                {/* Main glass card */}
                <div className="bg-white/80 backdrop-blur-xl rounded-[20px] border border-white/50 shadow-[0_20px_50px_rgba(59,107,232,0.12)] p-5 relative">
                  {/* Card image placeholder */}
                  <div className="w-full h-[100px] bg-gradient-to-br from-[#e8f4fc] to-[#d4e9f7] rounded-[12px] flex items-center justify-center mb-4">
                    <ImageIcon className="w-8 h-8 text-[#94A3B8]" />
                  </div>
                  
                  {/* Card text */}
                  <span className="block font-['Inter'] text-[12px] font-light leading-[14px] text-[#748695] mb-1">
                    Envie e Receba
                  </span>
                  <span className="block font-['Inter'] text-[14px] font-light leading-[16px] text-[#bfc8ce]">
                    Mensagens Globalmente
                    <br />
                    Rápido, Seguro e
                    <br />
                    Sem Complicação
                  </span>
                </div>

                {/* Floating badge - Users count */}
                <div className="absolute -top-4 -right-4 lg:top-auto lg:-right-8 lg:bottom-[60%] z-[20]">
                  <div className="bg-[#eff5fa] rounded-[9px] border border-[#d4e1f1] px-3 py-2 flex items-center gap-2">
                    <div className="flex -space-x-2">
                      <div className="w-[14px] h-[14px] rounded-full bg-gradient-to-br from-[#3B6BE8] to-[#1E3A8A]" />
                      <div className="w-[14px] h-[14px] rounded-full bg-gradient-to-br from-[#60A5FA] to-[#3B6BE8]" />
                      <div className="w-[14px] h-[14px] rounded-full bg-gradient-to-br from-[#93C5FD] to-[#60A5FA]" />
                    </div>
                    <span className="font-['Inter'] text-[10px] font-light text-[#8da1b2]">
                      7M+
                    </span>
                  </div>
                </div>
              </div>

              {/* ========================= */}
              {/* CENTER - Main headline area with central image */}
              {/* ========================= */}
              <div className="flex-1 text-center order-1 lg:order-2 max-w-[500px]">
                {/* Central image placeholder */}
                <div className="relative mx-auto mb-6">
                  <div className="w-[200px] h-[200px] md:w-[280px] md:h-[280px] lg:w-[320px] lg:h-[320px] mx-auto bg-gradient-to-br from-[#c5d8e8] to-[#dce9f4] rounded-[24px] flex items-center justify-center relative overflow-hidden">
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-gradient-radial from-[#3B6BE8]/10 to-transparent opacity-50" />
                    <div className="text-center">
                      <ImageIcon className="w-12 h-12 md:w-16 md:h-16 text-[#94A3B8] mx-auto mb-2" />
                      <span className="font-['Inter'] text-[10px] md:text-[12px] font-light text-[#8797a3]">
                        Imagem Principal
                      </span>
                    </div>
                  </div>
                  
                  {/* Circle decorator behind */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] md:w-[350px] md:h-[350px] rounded-full border border-[#cbd5e1]/30 -z-10" />
                </div>

                {/* Headline text below image */}
                <div className="mb-4">
                  <span className="font-['Inter'] text-[10px] md:text-[12px] font-light text-[#8797a3] uppercase tracking-wider">
                    CHATGO
                  </span>
                </div>
                <h1 className="font-['Inter'] text-[18px] md:text-[24px] lg:text-[28px] font-black leading-[1.2] text-[#5d7386] mb-4">
                  ATENDA E VENDA GLOBALMENTE
                  <br />
                  COM CHATGO
                </h1>
                <p className="font-['Inter'] text-[10px] md:text-[12px] font-light leading-[1.6] text-[#aec0cd] mb-6 max-w-[400px] mx-auto">
                  ChatGo Workforce Ajuda Você a Conectar e Atender Clientes em Mais de 150 Países de Forma Rápida, Segura e Sem Fronteiras
                </p>
                <button 
                  onClick={() => scrollToSection('features')}
                  className="font-['Inter'] text-[10px] md:text-[12px] font-normal text-[#9bc5e5] hover:text-[#3B6BE8] transition-colors"
                >
                  EXPLORAR FERRAMENTAS →
                </button>
              </div>

              {/* ========================= */}
              {/* RIGHT SIDE - Stacked cards (like Payrot credit cards) */}
              {/* ========================= */}
              <div className="relative w-full lg:w-[280px] order-3">
                {/* Top decorative lines */}
                <div className="hidden lg:block absolute -top-8 right-0 w-[80px] h-[9px]">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#d4e1ed] to-transparent rounded-full" />
                </div>
                <div className="hidden lg:block absolute -top-4 right-8 w-[40px] h-[7px]">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#cbd5e1] to-transparent rounded-full" />
                </div>

                {/* Main card stack */}
                <div className="relative h-[180px] md:h-[200px]">
                  {/* Card 1 - Back */}
                  <div className="absolute top-4 right-8 w-[200px] md:w-[240px] h-[120px] md:h-[140px] bg-gradient-to-br from-[#3B6BE8] to-[#1E3A8A] rounded-[16px] shadow-[0_20px_40px_rgba(0,0,0,0.15)] transform rotate-[-6deg] opacity-60" />
                  
                  {/* Card 2 - Middle */}
                  <div className="absolute top-2 right-4 w-[200px] md:w-[240px] h-[120px] md:h-[140px] bg-gradient-to-br from-[#60A5FA] to-[#3B6BE8] rounded-[16px] shadow-[0_15px_35px_rgba(0,0,0,0.12)] transform rotate-[-3deg] opacity-80" />
                  
                  {/* Card 3 - Front */}
                  <div className="absolute top-0 right-0 w-[200px] md:w-[240px] h-[120px] md:h-[140px] bg-gradient-to-br from-[#3B6BE8] to-[#1E3A8A] rounded-[16px] shadow-[0_25px_50px_rgba(59,107,232,0.25)] p-4">
                    {/* Card header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-[16px] h-[12px] bg-white/30 rounded-sm" />
                        <span className="font-['Inter'] text-[8px] md:text-[10px] font-light text-[#76b4e9]">
                          CHATGO
                        </span>
                      </div>
                      <MessageSquare className="w-4 h-4 text-white/50" />
                    </div>
                    
                    {/* Card number placeholder */}
                    <span className="block font-['Inter'] text-[12px] md:text-[14px] font-light text-[#9ac6e9] tracking-wider mb-2">
                      5467 3867 0099 3441
                    </span>
                    
                    {/* Card footer */}
                    <div className="flex items-center justify-between mt-auto">
                      <span className="font-['Inter'] text-[8px] md:text-[9px] font-light text-[#7ab4e5]">
                        MARIA SILVA
                      </span>
                      <span className="font-['Inter'] text-[8px] md:text-[9px] font-light text-[#92c2e8]">
                        12/26
                      </span>
                      <span className="font-['Inter'] text-[12px] md:text-[14px] font-normal text-[#b3d5ee]">
                        VISA
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right bottom card - Payment info */}
                <div className="hidden lg:block absolute bottom-0 right-0 w-[120px]">
                  <div className="bg-[#f2f5f7] rounded-[8px] border border-[#e0e6eb] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="w-4 h-4 text-[#8d9da8]" />
                      <span className="font-['Inter'] text-[10px] font-light text-[#8d9da8]">
                        Pagamento
                      </span>
                    </div>
                    <span className="font-['Inter'] text-[10px] font-light text-[#b9c8d3]">
                      Seguro
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================= */}
        {/* FOLD 2 - BOTTOM SECTION (FAST SEND / FAST RECEIVE) */}
        {/* ========================= */}
        <div className="relative z-[15] mt-8 md:mt-12 px-4 md:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 py-6 md:py-8 border-t border-[#e0e8f0]">
              
              {/* Left - Icons and text */}
              <div className="flex items-center gap-4 order-2 md:order-1">
                <div className="flex items-center gap-2">
                  <div className="w-[28px] h-[28px] rounded-full bg-gradient-to-br from-[#3B6BE8] to-[#60A5FA] flex items-center justify-center">
                    <Globe className="w-3 h-3 text-white" />
                  </div>
                  <div className="w-[28px] h-[28px] rounded-full bg-gradient-to-br from-[#60A5FA] to-[#93C5FD] flex items-center justify-center">
                    <MessageSquare className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div>
                  <p className="font-['Inter'] text-[12px] md:text-[14px] font-normal leading-[1.4] text-[#b0c4d1]">
                    ChatGo capacita usuários a enviar e
                    <br />
                    receber mensagens globalmente.
                  </p>
                </div>
                <button 
                  onClick={() => scrollToSection('features')}
                  className="font-['Inter'] text-[10px] font-light text-[#98a6b1] hover:text-[#3B6BE8] transition-colors whitespace-nowrap"
                >
                  NOSSOS SERVIÇOS
                </button>
              </div>

              {/* Center - Main headline */}
              <div className="text-center order-1 md:order-2">
                <h2 className="font-['Inter'] text-[24px] md:text-[32px] lg:text-[40px] font-black leading-[1.1] text-[#e9f0f8]">
                  ENVIO RÁPIDO,
                  <br />
                  RESPOSTA RÁPIDA
                </h2>
              </div>

              {/* Right - Stats */}
              <div className="flex items-center gap-4 order-3">
                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-[#fbfbfd] rounded-[6px] border border-[#a8b0bb] mb-2">
                    <span className="font-['Inter'] text-[8px] font-light text-[#aab5bd]">
                      TOTAL ATENDIMENTOS
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <span className="font-['Inter'] text-[32px] md:text-[40px] font-normal text-[#76b0e9]">
                      90M
                    </span>
                    <span className="font-['Inter'] text-[28px] md:text-[36px] font-light text-[#80b5ea]">
                      +
                    </span>
                  </div>
                  <span className="font-['Inter'] text-[14px] md:text-[18px] font-light text-[#aabecc]">
                    Mensagens
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="w-[80px] h-[5px] bg-gradient-to-r from-[#3B6BE8] to-[#60A5FA] rounded-full" />
                  <div className="w-[60px] h-[3px] bg-gradient-to-r from-[#60A5FA] to-[#93C5FD] rounded-full" />
                </div>
                <button className="font-['Inter'] text-[12px] font-light text-[#a0adb6] hover:text-[#3B6BE8] transition-colors">
                  VER STATS
                  <div className="w-[45px] h-[3px] bg-white mt-1" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================= */}
        {/* FOLD 3 - GROW BEYOND BORDERS SECTION */}
        {/* ========================= */}
        <div className="relative z-[20] mt-4 md:mt-8 px-4 md:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Globe/Map image placeholder with button */}
            <div className="relative w-full max-w-[900px] mx-auto">
              {/* World map background placeholder */}
              <div className="w-full h-[280px] md:h-[400px] lg:h-[500px] bg-gradient-to-b from-[#e5f0f8] via-[#d8e8f4] to-[#c8dced] rounded-[24px] flex items-center justify-center relative overflow-hidden">
                {/* Decorative circles representing globe */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-[180px] h-[180px] md:w-[280px] md:h-[280px] rounded-full border-2 border-dashed border-[#b0c8dc]/40" />
                  <div className="absolute w-[140px] h-[140px] md:w-[220px] md:h-[220px] rounded-full border border-[#a0bcd0]/30" />
                  <div className="absolute w-[100px] h-[100px] md:w-[160px] md:h-[160px] rounded-full bg-gradient-to-br from-[#d4e6f4] to-[#e8f2fa]" />
                </div>
                
                {/* Placeholder text */}
                <div className="absolute top-4 md:top-8 left-4 md:left-8">
                  <ImageIcon className="w-8 h-8 md:w-10 md:h-10 text-[#94A3B8]" />
                  <span className="block font-['Inter'] text-[10px] md:text-[12px] font-light text-[#8797a3] mt-1">
                    Mapa Global
                  </span>
                </div>

                {/* CTA Button in center-bottom */}
                <div className="absolute bottom-8 md:bottom-12 left-1/2 -translate-x-1/2">
                  <button 
                    onClick={() => navigate('/auth')}
                    className="bg-[#f3f6fc] rounded-[9px] border border-[#c8d5ed] px-4 md:px-6 py-2 md:py-3 flex items-center gap-2 hover:bg-[#e8f0fc] transition-colors"
                  >
                    <span className="font-['Inter'] text-[10px] md:text-[12px] font-normal text-[#a1aeb9]">
                      Abrir Conta
                    </span>
                    <div className="w-[11px] h-[3px] bg-[#3B6BE8] rounded-full" />
                  </button>
                </div>
              </div>

              {/* Text overlay below map */}
              <div className="text-center mt-6 md:mt-10">
                <h3 className="font-['Inter'] text-[24px] md:text-[36px] lg:text-[48px] font-medium leading-[1.1] text-[#c2ccd3] mb-4">
                  CRESÇA ALÉM DAS
                  <br />
                  FRONTEIRAS COM CHATGO
                </h3>
                <p className="font-['Inter'] text-[10px] md:text-[12px] lg:text-[14px] font-light leading-[1.6] text-[#446987] max-w-[500px] mx-auto mb-6">
                  Se você está atendendo um freelancer ou uma equipe completa no exterior, ChatGo torna tudo Simples, Rápido, Seguro, e Sem Taxas Extras
                </p>
                <button 
                  onClick={() => scrollToSection('features')}
                  className="bg-[#0e3251] rounded-[9px] border border-[#7493a8] px-4 md:px-6 py-2 md:py-3 flex items-center gap-2 mx-auto hover:bg-[#1a4265] transition-colors"
                >
                  <span className="font-['Inter'] text-[10px] md:text-[12px] font-light text-[#71889a]">
                    Explorar Mais
                  </span>
                  <ArrowRight className="w-3 h-3 text-[#71889a]" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Vertical decorative lines on sides */}
        <div className="hidden lg:block absolute top-0 bottom-0 left-0 w-[2px] bg-gradient-to-b from-transparent via-[#e0e8f0] to-transparent z-[50]" />
        <div className="hidden lg:block absolute top-0 bottom-0 right-0 w-[2px] bg-gradient-to-b from-transparent via-[#e0e8f0] to-transparent z-[50]" />

        {/* Horizontal decorative line top */}
        <div className="absolute top-[78px] left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#e0e8f0] to-transparent z-[40]" />
      </div>

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
