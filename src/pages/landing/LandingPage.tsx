import React from "react";
import { MessageCircle, Globe, ArrowRight, Users, Send, Check, Zap, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const LandingPage = (): JSX.Element => {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* ========== HERO SECTION ========== */}
      <section className="relative min-h-screen hero-gradient">
        {/* Decorative orbs */}
        <div className="orb orb-blue w-[600px] h-[600px] -top-40 -left-40" />
        <div className="orb orb-light-blue w-[400px] h-[400px] top-1/3 right-0" />
        <div className="pattern-dots absolute inset-0" />
        
        {/* Navigation */}
        <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 lg:px-20 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--landing-whatsapp))] to-emerald-600 flex items-center justify-center shadow-lg">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">CHATGO</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#recursos" className="text-white/70 hover:text-white transition-colors text-sm font-medium">Recursos</a>
            <a href="#empresas" className="text-white/70 hover:text-white transition-colors text-sm font-medium">Empresas</a>
            <a href="#marketplace" className="text-white/70 hover:text-white transition-colors text-sm font-medium">Marketplace</a>
            <a href="#precos" className="text-white/70 hover:text-white transition-colors text-sm font-medium">Preços</a>
          </div>
          
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10">
                Entrar
              </Button>
            </Link>
            <Link to="/auth">
              <Button className="landing-btn-primary px-6 py-2.5">
                Começar Grátis
              </Button>
            </Link>
          </div>
        </nav>
        
        {/* Hero Content */}
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between px-6 md:px-12 lg:px-20 pt-12 lg:pt-20 pb-20 gap-12 lg:gap-20">
          {/* Left side - Text */}
          <div className="flex-1 text-center lg:text-left max-w-2xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 glass-badge rounded-full px-4 py-2 mb-8">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">+7 milhões de usuários ativos</span>
            </div>
            
            {/* Watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[12rem] md:text-[18rem] lg:text-[22rem] font-light text-white/[0.03] tracking-[0.2em] pointer-events-none select-none whitespace-nowrap">
              CHATGO
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-tight mb-6">
              Mensagens Globais,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-300">
                Conexões Reais
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-white/70 mb-10 max-w-xl mx-auto lg:mx-0">
              Envie e receba mensagens em todo o mundo de forma rápida, segura e sem complicações. ChatGo simplifica sua comunicação global.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <Link to="/auth">
                <Button size="lg" className="landing-btn-primary px-8 py-6 text-lg font-semibold">
                  Começar Agora
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8 py-6 text-lg">
                Ver Demonstração
              </Button>
            </div>
          </div>
          
          {/* Right side - Cards Stack */}
          <div className="flex-1 relative max-w-lg w-full">
            {/* Main WhatsApp Card */}
            <div className="relative z-20 bg-gradient-to-br from-[hsl(var(--landing-whatsapp))] to-emerald-600 rounded-3xl p-6 shadow-2xl transform hover:scale-[1.02] transition-transform duration-300">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageCircle className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-white/70 text-sm">WhatsApp Business</p>
                  <p className="text-white font-bold text-lg">CHATGO PRO</p>
                </div>
              </div>
              
              <div className="bg-white/10 rounded-2xl p-4 mb-4">
                <p className="text-white/60 text-xs mb-1">Número conectado</p>
                <p className="text-white font-mono text-xl tracking-wider">+55 11 9999-9999</p>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-white/70 text-sm">Business API</span>
                <div className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-white" />
                  <span className="text-white text-sm font-medium">Verificado</span>
                </div>
              </div>
            </div>
            
            {/* Floating Stats Card */}
            <div className="absolute -left-8 top-1/2 -translate-y-1/2 z-30 glass-card rounded-2xl p-4 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
                  <Send className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Mensagens hoje</p>
                  <p className="text-foreground font-bold text-xl">90M+</p>
                </div>
              </div>
            </div>
            
            {/* Floating Feature Card */}
            <div className="absolute -right-4 bottom-0 z-30 glass-card rounded-2xl p-4 shadow-xl">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-primary" />
                <span className="text-sm font-semibold text-foreground">Envio Rápido</span>
              </div>
              <p className="text-muted-foreground text-xs">Entrega instantânea garantida</p>
            </div>
            
            {/* Background Globe */}
            <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-gradient-to-br from-primary/20 to-blue-500/10 rounded-full blur-3xl" />
          </div>
        </div>
      </section>

      {/* ========== SERVICES SECTION ========== */}
      <section id="recursos" className="relative py-24 lg:py-32 section-gradient-light overflow-hidden">
        {/* Decorative */}
        <div className="orb orb-blue w-[300px] h-[300px] top-0 right-1/4 opacity-10" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
          {/* Section Header */}
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">Nossos Serviços</span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mt-4 mb-6">
              Envio Rápido,{" "}
              <span className="gradient-text-landing">Resposta Rápida</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              ChatGo capacita usuários a enviar e receber mensagens globalmente com velocidade e segurança.
            </p>
          </div>
          
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            {[
              { value: "90M+", label: "Mensagens/dia", icon: Send },
              { value: "150+", label: "Países", icon: Globe },
              { value: "7M+", label: "Usuários", icon: Users },
              { value: "99.9%", label: "Uptime", icon: Check },
            ].map((stat, i) => (
              <div key={i} className="landing-card p-6 text-center">
                <stat.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="text-muted-foreground text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
          
          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: MessageCircle,
                title: "Multi-atendimento",
                description: "Gerencie múltiplas conversas simultaneamente com eficiência máxima."
              },
              {
                icon: Zap,
                title: "Respostas Automáticas",
                description: "Configure chatbots inteligentes para atendimento 24/7."
              },
              {
                icon: Users,
                title: "Equipe Integrada",
                description: "Colabore com sua equipe em tempo real com chat interno."
              },
              {
                icon: Globe,
                title: "Alcance Global",
                description: "Conecte-se com clientes em mais de 150 países."
              },
              {
                icon: Send,
                title: "Envio em Massa",
                description: "Campanhas de marketing com segmentação avançada."
              },
              {
                icon: Check,
                title: "CRM Integrado",
                description: "Gerencie leads e funil de vendas em um só lugar."
              },
            ].map((feature, i) => (
              <div key={i} className="landing-card p-8 group">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
          
          {/* CTA */}
          <div className="text-center mt-12">
            <Link to="/auth">
              <Button className="landing-btn-primary px-8 py-6 text-lg font-semibold">
                Abrir Conta Grátis
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ========== TESTIMONIALS / HIRE SECTION ========== */}
      <section className="relative py-24 lg:py-32 bg-muted/30 overflow-hidden">
        <div className="orb orb-light-blue w-[400px] h-[400px] -bottom-40 left-1/4" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left - Content */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--landing-whatsapp))] to-emerald-600 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">CHATGO WORKFORCE</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
                Contrate e Atenda{" "}
                <span className="gradient-text-landing">Globalmente</span>
              </h2>
              
              <p className="text-lg text-muted-foreground mb-8">
                ChatGo Workforce ajuda você a gerenciar e atender clientes em mais de 150 países de forma rápida, segura e sem fronteiras.
              </p>
              
              <ul className="space-y-4 mb-8">
                {[
                  "Onboarding automatizado de clientes",
                  "Atendimento multicanal integrado",
                  "Relatórios e métricas em tempo real",
                  "Conformidade com LGPD e GDPR",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-[hsl(var(--landing-whatsapp))]/10 flex items-center justify-center">
                      <Check className="w-4 h-4 text-[hsl(var(--landing-whatsapp))]" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              
              <Button variant="link" className="text-primary p-0 font-semibold">
                Explorar Ferramentas de Atendimento
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
            
            {/* Right - Visual */}
            <div className="relative">
              <div className="landing-card p-8 lg:p-12">
                {/* Mock Dashboard */}
                <div className="bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-6 mb-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Atendimento Inteligente</p>
                      <p className="text-sm text-muted-foreground">Dashboard em tempo real</p>
                    </div>
                  </div>
                  
                  {/* Mock Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                      <p className="text-2xl font-bold text-primary">847</p>
                      <p className="text-xs text-muted-foreground">Conversas ativas</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                      <p className="text-2xl font-bold text-[hsl(var(--landing-whatsapp))]">98%</p>
                      <p className="text-xs text-muted-foreground">Satisfação</p>
                    </div>
                  </div>
                </div>
                
                {/* Floating notification */}
                <div className="absolute -right-4 top-1/3 glass-card rounded-xl p-3 shadow-lg animate-pulse">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[hsl(var(--landing-whatsapp))] flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">Mensagem enviada</p>
                      <p className="text-[10px] text-muted-foreground">Entrega instantânea</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== CTA / CONTACT SECTION ========== */}
      <section className="relative py-24 lg:py-32 cta-gradient overflow-hidden">
        <div className="pattern-dots absolute inset-0" />
        
        <div className="relative z-10 max-w-4xl mx-auto px-6 md:px-12 lg:px-20 text-center">
          {/* Globe Icon */}
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center mx-auto mb-8 border border-white/20">
            <Globe className="w-12 h-12 text-white" />
          </div>
          
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            Cresça Além das{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-cyan-200">
              Fronteiras
            </span>
          </h2>
          
          <p className="text-lg md:text-xl text-white/70 mb-10 max-w-2xl mx-auto">
            Seja atendendo clientes locais ou internacionais, ChatGo torna tudo simples, rápido, seguro e sem complicações.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 px-8 py-6 text-lg font-semibold shadow-xl">
                Começar Gratuitamente
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8 py-6 text-lg">
              Falar com Especialista
            </Button>
          </div>
          
          <p className="text-white/50 text-sm mt-8">
            Sem cartão de crédito • Configuração em 2 minutos • Suporte 24/7
          </p>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="bg-[hsl(var(--landing-dark))] py-12">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--landing-whatsapp))] to-emerald-600 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">CHATGO</span>
            </div>
            
            <p className="text-white/50 text-sm">
              © 2024 ChatGo. Todos os direitos reservados.
            </p>
            
            <div className="flex items-center gap-6">
              <a href="#" className="text-white/50 hover:text-white text-sm transition-colors">Termos</a>
              <a href="#" className="text-white/50 hover:text-white text-sm transition-colors">Privacidade</a>
              <a href="#" className="text-white/50 hover:text-white text-sm transition-colors">Contato</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
