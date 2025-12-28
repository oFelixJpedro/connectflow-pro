import { MessageCircle, Globe, CreditCard, Check, ArrowRight, Zap, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#f0f4f8] overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#1a56db] rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-[#1e3a5f]">ChatGo</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#services" className="text-[#1e3a5f]/70 hover:text-[#1e3a5f] transition-colors text-sm font-medium">
              Nossos Serviços
            </a>
            <a href="#about" className="text-[#1e3a5f]/70 hover:text-[#1e3a5f] transition-colors text-sm font-medium">
              Sobre
            </a>
            <a href="#tools" className="text-[#1e3a5f]/70 hover:text-[#1e3a5f] transition-colors text-sm font-medium">
              Ferramentas
            </a>
          </div>

          <Link to="/auth">
            <Button className="bg-[#1a56db] hover:bg-[#1a56db]/90 text-white rounded-full px-6">
              Entrar
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen pt-24 pb-16 overflow-hidden">
        {/* Giant Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
          <h1 className="text-[180px] md:text-[280px] lg:text-[380px] font-black text-[#d8e4ef] tracking-[0.15em] blur-[2px] whitespace-nowrap">
            CHATGO
          </h1>
        </div>

        {/* Content Container */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 h-full">
          <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-4 min-h-[80vh]">
            
            {/* Left Card - Globe Card */}
            <div className="relative lg:absolute lg:left-[5%] lg:top-1/2 lg:-translate-y-1/2 z-20">
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-2xl shadow-[#1a56db]/10 w-[280px] md:w-[320px]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1a56db] to-[#60a5fa] flex items-center justify-center">
                    <Globe className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-[#1e3a5f]/60 uppercase tracking-wider">Alcance Global</p>
                    <p className="text-lg font-bold text-[#1e3a5f]">Envie e Receba</p>
                  </div>
                </div>
                
                {/* Mini Globe Placeholder */}
                <div className="relative h-40 rounded-2xl bg-gradient-to-br from-[#1a56db]/20 to-[#60a5fa]/20 overflow-hidden mb-4">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#1a56db] to-[#0d47a1] opacity-80">
                      <div className="absolute inset-4 rounded-full border border-white/30"></div>
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full h-[1px] bg-white/20"></div>
                      </div>
                      <div className="absolute inset-0 flex justify-center">
                        <div className="w-[1px] h-full bg-white/20"></div>
                      </div>
                    </div>
                  </div>
                  {/* Connection dots */}
                  <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                  <div className="absolute bottom-6 left-6 w-2 h-2 rounded-full bg-[#1a56db] animate-pulse"></div>
                  <div className="absolute top-1/2 right-8 w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></div>
                </div>

                <p className="text-sm text-[#1e3a5f]/70">
                  Conecte-se com clientes em <span className="font-semibold text-[#1a56db]">190+ países</span>
                </p>
              </div>
            </div>

            {/* Center - Main Image Placeholder */}
            <div className="relative z-10 order-first lg:order-none">
              {/* Users Badge - Floating */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 lg:top-8 lg:left-auto lg:right-0 lg:translate-x-1/2 z-30">
                <div className="bg-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 border-2 border-white"></div>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 border-2 border-white"></div>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-400 border-2 border-white"></div>
                  </div>
                  <span className="text-sm font-bold text-[#1e3a5f]">7M+ usuários</span>
                </div>
              </div>

              {/* Main Visual - Bird/Mascot Placeholder */}
              <div className="relative w-[300px] h-[400px] md:w-[400px] md:h-[500px] lg:w-[450px] lg:h-[550px]">
                <div className="absolute inset-0 bg-gradient-to-b from-[#ffd700]/30 via-[#ff6b35]/30 to-[#1a56db]/30 rounded-[40px] blur-3xl"></div>
                <div className="relative h-full rounded-[40px] bg-gradient-to-b from-[#ffecd2] via-[#fcb69f] to-[#1a56db]/20 flex items-center justify-center overflow-hidden">
                  {/* Decorative Elements */}
                  <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ffd700] opacity-60 blur-xl"></div>
                  <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full bg-gradient-to-br from-[#1a56db] to-[#60a5fa] opacity-40 blur-2xl"></div>
                  
                  {/* Placeholder Icon */}
                  <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#ffd700] flex items-center justify-center shadow-2xl">
                      <MessageCircle className="w-12 h-12 text-white" />
                    </div>
                    <p className="text-white/80 font-medium text-center px-8">
                      Sua imagem de destaque aqui
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Card - VISA Style Card */}
            <div className="relative lg:absolute lg:right-[5%] lg:top-1/2 lg:-translate-y-1/2 z-20">
              <div className="w-[300px] md:w-[340px]">
                {/* Credit Card */}
                <div className="bg-gradient-to-br from-[#1a56db] via-[#2563eb] to-[#1e40af] rounded-2xl p-6 shadow-2xl shadow-[#1a56db]/30 aspect-[1.6/1] relative overflow-hidden">
                  {/* Card Pattern */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
                  
                  {/* Chip */}
                  <div className="w-10 h-7 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-md mb-6">
                    <div className="w-full h-full grid grid-cols-3 gap-[1px] p-1">
                      <div className="bg-yellow-600/30 rounded-sm"></div>
                      <div className="bg-yellow-600/30 rounded-sm"></div>
                      <div className="bg-yellow-600/30 rounded-sm"></div>
                    </div>
                  </div>
                  
                  {/* Card Number */}
                  <p className="text-white/90 font-mono text-lg tracking-[0.2em] mb-4">
                    •••• •••• •••• 4582
                  </p>
                  
                  {/* Card Footer */}
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Titular</p>
                      <p className="text-white font-medium text-sm">CHATGO USER</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold text-xl italic tracking-wider">VISA</p>
                    </div>
                  </div>
                </div>

                {/* Transaction Card Below */}
                <div className="mt-4 bg-white rounded-2xl p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Check className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#1e3a5f] text-sm">Pagamento Recebido</p>
                        <p className="text-xs text-[#1e3a5f]/60">Há 2 minutos</p>
                      </div>
                    </div>
                    <p className="font-bold text-green-600">+R$ 1.500</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
          <div className="flex flex-col items-center gap-2 animate-bounce">
            <span className="text-xs text-[#1e3a5f]/60 uppercase tracking-wider">Scroll</span>
            <ChevronRight className="w-4 h-4 text-[#1e3a5f]/60 rotate-90" />
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="relative py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          {/* Top Row */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 mb-16">
            <div className="flex-1">
              <p className="text-xs text-[#1a56db] uppercase tracking-[0.3em] mb-2 flex items-center gap-2">
                <Zap className="w-3 h-3" />
                NOSSOS SERVIÇOS
              </p>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-[#1e3a5f] leading-tight">
                ENVIO RÁPIDO,<br />
                RESPOSTA RÁPIDA
              </h2>
            </div>

            {/* Big Metric */}
            <div className="text-right">
              <p className="text-6xl md:text-7xl lg:text-8xl font-black text-[#1a56db]">90M+</p>
              <p className="text-sm text-[#1e3a5f]/60 uppercase tracking-wider">Mensagens Enviadas</p>
            </div>
          </div>

          {/* Decorative Line */}
          <div className="h-[2px] bg-gradient-to-r from-[#1a56db] via-[#60a5fa] to-transparent mb-16"></div>

          {/* Services Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Service Card 1 */}
            <div className="group bg-[#f8fafc] rounded-3xl p-8 hover:bg-[#1a56db] transition-all duration-300">
              <div className="w-14 h-14 rounded-2xl bg-[#1a56db]/10 group-hover:bg-white/20 flex items-center justify-center mb-6 transition-colors">
                <MessageCircle className="w-7 h-7 text-[#1a56db] group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-[#1e3a5f] group-hover:text-white mb-3 transition-colors">
                Mensagens Automáticas
              </h3>
              <p className="text-[#1e3a5f]/70 group-hover:text-white/80 transition-colors">
                Automatize suas respostas e nunca perca uma oportunidade de venda.
              </p>
            </div>

            {/* Service Card 2 */}
            <div className="group bg-[#f8fafc] rounded-3xl p-8 hover:bg-[#1a56db] transition-all duration-300">
              <div className="w-14 h-14 rounded-2xl bg-[#1a56db]/10 group-hover:bg-white/20 flex items-center justify-center mb-6 transition-colors">
                <Globe className="w-7 h-7 text-[#1a56db] group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-[#1e3a5f] group-hover:text-white mb-3 transition-colors">
                Alcance Global
              </h3>
              <p className="text-[#1e3a5f]/70 group-hover:text-white/80 transition-colors">
                Conecte-se com clientes em qualquer lugar do mundo, 24/7.
              </p>
            </div>

            {/* Service Card 3 */}
            <div className="group bg-[#f8fafc] rounded-3xl p-8 hover:bg-[#1a56db] transition-all duration-300">
              <div className="w-14 h-14 rounded-2xl bg-[#1a56db]/10 group-hover:bg-white/20 flex items-center justify-center mb-6 transition-colors">
                <CreditCard className="w-7 h-7 text-[#1a56db] group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl font-bold text-[#1e3a5f] group-hover:text-white mb-3 transition-colors">
                Pagamentos Integrados
              </h3>
              <p className="text-[#1e3a5f]/70 group-hover:text-white/80 transition-colors">
                Receba pagamentos diretamente nas suas conversas.
              </p>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="flex flex-col md:flex-row items-center justify-between mt-16 gap-6">
            <div className="flex items-center gap-4">
              <span className="px-4 py-2 bg-[#1e3a5f] text-white text-sm font-medium rounded-full">
                TOTAL MENSAGENS
              </span>
              <span className="px-4 py-2 bg-white border border-[#1e3a5f]/20 text-[#1e3a5f] text-sm font-medium rounded-full">
                VER STATS
              </span>
            </div>

            <Link to="/trial">
              <Button className="bg-[#1a56db] hover:bg-[#1a56db]/90 text-white rounded-full px-8 py-6 text-lg">
                Abrir Conta Grátis
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials / Hire Section */}
      <section id="about" className="relative py-24 bg-[#f0f4f8] overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Left Content */}
            <div className="flex-1 relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-[#1a56db] rounded-lg flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold text-[#1e3a5f]">CHATGO</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-black text-[#1e3a5f] leading-tight mb-6">
                CONTRATE E ATENDA<br />
                <span className="text-[#1a56db]">GLOBALMENTE</span>
              </h2>

              <p className="text-lg text-[#1e3a5f]/70 mb-8 max-w-md">
                A ChatGo proporciona contratação global de funcionários e meios de pagamento em mais de 150 países, sendo utilizada por mais de 35.000 empresas para processar pagamentos internacionais.
              </p>

              <a href="#tools" className="inline-flex items-center gap-2 text-[#1a56db] font-semibold hover:gap-3 transition-all">
                EXPLORAR FERRAMENTAS
                <ArrowRight className="w-4 h-4" />
              </a>

              {/* Feature List */}
              <div className="mt-12 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-[#1e3a5f]">Atendimento 24 horas, 7 dias por semana</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-[#1e3a5f]">IA treinada para seu negócio</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="w-4 h-4 text-green-600" />
                  </div>
                  <span className="text-[#1e3a5f]">Integração com múltiplos canais</span>
                </div>
              </div>
            </div>

            {/* Right - Image with Floating Cards */}
            <div className="flex-1 relative">
              {/* Main Image Placeholder */}
              <div className="relative w-full max-w-[500px] aspect-square mx-auto">
                <div className="absolute inset-0 bg-gradient-to-br from-[#1a56db]/20 to-[#60a5fa]/20 rounded-[40px] blur-3xl"></div>
                <div className="relative h-full rounded-[40px] bg-gradient-to-br from-[#e0e7ef] to-[#f8fafc] flex items-center justify-center overflow-hidden border border-white/50">
                  {/* Placeholder for person image */}
                  <div className="text-center p-8">
                    <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#1a56db]/30 to-[#60a5fa]/30 flex items-center justify-center">
                      <svg className="w-16 h-16 text-[#1a56db]/50" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    </div>
                    <p className="text-[#1e3a5f]/50 text-sm">Sua imagem aqui</p>
                  </div>
                </div>

                {/* Floating Payment Card - Top Right */}
                <div className="absolute -top-4 -right-4 md:top-8 md:-right-8 bg-white rounded-2xl p-4 shadow-xl z-20 w-48">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-[#1a56db] flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs text-[#1e3a5f]/60">Pagamento</span>
                  </div>
                  <p className="text-2xl font-bold text-[#1e3a5f]">R$ 2.500</p>
                  <p className="text-xs text-green-600 mt-1">Recebido com sucesso</p>
                </div>

                {/* Floating Message Card - Bottom Left */}
                <div className="absolute -bottom-4 -left-4 md:bottom-8 md:-left-8 bg-white rounded-2xl p-4 shadow-xl z-20 w-56">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <MessageCircle className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm font-medium text-[#1e3a5f]">Nova mensagem</span>
                  </div>
                  <p className="text-xs text-[#1e3a5f]/70">"Olá! Gostaria de saber mais sobre..."</p>
                </div>

                {/* Success Badge - Center Right */}
                <div className="absolute top-1/2 -right-2 md:-right-6 -translate-y-1/2 z-20">
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Globe / Contact Section */}
      <section id="tools" className="relative py-32 bg-[#0a1929] overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#1a56db]/20 rounded-full blur-[150px]"></div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-6">
          {/* Giant Globe Placeholder */}
          <div className="relative w-full max-w-[600px] mx-auto aspect-square mb-16">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#1a56db] to-[#0d47a1] opacity-80">
              {/* Globe Lines */}
              <div className="absolute inset-8 rounded-full border border-white/10"></div>
              <div className="absolute inset-16 rounded-full border border-white/10"></div>
              <div className="absolute inset-24 rounded-full border border-white/10"></div>
              
              {/* Horizontal Lines */}
              <div className="absolute top-1/4 left-0 right-0 h-[1px] bg-white/10"></div>
              <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/10"></div>
              <div className="absolute top-3/4 left-0 right-0 h-[1px] bg-white/10"></div>
              
              {/* Vertical Center Line */}
              <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-white/10"></div>
              
              {/* Connection Points */}
              <div className="absolute top-[20%] left-[30%] w-3 h-3 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/50"></div>
              <div className="absolute top-[40%] right-[25%] w-3 h-3 rounded-full bg-yellow-400 animate-pulse shadow-lg shadow-yellow-400/50"></div>
              <div className="absolute bottom-[30%] left-[40%] w-3 h-3 rounded-full bg-[#60a5fa] animate-pulse shadow-lg shadow-[#60a5fa]/50"></div>
              <div className="absolute top-[60%] right-[40%] w-2 h-2 rounded-full bg-white animate-pulse"></div>
              <div className="absolute bottom-[40%] right-[30%] w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
            </div>
            
            {/* Globe Icon in Center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Globe className="w-24 h-24 text-white/20" />
            </div>
          </div>

          {/* Content Below Globe */}
          <div className="text-center">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-6">
              CRESÇA ALÉM DAS<br />
              <span className="text-[#60a5fa]">FRONTEIRAS</span> COM CHATGO
            </h2>

            <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10">
              Transforme suas conversas em oportunidades de negócio. Com a ChatGo, você atende clientes, processa pagamentos e escala seu negócio globalmente.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/trial">
                <Button className="bg-white text-[#0a1929] hover:bg-white/90 rounded-full px-8 py-6 text-lg font-bold">
                  Começar Grátis
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 rounded-full px-8 py-6 text-lg">
                  Ver Planos
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a1929] border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#1a56db] rounded-lg flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">ChatGo</span>
            </div>

            <div className="flex items-center gap-8">
              <a href="#" className="text-white/60 hover:text-white text-sm transition-colors">Termos</a>
              <a href="#" className="text-white/60 hover:text-white text-sm transition-colors">Privacidade</a>
              <a href="#" className="text-white/60 hover:text-white text-sm transition-colors">Contato</a>
            </div>

            <p className="text-white/40 text-sm">
              © 2024 ChatGo. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
