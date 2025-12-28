import React from "react";
import { MessageCircle, Zap, ArrowRight } from "lucide-react";

export const ServicesSection = (): JSX.Element => {
  return (
    <section
      className="absolute right-0 bottom-[436px] w-[478px] h-[109px]"
      aria-label="Services Section"
    >
      {/* Decorative line */}
      <div
        className="absolute right-[86px] bottom-[19px] w-[45px] h-[3px] bg-[#fefffe]"
        aria-hidden="true"
      />

      {/* Our Services label */}
      <h2 className="absolute right-[414px] bottom-5 w-[43px] h-2.5 flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#98a6b1] text-[5px] tracking-[0] leading-[normal]">
        NOSSOS SERVIÇOS
      </h2>

      {/* Receita label */}
      <div className="absolute right-[29px] bottom-[35px] w-[37px] h-[25px] flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#aabecc] text-[11px] tracking-[0] leading-[normal]">
        Leads
      </div>

      {/* Plus sign */}
      <div
        className="absolute right-[73px] bottom-10 w-3 h-4 flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#80b5ea] text-[17px] text-center tracking-[0] leading-[normal] whitespace-nowrap"
        aria-hidden="true"
      >
        +
      </div>

      {/* 90M counter */}
      <div className="absolute right-[86px] bottom-[38px] w-[42px] h-[21px] flex items-center justify-center [font-family:'Inter',Helvetica] font-normal text-[#76b0e9] text-[19px] tracking-[0] leading-[normal] whitespace-nowrap">
        90M
      </div>

      {/* Main headline */}
      <h3 className="absolute right-[179px] bottom-[50px] w-[118px] h-[37px] flex items-center justify-center [font-family:'Inter',Helvetica] font-black text-[#e9f0f8] text-base text-center tracking-[0] leading-[16.1px]">
        ENVIO RÁPIDO,
        <br />
        RESPOSTA RÁPIDA
      </h3>

      {/* Description */}
      <p className="right-[336px] bottom-[42px] w-[120px] h-[19px] [font-family:'Inter',Helvetica] font-normal text-[#b0c4d1] text-[7px] tracking-[0] leading-[9.2px] absolute flex items-center justify-center">
        ChatGo permite enviar e receber
        <br />
        mensagens globalmente.
      </p>

      {/* Decorative gradient bar */}
      <div
        className="absolute right-7 bottom-[66px] w-[103px] h-[5px] bg-gradient-to-r from-[#e8f4fc] to-[#d4e8f5] rounded-full"
        aria-hidden="true"
      />

      {/* Total transfers badge */}
      <button
        className="all-[unset] box-border absolute right-[77px] bottom-[75px] w-[53px] h-3.5 cursor-pointer"
        aria-label="Total de Transferências"
      >
        <div className="absolute right-px bottom-px w-[51px] h-[11px] bg-[#fbfbfd] rounded-[5.25px] border border-solid border-[#a8b0bb]" />
        <span className="absolute right-[5px] bottom-[3px] w-[43px] h-2 flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#aab5bd] text-[4px] tracking-[0] leading-[normal]">
          TOTAL MENSAGENS
        </span>
      </button>

      {/* Service icons */}
      <div className="absolute right-[427px] bottom-[75px] w-3.5 h-3.5 flex items-center justify-center">
        <Zap className="w-3 h-3 text-[#3b82f6]" />
      </div>
      <div className="absolute right-[442px] bottom-[75px] w-3.5 h-3.5 flex items-center justify-center">
        <MessageCircle className="w-3 h-3 text-[#25d366]" />
      </div>

      {/* Open Account button */}
      <button
        className="all-[unset] box-border absolute right-[205px] bottom-[90px] w-[70px] h-[21px] cursor-pointer"
        aria-label="Abrir Conta"
      >
        <div className="absolute right-px bottom-px w-[67px] h-[19px] bg-[#f3f6fc] rounded-[8.75px] border border-solid border-[#c8d5ed]" />
        <div className="absolute right-[9px] bottom-[9px] w-[11px] h-[3px] flex items-center justify-center">
          <ArrowRight className="w-2 h-1 text-[#a1aeb9]" />
        </div>
        <span className="absolute right-6 bottom-1.5 w-9 h-[9px] flex items-center justify-center [font-family:'Inter',Helvetica] font-normal text-[#a1aeb9] text-[5px] tracking-[0] leading-[normal]">
          Começar Agora
        </span>
      </button>

      {/* View stats link */}
      <button
        className="absolute right-[87px] bottom-[21px] w-[42px] h-[9px] flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#a0adb6] text-[7px] tracking-[0] leading-[normal] cursor-pointer bg-transparent border-0 p-0"
        aria-label="Ver Estatísticas"
      >
        VER STATS
      </button>
    </section>
  );
};
