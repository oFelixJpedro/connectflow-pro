import React from "react";
import { MessageCircle, Check, CreditCard } from "lucide-react";

export const TestimonialsSection = (): JSX.Element => {
  return (
    <section
      className="absolute right-0 bottom-[276px] w-[478px] h-[158px]"
      aria-label="ChatGo Atendimento Global Section"
    >
      {/* Explore tools link */}
      <a
        href="#tools"
        className="absolute right-[357px] bottom-[41px] w-[82px] h-[9px] flex items-center justify-center [font-family:'Inter',Helvetica] font-normal text-[#9bc5e5] text-[5px] tracking-[0] leading-[normal] hover:underline focus:outline-none focus:ring-2 focus:ring-[#9bc5e5]"
        aria-label="Explorar Ferramentas de Automação"
      >
        EXPLORAR FERRAMENTAS +
      </a>

      {/* Description paragraph */}
      <p className="absolute right-[272px] bottom-14 w-[167px] h-[27px] flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#aec0cd] text-[5px] tracking-[0] leading-[8.3px]">
        ChatGo Automação ajuda você a integrar e atender clientes
        <br /> em mais de 150 países de forma rápida, segura e
        <br />
        sem fronteiras.
      </p>

      {/* CHATGO label */}
      <div className="absolute right-[195px] bottom-[119px] w-[37px] h-[9px] flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#8797a3] text-[7px] tracking-[0] leading-[normal]">
        CHATGO
      </div>

      {/* Logo icon */}
      <div className="absolute right-[233px] bottom-[117px] w-[9px] h-[11px] flex items-center justify-center">
        <MessageCircle className="w-2 h-2 text-[#25d366]" />
      </div>

      {/* Main image placeholder */}
      <div className="absolute right-[73px] bottom-[11px] w-[122px] h-[134px] bg-gradient-to-br from-[#e8f4fc] to-[#d4e8f5] rounded-2xl flex items-center justify-center">
        <span className="text-[#7b8fa2] text-[8px]">Imagem Pessoa</span>
      </div>

      {/* Payment card showing value */}
      <div
        className="absolute right-[151px] bottom-[54px] w-14 h-[26px]"
        role="img"
        aria-label="Card mostrando R$500"
      >
        <div className="absolute right-px bottom-0 w-[53px] h-[25px] bg-[#f2f5f7] rounded-[4.5px_3.25px_0px_2.25px] border border-solid border-[#e0e6eb]" />
        <div className="absolute right-[38px] bottom-[7px] w-[11px] h-2.5 flex items-center justify-center">
          <CreditCard className="w-2 h-2 text-[#b9c8d3]" />
        </div>
        <div className="absolute right-[23px] bottom-1.5 w-3 h-1.5 flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#b9c8d3] text-[5px] text-center tracking-[0] leading-[normal]">
          Pago
        </div>
        <div className="absolute right-1.5 bottom-[13px] w-[29px] h-2 flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#8d9da8] text-[6px] tracking-[0] leading-[normal]">
          R$500BRL
        </div>
      </div>

      {/* Checkmark */}
      <div className="absolute right-[145px] bottom-[47px] w-[13px] h-3 flex items-center justify-center">
        <Check className="w-2.5 h-2.5 text-[#22c55e]" />
      </div>

      {/* Payment notification card */}
      <div
        className="absolute right-10 bottom-[91px] w-[57px] h-7"
        role="img"
        aria-label="Notificação de pagamento"
      >
        <div className="absolute right-[3px] bottom-0 w-[52px] h-[26px] bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] rounded-lg border border-[#e2e8f0]" />
        <div className="absolute right-[38px] bottom-2 w-[11px] h-2.5 flex items-center justify-center">
          <MessageCircle className="w-2 h-2 text-[#25d366]" />
        </div>
        <div className="absolute right-[22px] bottom-[5px] w-3 h-1.5 flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#bfcdd7] text-[6px] text-center tracking-[0] leading-[normal] whitespace-nowrap">
          Enviado
        </div>
        <div className="absolute right-[7px] bottom-3 w-7 h-[11px] flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#9aa8b2] text-[5px] tracking-[0] leading-[normal]">
          MENSAGEM
        </div>
      </div>

      {/* Success badge */}
      <div className="absolute right-[86px] bottom-[83px] w-[18px] h-[19px] bg-[#22c55e] rounded-full flex items-center justify-center">
        <Check className="w-3 h-3 text-white" />
      </div>

      {/* Subtitle */}
      <div className="absolute right-[189px] bottom-28 w-[42px] h-1.5 flex items-center justify-center [font-family:'Inter',Helvetica] font-normal text-[#c2d0db] text-[4px] tracking-[0] leading-[normal]">
        Trabalhe melhor, mais rápido
      </div>

      {/* Main headline */}
      <h2 className="absolute right-[270px] bottom-[92px] w-[169px] h-[29px] flex items-center justify-center [font-family:'Inter',Helvetica] font-black text-[#5d7386] text-[13px] tracking-[0] leading-[13.1px]">
        CONTRATE E ATENDA GLOBALMENTE
        <br />
        COM CHATGO
      </h2>
    </section>
  );
};
