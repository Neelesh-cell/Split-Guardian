'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';

export default function Dashboard() {
  const [account, setAccount] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ allow_reverse_splits: false, trade_size_dollars: 100, is_auto_buy_enabled: true });
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchDashboardData = async (manualSync = false) => {
    if (manualSync) setIsSyncing(true);
    try {
      // Fetch Alpaca Account
      const accRes = await fetch('/api/alpaca/account');
      if (accRes.ok) {
        const accData = await accRes.json();
        setAccount(accData);
      }

      // Fetch Trade Log
      const { data: tradeData } = await supabase.from('trade_log').select('*').order('created_at', { ascending: false }).limit(20);
      if (tradeData) setTrades(tradeData);

      // Fetch Settings
      const { data: setData } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (setData) setSettings(setData);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      if (manualSync) setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => fetchDashboardData(), 15000); // Refresh every 15s

    // Set up Realtime Subscription
    const channel = supabase.channel('public:trade_log')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'trade_log',
        },
        (payload) => {
          setTrades((currentTrades) => {
            const newTrades = [payload.new, ...currentTrades];
            return newTrades.slice(0, 20); // Keep only the latest 20
          });
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const updateSettings = async (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await supabase.from('settings').update({ [key]: value }).eq('id', 1);
  };

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Loading Split-Guardian...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header / P&L Top Bar */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 bg-gray-900/50 backdrop-blur-md border border-gray-800 p-4 md:p-6 rounded-2xl shadow-2xl">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Split-Guardian
            </h1>
            <p className="text-gray-400 text-sm mt-1">High-Precision Stock Split Automation</p>
          </div>
          
          <div className="flex w-full md:w-auto justify-between md:justify-end gap-4 md:gap-8 items-center">
            <div className="flex flex-col items-start md:items-end">
              <span className="text-xs md:text-sm text-gray-500 uppercase tracking-wider font-semibold">Net P/L</span>
              <span className={`text-xl md:text-2xl font-bold ${account?.netPl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {account?.netPl >= 0 ? '+' : ''}${account?.netPl?.toFixed(2) || '0.00'}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs md:text-sm text-gray-500 uppercase tracking-wider font-semibold">Equity</span>
              <span className="text-xl md:text-2xl font-bold text-white">${account?.equity?.toLocaleString(undefined, {minimumFractionDigits: 2}) || '0.00'}</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Settings Panel */}
          <div className="bg-gray-900/50 backdrop-blur-md border border-gray-800 p-4 md:p-6 rounded-2xl shadow-xl lg:col-span-1">
            <h2 className="text-xl font-bold mb-6 text-indigo-300">Execution Settings</h2>
            
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <label className="text-gray-300 font-medium">Auto-Buy Enabled</label>
                <button 
                  onClick={() => updateSettings('is_auto_buy_enabled', !settings.is_auto_buy_enabled)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.is_auto_buy_enabled ? 'bg-indigo-500' : 'bg-gray-700'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.is_auto_buy_enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex justify-between items-center">
                <label className="text-gray-300 font-medium">Allow Reverse Splits</label>
                <button 
                  onClick={() => updateSettings('allow_reverse_splits', !settings.allow_reverse_splits)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.allow_reverse_splits ? 'bg-rose-500' : 'bg-gray-700'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.allow_reverse_splits ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-2">Trade Size ($ per buy)</label>
                <input 
                  type="number" 
                  value={settings.trade_size_dollars}
                  onChange={(e) => updateSettings('trade_size_dollars', Number(e.target.value))}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <button 
                onClick={() => fetchDashboardData(true)}
                disabled={isSyncing}
                className={`w-full font-medium py-2 rounded-lg transition-colors border ${isSyncing ? 'bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-700 text-white border-gray-700'}`}
              >
                {isSyncing ? 'Syncing...' : 'Force Refresh Sync'}
              </button>
            </div>
          </div>

          {/* Signal Feed */}
          <div className="bg-gray-900/50 backdrop-blur-md border border-gray-800 p-4 md:p-6 rounded-2xl shadow-xl lg:col-span-2 overflow-hidden flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-xl font-bold text-cyan-300">Live Signal Feed</h2>
              <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Live</span>
              </div>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-500 uppercase tracking-wider border-b border-gray-800">
                    <th className="pb-3 px-4 font-semibold">Time</th>
                    <th className="pb-3 px-4 font-semibold">Ticker</th>
                    <th className="pb-3 px-4 font-semibold">Type</th>
                    <th className="pb-3 px-4 font-semibold">Ratio</th>
                    <th className="pb-3 px-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {trades.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-gray-500">No signals logged yet.</td></tr>
                  ) : trades.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-800/20 transition-colors">
                      <td className="py-3 px-4 text-gray-400">{new Date(t.created_at).toLocaleTimeString()}</td>
                      <td className="py-3 px-4 font-bold text-white">{t.ticker}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${t.split_type === 'forward' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {t.split_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300">{t.split_ratio}</td>
                      <td className="py-3 px-4">
                        <span className={`text-sm ${t.execution_status.includes('Executed') ? 'text-emerald-400' : t.execution_status.includes('Failed') ? 'text-rose-400' : 'text-amber-400'}`}>
                          {t.execution_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
