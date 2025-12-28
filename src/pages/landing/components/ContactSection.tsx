import React from "react";
import { Globe, ArrowRight } from "lucide-react";

export const ContactSection = (): JSX.Element => {
  return (
    <section className="absolute right-[11px] bottom-0 w-[465px] h-[274px]">
      {/* Background gradient */}
      <div
        className="absolute right-1.5 bottom-[7px] w-[446px] h-[213px] bg-gradient-to-br from-[#0a1628] via-[#0f2744] to-[#1a365d] rounded-3xl"
      />

      {/* Explore More button */}
      <button
        className="absolute right-[196px] bottom-[33px] w-[66px] h-[21px] cursor-pointer"
        aria-label="Explorar Mais"
      >
        <div className="absolute right-0 bottom-px w-[65px] h-[19px] bg-[#0e3251] rounded-[9px] border border-solid border-[#7493a8]" />
        <div className="absolute right-[9px] bottom-2 w-[11px] h-1 flex items-center justify-center">
          <ArrowRight className="w-2 h-1 text-[#71889a]" />
        </div>
        <span className="absolute right-6 bottom-1.5 w-8 h-[9px] flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#71889a] text-[5px] tracking-[0] leading-[normal]">
          Explorar Mais
        </span>
      </button>

      {/* Globe placeholder */}
      <div className="absolute right-40 bottom-[141px] w-[133px] h-[125px] bg-gradient-to-br from-[#1e3a5f] to-[#0f2744] rounded-full flex items-center justify-center border border-[#2d4a6f]">
        <Globe className="w-16 h-16 text-[#4a90c2]" />
      </div>

      {/* Description text */}
      <p className="absolute right-[133px] bottom-[60px] w-[189px] h-5 flex items-center justify-center [font-family:'Inter',Helvetica] font-light text-[#446987] text-[5px] tracking-[0] leading-[8.7px]">
        Seja atendendo clientes locais ou internacionais, ChatGo
        <br />
        torna tudo simples, rápido, seguro e sem taxas ocultas.
      </p>

      {/* Main headline */}
      <h2 className="absolute right-[124px] bottom-[85px] w-[206px] h-[42px] flex items-center justify-center [font-family:'Inter',Helvetica] font-medium text-[#c2ccd3] text-base text-center tracking-[0] leading-[16.1px]">
        CRESÇA ALÉM
        <br />
        DAS FRONTEIRAS COM CHATGO
      </h2>
    </section>
  );
};
