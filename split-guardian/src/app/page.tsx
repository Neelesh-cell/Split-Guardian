import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans selection:bg-indigo-500/30">
      
      {/* Navigation Bar */}
      <nav className="w-full bg-gray-900/50 backdrop-blur-md border-b border-gray-800 p-6 flex justify-between items-center fixed top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-full border border-indigo-500/20 shadow-inner">
            <svg className="w-6 h-6 text-indigo-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-white">
            Split-<span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Guardian</span>
          </span>
        </div>
        <div className="flex gap-4">
          <Link href="/connect" className="text-sm font-semibold text-gray-300 hover:text-white transition-colors py-2 px-4">
            Sign In
          </Link>
          <Link href="/connect" className="text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white py-2 px-5 rounded-lg transition-colors border border-indigo-500 shadow-lg shadow-indigo-500/20">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 mt-24 text-center">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none flex justify-center items-center">
          <div className="w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px] opacity-50 mix-blend-screen"></div>
          <div className="w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[100px] opacity-50 mix-blend-screen -translate-x-32 translate-y-32"></div>
        </div>

        <div className="relative z-10 max-w-4xl space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold uppercase tracking-widest mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live Institutional Grade Execution
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-white leading-[1.1]">
            Automated Stock Split Execution for <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Professional Portfolios</span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto font-medium leading-relaxed">
            Eliminate human latency. Split-Guardian automatically detects and acts on forward and reverse stock splits using predefined sizing rules directly inside your Alpaca brokerage account.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Link 
              href="/connect" 
              className="w-full sm:w-auto text-lg font-bold px-10 py-4 rounded-xl transition-all border border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] hover:shadow-[0_0_60px_-15px_rgba(79,70,229,0.7)] hover:-translate-y-1"
            >
              Get Started Now
            </Link>
            <a 
              href="#features" 
              className="w-full sm:w-auto text-lg font-semibold px-10 py-4 rounded-xl transition-all border border-gray-700 bg-gray-900/50 hover:bg-gray-800 text-gray-300 backdrop-blur-sm"
            >
              Explore Features
            </a>
          </div>
        </div>
      </main>

      {/* Feature Section (Stub) */}
      <section id="features" className="py-24 bg-gray-950/80 border-t border-gray-900 z-10 relative">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 p-8 rounded-2xl hover:border-indigo-500/50 transition-colors group">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Zero Latency Execution</h3>
            <p className="text-gray-400">Our Hunter background script triggers trades the millisecond a split signal is verified on the market.</p>
          </div>
          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 p-8 rounded-2xl hover:border-cyan-500/50 transition-colors group">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Risk Protection</h3>
            <p className="text-gray-400">Strictly isolated, multi-tenant execution ensures your portfolio settings are respected without fail.</p>
          </div>
          <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 p-8 rounded-2xl hover:border-emerald-500/50 transition-colors group">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Sizing Mastery</h3>
            <p className="text-gray-400">Dynamically scale trades by fractional dollars or exact quantities to fit your trading style.</p>
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-sm text-gray-500 border-t border-gray-900 bg-gray-950 z-10 flex flex-col md:flex-row justify-center items-center gap-6">
        <p>© {new Date().getFullYear()} Split-Guardian SaaS.</p>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-indigo-400 transition-colors">Privacy Policy</Link>
          <span>|</span>
          <Link href="/terms" className="hover:text-indigo-400 transition-colors">Terms of Use</Link>
        </div>
      </footer>
    </div>
  );
}
