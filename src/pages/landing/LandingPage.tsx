import React from "react";
import { ContactSection } from "./components/ContactSection";
import { InfoSection } from "./components/InfoSection";
import { ServicesSection } from "./components/ServicesSection";
import { TestimonialsSection } from "./components/TestimonialsSection";

const LandingPage = (): JSX.Element => {
  return (
    <div className="w-full min-w-[478px] min-h-[818px] flex bg-gradient-to-b from-[#f8fafc] to-[#e8f4fc]">
      <div className="h-[818px] flex-1 relative">
        {/* Background decorative images - placeholders */}
        <div
          className="absolute right-0 bottom-[546px] w-[478px] h-[272px] bg-gradient-to-br from-[#e8f4fc] to-[#d4e8f5] opacity-50"
        />
        <div
          className="absolute right-0 bottom-0 w-[478px] h-[550px] bg-gradient-to-t from-[#0a1628] to-transparent opacity-30"
        />

        {/* Main content container */}
        <div className="absolute right-0 bottom-2 w-[478px] h-[810px]">
          <ContactSection />
          <TestimonialsSection />
          
          {/* Decorative image placeholder between sections */}
          <div
            className="absolute right-0.5 bottom-[464px] w-[466px] h-[321px] bg-gradient-to-br from-[#f0f7fc] to-[#e4f0f8] opacity-40"
          />
          
          <ServicesSection />
          <InfoSection />
        </div>

        {/* Border decorative lines - placeholders */}
        <div
          className="absolute right-0 bottom-[816px] w-[478px] h-0.5 bg-gradient-to-r from-transparent via-[#d4e8f5] to-transparent"
        />
        <div
          className="absolute right-0 bottom-0 w-0.5 h-[818px] bg-gradient-to-b from-[#d4e8f5] to-transparent"
        />
        <div
          className="absolute right-[476px] bottom-0 w-0.5 h-[818px] bg-gradient-to-b from-[#d4e8f5] to-transparent"
        />
      </div>
    </div>
  );
};

export default LandingPage;
