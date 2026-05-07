'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ConnectPage() {
  const [email, setEmail] = useState('');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('split_guardian_session');
    if (stored) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleConnect = () => {
    if (!email) return alert('Please enter an email address.');

    const devEmail = process.env.NEXT_PUBLIC_DEV_EMAIL;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Developer Backdoor
    if (isLocalhost || (devEmail && email === devEmail)) {
      localStorage.setItem('split_guardian_session', email);
      router.push('/dashboard');
      return;
    }

    // Standard OAuth Flow
    const clientId = process.env.NEXT_PUBLIC_ALPACA_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/alpaca/callback`;
    const authUrl = `https://app.alpaca.markets/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=account:write%20trading&state=${encodeURIComponent(email)}`;
    window.location.href = authUrl;
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-6 selection:bg-indigo-500/30">
      <div className="max-w-md w-full bg-gray-900/50 backdrop-blur-md border border-gray-800 p-8 rounded-3xl shadow-2xl text-center">
        
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-indigo-500/10 rounded-full border border-indigo-500/20 shadow-inner">
            <svg className="w-12 h-12 text-indigo-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
          Connect <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Broker</span>
        </h1>
        <p className="text-gray-400 mb-8 font-medium">Link Alpaca to begin automated execution.</p>

        <div className="space-y-5">
          <input 
            type="email" 
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
          />

          <div className="bg-gray-800/30 border border-gray-700/50 p-4 rounded-xl text-left space-y-2">
            <p className="text-[11px] text-gray-400 font-semibold mb-1">By connecting to Alpaca, you acknowledge:</p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              <strong>Access:</strong> Split-Guardian will have access to your account info and authorization to place trades at your direction.
            </p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              <strong>No Guarantee:</strong> Alpaca does not warrant or guarantee that Split-Guardian will perform as advertised or expected.
            </p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              <strong>Due Diligence:</strong> Please ensure you learn more about Split-Guardian before authorizing.
            </p>
          </div>

          <button 
            onClick={handleConnect}
            className="w-full font-bold py-3.5 rounded-xl transition-all border border-indigo-500 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
          >
            Connect to Alpaca
          </button>
        </div>
      </div>

      <footer className="mt-12 text-center text-sm text-gray-500 flex flex-col md:flex-row justify-center items-center gap-4">
        <Link href="/" className="hover:text-white transition-colors flex items-center gap-2 mb-4 md:mb-0 mr-4">
          <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back to Home
        </Link>
        <p>© {new Date().getFullYear()} Split-Guardian.</p>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-indigo-400 transition-colors">Privacy Policy</Link>
          <span>|</span>
          <Link href="/terms" className="hover:text-indigo-400 transition-colors">Terms of Use</Link>
        </div>
      </footer>
    </div>
  );
}
