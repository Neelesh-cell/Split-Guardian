'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export default function Dashboard() {
  const [account, setAccount] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ allow_reverse_splits: false, trade_size_dollars: 100, is_auto_buy_enabled: true });
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [localTradeSize, setLocalTradeSize] = useState<string>('100');
  const [linkEmail, setLinkEmail] = useState('');

  const fetchDashboardData = async (manualSync = false) => {
    if (manualSync) setIsSyncing(true);
    try {
      // Fetch Alpaca Account + Positions
      const accRes = await fetch('/api/alpaca/account');
      if (accRes.ok) {
        const accData = await accRes.json();
        setAccount(accData);
        setPositions(accData.positions || []);
      }

      // Fetch Trade Log
      const { data: tradeData } = await supabase.from('trade_log').select('*').order('created_at', { ascending: false }).limit(20);
      if (tradeData) setTrades(tradeData);

      // Fetch Settings
      const { data: setData } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (setData) {
        setSettings(setData);
        setLocalTradeSize(String(setData.trade_size_dollars));
      }

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

  const handleTradeSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d*$/.test(val)) {
      setLocalTradeSize(val);
    }
  };

  const handleTradeSizeBlur = () => {
    let finalVal = parseInt(localTradeSize, 10);
    if (isNaN(finalVal) || finalVal <= 0) {
      finalVal = 10;
      setLocalTradeSize('10');
    } else {
      setLocalTradeSize(String(finalVal));
    }
    
    if (finalVal !== settings.trade_size_dollars) {
      updateSettings('trade_size_dollars', finalVal);
    }
  };

  const updateSettings = async (key: string, value: any) => {
    const oldSettings = { ...settings };
    const newSettings = { ...settings, [key]: value };
    
    // Optimistic update
    setSettings(newSettings);
    setSavingSettings(true);
    
    try {
      const { error } = await supabase.from('settings').update({ [key]: value }).eq('id', 1);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to update settings:', err);
      // Revert on failure
      setSettings(oldSettings);
      alert('Failed to save settings. Check your database permissions.');
    } finally {
      setSavingSettings(false);
    }
  };

  const downloadCSV = () => {
    if (trades.length === 0) return;
    
    const headers = ['Date', 'Time (Local)', 'Ticker', 'Type', 'Ratio', 'Trade Size', 'Status'];
    const csvRows = [headers.join(',')];
    
    trades.forEach(t => {
      const d = new Date(t.created_at);
      const time = new Intl.DateTimeFormat('default', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
      const date = new Intl.DateTimeFormat('default', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
      
      const row = [
        date,
        time,
        t.ticker,
        t.split_type,
        `"${t.split_ratio}"`,
        settings.trade_size_dollars,
        `"${t.execution_status}"`
      ];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    const todayStr = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `Split-Guardian-Logs-${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Derived metrics
  const portfolioValue = account?.portfolioValue ?? 0;
  const buyingPower = account?.buyingPower ?? 0;
  const activeCapital = positions.reduce((sum: number, p: any) => sum + parseFloat(p.cost_basis || '0'), 0);

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Loading Split-Guardian...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 bg-gray-900/50 backdrop-blur-md border border-gray-800 p-4 md:p-6 rounded-2xl shadow-2xl">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Split-Guardian
            </h1>
            <p className="text-gray-400 text-sm mt-1">High-Precision Stock Split Automation</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${account?.status === 'ACTIVE' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${account?.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              {account?.status || 'Unknown'}
            </span>
          </div>
        </header>

        {/* ─── Top-Level Metrics Bar ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          {/* Portfolio Value */}
          <div className="relative overflow-hidden bg-slate-900/80 backdrop-blur-md border border-slate-700/50 p-5 md:p-6 rounded-2xl shadow-xl group hover:border-indigo-500/30 transition-colors duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -translate-y-8 translate-x-8"></div>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">Total Portfolio Value</p>
            <p className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {formatCurrency(portfolioValue)}
            </p>
          </div>

          {/* Buying Power */}
          <div className="relative overflow-hidden bg-slate-900/80 backdrop-blur-md border border-slate-700/50 p-5 md:p-6 rounded-2xl shadow-xl group hover:border-cyan-500/30 transition-colors duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full -translate-y-8 translate-x-8"></div>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">Buying Power</p>
            <p className="text-2xl md:text-3xl font-extrabold text-emerald-400 tracking-tight">
              {formatCurrency(buyingPower)}
            </p>
          </div>

          {/* Active Capital */}
          <div className="relative overflow-hidden bg-slate-900/80 backdrop-blur-md border border-slate-700/50 p-5 md:p-6 rounded-2xl shadow-xl group hover:border-amber-500/30 transition-colors duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -translate-y-8 translate-x-8"></div>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">Active Capital</p>
            <p className="text-2xl md:text-3xl font-extrabold text-amber-400 tracking-tight">
              {formatCurrency(activeCapital)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">{positions.length} position{positions.length !== 1 ? 's' : ''} deployed</p>
          </div>
        </div>

        {/* ─── Active Holdings Section ─── */}
        <div className="bg-gray-900/50 backdrop-blur-md border border-gray-800 p-4 md:p-6 rounded-2xl shadow-xl overflow-hidden">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-xl font-bold text-indigo-300">Current Holdings</h2>
            {positions.length > 0 && (
              <span className="text-xs font-bold text-slate-500 bg-slate-800 px-2.5 py-1 rounded-full">{positions.length}</span>
            )}
          </div>

          {positions.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-6 text-center">No active holdings. Waiting for next split signal.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-500 uppercase tracking-wider border-b border-gray-800">
                    <th className="pb-3 px-4 font-semibold">Ticker</th>
                    <th className="pb-3 px-4 font-semibold text-right">Shares</th>
                    <th className="pb-3 px-4 font-semibold text-right">Cost Basis</th>
                    <th className="pb-3 px-4 font-semibold text-right">Market Value</th>
                    <th className="pb-3 px-4 font-semibold text-right">P/L %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {positions.map((p: any) => {
                    const plPercent = parseFloat(p.unrealized_plpc || '0') * 100;
                    const isPositive = plPercent >= 0;
                    return (
                      <tr key={p.asset_id} className="hover:bg-gray-800/20 transition-colors">
                        <td className="py-3 px-4 font-bold text-white">{p.symbol}</td>
                        <td className="py-3 px-4 text-right text-slate-300">{parseFloat(p.qty)}</td>
                        <td className="py-3 px-4 text-right text-slate-300">{formatCurrency(parseFloat(p.cost_basis))}</td>
                        <td className="py-3 px-4 text-right text-slate-300">{formatCurrency(parseFloat(p.market_value))}</td>
                        <td className={`py-3 px-4 text-right font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isPositive ? '+' : ''}{plPercent.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Settings Panel */}
          <div className="bg-gray-900/50 backdrop-blur-md border border-gray-800 p-4 md:p-6 rounded-2xl shadow-xl lg:col-span-1">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-indigo-300">Execution Settings</h2>
              {savingSettings && (
                <span className="flex items-center gap-2 text-xs font-medium text-indigo-400">
                  <svg className="animate-spin h-3 w-3 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              )}
            </div>
            
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
                  type="text" 
                  inputMode="numeric"
                  value={localTradeSize}
                  onChange={handleTradeSizeChange}
                  onBlur={handleTradeSizeBlur}
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

            {/* Link Alpaca Account */}
            <div className="mt-8 pt-6 border-t border-gray-800 space-y-4">
              <h3 className="text-lg font-bold text-indigo-300">Link Sub-Account</h3>
              <p className="text-sm text-gray-400">Authorize Alpaca to enable multi-account manual execution.</p>
              <div>
                <input 
                  type="email" 
                  placeholder="User Email Address"
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors mb-3"
                />
                <button 
                  onClick={() => {
                    if (!linkEmail) return alert('Please enter an email address first.');
                    const clientId = process.env.NEXT_PUBLIC_ALPACA_CLIENT_ID;
                    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/alpaca/callback`;
                    const authUrl = `https://app.alpaca.markets/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=account:write%20trading&state=${encodeURIComponent(linkEmail)}`;
                    window.location.href = authUrl;
                  }}
                  className="w-full font-medium py-2 rounded-lg transition-colors border border-indigo-600 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300"
                >
                  Link Account via Alpaca
                </button>
              </div>
            </div>
          </div>

          {/* Signal Feed */}
          <div className="bg-gray-900/50 backdrop-blur-md border border-gray-800 p-4 md:p-6 rounded-2xl shadow-xl lg:col-span-2 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-cyan-300">Live Signal Feed</h2>
                <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Live</span>
                </div>
              </div>
              <button 
                onClick={downloadCSV}
                className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors border border-gray-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                <span className="hidden sm:inline">Download CSV</span>
              </button>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-500 uppercase tracking-wider border-b border-gray-800">
                    <th className="pb-3 px-4 font-semibold hidden md:table-cell">Date</th>
                    <th className="pb-3 px-4 font-semibold">Time</th>
                    <th className="pb-3 px-4 font-semibold">Ticker</th>
                    <th className="pb-3 px-4 font-semibold">Type</th>
                    <th className="pb-3 px-4 font-semibold">Ratio</th>
                    <th className="pb-3 px-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {trades.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-gray-500">No signals logged yet.</td></tr>
                  ) : trades.map((t) => {
                    const d = new Date(t.created_at);
                    const time = new Intl.DateTimeFormat('default', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
                    const date = new Intl.DateTimeFormat('default', { month: 'short', day: 'numeric' }).format(d);
                    const isToday = new Date().toDateString() === d.toDateString();

                    return (
                      <tr key={t.id} className="hover:bg-gray-800/20 transition-colors">
                        <td className="py-3 px-4 text-slate-400 hidden md:table-cell whitespace-nowrap">
                          {date}
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          <span className="md:hidden text-xs mr-2">{date} |</span>
                          <span>{time}</span>
                          {isToday && <span className="ml-2 text-[10px] font-bold text-emerald-500 uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded">Today</span>}
                        </td>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-gray-800 text-center text-sm text-gray-500 pb-8 flex flex-col md:flex-row justify-center items-center gap-4">
          <p>© {new Date().getFullYear()} Split-Guardian. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-indigo-400 transition-colors">Privacy Policy</Link>
            <span>|</span>
            <Link href="/terms" className="hover:text-rose-400 transition-colors">Terms of Use</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
