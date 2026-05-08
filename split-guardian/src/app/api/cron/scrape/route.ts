import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { executeMarketBuy } from '@/utils/alpaca';
import * as cheerio from 'cheerio';
import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import axios from 'axios';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60; // Max allowed by Vercel Hobby/Pro for serverless to prevent immediate timeouts

// ─── Shared Configurations ──────────────────────────────────────────────────
const CAPMONSTER_API_KEY = process.env.CAPMONSTER_API_KEY || '';
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

interface SplitSignal {
  ticker: string;
  company?: string;
  ratio: string;
  source: string;
  date: string;       // YYYY-MM-DD
  exchange?: string;
}

function todayET(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[1].padStart(2, '0')}-${slashMatch[2].padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return trimmed;
}

function isUpcoming(exDate: string, windowDays = 3): boolean {
  const today = new Date(todayET() + 'T00:00:00');
  const target = new Date(exDate + 'T00:00:00');
  const diffMs = target.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= windowDays;
}

function parseRatio(ratioStr: string) {
  let num1 = 0, num2 = 0;
  const cleaned = ratioStr.replace(/\s+/g, '');
  if (cleaned.includes(':')) {
    [num1, num2] = cleaned.split(':').map(Number);
  } else if (cleaned.toLowerCase().includes('-for-')) {
    [num1, num2] = cleaned.toLowerCase().split('-for-').map(Number);
  } else if (cleaned.toLowerCase().includes('for')) {
    [num1, num2] = cleaned.toLowerCase().split('for').map(Number);
  } else {
    return { type: 'unknown' as const, ratio: ratioStr };
  }
  if (isNaN(num1) || isNaN(num2) || num2 === 0) {
    return { type: 'unknown' as const, ratio: ratioStr };
  }
  return {
    type: (num1 > num2 ? 'forward' : 'reverse') as 'forward' | 'reverse',
    ratio: ratioStr,
  };
}

// ─── Puppeteer / CapMonster Utilities ─────────────────────────────────────────

async function getBrowser() {
  return await puppeteer.launch({
    args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(
      'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
    ),
    headless: chromium.headless,
  });
}

/** 
 * Uses CapMonster CloudflareTask to get clearance cookies if Turnstile isn't enough.
 * CloudflareTask solves managed challenges returning a cf_clearance cookie.
 */
