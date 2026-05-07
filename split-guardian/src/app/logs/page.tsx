'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

export default function LogsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setMounted(true);
    
    // Auth Check
    const stored = localStorage.getItem('split_guardian_session');
    if (!stored) {
      router.push('/connect');
      return;
    }

    fetchLogs();
    
    // Subscribe to real-time updates
    const channel = supabase.channel('public:trade_log')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trade_log' },
        (payload) => {
          setTrades((currentTrades) => [payload.new, ...currentTrades]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('trade_log')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (data) setTrades(data);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTrades = trades.filter(t => 
    t.ticker.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-8 flex flex-col h-[calc(100vh-4rem)]">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 bg-gray-900/50 backdrop-blur-md border border-gray-800 p-4 md:p-6 rounded-2xl shadow-2xl shrink-0">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              Full Execution Logs
            </h1>
            <div className="flex gap-4 mt-2 text-sm font-medium">
              <Link href="/dashboard" className="text-gray-400 hover:text-white transition-colors pb-1">Dashboard</Link>
              <Link href="/logs" className="text-white border-b-2 border-indigo-400 pb-1">Logs</Link>
            </div>
          </div>
          
          <div className="w-full md:w-72">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
              </div>
              <input 
                type="text" 
                placeholder="Search by Ticker..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-950 border border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors shadow-inner text-sm"
              />
            </div>
          </div>
        </header>

        <div className="bg-gray-900/50 backdrop-blur-md border border-gray-800 rounded-2xl shadow-xl flex-1 flex flex-col overflow-hidden">
          <div className="p-4 md:p-6 border-b border-gray-800 shrink-0 flex justify-between items-center">
            <h2 className="text-xl font-bold text-cyan-300">Signal History</h2>
            <div className="px-2.5 py-1 bg-gray-800 rounded-full border border-gray-700">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{filteredTrades.length} Records</span>
            </div>
          </div>
          
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-900/95 backdrop-blur z-10">
                <tr className="text-gray-500 uppercase tracking-wider border-b border-gray-800 shadow-sm">
                  <th className="py-4 px-6 font-semibold hidden md:table-cell">Date</th>
                  <th className="py-4 px-6 font-semibold">Time</th>
                  <th className="py-4 px-6 font-semibold">Ticker</th>
                  <th className="py-4 px-6 font-semibold">Type</th>
                  <th className="py-4 px-6 font-semibold">Ratio</th>
                  <th className="py-4 px-6 font-semibold">Status</th>
                  <th className="py-4 px-6 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {loading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-500">Loading history...</td></tr>
                ) : filteredTrades.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-gray-500">No signals found.</td></tr>
                ) : filteredTrades.map((t) => {
                  const d = new Date(t.created_at);
                  const time = new Intl.DateTimeFormat('default', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
                  const date = new Intl.DateTimeFormat('default', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);

                  return (
                    <tr key={t.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-4 px-6 text-slate-400 hidden md:table-cell whitespace-nowrap">{date}</td>
                      <td className="py-4 px-6 text-slate-400 whitespace-nowrap">
                        <span className="md:hidden text-xs mr-2">{date} |</span>
                        <span>{time}</span>
                      </td>
                      <td className="py-4 px-6 font-bold text-white">{t.ticker}</td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${t.split_type === 'forward' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {t.split_type}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-gray-300 font-medium">{t.split_ratio}</td>
                      <td className="py-4 px-6">
                        <span className={`text-sm font-medium ${t.execution_status.includes('Executed') ? 'text-emerald-400' : t.execution_status.includes('Failed') || t.execution_status.includes('Skipped') ? 'text-rose-400' : 'text-amber-400'}`}>
                          {t.execution_status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Link 
                          href={`/dashboard?strike=${t.ticker}`}
                          className="inline-block bg-gray-800 hover:bg-rose-600/90 text-gray-300 hover:text-white px-4 py-1.5 rounded-lg transition-colors text-xs font-bold uppercase tracking-wider border border-gray-700 hover:border-rose-500 shadow-sm"
                        >
                          Strike
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
