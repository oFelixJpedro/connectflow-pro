import React from "react";
import { MessageCircle, ArrowRight, CreditCard, Users } from "lucide-react";

export const InfoSection = (): JSX.Element => {
  const navigationItems = [
    {
      text: "CHATGO",
      className:
        "[font-family:'Inter',Helvetica] font-light text-[#7b8fa2] text-[8px]",
      position: "right-[411px] bottom-[230px] w-[35px] h-2",
    },
    {
      text: "Recursos",
      className:
        "[font-family:'Inter',Helvetica] font-normal text-[#9bb6cc] text-[6px]",
      position: "right-[271px] bottom-[229px] w-[27px] h-2",
    },
    {
      text: "Planos",
      className:
        "[font-family:'Inter',Helvetica] font-normal text-[#9bb7ce] text-[6px] text-center",
      position: "right-60 bottom-[229px] w-6 h-2",
    },
    {
      text: "Integrações",
      className:
        "[font-family:'Inter',Helvetica] font-light text-[#93b1c9] text-[5px]",
      position: "right-[201px] bottom-[229px] w-8 h-2",
    },
    {
      text: "FAQ",
      className:
        "[font-family:'Inter',Helvetica] font-light text-[#8dabc4] text-[5px] text-center",
      position: "right-[180px] bottom-[229px] w-3.5 h-2",
    },
  ];

  return (
    <header className="absolute right-0 bottom-[559px] w-[478px] h-[251px]">
      {/* Decorative element */}
      <div className="absolute right-[225px] bottom-11 w-[21px] h-[18px] flex items-center justify-center">
        <MessageCircle className="w-4 h-4 text-[#7ab4e5]" />
      </div>

      {/* Badge with avatars */}
      <div className="absolute right-[35px] bottom-[91px] w-[68px] h-2.5 flex items-end justify-end gap-px">
        <div className="w-[46px] h-[9px] bg-gradient-to-r from-[#e8f4fc] to-[#d4e8f5] rounded-full" />
        <div className="mb-0.5 w-[19px] h-[7px] mr-0.5 flex">
          <div className="w-2 h-2 rounded-full bg-[#3b82f6] -mr-1" />
          <div className="w-2 h-2 rounded-full bg-[#60a5fa] -mr-1" />
          <div className="w-2 h-2 rounded-full bg-[#93c5fd]" />
        </div>
      </div>

      {/* Card placeholder - main image area */}
      <div className="absolute right-[19px] bottom-[22px] w-[94px] h-[60px] bg-gradient-to-br from-[#e8f4fc] to-[#d4e8f5] rounded-lg flex items-center justify-center">
        <span className="text-[#7b8fa2] text-[6px]">Imagem Principal</span>
      </div>

      {/* Grammar badge */}
      <div className="absolute right-7 bottom-[81px] w-[79px] h-[11px]">
        <div className="absolute right-px bottom-0 w-[78px] h-2.5 bg-gradient-to-r from-[#f0f7fc] to-[#e4f0f8] rounded-md" />
        <div className="absolute right-[63px] bottom-0 w-[13px] h-1.5 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
        </div>
        <div className="absolute right-16 bottom-px w-3 h-1 flex items-center justify-center text-[#7ab4e5] text-[3px]">
          ✓
        </div>
        <div className="absolute right-1 bottom-[3px] w-[22px] h-1.5 flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#99a5af] text-[5px] text-center tracking-[0] leading-[normal]">
          Ativo
        </div>
      </div>

      {/* WhatsApp Card */}
      <article className="absolute right-[22px] bottom-[22px] w-[95px] h-[61px]">
        <div className="absolute right-0 bottom-0 w-[95px] h-[59px] bg-gradient-to-br from-[#1e3a5f] to-[#0f2744] rounded-xl" />
        <div className="absolute right-9 bottom-7 w-6 h-[23px] flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-[#7ab4e5]" />
        </div>
        <div className="absolute right-[67px] bottom-[34px] w-[5px] h-[7px] bg-[#22c55e] rounded-full" />
        <div className="absolute right-[74px] bottom-8 w-[15px] h-[11px] flex items-center justify-center">
          <MessageCircle className="w-3 h-3 text-[#25d366]" />
        </div>
        <div className="absolute right-[77px] bottom-[35px] w-[5px] h-1.5 bg-[#60a5fa] rounded-full" />
        <div className="absolute right-6 bottom-[49px] w-[5px] h-[5px] bg-[#f59e0b] rounded-full" />
        <div className="absolute right-1 bottom-1 w-[19px] h-2.5 flex items-center justify-center [font-family:'Inter',Helvetica] font-normal text-[#b3d5ee] text-[7px] text-center tracking-[0] leading-[normal]">
          PRO
        </div>
        <div className="absolute right-[35px] bottom-[5px] w-[13px] h-2 flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#92c2e8] text-[4px] text-center tracking-[0] leading-[normal]">
          24/7
        </div>
        <div className="absolute right-14 bottom-1.5 w-[34px] h-[7px] flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#7ab4e5] text-[4px] tracking-[0] leading-[normal]">
          EMPRESA LTDA
        </div>
        <div className="absolute right-4 bottom-[17px] w-[73px] h-2.5 flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#9ac6e9] text-[7px] tracking-[0] leading-[normal]">
          +55 11 99999-9999
        </div>
        <div className="absolute right-1 bottom-[49px] w-5 h-[7px] flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#76b4e9] text-[4px] text-center tracking-[0] leading-[normal]">
          CHATGO
        </div>
      </article>

      {/* Users badge */}
      <button
        className="all-[unset] box-border absolute right-[155px] bottom-[104px] w-16 h-[22px] cursor-pointer"
        aria-label="7M+ usuários"
      >
        <div className="absolute right-0 bottom-px w-16 h-[19px] bg-[#eff5fa] rounded-[9.25px] border border-solid border-[#d4e1f1]" />
        <div className="absolute right-2 bottom-[5px] w-[15px] h-1.5 flex items-center">
          <Users className="w-3 h-3 text-[#8da1b2]" />
        </div>
        <div className="absolute right-[27px] bottom-[5px] w-7 h-[11px] flex -space-x-1">
          <div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#60a5fa]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#93c5fd]" />
        </div>
        <span className="absolute right-[9px] bottom-2.5 w-[15px] h-[7px] flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#8da1b2] text-[5px] text-center tracking-[0] leading-[normal]">
          7M+
        </span>
      </button>

      {/* Left info card */}
      <article className="absolute right-[363px] bottom-[13px] w-[94px] h-[109px]">
        <div className="absolute right-0 bottom-0 w-[94px] h-[107px] bg-gradient-to-br from-[#ffffff] to-[#f8fafc] rounded-2xl border border-[#e2e8f0] shadow-lg" />
        <p className="absolute right-[18px] bottom-[13px] w-[60px] h-[25px] flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#bfc8ce] text-[7px] tracking-[0] leading-[8.0px]">
          Atendimento Mundial
          <br />
          Rápido, Seguro e
          <br />
          Sem Complicações
        </p>
        <h3 className="absolute right-[18px] bottom-[39px] w-[60px] h-[9px] flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#748695] text-[6px] tracking-[0] leading-[normal]">
          Envie e Receba
        </h3>
      </article>

      {/* Phone mockup placeholder */}
      <div className="absolute right-[378px] bottom-[70px] w-[62px] h-[61px] bg-gradient-to-br from-[#e8f4fc] to-[#d4e8f5] rounded-xl flex items-center justify-center">
        <MessageCircle className="w-6 h-6 text-[#3b82f6]" />
      </div>

      {/* Giant watermark */}
      <h1 className="right-[15px] bottom-[141px] w-[445px] h-[73px] blur-[2.5px] [font-family:'Inter',Helvetica] font-light text-[#e4edf5] text-[92px] text-center tracking-[19.32px] leading-[normal] whitespace-nowrap absolute flex items-center justify-center">
        CHATGO
      </h1>

      {/* Contact button */}
      <button
        className="all-[unset] box-border absolute right-[21px] bottom-56 w-[54px] h-5 cursor-pointer"
        aria-label="Contato"
      >
        <div className="absolute right-px bottom-0 w-[51px] h-[18px] bg-[#1e80f1] rounded-[9px] border border-solid border-[#2d85ed]" />
        <div className="absolute right-[9px] bottom-[7px] w-[11px] h-1 flex items-center justify-center">
          <ArrowRight className="w-2 h-2 text-[#75b7ea]" />
        </div>
        <span className="absolute right-6 bottom-1.5 w-[21px] h-2 flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#75b7ea] text-[5px] text-center tracking-[0] leading-[normal]">
          Contato
        </span>
      </button>

      {/* Navigation */}
      <nav className="absolute inset-0" aria-label="Main navigation">
        {navigationItems.map((item, index) => (
          <div
            key={index}
            className={`absolute ${item.position} flex items-center justify-center ${item.className} tracking-[0] leading-[normal] whitespace-nowrap`}
          >
            {item.text}
          </div>
        ))}
      </nav>

      {/* Logo icon */}
      <div className="absolute right-[448px] bottom-[228px] w-[9px] h-2.5 flex items-center justify-center">
        <MessageCircle className="w-2 h-2 text-[#3b82f6]" />
      </div>
    </header>
  );
};
