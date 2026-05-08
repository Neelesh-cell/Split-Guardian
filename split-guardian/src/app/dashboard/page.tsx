'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const getBadge = (source: string) => {
  switch (source) {
    case 'Benzinga': return <span key={source} className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">BZ</span>;
    case 'StockTitan': return <span key={source} className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">ST</span>;
    case 'HedgeFollow': return <span key={source} className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">HF</span>;
    case 'TipRanks': return <span key={source} className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">TR</span>;
    case 'Manual': return <span key={source} className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">MN</span>;
    default: return <span key={source} className="bg-gray-500/10 text-gray-400 border border-gray-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">{source.substring(0,2)}</span>;
  }
};

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  const [account, setAccount] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ allow_reverse_splits: false, trade_size_dollars: 1, is_auto_buy_enabled: true, position_type: 'quantity' });
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [localTradeSize, setLocalTradeSize] = useState<string>('100');

  // Manual Strike State
  const [msTicker, setMsTicker] = useState('');
  const [msAction, setMsAction] = useState('Buy');
  const [msTradeBy, setMsTradeBy] = useState('quantity');
  const [msValue, setMsValue] = useState('1');
  const [isStriking, setIsStriking] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const stored = localStorage.getItem('split_guardian_session');
    const searchParams = new URLSearchParams(window.location.search);
    const success = searchParams.get('success');
    const paramEmail = searchParams.get('session_email');

    if (success === 'alpaca_linked' && paramEmail) {
      localStorage.setItem('split_guardian_session', paramEmail);
      setSessionEmail(paramEmail);
      window.history.replaceState({}, document.title, '/dashboard');
    } else if (stored) {
      setSessionEmail(stored);
    } else {
      router.push('/connect');
    }
  }, [router]);

  const fetchDashboardData = async (manualSync = false) => {
    if (!sessionEmail) return;
    if (manualSync) setIsSyncing(true);
    try {
      const accRes = await fetch(`/api/alpaca/account?email=${encodeURIComponent(sessionEmail)}`);
      if (accRes.ok) {
        const accData = await accRes.json();
        setAccount(accData);
        setPositions(accData.positions || []);
      }

      const { data: tradeData } = await supabase.from('trade_log').select('*').eq('user_email', sessionEmail).order('created_at', { ascending: false }).limit(20);
      if (tradeData) setTrades(tradeData);

      const { data: setData } = await supabase.from('users').select('*').eq('user_email', sessionEmail).single();
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
    if (!sessionEmail) return;

    fetchDashboardData();
    const interval = setInterval(() => fetchDashboardData(), 15000);

    const searchParams = new URLSearchParams(window.location.search);
    const strikeTicker = searchParams.get('strike');
    if (strikeTicker) {
      setMsTicker(strikeTicker.toUpperCase());
      setMsAction('Buy');
      setMsTradeBy('quantity');
      setMsValue('1');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const channel = supabase.channel('public:trade_log')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trade_log', filter: `user_email=eq.${sessionEmail}` },
        (payload) => {
          setTrades((currentTrades) => {
            const newTrades = [payload.new, ...currentTrades];
            return newTrades.slice(0, 20);
          });
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [sessionEmail]);

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
    if (!sessionEmail) return;
    const oldSettings = { ...settings };
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setSavingSettings(true);
    
    try {
      const { error } = await supabase.from('users').update({ [key]: value }).eq('user_email', sessionEmail);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to update settings:', err);
      setSettings(oldSettings);
      alert('Failed to save settings. Check your database permissions.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleStrikePreFill = (ticker: string) => {
    setMsTicker(ticker);
    setMsAction('Buy');
    setMsTradeBy('quantity');
    setMsValue('1');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executeManualStrike = async () => {
    if (!msTicker || !msValue) return alert('Please enter a Ticker and Value.');
    const confirm = window.confirm(`WARNING: You are about to execute a ${msAction.toUpperCase()} order for ${msValue} ${msTradeBy === 'quantity' ? 'shares' : 'dollars'} of ${msTicker} across ALL linked accounts.\n\nProceed with Manual Strike?`);
    if (!confirm) return;

    setIsStriking(true);
    try {
      const res = await fetch('/api/manual-strike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: msTicker,
          action: msAction,
          tradeBy: msTradeBy,
          value: msValue,
          email: sessionEmail
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Success!\n\n${data.summary}`);
        fetchDashboardData(true);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Execution failed: ${e.message}`);
    } finally {
      setIsStriking(false);
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
      const row = [date, time, t.ticker, t.split_type, `"${t.split_ratio}"`, settings.trade_size_dollars, `"${t.execution_status}"`];
      csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Split-Guardian-Logs-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = () => {
    localStorage.removeItem('split_guardian_session');
    setSessionEmail(null);
    router.push('/connect');
  };

  if (!mounted || !sessionEmail) return null;

  const portfolioValue = account?.portfolioValue ?? 0;
  const buyingPower = account?.buyingPower ?? 0;
  const activeCapital = positions.reduce((sum: number, p: any) => sum + parseFloat(p.cost_basis || '0'), 0);

  if (loading) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Loading Dashboard...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-8 flex flex-col h-full">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 bg-gray-900/50 backdrop-blur-md border border-gray-800 p-4 md:p-6 rounded-2xl shadow-2xl">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Split-Guardian
            </h1>
            <div className="flex gap-4 mt-2 text-sm font-medium">
              <Link href="/dashboard" className="text-white border-b-2 border-indigo-400 pb-1">Dashboard</Link>
              <Link href="/logs" className="text-gray-400 hover:text-white transition-colors pb-1">Logs</Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${account?.status === 'ACTIVE' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${account?.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              {account?.status || 'Unknown'}
            </span>
            <button onClick={handleLogout} className="text-sm font-medium text-gray-500 hover:text-rose-400 transition-colors">
              Log out
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
          <div className="relative overflow-hidden bg-slate-900/80 backdrop-blur-md border border-slate-700/50 p-5 md:p-6 rounded-2xl shadow-xl group hover:border-indigo-500/30 transition-colors duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -translate-y-8 translate-x-8"></div>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">Total Portfolio Value</p>
            <p className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{formatCurrency(portfolioValue)}</p>
          </div>
          <div className="relative overflow-hidden bg-slate-900/80 backdrop-blur-md border border-slate-700/50 p-5 md:p-6 rounded-2xl shadow-xl group hover:border-cyan-500/30 transition-colors duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full -translate-y-8 translate-x-8"></div>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">Buying Power</p>
            <p className="text-2xl md:text-3xl font-extrabold text-emerald-400 tracking-tight">{formatCurrency(buyingPower)}</p>
          </div>
          <div className="relative overflow-hidden bg-slate-900/80 backdrop-blur-md border border-slate-700/50 p-5 md:p-6 rounded-2xl shadow-xl group hover:border-amber-500/30 transition-colors duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -translate-y-8 translate-x-8"></div>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">Active Capital</p>
            <p className="text-2xl md:text-3xl font-extrabold text-amber-400 tracking-tight">{formatCurrency(activeCapital)}</p>
            <p className="text-[11px] text-slate-500 mt-1">{positions.length} position{positions.length !== 1 ? 's' : ''} deployed</p>
          </div>
        </div>

        <div className="bg-gray-900/50 backdrop-blur-md border border-gray-800 p-4 md:p-6 rounded-2xl shadow-xl overflow-hidden">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-xl font-bold text-indigo-300">Current Holdings</h2>
            {positions.length > 0 && <span className="text-xs font-bold text-slate-500 bg-slate-800 px-2.5 py-1 rounded-full">{positions.length}</span>}
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
          
          <div className="space-y-8 lg:col-span-1">
            <div className="bg-gray-900/50 backdrop-blur-md border border-gray-800 p-4 md:p-6 rounded-2xl shadow-xl">
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
                <div className="flex justify-between items-center">
                  <label className="text-gray-300 font-medium">Position Type</label>
                  <select 
                    value={settings.position_type || 'quantity'}
                    onChange={(e) => updateSettings('position_type', e.target.value)}
                    className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-1.5 text-white font-medium focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
                  >
                    <option value="quantity">Shares</option>
                    <option value="amount">Dollars</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 font-medium mb-2">Trade Size ({settings.position_type === 'amount' ? '$ per buy' : 'Shares per buy'})</label>
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
            </div>

            <div className="bg-gray-900/50 backdrop-blur-md border border-rose-900/50 p-4 md:p-6 rounded-2xl shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-xl font-bold text-rose-400">Manual Strike</h2>
                <div className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                  Isolated Mode
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Ticker</label>
                  <input 
                    type="text" 
                    value={msTicker}
                    onChange={e => setMsTicker(e.target.value.toUpperCase())}
                    placeholder="e.g. AAPL"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white font-bold focus:outline-none focus:border-rose-500 transition-colors uppercase placeholder:normal-case placeholder:font-normal"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Action</label>
                    <select 
                      value={msAction}
                      onChange={e => setMsAction(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white font-medium focus:outline-none focus:border-rose-500 transition-colors appearance-none"
                    >
                      <option value="Buy">Buy</option>
                      <option value="Sell">Sell</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Trade By</label>
                    <select 
                      value={msTradeBy}
                      onChange={e => setMsTradeBy(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white font-medium focus:outline-none focus:border-rose-500 transition-colors appearance-none"
                    >
                      <option value="quantity">Shares</option>
                      <option value="amount">Dollars</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Value ({msTradeBy === 'quantity' ? 'Shares' : '$'})</label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={msValue}
                    onChange={e => setMsValue(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-white font-medium focus:outline-none focus:border-rose-500 transition-colors"
                  />
                </div>

                <button 
                  onClick={executeManualStrike}
                  disabled={isStriking || !msTicker || !msValue}
                  className={`w-full font-bold py-3 mt-2 rounded-xl transition-all border ${isStriking || !msTicker || !msValue ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/20'}`}
                >
                  {isStriking ? 'Executing...' : 'Review & Execute'}
                </button>
              </div>
            </div>
          </div>

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
              <div className="flex items-center gap-3">
                <button 
                  onClick={downloadCSV}
                  className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors border border-gray-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  <span className="hidden sm:inline">Download CSV</span>
                </button>
                <Link 
                  href="/logs"
                  className="flex items-center gap-2 text-sm bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-3 py-1.5 rounded-lg transition-colors border border-indigo-500/20"
                >
                  <span className="hidden sm:inline font-semibold">View All</span>
                  <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                </Link>
              </div>
            </div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-500 uppercase tracking-wider border-b border-gray-800">
                    <th className="pb-3 px-4 font-semibold hidden md:table-cell">Date</th>
                    <th className="pb-3 px-4 font-semibold">Time</th>
                    <th className="pb-3 px-4 font-semibold">Ticker</th>
                    <th className="pb-3 px-4 font-semibold">Sources</th>
                    <th className="pb-3 px-4 font-semibold">Type</th>
                    <th className="pb-3 px-4 font-semibold">Ratio</th>
                    <th className="pb-3 px-4 font-semibold">Status</th>
                    <th className="pb-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {trades.length === 0 ? (
                    <tr><td colSpan={8} className="py-8 text-center text-gray-500">No signals logged yet.</td></tr>
                  ) : trades.map((t) => {
                    const d = new Date(t.created_at);
                    const time = new Intl.DateTimeFormat('default', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
                    const date = new Intl.DateTimeFormat('default', { month: 'short', day: 'numeric' }).format(d);
                    const isToday = new Date().toDateString() === d.toDateString();

                    const sources = Array.isArray(t.sources) ? t.sources : typeof t.source_site === 'string' ? t.source_site.split(',').map((s: string) => s.trim()) : [];
                    const isGold = sources.length >= 3;
                    const isVerified = sources.length > 1;

                    return (
                      <tr key={t.id} className="hover:bg-gray-800/20 transition-colors">
                        <td className="py-3 px-4 text-slate-400 hidden md:table-cell whitespace-nowrap">{date}</td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          <span className="md:hidden text-xs mr-2">{date} |</span>
                          <span>{time}</span>
                          {isToday && <span className="ml-2 text-[10px] font-bold text-emerald-500 uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded">Today</span>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-extrabold ${isGold ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'text-white'}`}>
                              {t.ticker}
                            </span>
                            {isVerified && (
                              <svg className="w-4 h-4 text-emerald-400 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                              </svg>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {sources.map((s: string) => getBadge(s))}
                          </div>
                        </td>
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
                        <td className="py-3 px-4 text-right">
                          <button 
                            onClick={() => handleStrikePreFill(t.ticker)}
                            className="bg-gray-800 hover:bg-rose-600/90 text-gray-300 hover:text-white px-3 py-1.5 rounded transition-colors text-xs font-bold uppercase tracking-wider border border-gray-700 hover:border-rose-500 shadow-sm"
                          >
                            Strike
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

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
