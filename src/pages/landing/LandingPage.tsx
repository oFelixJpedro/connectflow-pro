import React from "react";
import { MessageCircle, Globe, ArrowRight, Users, Send, Check, Zap } from "lucide-react";
import "./landing.css";

const LandingPage = (): JSX.Element => {
  return (
    <div className="figma-design-captura">
      <main className="root">
        {/* Background decorative elements */}
        <div className="image bg-gradient-to-br from-[#e8f4fc] to-[#d4e8f5]" />
        <div className="img bg-gradient-to-t from-[#0a1628] to-[#1a365d]" />

        <div className="groups">
          {/* Section 1: Contact/Globe Section (bottom) */}
          <section className="div">
            <div className="background bg-gradient-to-br from-[#0a1628] via-[#0f2744] to-[#1a365d] rounded-3xl" />
            
            <button className="button" type="button" aria-label="Explorar Mais">
              <span className="background-2" />
              <ArrowRight className="image-2-icon" />
              <span className="text-wrapper">Explorar Mais</span>
            </button>
            
            <div className="image-3 bg-gradient-to-br from-[#1e3a5f] to-[#0f2744] rounded-full flex items-center justify-center border border-[#2d4a6f]">
              <Globe className="w-16 h-16 text-[#4a90c2]" />
            </div>
            
            <p className="whather-youre-pa">
              Seja atendendo clientes locais ou internacionais, ChatGo<br />
              torna tudo simples, rápido, seguro e sem complicações.
            </p>
            
            <h2 className="GROWBEYOND-BORDE">
              CRESÇA ALÉM DAS<br />FRONTEIRAS COM CHATGO
            </h2>
          </section>

          {/* Section 2: Testimonials/Hire Section */}
          <section className="groups-2">
            <a href="#" className="EXPLORE-WNDRNFOR">
              EXPLORAR FERRAMENTAS DE ATENDIMENTO +
            </a>
            
            <p className="poayrat-workfarc">
              ChatGo Workforce ajuda você a gerenciar e atender clientes<br />
              em mais de 150 países de forma rápida, segura e<br />
              sem fronteiras.
            </p>
            
            <div className="text-wrapper-2">CHATGO</div>
            
            <div className="image-4 bg-gradient-to-br from-[#25D366] to-[#128C7E] rounded-full flex items-center justify-center">
              <MessageCircle className="w-2 h-2 text-white" />
            </div>
            
            <div className="image-5 bg-gradient-to-br from-[#f0f7fc] to-[#e4f0f8] rounded-lg flex items-center justify-center">
              <Users className="w-12 h-12 text-[#4a90c2]" />
            </div>
            
            <div className="button-2" role="group" aria-label="Status de mensagem">
              <span className="background-3" />
              <Send className="image-6-icon" />
              <span className="text-wrapper-3">Enviar</span>
              <span className="text-wrapper-4">Mensagem</span>
            </div>
            
            <div className="image-7 bg-[#25D366] rounded-full flex items-center justify-center">
              <Check className="w-2 h-2 text-white" />
            </div>
            
            <div className="groups-3" role="group" aria-label="Confirmação de envio">
              <div className="background-4 bg-gradient-to-r from-[#f2f5f7] to-[#e8f0f5] rounded-lg" />
              <Zap className="image-8-icon" />
              <span className="text-wrapper-5">Rápido</span>
              <span className="text-wrapper-6">ENVIADO</span>
            </div>
            
            <div className="image-9 bg-[#4a90c2] rounded-full flex items-center justify-center">
              <Check className="w-2 h-2 text-white" />
            </div>
            
            <p className="tak-jimo-hay-sn">Atendimento Inteligente</p>
            
            <h2 className="HIRE-ANDPAYGLOBA">
              CONTRATE E ATENDA<br />GLOBALMENTE COM CHATGO
            </h2>
          </section>

          {/* Background image between sections */}
          <div className="image-10 bg-gradient-to-br from-[#f0f7fc] to-[#e4f0f8]" />

          {/* Section 3: Services/Fast Send Section */}
          <section className="groups-4">
            <span className="background-5" />
            
            <h2 className="text-wrapper-7">NOSSOS SERVIÇOS</h2>
            
            <div className="text-wrapper-8">Respostas</div>
            
            <span className="text-wrapper-9">+</span>
            
            <div className="text-wrapper-10">90M</div>
            
            <h3 className="FAST-SEND-FASTR">
              ENVIO RÁPIDO,<br />RESPOSTA RÁPIDA
            </h3>
            
            <p className="payrot-empowers">
              ChatGo capacita usuários a enviar e<br />
              receber mensagens globalmente.
            </p>
            
            <div className="background-6 bg-gradient-to-r from-[#4a90c2] to-[#1e80f1]" />
            
            <button className="button-3" type="button">
              <span className="background-7" />
              <span className="text-wrapper-11">TOTAL DE MENSAGENS</span>
            </button>
            
            <div className="image-11 bg-[#25D366] rounded-full flex items-center justify-center">
              <MessageCircle className="w-2 h-2 text-white" />
            </div>
            
            <div className="image-12 bg-[#4a90c2] rounded-full flex items-center justify-center">
              <Send className="w-2 h-2 text-white" />
            </div>
            
            <button className="button-4" type="button">
              <span className="background-8" />
              <ArrowRight className="image-13-icon" />
              <span className="text-wrapper-12">Abrir Conta</span>
            </button>
            
            <a href="#" className="text-wrapper-13">VER ESTATÍSTICAS</a>
          </section>

          {/* Section 4: Hero Section (top) */}
          <section className="groups-5">
            <div className="image-14 bg-gradient-to-br from-[#25D366] to-[#128C7E] rounded-lg flex items-center justify-center">
              <MessageCircle className="w-3 h-3 text-white" />
            </div>
            
            <div className="groups-6">
              <div className="background-9 bg-gradient-to-r from-[#f0f7fc] to-[#e4f0f8] rounded-full" />
              <div className="image-15 bg-[#4a90c2] rounded-full" />
            </div>
            
            {/* Central image placeholder */}
            <div className="image-16 bg-gradient-to-br from-[#4a90c2] to-[#1e80f1] rounded-2xl flex items-center justify-center shadow-xl">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            
            {/* Card with icons */}
            <div className="groups-7" role="group" aria-label="Método de comunicação">
              <div className="background-10 bg-gradient-to-r from-[#f2f5f7] to-[#e8f0f5] rounded-lg" />
              <Send className="image-17-icon" />
              <Zap className="image-18-icon" />
              <span className="text-wrapper-14">Rápido</span>
            </div>
            
            {/* Credit card style element */}
            <div className="groups-8" role="group" aria-label="Detalhes do WhatsApp">
              <div className="background-11 bg-gradient-to-br from-[#25D366] to-[#128C7E] rounded-xl" />
              <div className="image-19 bg-white/20 rounded-full flex items-center justify-center">
                <MessageCircle className="w-3 h-3 text-white" />
              </div>
              <div className="image-20 bg-white/10 rounded" />
              <div className="image-21 bg-white/10 rounded" />
              <div className="image-22 bg-white/10 rounded" />
              <div className="image-23 bg-white/10 rounded" />
              <span className="text-wrapper-15">WhatsApp</span>
              <span className="text-wrapper-16">API</span>
              <span className="text-wrapper-17">CHATGO PRO</span>
              <span className="element">+55 11 9999-9999</span>
              <span className="text-wrapper-18">BUSINESS</span>
            </div>
            
            {/* Users badge */}
            <button className="button-5" type="button" aria-label="7 milhões de usuários">
              <span className="background-12" />
              <div className="image-24 flex gap-0.5">
                <div className="w-1.5 h-1.5 bg-[#4a90c2] rounded-full" />
                <div className="w-1.5 h-1.5 bg-[#25D366] rounded-full" />
                <div className="w-1.5 h-1.5 bg-[#1e80f1] rounded-full" />
              </div>
              <div className="image-25 flex items-center gap-0.5">
                <Users className="w-2 h-2 text-[#4a90c2]" />
              </div>
              <span className="text-wrapper-19">7M+</span>
            </button>
            
            {/* Feature card */}
            <div className="groups-9">
              <div className="background-13 bg-gradient-to-br from-white to-[#f0f7fc] rounded-2xl shadow-lg border border-[#e4f0f8]" />
              <p className="money-worldwide">
                Mensagens Globais<br />
                Rápido, Seguro e<br />
                Sem Complicações
              </p>
              <h3 className="text-wrapper-20">Envie e Receba</h3>
            </div>
            
            {/* Globe icon */}
            <div className="image-26 bg-gradient-to-br from-[#4a90c2] to-[#1e80f1] rounded-full flex items-center justify-center">
              <Globe className="w-6 h-6 text-white" />
            </div>
            
            {/* Watermark */}
            <div className="text-wrapper-21">CHATGO</div>
            
            {/* Contact button */}
            <button className="button-6" type="button">
              <span className="background-14" />
              <ArrowRight className="image-27-icon" />
              <span className="text-wrapper-22">Contato</span>
            </button>
            
            {/* Navigation */}
            <nav aria-label="Navegação principal">
              <a href="#" className="text-wrapper-23">Preços</a>
              <a href="#" className="text-wrapper-24">Marketplace</a>
              <a href="#" className="text-wrapper-25">Empresas</a>
              <a href="#" className="text-wrapper-26">Recursos</a>
            </nav>
            
            <div className="text-wrapper-27">CHATGO</div>
            
            <div className="image-28 bg-gradient-to-br from-[#25D366] to-[#128C7E] rounded flex items-center justify-center">
              <MessageCircle className="w-1.5 h-1.5 text-white" />
            </div>
          </section>
        </div>

        {/* Decorative borders */}
        <div className="image-29 bg-gradient-to-r from-transparent via-[#d4e8f5] to-transparent" />
        <div className="image-30 bg-gradient-to-b from-[#d4e8f5] to-transparent" />
        <div className="image-31 bg-gradient-to-b from-[#d4e8f5] to-transparent" />
      </main>
    </div>
  );
};

export default LandingPage;