async function solveCloudflareChallengeCookie(url: string, html: string): Promise<any | null> {
    try {
      const createRes = await axios.post('https://api.capmonster.cloud/createTask', {
        clientKey: CAPMONSTER_API_KEY,
        task: {
          type: 'CloudflareTask',
          websiteURL: url,
          htmlPageBase64: Buffer.from(html).toString('base64'),
        }
      });
  
      if (createRes.data.errorId !== 0) return null;
      const taskId = createRes.data.taskId;
  
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const res = await axios.post('https://api.capmonster.cloud/getTaskResult', {
          clientKey: CAPMONSTER_API_KEY,
          taskId
        });
        if (res.data.status === 'ready') return res.data.solution;
        if (res.data.errorId !== 0) return null;
      }
      return null;
    } catch {
      return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRAPER 1: BENZINGA 
// ═══════════════════════════════════════════════════════════════════════════════
async function scrapeBenzinga(): Promise<SplitSignal[]> {
  const label = '[Benzinga]';
  const res = await fetch('https://www.benzinga.com/calendars/stock-splits', {
    headers: { 'User-Agent': randomUA() },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`${label} HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const results: SplitSignal[] = [];

  $('table tbody tr').each((_i, el) => {
    const tds = $(el).find('td');
    if (tds.length < 5) return;
    const rawDate = $(tds[0]).text().trim();
    const company = $(tds[1]).text().trim();
    const ticker = $(tds[2]).text().trim().toUpperCase();
    const exchange = $(tds[3]).text().trim().toUpperCase();
    const ratio = $(tds[4]).text().trim();
    if (!ticker || !ratio || !rawDate) return;
    results.push({ ticker, company, ratio, source: 'Benzinga', date: normalizeDate(rawDate), exchange });
  });

  return results.filter(r => isUpcoming(r.date));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRAPER 2: STOCKTITAN
// ═══════════════════════════════════════════════════════════════════════════════
async function scrapeStockTitan(): Promise<SplitSignal[]> {
  const label = '[StockTitan]';
  const url = 'https://www.stocktitan.net/news/stock-splits.html';
  let html = '';
  
  const res = await fetch(url, { headers: { 'User-Agent': randomUA() } });
  if (res.ok) {
    html = await res.text();
  } else {
    console.log(`${label} Fetch failed, using Puppeteer fallback.`);
    const browser = await getBrowser();
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      html = await page.content();
    } finally {
      await browser.close();
    }
  }

  const $ = cheerio.load(html);
  const results: SplitSignal[] = [];

  $('article, .news-item, table tr').each((_i, el) => {
    const text = $(el).text();
    const tickerMatch = text.match(/\b([A-Z]{1,5})\b/); 
    const ratioMatch = text.match(/(\d+)\s*[-–]?\s*for\s*[-–]?\s*(\d+)/i) || text.match(/(\d+)\s*:\s*(\d+)/);
    const dateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);

    if (tickerMatch && ratioMatch) {
      const tds = $(el).find('td');
      if (tds.length >= 3) {
         const t_date = $(tds[0]).text().trim();
         const t_ticker = $(tds[1]).text().trim().toUpperCase();
         const t_ratio = $(tds[2]).text().trim();
         if (t_ticker && t_ratio) {
           results.push({ ticker: t_ticker, ratio: t_ratio, source: 'StockTitan', date: normalizeDate(t_date) });
           return;
         }
      }

      const ticker = tickerMatch[1].toUpperCase();
      const ratio = `${ratioMatch[1]}:${ratioMatch[2]}`;
      let date = todayET();
      if (dateMatch) date = dateMatch[1];
      results.push({ ticker, ratio, source: 'StockTitan', date });
    }
  });

  return results.filter(r => isUpcoming(r.date));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRAPER 3: HEDGEFOLLOW
// ═══════════════════════════════════════════════════════════════════════════════
async function scrapeHedgeFollow(): Promise<SplitSignal[]> {
  const label = '[HedgeFollow]';
  const url = 'https://hedgefollow.com/upcoming-stock-splits.php';
  const res = await fetch(url, { headers: { 'User-Agent': randomUA() } });
  
  if (!res.ok && res.status === 403) {
     console.log(`${label} 403 detected, using CapMonster + Puppeteer`);
     const browser = await getBrowser();
     let html = '';
     try {
       const page = await browser.newPage();
       await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
       html = await page.content();
     } finally {
       await browser.close();
     }
     
     const $ = cheerio.load(html);
     const results: SplitSignal[] = [];
     $('table tbody tr, #latest_splits tbody tr').each((_i, el) => {
       const tds = $(el).find('td');
       if (tds.length < 8) return;
       const ticker = $(tds[0]).text().trim().toUpperCase();
       const company = $(tds[2]).text().trim();
       const ratioStr = $(tds[3]).text().trim();
       const exDate = normalizeDate($(tds[7]).text().trim());
       if (ticker && ratioStr) {
         results.push({ ticker, company, ratio: ratioStr, source: 'HedgeFollow', date: exDate });
       }
     });
     return results.filter(r => isUpcoming(r.date));
  } else if (!res.ok) {
     throw new Error(`${label} HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const results: SplitSignal[] = [];

  $('table tbody tr, #latest_splits tbody tr').each((_i, el) => {
    const tds = $(el).find('td');
    if (tds.length < 8) return;
    const ticker = $(tds[0]).text().trim().toUpperCase();
    const company = $(tds[2]).text().trim();
    const ratioStr = $(tds[3]).text().trim();
    const exDate = normalizeDate($(tds[7]).text().trim());
    if (ticker && ratioStr) {
      results.push({ ticker, company, ratio: ratioStr, source: 'HedgeFollow', date: exDate });
    }
  });

  return results.filter(r => isUpcoming(r.date));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRAPER 4: TIPRANKS
// ═══════════════════════════════════════════════════════════════════════════════
async function scrapeTipRanks(): Promise<SplitSignal[]> {
  const label = '[TipRanks]';
  const url = 'https://www.tipranks.com/calendars/stock-splits/upcoming';
  
  console.log(`${label} Initiating Puppeteer + CapMonster scrape...`);
  const browser = await getBrowser();
  let html = '';
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    html = await page.content();
    
    if (html.includes('cf-browser-verification') || html.includes('challenges.cloudflare.com') || html.includes('Just a moment')) {
      console.log(`${label} Cloudflare challenge detected. Asking CapMonster for solution...`);
      const solution = await solveCloudflareChallengeCookie(url, html);
      if (solution && solution.clearanceCookie) {
        await page.setCookie({
            name: 'cf_clearance',
            value: solution.clearanceCookie,
            domain: '.tipranks.com'
        });
        await page.reload({ waitUntil: 'networkidle2', timeout: 20000 });
        html = await page.content();
      } else {
        console.warn(`${label} CapMonster failed to solve challenge.`);
      }
    } else {
       try { await page.waitForSelector('table', { timeout: 10000 }); } catch (e) {}
       html = await page.content();
    }
  } finally {
    await browser.close();
  }

  const $ = cheerio.load(html);
  const results: SplitSignal[] = [];

  $('table tbody tr').each((_i, el) => {
    const tds = $(el).find('td');
    if (tds.length < 4) return;
    const col0Text = $(tds[0]).text().trim();
    const tickerMatch = col0Text.match(/^[A-Z]{1,5}/); 
    const ticker = tickerMatch ? tickerMatch[0] : col0Text.split('\n')[0].toUpperCase();
    const ratio = $(tds[1]).text().trim();
    const rawDate = $(tds[2]).text().trim();

    if (ticker && ratio && ratio.includes(':')) {
      results.push({ ticker, ratio, source: 'TipRanks', date: normalizeDate(rawDate) });
    }
  });

  return results.filter(r => isUpcoming(r.date));
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGGREGATION + DEDUPLICATION + EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    console.log('══════════════════════════════════════════════');
    console.log('  Split-Guardian Cron Job Triggered (Multi-Source)');
    console.log('  Time:', new Date().toISOString());
    console.log('══════════════════════════════════════════════');

    const { data: users } = await supabase.from('users').select('*');
    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, message: 'No users configured' });
    }

    // 1. Fetch pending retries
    const { data: pendingRetries } = await supabase
      .from('trade_log')
      .select('*')
      .like('execution_status', 'Pending%')
      .lte('retry_at', new Date().toISOString());

    if (pendingRetries && pendingRetries.length > 0) {
      for (const retry of pendingRetries) {
        const user = users.find(u => u.user_email === retry.user_email);
        if (!user || !user.alpaca_access_token) continue;
        const orderType = user.position_type === 'amount' ? 'amount' : 'quantity';
        const tradeRes = await executeMarketBuy(retry.ticker, orderType, Number(user.trade_size_dollars), user.alpaca_access_token);
        const newStatus = tradeRes.success ? `Executed - Buy ${tradeRes.qty} shares` : `Skipped - Persistent Halt (${tradeRes.error.substring(0, 50)})`;
        await supabase.from('trade_log').update({ execution_status: newStatus, retry_at: null }).eq('id', retry.id);
      }
    }

    // 2. Scrape in isolated Promise.allSettled
    const scrapeResults = await Promise.allSettled([
      scrapeBenzinga(),
      scrapeStockTitan(),
      scrapeHedgeFollow(),
      scrapeTipRanks(),
    ]);

    const benzingaResults = scrapeResults[0].status === 'fulfilled' ? scrapeResults[0].value : [];
    const stockTitanResults = scrapeResults[1].status === 'fulfilled' ? scrapeResults[1].value : [];
    const hedgeFollowResults = scrapeResults[2].status === 'fulfilled' ? scrapeResults[2].value : [];
    const tipRanksResults = scrapeResults[3].status === 'fulfilled' ? scrapeResults[3].value : [];

    scrapeResults.forEach((res, idx) => {
      if (res.status === 'rejected') {
        const sourceName = ['Benzinga', 'StockTitan', 'HedgeFollow', 'TipRanks'][idx];
        console.error(`[Scraper Error] ${sourceName} failed:`, res.reason);
      }
    });

    const sourceReport = {
      benzinga: benzingaResults.length,
      stockTitan: stockTitanResults.length,
      hedgeFollow: hedgeFollowResults.length,
      tipRanks: tipRanksResults.length,
    };
    console.log('Source Report:', JSON.stringify(sourceReport));

    // 3. Deduplicate and merge sources
    const allSignals: SplitSignal[] = [
      ...benzingaResults,
      ...stockTitanResults,
      ...hedgeFollowResults,
      ...tipRanksResults,
    ];

    const deduplicatedMap = new Map<string, SplitSignal & { sourcesArray: string[] }>();

    for (const signal of allSignals) {
      const key = signal.ticker.toUpperCase();
      if (deduplicatedMap.has(key)) {
        const existing = deduplicatedMap.get(key)!;
        if (!existing.sourcesArray.includes(signal.source)) {
          existing.sourcesArray.push(signal.source);
        }
      } else {
        deduplicatedMap.set(key, { ...signal, sourcesArray: [signal.source] });
      }
    }

    const deduplicated = Array.from(deduplicatedMap.values());
    console.log(`Deduplicated: ${allSignals.length} → ${deduplicated.length} unique signals`);

    // 4. Execute
    const processed = [];

    for (const signal of deduplicated) {
      const parsed = parseRatio(signal.ratio);
      if (parsed.type === 'unknown') continue;
      const splitType = parsed.type;
      

      for (const user of users) {
        if (!user.alpaca_access_token) continue;
        const orderType = user.position_type === 'amount' ? 'amount' : 'quantity';
        const tradeSize = Number(user.trade_size_dollars);
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const { data: recentTrades } = await supabase
          .from('trade_log')
          .select('id, sources')
          .eq('ticker', signal.ticker)
          .eq('user_email', user.user_email)
          .gte('created_at', oneDayAgo.toISOString());

        if (recentTrades && recentTrades.length > 0) {
          const recentRow = recentTrades[0];
          const currentSources = Array.isArray(recentRow.sources) ? recentRow.sources : [];
          let hasNew = false;
          const newSources = [...currentSources];
          
          for (const s of signal.sourcesArray) {
            if (!newSources.includes(s)) {
              newSources.push(s);
              hasNew = true;
            }
          }

          if (hasNew) {
            await supabase.from('trade_log').update({ sources: newSources }).eq('id', recentRow.id);
          }
          continue;
        }

        let executionStatus = 'Processed';
        let shouldLog = false;
        let retryAt = null;

        if (!user.is_auto_buy_enabled) {
          executionStatus = 'Skipped - Auto-Buy Disabled';
        } else if (splitType === 'reverse' && !user.allow_reverse_splits) {
          executionStatus = 'Skipped - Restricted Type';
          shouldLog = true;
        } else {
          const tradeRes = await executeMarketBuy(signal.ticker, orderType, tradeSize, user.alpaca_access_token);
          if (tradeRes.success) {
            executionStatus = `Executed - Buy ${tradeRes.qty} shares`;
            shouldLog = true;
          } else {
            const errStr = tradeRes.error || '';
            if (errStr.includes('ASSET_INACTIVE') || errStr.includes('NOT_TRADABLE') || errStr.includes('Failed to fetch quote') || errStr.includes('Invalid ask price') || errStr.includes('Calculated quantity is 0') || errStr.includes('ASSET_NOT_FOUND')) {
              executionStatus = `Pending - ${errStr.includes('ASSET_INACTIVE') ? 'Exchange Halt' : 'Market Illiquidity'}`;
              shouldLog = true;
              retryAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
            } else {
              executionStatus = `Failed - ${errStr.substring(0, 50)}`;
              shouldLog = true;
            }
          }
        }

        if (shouldLog) {
          const payload: any = {
            user_email: user.user_email,
            ticker: signal.ticker,
            split_ratio: signal.ratio,
            sources: signal.sourcesArray,
            split_type: splitType,
            execution_status: executionStatus,
          };
          if (retryAt) payload.retry_at = retryAt;
          await supabase.from('trade_log').insert(payload);
        }

        processed.push({
          user: user.user_email,
          ticker: signal.ticker,
          split_type: splitType,
          ratio: signal.ratio,
          date: signal.date,
          sources: signal.sourcesArray,
          status: executionStatus,
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      sources: sourceReport,
      totalRaw: allSignals.length,
      totalUnique: deduplicated.length,
      processed,
    });

  } catch (error: any) {
    console.error('Cron error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
