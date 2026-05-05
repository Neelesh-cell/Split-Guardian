import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { executeMarketBuy } from '@/utils/alpaca';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Professional User-Agent pool (rotated per-request) ───────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ─── Shared Types ─────────────────────────────────────────────────────────────
interface SplitSignal {
  ticker: string;
  company?: string;
  ratio: string;
  source: string;
  date: string;       // Ex-date / effective date (YYYY-MM-DD)
  exchange?: string;
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────
/** Returns YYYY-MM-DD for "today" in US-Eastern time */
function todayET(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

/** Parse a date string like "04/30/2026" or "2026-04-30" → YYYY-MM-DD */
function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  // MM/DD/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[1].padStart(2, '0')}-${slashMatch[2].padStart(2, '0')}`;
  }
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return trimmed;
}

/** Is the ex-date within the upcoming window (today → today+3 days)? */
function isUpcoming(exDate: string, windowDays = 3): boolean {
  const today = new Date(todayET() + 'T00:00:00');
  const target = new Date(exDate + 'T00:00:00');
  const diffMs = target.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= windowDays;
}

// ─── Ratio Parsing ────────────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// SCRAPER 1: BENZINGA (Primary — proven to work with server-side fetch)
// Target: "Upcoming Splits" from their stock-splits calendar table
// ═══════════════════════════════════════════════════════════════════════════════
async function scrapeBenzinga(): Promise<SplitSignal[]> {
  const label = '[Benzinga]';
  try {
    const res = await fetch('https://www.benzinga.com/calendars/stock-splits', {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.warn(`${label} HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: SplitSignal[] = [];

    // Benzinga table: th[0]=Ex-Date, th[1]=Company, th[2]=ticker, th[3]=exchange, th[4]=Split Ratio
    $('table tbody tr').each((_i, el) => {
      const tds = $(el).find('td');
      if (tds.length < 5) return;

      const rawDate = $(tds[0]).text().trim();
      const company = $(tds[1]).text().trim();
      const ticker = $(tds[2]).text().trim().toUpperCase();
      const exchange = $(tds[3]).text().trim().toUpperCase();
      const ratio = $(tds[4]).text().trim();

      if (!ticker || !ratio || !rawDate) return;

      const exDate = normalizeDate(rawDate);

      results.push({
        ticker,
        company,
        ratio,
        source: 'Benzinga',
        date: exDate,
        exchange,
      });
    });

    // Filter to upcoming splits only (today → today + 3 days)
    const upcoming = results.filter(r => isUpcoming(r.date));
    console.log(`${label} Scraped ${results.length} total, ${upcoming.length} upcoming.`);
    return upcoming;

  } catch (e: any) {
    console.error(`${label} Error:`, e.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRAPER 2: STOCKTITAN (Best-effort — may return 403)
// Falls back gracefully if blocked.
// ═══════════════════════════════════════════════════════════════════════════════
async function scrapeStockTitan(): Promise<SplitSignal[]> {
  const label = '[StockTitan]';
  // StockTitan doesn't have a public stock-split calendar page that's
  // easy to scrape server-side (returns 403). We attempt their press
  // release tag page; if blocked, we fail gracefully.
  const urls = [
    'https://stocktitan.net/press-releases/tag/stock-split/',
    'https://www.stocktitan.net/press-releases/',
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': randomUA(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.google.com/',
        },
        next: { revalidate: 0 },
      });

      if (!res.ok) {
        console.warn(`${label} ${url} → HTTP ${res.status}`);
        continue;
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      const results: SplitSignal[] = [];

      // StockTitan press releases: look for articles/links mentioning split ratios
      $('article, .press-release, .news-item, .post').each((_i, el) => {
        const text = $(el).text();
        const title = $(el).find('h2, h3, .title, a').first().text().trim();

        // Try to extract ticker from parenthetical like (NASDAQ: AIRE)
        const tickerMatch = text.match(/\((?:NASDAQ|NYSE|OTC|AMEX)[:\s]+([A-Z]{1,5})\)/i);
        // Try to extract ratio like "1-for-25" or "1:10"
        const ratioMatch = text.match(/(\d+)\s*[-–]?\s*for\s*[-–]?\s*(\d+)/i) || text.match(/(\d+)\s*:\s*(\d+)/);
        // Try to extract a date
        const dateMatch = text.match(/((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})/i)
                       || text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);

        if (tickerMatch && ratioMatch) {
          const ticker = tickerMatch[1].toUpperCase();
          const ratio = `${ratioMatch[1]}:${ratioMatch[2]}`;
          let date = todayET(); // fallback to today
          if (dateMatch) {
            const parsed = new Date(dateMatch[1]);
            if (!isNaN(parsed.getTime())) {
              date = parsed.toISOString().split('T')[0];
            }
          }
          results.push({ ticker, ratio, source: 'StockTitan', date, company: title.substring(0, 60) });
        }
      });

      if (results.length > 0) {
        const upcoming = results.filter(r => isUpcoming(r.date));
        console.log(`${label} Scraped ${results.length} total, ${upcoming.length} upcoming from ${url}.`);
        return upcoming;
      }
    } catch (e: any) {
      console.warn(`${label} ${url} Error:`, e.message);
    }
  }

  console.warn(`${label} All URLs failed or returned 0 results. Skipping.`);
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRAPER 3: HEDGEFOLLOW (Best-effort — JS-rendered data, so we try to parse
// any inline JSON or fall back gracefully)
// ═══════════════════════════════════════════════════════════════════════════════
async function scrapeHedgeFollow(): Promise<SplitSignal[]> {
  const label = '[HedgeFollow]';
  try {
    const res = await fetch('https://hedgefollow.com/upcoming-stock-splits.php', {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.warn(`${label} HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: SplitSignal[] = [];

    // HedgeFollow table headers: Stock, Exchange, Company Name, Split Ratio, 
    //   Ratio Numerator, Ratio Denominator, Ratio Decimal, Ex-Date, Announcement Date
    // NOTE: Table body is JS-rendered via myDataTree plugin, so tbody rows are
    // typically empty in the raw HTML. We attempt to parse just in case
    // server-rendering is ever enabled or partial data is inlined.
    $('table tbody tr, #latest_splits tbody tr').each((_i, el) => {
      const tds = $(el).find('td');
      if (tds.length < 8) return;

      const ticker = $(tds[0]).text().trim().toUpperCase();
      const exchange = $(tds[1]).text().trim().toUpperCase();
      const company = $(tds[2]).text().trim();
      const ratioStr = $(tds[3]).text().trim();
      const exDate = normalizeDate($(tds[7]).text().trim());

      if (!ticker || !ratioStr) return;

      results.push({ ticker, company, ratio: ratioStr, source: 'HedgeFollow', date: exDate, exchange });
    });

    // Also try to find JSON data embedded in script tags
    $('script').each((_i, el) => {
      const scriptText = $(el).html() || '';
      // Look for arrays of objects with stock-split-like properties
      const jsonArrayMatch = scriptText.match(/\[\s*\{[^]*?"(?:ticker|symbol|stock)"[^]*?\}\s*\]/);
      if (jsonArrayMatch) {
        try {
          const data = JSON.parse(jsonArrayMatch[0]);
          for (const item of data) {
            const ticker = (item.ticker || item.symbol || item.stock || '').toUpperCase();
            const ratio = item.ratio || item.split_ratio || `${item.numerator || '?'}:${item.denominator || '?'}`;
            const date = normalizeDate(item.date || item.ex_date || item.exDate || '');
            if (ticker && ratio) {
              results.push({ ticker, ratio, source: 'HedgeFollow', date });
            }
          }
        } catch { /* ignore parse errors */ }
      }
    });

    const upcoming = results.filter(r => isUpcoming(r.date));
    console.log(`${label} Scraped ${results.length} total, ${upcoming.length} upcoming.`);
    return upcoming;

  } catch (e: any) {
    console.error(`${label} Error:`, e.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRAPER 4: TIPRANKS (Best-effort — Cloudflare-protected, will likely fail)
// ═══════════════════════════════════════════════════════════════════════════════
async function scrapeTipRanks(): Promise<SplitSignal[]> {
  const label = '[TipRanks]';
  try {
    const res = await fetch('https://www.tipranks.com/calendars/stock-splits', {
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.warn(`${label} HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();

    // TipRanks serves a Cloudflare challenge page — detect and bail early
    if (html.includes('Just a moment') || html.includes('cf-browser-verification') || html.includes('challenges.cloudflare.com')) {
      console.warn(`${label} Cloudflare challenge detected. Skipping.`);
      return [];
    }

    const $ = cheerio.load(html);
    const results: SplitSignal[] = [];

    // If we somehow get through, parse their table
    $('table tbody tr').each((_i, el) => {
      const tds = $(el).find('td');
      if (tds.length < 4) return;

      const ticker = $(tds[0]).text().trim().toUpperCase();
      const company = $(tds[1]).text().trim();
      const ratio = $(tds[2]).text().trim();
      const rawDate = $(tds[3]).text().trim();

      if (!ticker || !ratio) return;
      results.push({ ticker, company, ratio, source: 'TipRanks', date: normalizeDate(rawDate) });
    });

    const upcoming = results.filter(r => isUpcoming(r.date));
    console.log(`${label} Scraped ${results.length} total, ${upcoming.length} upcoming.`);
    return upcoming;

  } catch (e: any) {
    console.error(`${label} Error:`, e.message);
    return [];
  }
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
    console.log('  Split-Guardian Cron Job Triggered');
    console.log('  Time:', new Date().toISOString());
    console.log('  Today (ET):', todayET());
    console.log('══════════════════════════════════════════════');

    // 1. Fetch Global Settings
    const { data: settingsData } = await supabase.from('settings').select('*').eq('id', 1).single();
    const settings = settingsData || { allow_reverse_splits: false, trade_size_dollars: 1, position_type: 'quantity', is_auto_buy_enabled: true };

    const orderType = settings.position_type === 'amount' ? 'amount' : 'quantity';
    const tradeSize = Number(settings.trade_size_dollars);

    // 1.5. THE HUNTER: Auto-Retry Engine
    console.log('--- Checking for Pending Retries ---');
    const { data: pendingRetries } = await supabase
      .from('trade_log')
      .select('*')
      .like('execution_status', 'Pending%')
      .lte('retry_at', new Date().toISOString());

    if (pendingRetries && pendingRetries.length > 0) {
      console.log(`Found ${pendingRetries.length} pending trades ready for retry.`);
      for (const retry of pendingRetries) {
        console.log(`[Retry] Attempting ${retry.ticker}...`);
        const tradeRes = await executeMarketBuy(retry.ticker, orderType, tradeSize);
        
        let newStatus = '';
        if (tradeRes.success) {
          newStatus = `Executed - Buy ${tradeRes.qty} shares`;
          console.log(`[Retry Success] ${retry.ticker}: ${newStatus}`);
        } else {
          // Failed a second time -> mark persistent
          newStatus = `Skipped - Persistent Halt (${tradeRes.error.substring(0, 50)})`;
          console.warn(`[Retry Failed] ${retry.ticker}: ${newStatus}`);
        }
        
        await supabase
          .from('trade_log')
          .update({ execution_status: newStatus, retry_at: null })
          .eq('id', retry.id);
      }
    } else {
      console.log('No pending retries at this time.');
    }

    // 2. Scrape all 4 sources concurrently (4-source redundancy)
    const [benzingaResults, stockTitanResults, hedgeFollowResults, tipRanksResults] = await Promise.all([
      scrapeBenzinga(),
      scrapeStockTitan(),
      scrapeHedgeFollow(),
      scrapeTipRanks(),
    ]);

    const sourceReport = {
      benzinga: benzingaResults.length,
      stockTitan: stockTitanResults.length,
      hedgeFollow: hedgeFollowResults.length,
      tipRanks: tipRanksResults.length,
    };
    console.log('Source Report:', JSON.stringify(sourceReport));

    // 3. Merge & Deduplicate by ticker (first-seen wins)
    const allSignals: SplitSignal[] = [
      ...benzingaResults,
      ...stockTitanResults,
      ...hedgeFollowResults,
      ...tipRanksResults,
    ];

    const seenTickers = new Set<string>();
    const deduplicated: SplitSignal[] = [];

    for (const signal of allSignals) {
      const key = signal.ticker.toUpperCase();
      if (seenTickers.has(key)) {
        console.log(`[Dedup] Skipping duplicate: ${key} from ${signal.source}`);
        continue;
      }
      seenTickers.add(key);
      deduplicated.push(signal);
    }

    console.log(`Deduplicated: ${allSignals.length} → ${deduplicated.length} unique signals`);

    // 4. Process each unique signal
    const processed = [];

    for (const signal of deduplicated) {
      const parsed = parseRatio(signal.ratio);
      if (parsed.type === 'unknown') {
        console.warn(`[Skip] Unknown ratio format for ${signal.ticker}: ${signal.ratio}`);
        continue;
      }
      const splitType = parsed.type;

      // 24-Hour Cooldown Check
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data: recentTrades } = await supabase
        .from('trade_log')
        .select('id')
        .eq('ticker', signal.ticker)
        .gte('created_at', oneDayAgo.toISOString());

      if (recentTrades && recentTrades.length > 0) {
        // Silently skip if already processed in the last 7 days
        processed.push({ ticker: signal.ticker, status: 'Skipped - Cooldown', source: signal.source });
        console.log(`[Cooldown] ${signal.ticker} — already logged within 7 days. Exiting silently.`);
        continue;
      }

      // Execution Logic
      let executionStatus = 'Processed';
      let shouldLog = false;
      let retryAt = null;

      if (!settings.is_auto_buy_enabled) {
        executionStatus = 'Skipped - Auto-Buy Disabled';
        shouldLog = false; // Do not log to DB
      } else if (splitType === 'reverse' && !settings.allow_reverse_splits) {
        executionStatus = 'Skipped - Restricted Type';
        shouldLog = true; // Log once for manual review
      } else {
        // Forward Split or (Reverse Split + Allowed) → Execute via Alpaca
        const tradeRes = await executeMarketBuy(signal.ticker, orderType, tradeSize);

        if (tradeRes.success) {
          executionStatus = `Executed - Buy ${tradeRes.qty} shares`;
          shouldLog = true;
        } else {
          const errStr = tradeRes.error || '';
          
          if (errStr.includes('ASSET_INACTIVE')) {
            executionStatus = 'Pending - Exchange Halt';
            shouldLog = true;
            retryAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
            console.warn(`[Skip - Halt] ${signal.ticker}: Asset Inactive`);
          } else if (errStr.includes('NOT_TRADABLE')) {
            executionStatus = 'Pending - OTC Restricted';
            shouldLog = true;
            retryAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
            console.warn(`[Skip - OTC] ${signal.ticker}: Not Tradable`);
          } else if (errStr.includes('Failed to fetch quote') || errStr.includes('Invalid ask price') || errStr.includes('Calculated quantity is 0') || errStr.includes('ASSET_NOT_FOUND')) {
            executionStatus = 'Pending - Market Illiquidity';
            shouldLog = true;
            retryAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
            console.warn(`[Skip - Price] ${signal.ticker}: ${errStr.substring(0, 50)}`);
          } else {
            // High-priority issue (e.g. Insufficient funds, API key)
            executionStatus = `Failed - ${errStr.substring(0, 50)}`;
            shouldLog = true;
            console.error(`[Trade Failed] ${signal.ticker}: ${errStr}`);
          }
        }
      }

      // Log to Supabase only if it's a meaningful action
      if (shouldLog) {
        const payload: any = {
          ticker: signal.ticker,
          split_ratio: signal.ratio,
          source_site: signal.source,
          split_type: splitType,
          execution_status: executionStatus,
        };
        if (retryAt) {
          payload.retry_at = retryAt;
        }
        await supabase.from('trade_log').insert(payload);
      }

      processed.push({
        ticker: signal.ticker,
        split_type: splitType,
        ratio: signal.ratio,
        date: signal.date,
        source: signal.source,
        status: executionStatus,
      });
      console.log(`[Processed] ${signal.ticker} | ${splitType} ${signal.ratio} | ${executionStatus}`);
    }

    console.log('══════════════════════════════════════════════');
    console.log(`  Cron Complete: ${processed.length} signals processed`);
    console.log('══════════════════════════════════════════════');

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
