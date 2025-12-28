import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Globe, Check, CreditCard } from "lucide-react";
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
      {/* Custom animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes float-card {
          0%, 100% { transform: translateY(0px) rotate(12deg); }
          50% { transform: translateY(-12px) rotate(12deg); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-float-slow {
          animation: float-slow 5s ease-in-out infinite 0.5s;
        }
        .animate-float-card {
          animation: float-card 4.5s ease-in-out infinite 0.3s;
        }
      `}</style>

      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#F8FAFC]/80 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-24 py-4 flex items-center justify-between">
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

      {/* Hero Section - Asymmetric 25% | 50% | 25% */}
      <section className="relative min-h-[650px] pt-24 overflow-hidden">
        {/* Giant Watermark - Behind everything */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <h1 className="text-[100px] md:text-[180px] lg:text-[260px] font-black text-[#1E3A5F]/[0.03] tracking-[0.05em]">
            PAYROT
          </h1>
        </div>

        {/* Hero Content - 3 Asymmetric Columns */}
        <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-24 pt-8">
          <div className="grid grid-cols-12 gap-4 min-h-[550px]">
            
            {/* Left Column - 25% (3 cols) */}
            <div className="col-span-12 md:col-span-3 flex flex-col pt-8">
              {/* Globe at top */}
              <div className="relative w-[200px] h-[200px] animate-float">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-[#1E3A5F] via-[#3B82F6] to-[#60A5FA] shadow-2xl shadow-[#3B82F6]/30 relative overflow-hidden">
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
                  <div className="absolute top-1/4 left-1/3 w-10 h-6 bg-[#22C55E]/40 rounded-full blur-sm" />
                  <div className="absolute top-1/2 right-1/4 w-8 h-5 bg-[#22C55E]/40 rounded-full blur-sm" />
                  <div className="absolute bottom-1/3 left-1/4 w-8 h-4 bg-[#22C55E]/40 rounded-full blur-sm" />
                </div>
              </div>
              
              {/* Text card - overlapping globe bottom */}
              <div className="relative -mt-6 ml-6 bg-white/95 backdrop-blur-sm rounded-2xl p-5 max-w-[200px] shadow-xl border border-[#E2E8F0]">
                <p className="text-[#3B82F6] font-bold text-base mb-1">Send And Receive</p>
                <p className="text-[#64748B] text-sm leading-relaxed">
                  Money Worldwide Fast, Secure, And <span className="font-semibold text-[#1E3A5F]">Hassle-Free</span>
                </p>
              </div>
            </div>

            {/* Center Column - 50% (6 cols) - ARARA DOMINANTE */}
            <div className="col-span-12 md:col-span-6 relative flex flex-col items-center">
              {/* 7M+ Users badge - top right of arara */}
              <div className="absolute top-0 right-4 md:right-12 z-20 animate-float-slow">
                <div className="bg-white rounded-full px-4 py-2.5 shadow-lg flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#F59E0B] to-[#EF4444] border-2 border-white" />
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] border-2 border-white" />
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#10B981] to-[#14B8A6] border-2 border-white" />
                  </div>
                  <span className="text-sm font-bold text-[#1E3A5F]">7M+</span>
                  <span className="text-[#64748B] text-xs">USERS</span>
                </div>
              </div>

              {/* ARARA - Large and dominant - ~400px height */}
              <div className="relative mt-8 animate-float-slow">
                {/* Background glow */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#3B82F6]/20 via-[#60A5FA]/30 to-transparent rounded-[60px] blur-3xl scale-110" />
                
                {/* Arara container */}
                <div className="relative w-[300px] h-[400px] md:w-[340px] md:h-[450px]">
                  {/* Arara body */}
                  <div className="absolute inset-0 bg-gradient-to-b from-[#60A5FA]/10 to-transparent rounded-[40px]" />
                  
                  {/* Stylized Bird */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                      {/* Body */}
                      <div className="w-[180px] h-[280px] bg-gradient-to-b from-[#3B82F6] via-[#2563EB] to-[#1E3A5F] rounded-[50px] transform -rotate-3 shadow-2xl" />
                      
                      {/* Head */}
                      <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[140px] h-[140px] bg-gradient-to-br from-[#60A5FA] via-[#3B82F6] to-[#2563EB] rounded-full shadow-xl">
                        {/* Eye */}
                        <div className="absolute top-8 right-6 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-inner">
                          <div className="w-5 h-5 bg-[#1E3A5F] rounded-full">
                            <div className="w-2 h-2 bg-white rounded-full ml-1 mt-1" />
                          </div>
                        </div>
                        {/* Beak */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-16 bg-gradient-to-b from-[#1E3A5F] to-[#0F172A] rounded-b-[30px] rounded-t-lg shadow-lg" />
                      </div>
                      
                      {/* Feather details */}
                      <div className="absolute top-20 left-0 w-4 h-24 bg-[#60A5FA]/60 rounded-full transform -rotate-12" />
                      <div className="absolute top-24 right-0 w-4 h-20 bg-[#60A5FA]/60 rounded-full transform rotate-12" />
                    </div>
                  </div>
                </div>
                
                {/* Interactive dot below arara */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center cursor-pointer hover:scale-110 transition-transform border border-[#E2E8F0]">
                  <div className="w-3 h-3 rounded-full bg-[#3B82F6]" />
                </div>
              </div>
            </div>

            {/* Right Column - 25% (3 cols) */}
            <div className="col-span-12 md:col-span-3 flex flex-col items-end pt-4">
              {/* Small Payrot badges at top */}
              <div className="flex flex-col gap-2 items-end mb-12">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md text-xs text-[#64748B] flex items-center gap-2 border border-[#E2E8F0]">
                  <div className="w-5 h-5 rounded bg-[#3B82F6] flex items-center justify-center">
                    <Globe className="w-3 h-3 text-white" />
                  </div>
                  <span className="font-medium text-[#1E3A5F]">PAYROT</span>
                </div>
                <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md text-xs text-[#64748B] flex items-center gap-2 border border-[#E2E8F0]">
                  <div className="w-5 h-5 rounded bg-[#3B82F6] flex items-center justify-center">
                    <Globe className="w-3 h-3 text-white" />
                  </div>
                  <span className="font-medium text-[#1E3A5F]">PAYROT</span>
                </div>
              </div>

              {/* Credit Card - positioned lower, rotated 12deg, floating */}
              <div className="relative mt-8 animate-float-card">
                <div 
                  className="w-[280px] h-[175px] rounded-2xl bg-gradient-to-br from-[#1E3A5F] via-[#3B82F6] to-[#60A5FA] p-5 shadow-2xl shadow-[#3B82F6]/40 relative overflow-hidden"
                  style={{ transform: 'rotate(12deg)' }}
                >
                  {/* Card patterns */}
                  <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
                  
                  {/* Contactless icon */}
                  <div className="absolute top-4 right-4 flex items-center gap-1">
                    <svg className="w-6 h-6 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8.5 14.5A5 5 0 0 1 8 12a5 5 0 0 1 .5-2.5" />
                      <path d="M12 17a7 7 0 0 1 0-10" />
                      <path d="M15.5 19.5a9 9 0 0 0 0-15" />
                    </svg>
                  </div>
                  
                  {/* Chip */}
                  <div className="w-10 h-7 bg-gradient-to-br from-[#FCD34D] to-[#F59E0B] rounded-md mb-4 mt-2 relative overflow-hidden">
                    <div className="absolute inset-1 grid grid-cols-3 gap-[2px]">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="bg-[#D97706]/30 rounded-sm" />
                      ))}
                    </div>
                  </div>
                  
                  {/* Card number */}
                  <p className="text-white font-mono text-sm tracking-[0.12em] mb-3">
                    5467 3867 0099 3441
                  </p>
                  
                  {/* Card footer */}
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-white/50 text-[9px] uppercase tracking-wider">Cardholder</p>
                      <p className="text-white font-medium text-xs">HAMIDA JANNAT</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white/50 text-[9px]">VALID</p>
                      <p className="text-white text-xs">07/30</p>
                    </div>
                    <span className="text-white font-bold text-lg italic">VISA</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Open Account Button - centered below hero */}
        <div className="relative z-10 flex justify-center mt-4 pb-8">
          <Link to="/trial">
            <Button variant="outline" className="rounded-full px-6 py-3 border-[#94A3B8] text-[#64748B] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-all">
              Open Account
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Statistics Section - 3 Columns 30|40|30 */}
      <section className="py-16 border-t border-b border-[#E2E8F0]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-24">
          <div className="grid grid-cols-12 gap-8 items-start">
            
            {/* Left Column - 30% */}
            <div className="col-span-12 md:col-span-4 flex flex-col">
              {/* Social icons at top */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-[#1E3A5F] flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <div className="w-10 h-10 rounded-full bg-[#3B82F6] flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
                  <CreditCard className="w-5 h-5 text-white" />
                </div>
              </div>
              
              {/* Description */}
              <p className="text-[#64748B] text-base leading-relaxed mb-6 max-w-[280px]">
                Payrot empowers users to send and receive payments globally.
              </p>
              
              {/* Link */}
              <a href="#" className="text-[#1E3A5F] text-sm font-semibold underline underline-offset-4 hover:text-[#3B82F6] transition-colors">
                OUR SERVICES
              </a>
            </div>

            {/* Center Column - 40% */}
            <div className="col-span-12 md:col-span-4 flex flex-col items-center text-center">
              {/* Main title */}
              <h2 className="text-4xl lg:text-5xl font-black leading-tight">
                <span className="text-[#1E3A5F]">FAST SEND,</span>
                <br />
                <span className="bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] bg-clip-text text-transparent">
                  FAST RECEIVE
                </span>
              </h2>
            </div>

            {/* Right Column - 30% */}
            <div className="col-span-12 md:col-span-4 flex flex-col items-end text-right" ref={counterRef}>
              {/* Badge at top */}
              <div className="border border-[#94A3B8] rounded-full px-4 py-1.5 text-xs text-[#64748B] font-medium mb-4">
                TOTAL TRANSFERS
              </div>
              
              {/* Counter */}
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-6xl lg:text-7xl font-black text-[#1E3A5F]">
                  {transferCount}M
                </span>
                <span className="text-5xl lg:text-6xl font-black text-[#60A5FA]">+</span>
              </div>
              
              {/* Side text */}
              <p className="text-[#64748B] text-sm mb-4">
                Payment Processed With Payrot
              </p>
              
              {/* Link */}
              <a href="#" className="text-[#3B82F6] text-sm font-semibold flex items-center gap-1 hover:underline">
                VIEW STATS <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Hire and Pay Section - 2 Columns 40|60 */}
      <section className="py-24">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-24">
          <div className="grid grid-cols-12 gap-8 items-center">
            
            {/* Left Column - 40% (5 cols) */}
            <div className="col-span-12 md:col-span-5">
              {/* Badge */}
              <div className="flex items-center gap-2 mb-6">
                <div className="w-6 h-6 rounded bg-[#1E3A5F] flex items-center justify-center">
                  <Globe className="w-3 h-3 text-white" />
                </div>
                <span className="text-xs font-semibold text-[#1E3A5F] tracking-wider">PAYROT</span>
                <span className="text-[#64748B] text-xs">Fast, Easy, Pay Anywhere</span>
              </div>
              
              {/* Title */}
              <h2 className="text-4xl lg:text-5xl font-black text-[#1E3A5F] leading-tight mb-2">
                HIRE AND PAY
                <br />
                GLOBALLY
              </h2>
              <h2 className="text-4xl lg:text-5xl font-black text-[#60A5FA] mb-6">
                WITH PAYROT
              </h2>
              
              {/* Description */}
              <p className="text-[#64748B] text-base leading-relaxed mb-8 max-w-[380px]">
                <span className="text-[#3B82F6] font-semibold">Payrot</span> Workforce Helps You Onboard And Pay Freelancers Or Contractors Across <span className="font-semibold text-[#1E3A5F]">150+ Countries</span> Quickly, Securely, And Without Borders.
              </p>
              
              {/* Link */}
              <a href="#" className="text-[#1E3A5F] text-sm font-semibold flex items-center gap-2 hover:text-[#3B82F6] transition-colors group">
                EXPLORE WORKFORCE TOOLS 
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>

            {/* Right Column - 60% (7 cols) */}
            <div className="col-span-12 md:col-span-7">
              <div className="relative h-[500px] flex items-center justify-center">
                
                {/* Person placeholder - centered */}
                <div className="w-[280px] h-[380px] bg-gradient-to-b from-[#E2E8F0] to-[#CBD5E1] rounded-3xl flex flex-col items-center justify-center relative overflow-hidden">
                  {/* Person silhouette */}
                  <div className="w-24 h-24 rounded-full bg-[#94A3B8] mb-4" />
                  <div className="w-40 h-48 bg-[#94A3B8]/60 rounded-t-3xl" />
                  {/* Laptop */}
                  <div className="absolute bottom-16 w-32 h-20 bg-gradient-to-br from-[#64748B] to-[#94A3B8] rounded-lg shadow-lg" />
                </div>

                {/* Floating Card 1 - TOP LEFT - above and left of head */}
                <div className="absolute top-8 left-8 bg-white rounded-2xl px-4 py-3 shadow-xl animate-float flex items-center gap-2 border border-[#E2E8F0]">
                  <div className="w-8 h-8 rounded-lg bg-[#1E3A5F] flex items-center justify-center">
                    <Globe className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-[#1E3A5F] font-bold text-sm">PAYROT</p>
                    <p className="text-[#64748B] text-[10px]">Fast, Easy, Pay Anywhere</p>
                  </div>
                </div>

                {/* Floating Card 2 - MIDDLE LEFT - chest height */}
                <div className="absolute top-1/2 -translate-y-1/2 left-0 bg-[#1E3A5F] rounded-2xl px-4 py-3 shadow-xl animate-float-slow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-lg">1500 USD</p>
                      <p className="text-green-400 text-xs font-medium">Paid</p>
                    </div>
                  </div>
                </div>

                {/* Floating Card 3 - TOP RIGHT - shoulder height */}
                <div className="absolute top-20 right-0 bg-white rounded-2xl px-4 py-3 shadow-xl animate-float border border-[#E2E8F0]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#DCFCE7] flex items-center justify-center">
                      <Check className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <div>
                      <p className="text-[#1E3A5F] font-semibold text-sm">PAYMENT REQUEST</p>
                      <p className="text-[#22C55E] text-xs font-medium">Sent</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Grow Beyond Section */}
      <section className="relative bg-[#152942] pt-0 pb-24 overflow-hidden">
        {/* White curved transition - 60% width, centered */}
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[120px] bg-[#F8FAFC]"
          style={{ borderRadius: '0 0 50% 50%' }}
        />
        
        {/* Globe overlapping the curve */}
        <div className="relative z-10 flex justify-center" style={{ marginTop: '-30px' }}>
          <div className="w-[250px] h-[250px] rounded-full bg-gradient-to-br from-[#3B82F6] via-[#2563EB] to-[#1E3A5F] shadow-2xl flex items-center justify-center animate-float-slow border-4 border-white/20 relative overflow-hidden">
            {/* Globe lines */}
            <div className="absolute inset-4 rounded-full border border-white/20" />
            <div className="absolute inset-8 rounded-full border border-white/15" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-[1px] bg-white/20" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-full w-[1px] bg-white/20" />
            </div>
            <Globe className="w-24 h-24 text-white/50" />
          </div>
        </div>

        {/* Content */}
        <div className="max-w-[600px] mx-auto px-6 text-center mt-16">
          <h2 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
            GROW BEYOND
            <br />
            <span className="text-[#60A5FA]">BORDERS WITH PAYROT</span>
          </h2>
          
          <p className="text-white/70 text-base leading-relaxed mb-8 max-w-[480px] mx-auto">
            Expand your business internationally with our seamless cross-border payment solutions. Connect with clients and partners worldwide.
          </p>
          
          <button className="border-2 border-white text-white px-8 py-3 rounded-full font-medium hover:bg-white hover:text-[#152942] transition-colors inline-flex items-center gap-2">
            Explore More <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0F172A] py-12">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-24 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#3B82F6] flex items-center justify-center">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-lg">PAYROT</span>
          </div>
          <p className="text-white/50 text-sm">
            © 2024 Payrot. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
