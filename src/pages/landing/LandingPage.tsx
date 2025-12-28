import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

// Animated Counter Hook
const useCountUp = (end: number, duration: number = 2000) => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [isVisible, end, duration]);

  return { count, ref };
};

export default function LandingPage() {
  const { count: transferCount, ref: counterRef } = useCountUp(90, 2500);

  return (
    <div className="min-h-screen bg-[#F8FAFC] overflow-x-hidden font-['Inter',sans-serif]">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#F8FAFC]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#1E3A5F] flex items-center justify-center">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-[#1E3A5F] tracking-tight">PAYROT</span>
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#" className="text-[#64748B] hover:text-[#1E3A5F] transition-colors text-sm font-medium">
              Freelancer
            </a>
            <a href="#" className="text-[#64748B] hover:text-[#1E3A5F] transition-colors text-sm font-medium">
              Business
            </a>
            <a href="#" className="text-[#64748B] hover:text-[#1E3A5F] transition-colors text-sm font-medium">
              Marketplace
            </a>
            <a href="#" className="text-[#64748B] hover:text-[#1E3A5F] transition-colors text-sm font-medium">
              Fees
            </a>
          </nav>

          {/* Contact Button */}
          <Link to="/auth">
            <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-full px-6 py-2 text-sm font-medium">
              Contact
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen pt-20 overflow-hidden">
        {/* Giant Watermark */}
        <div className="absolute inset-0 flex items-start justify-center pt-24 pointer-events-none select-none">
          <h1 className="text-[120px] md:text-[200px] lg:text-[280px] font-black text-[#E8EEF4] tracking-[0.08em]">
            PAYROT
          </h1>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-16 min-h-[85vh] flex items-center">
          <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            
            {/* Left - Globe Card */}
            <div className="flex justify-center lg:justify-start">
              <div className="relative">
                {/* Globe Container */}
                <div className="w-[220px] h-[220px] md:w-[280px] md:h-[280px] rounded-full bg-gradient-to-br from-[#1E3A5F] via-[#3B82F6] to-[#60A5FA] shadow-2xl shadow-[#3B82F6]/30 animate-float relative overflow-hidden">
                  {/* Globe Lines */}
                  <div className="absolute inset-4 rounded-full border border-white/20" />
                  <div className="absolute inset-8 rounded-full border border-white/15" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-[1px] bg-white/20" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-full w-[1px] bg-white/20" />
                  </div>
                  {/* Continents placeholder */}
                  <div className="absolute top-1/4 left-1/3 w-12 h-8 bg-[#22C55E]/40 rounded-full blur-sm" />
                  <div className="absolute top-1/2 right-1/4 w-8 h-6 bg-[#22C55E]/40 rounded-full blur-sm" />
                  <div className="absolute bottom-1/3 left-1/4 w-10 h-5 bg-[#22C55E]/40 rounded-full blur-sm" />
                </div>
                
                {/* Text Card */}
                <div className="absolute -left-4 bottom-0 bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-lg max-w-[180px]">
                  <p className="text-[#3B82F6] font-semibold text-sm">Send And Receive</p>
                  <p className="text-[#64748B] text-xs mt-1">Money Worldwide Fast, Secure, And <span className="font-semibold text-[#1E3A5F]">Hassle-Free</span></p>
                </div>
              </div>
            </div>

            {/* Center - Mascot Area */}
            <div className="flex justify-center relative">
              {/* Badge floating */}
              <div className="absolute -top-4 right-0 md:right-8 z-20 animate-float-slow">
                <div className="bg-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#EF4444] border-2 border-white" />
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] border-2 border-white" />
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#10B981] to-[#14B8A6] border-2 border-white" />
                  </div>
                  <span className="text-sm font-bold text-[#1E3A5F]">7M+ Users</span>
                </div>
              </div>

              {/* Mascot Placeholder (Blue Macaw) */}
              <div className="w-[280px] h-[350px] md:w-[340px] md:h-[420px] relative">
                <div className="absolute inset-0 bg-gradient-to-b from-[#3B82F6]/20 via-[#60A5FA]/30 to-transparent rounded-[60px] blur-3xl" />
                <div className="relative w-full h-full rounded-[40px] bg-gradient-to-b from-[#60A5FA]/10 to-transparent flex items-center justify-center">
                  {/* Stylized Bird Shape */}
                  <div className="relative">
                    <div className="w-32 h-40 bg-gradient-to-br from-[#3B82F6] to-[#1E3A5F] rounded-[30px] transform -rotate-6" />
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-20 h-20 bg-gradient-to-br from-[#60A5FA] to-[#3B82F6] rounded-full" />
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#1E3A5F] rounded-full" />
                    <div className="absolute top-0 left-1/2 translate-x-2 w-6 h-3 bg-[#F59E0B] rounded-full transform rotate-12" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Credit Card */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative animate-float">
                {/* Credit Card */}
                <div className="w-[280px] md:w-[320px] transform rotate-[10deg] hover:rotate-[5deg] transition-transform duration-500">
                  <div className="bg-gradient-to-br from-[#1E3A5F] via-[#3B82F6] to-[#60A5FA] rounded-2xl p-6 shadow-2xl shadow-[#3B82F6]/40 aspect-[1.6/1] relative overflow-hidden">
                    {/* Card Pattern */}
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
                    
                    {/* Chip */}
                    <div className="w-12 h-9 bg-gradient-to-br from-[#FCD34D] to-[#F59E0B] rounded-lg mb-6 relative overflow-hidden">
                      <div className="absolute inset-1 grid grid-cols-3 gap-[2px]">
                        {[...Array(6)].map((_, i) => (
                          <div key={i} className="bg-[#D97706]/30 rounded-sm" />
                        ))}
                      </div>
                    </div>
                    
                    {/* Card Number */}
                    <p className="text-white font-mono text-lg tracking-[0.15em] mb-6">
                      0467 3867 0099 3441
                    </p>
                    
                    {/* Card Footer */}
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-white/50 text-[10px] uppercase tracking-wider mb-1">Cardholder</p>
                        <p className="text-white font-medium text-sm">MAMOA JANNA</p>
                      </div>
                      <p className="text-white font-bold text-2xl italic">VISA</p>
                    </div>
                  </div>
                </div>

                {/* Small Payrot badge */}
                <div className="absolute -top-6 -right-4 bg-white rounded-xl p-3 shadow-lg animate-float-slow">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#1E3A5F] flex items-center justify-center">
                      <Globe className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-[#1E3A5F]">PAYROT</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Open Account Button */}
        <div className="relative z-10 flex justify-center pb-8">
          <Link to="/trial">
            <Button variant="outline" className="rounded-full px-6 py-3 border-[#1E3A5F] text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white transition-all">
              Open Account
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="relative py-16 border-t border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            {/* Left - Description */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-[#1E3A5F] flex items-center justify-center">
                  <Globe className="w-4 h-4 text-white" />
                </div>
                <div className="w-8 h-8 rounded-full bg-[#3B82F6] flex items-center justify-center">
                  <div className="w-3 h-3 bg-white rounded-full" />
                </div>
              </div>
              <p className="text-[#64748B] text-sm leading-relaxed mb-4">
                Payrot empowers users to send and receive payments globally.
              </p>
              <a href="#" className="text-[#1E3A5F] text-sm font-semibold underline underline-offset-4 hover:text-[#3B82F6] transition-colors">
                OUR SERVICES
              </a>
            </div>

            {/* Center - Main Text */}
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-[#1E3A5F] leading-tight">
                FAST SEND,
                <br />
                <span className="bg-gradient-to-b from-[#1E3A5F] to-[#94A3B8] bg-clip-text text-transparent">
                  FAST RECEIVE
                </span>
              </h2>
            </div>

            {/* Right - Counter */}
            <div className="text-right" ref={counterRef}>
              <div className="inline-block">
                <div className="border border-[#E2E8F0] rounded-full px-4 py-1 mb-2 inline-block">
                  <span className="text-xs text-[#64748B] uppercase tracking-wider">Total Transfers</span>
                </div>
                <div className="flex items-baseline justify-end gap-2">
                  <span className="text-5xl md:text-6xl lg:text-7xl font-black text-[#3B82F6]">
                    {transferCount}M+
                  </span>
                </div>
                <p className="text-[#64748B] text-sm mt-1">Payment Processed With Payrot</p>
                <a href="#" className="text-[#3B82F6] text-sm font-semibold hover:underline inline-flex items-center gap-1 mt-2">
                  VIEW STATS <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Hire and Pay Section */}
      <section className="py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left - Content */}
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 rounded-full bg-[#1E3A5F] flex items-center justify-center">
                  <Globe className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs font-semibold text-[#1E3A5F] tracking-wider">PAYROT</span>
                <span className="text-[#64748B] text-xs">Fast, Easy, Pay Anywhere</span>
              </div>

              <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-[#1E3A5F] leading-tight mb-6">
                HIRE AND PAY GLOBALLY
                <br />
                <span className="text-[#3B82F6]">WITH PAYROT</span>
              </h2>

              <p className="text-[#64748B] leading-relaxed mb-6 max-w-md">
                <span className="text-[#3B82F6] font-semibold">Payrot</span> Workforce Helps You Onboard And Pay Freelancers Or Contractors Across <span className="font-semibold text-[#1E3A5F]">150+ Countries</span> Quickly, Securely, And Without Borders.
              </p>

              <a href="#" className="inline-flex items-center gap-2 text-[#3B82F6] font-semibold text-sm hover:gap-3 transition-all">
                EXPLORE WORKFORCE TOOLS
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            {/* Right - Person with floating cards */}
            <div className="relative flex justify-center">
              {/* Person placeholder */}
              <div className="w-[300px] h-[380px] md:w-[360px] md:h-[450px] relative">
                <div className="absolute inset-0 bg-gradient-to-b from-[#60A5FA]/20 to-transparent rounded-[40px]" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[280px] h-[320px] bg-gradient-to-b from-[#3B82F6]/10 to-[#1E3A5F]/5 rounded-t-[100px]" />
                {/* Laptop */}
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-40 h-24 bg-gradient-to-br from-[#64748B] to-[#94A3B8] rounded-lg transform perspective-500 rotateX-10" />
              </div>

              {/* Floating Card - PAYROT */}
              <div className="absolute top-4 left-0 md:-left-8 animate-float-slow">
                <div className="bg-white rounded-2xl p-4 shadow-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#1E3A5F] flex items-center justify-center">
                      <Globe className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#1E3A5F]">PAYROT</p>
                      <p className="text-[10px] text-[#64748B]">Fast, Easy, Pay Anywhere</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Card - 1500 USD */}
              <div className="absolute bottom-32 -left-4 md:-left-12 animate-float">
                <div className="bg-[#1E3A5F] rounded-2xl p-4 shadow-xl text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">1500 USD</p>
                      <p className="text-xs text-white/70">Paid</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Card - Payment Request */}
              <div className="absolute top-20 -right-4 md:-right-8 animate-float">
                <div className="bg-white rounded-2xl p-4 shadow-xl border border-[#E2E8F0]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#DCFCE7] flex items-center justify-center">
                      <Check className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1E3A5F]">PAYMENT REQUEST</p>
                      <p className="text-xs text-[#22C55E]">Sent</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Grow Beyond Section */}
      <section className="relative bg-[#152942] pt-32 pb-20 overflow-hidden">
        {/* White Curve */}
        <div className="absolute top-0 left-0 right-0 h-32 overflow-hidden">
          <svg
            viewBox="0 0 1440 120"
            className="absolute bottom-0 w-full h-full"
            preserveAspectRatio="none"
          >
            <path
              d="M0,120 L0,60 Q720,120 1440,60 L1440,120 Z"
              fill="#F8FAFC"
            />
          </svg>
        </div>

        {/* Globe on curve */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 z-10">
          <div className="w-[200px] h-[200px] md:w-[280px] md:h-[280px] rounded-full bg-gradient-to-br from-[#1E3A5F] via-[#3B82F6] to-[#60A5FA] shadow-2xl shadow-[#3B82F6]/50 animate-float relative overflow-hidden">
            {/* Globe Lines */}
            <div className="absolute inset-4 rounded-full border border-white/20" />
            <div className="absolute inset-8 rounded-full border border-white/15" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-[1px] bg-white/20" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-full w-[1px] bg-white/20" />
            </div>
            {/* Continents */}
            <div className="absolute top-1/4 left-1/3 w-12 h-8 bg-[#22C55E]/40 rounded-full blur-sm" />
            <div className="absolute top-1/2 right-1/4 w-8 h-6 bg-[#22C55E]/40 rounded-full blur-sm" />
            <div className="absolute bottom-1/3 left-1/4 w-10 h-5 bg-[#22C55E]/40 rounded-full blur-sm" />
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center pt-20">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
            GROW BEYOND
            <br />
            BORDERS WITH PAYROT
          </h2>

          <p className="text-white/70 max-w-xl mx-auto mb-8 leading-relaxed">
            Whether You're Paying A Freelancer Or A Full Team Overseas, Payrot Makes It Simple Fast, Secure, And With No Card Fees To Worry About.
          </p>

          <Button
            variant="outline"
            className="rounded-full px-8 py-6 border-white text-white bg-transparent hover:bg-white hover:text-[#152942] transition-all text-sm font-medium"
          >
            Explore More
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>

        {/* Bottom decoration */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#0F1F33] to-transparent" />
      </section>

      {/* Custom Styles */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-float-slow {
          animation: float-slow 5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
