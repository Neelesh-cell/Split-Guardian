/**
 * Split-Guardian Dry Run — Production Scraper Test
 * 
 * This script tests the REAL Benzinga scraper locally (no Supabase/Alpaca needed).
 * Run with: node dry_run.js
 */

const cheerio = require('cheerio');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function todayET() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

function normalizeDate(raw) {
  const trimmed = raw.trim();
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[1].padStart(2, '0')}-${slashMatch[2].padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return trimmed;
}

function isUpcoming(exDate, windowDays = 3) {
  const today = new Date(todayET() + 'T00:00:00');
  const target = new Date(exDate + 'T00:00:00');
  const diffMs = target.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= windowDays;
}

function parseRatio(ratioStr) {
  let num1 = 0, num2 = 0;
  const cleaned = ratioStr.replace(/\s+/g, '');
  if (cleaned.includes(':')) {
    [num1, num2] = cleaned.split(':').map(Number);
  } else if (cleaned.toLowerCase().includes('-for-')) {
    [num1, num2] = cleaned.toLowerCase().split('-for-').map(Number);
  } else {
    return { type: 'unknown', ratio: ratioStr };
  }
  if (isNaN(num1) || isNaN(num2) || num2 === 0) return { type: 'unknown', ratio: ratioStr };
  return { type: num1 > num2 ? 'forward' : 'reverse', ratio: ratioStr };
}

// ─── LIVE Benzinga Scraper ────────────────────────────────────────────────────
async function scrapeBenzinga() {
  try {
    console.log('[Benzinga] Fetching...');
    const res = await fetch('https://www.benzinga.com/calendars/stock-splits', {
      headers: { 'User-Agent': randomUA(), 'Accept': 'text/html' },
    });
    if (!res.ok) { console.log('[Benzinga] HTTP', res.status); return []; }
    const html = await res.text();
    const $ = cheerio.load(html);
    const results = [];

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

    const upcoming = results.filter(r => isUpcoming(r.date));
    console.log(`[Benzinga] Scraped ${results.length} total, ${upcoming.length} upcoming.`);
    return upcoming;
  } catch (e) {
    console.log('[Benzinga] Error:', e.message);
    return [];
  }
}

// ─── Mock scrapers for StockTitan/HedgeFollow/TipRanks (blocked in local) ─────
async function scrapeStockTitan() {
  console.log('[StockTitan] Attempting...');
  try {
    const res = await fetch('https://stocktitan.net/press-releases/tag/stock-split/', {
      headers: { 'User-Agent': randomUA() },
    });
    console.log('[StockTitan] HTTP', res.status, '(Expected: 403)');
    return [];
  } catch (e) {
    console.log('[StockTitan] Blocked:', e.message);
    return [];
  }
}

async function scrapeHedgeFollow() {
  console.log('[HedgeFollow] JS-rendered page, attempting raw parse...');
  try {
    const res = await fetch('https://hedgefollow.com/upcoming-stock-splits.php', {
      headers: { 'User-Agent': randomUA() },
    });
    if (!res.ok) { console.log('[HedgeFollow] HTTP', res.status); return []; }
    const html = await res.text();
    const $ = cheerio.load(html);
    const rows = $('table tbody tr');
    console.log(`[HedgeFollow] Table rows found: ${rows.length} (Expected: 0 — data is JS-rendered)`);
    return [];
  } catch (e) {
    console.log('[HedgeFollow] Error:', e.message);
    return [];
  }
}

async function scrapeTipRanks() {
  console.log('[TipRanks] Attempting...');
  try {
    const res = await fetch('https://www.tipranks.com/calendars/stock-splits', {
      headers: { 'User-Agent': randomUA() },
    });
    const html = await res.text();
    if (html.includes('Just a moment') || html.includes('challenges.cloudflare.com')) {
      console.log('[TipRanks] Cloudflare challenge detected. Blocked.');
      return [];
    }
    console.log('[TipRanks] HTTP', res.status);
    return [];
  } catch (e) {
    console.log('[TipRanks] Error:', e.message);
    return [];
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Split-Guardian — DRY RUN (Live Scrape Test)');
  console.log('  Today (ET):', todayET());
  console.log('  Window: Today → Today + 3 days');
  console.log('═══════════════════════════════════════════════\n');

  // Scrape all sources concurrently
  const [bz, st, hf, tr] = await Promise.all([
    scrapeBenzinga(),
    scrapeStockTitan(),
    scrapeHedgeFollow(),
    scrapeTipRanks(),
  ]);

  console.log('\n── Source Report ──────────────────────────────');
  console.log(`  Benzinga:    ${bz.length} upcoming signals`);
  console.log(`  StockTitan:  ${st.length} upcoming signals`);
  console.log(`  HedgeFollow: ${hf.length} upcoming signals`);
  console.log(`  TipRanks:    ${tr.length} upcoming signals`);

  // Merge + Dedup
  const all = [...bz, ...st, ...hf, ...tr];
  const seen = new Set();
  const deduped = [];
  for (const s of all) {
    if (seen.has(s.ticker)) {
      console.log(`  [Dedup] Skipping duplicate: ${s.ticker} from ${s.source}`);
      continue;
    }
    seen.add(s.ticker);
    deduped.push(s);
  }

  console.log(`\n── Deduplicated: ${all.length} → ${deduped.length} unique signals ──\n`);

  // Simulate execution
  const mockCooldown = []; // Add tickers here to test cooldown
  const settings = { is_auto_buy_enabled: true, allow_reverse_splits: false, trade_size_dollars: 100 };

  const report = [];
  for (const signal of deduped) {
    const parsed = parseRatio(signal.ratio);
    if (parsed.type === 'unknown') {
      report.push({ ...signal, split_type: 'unknown', action: 'Skipped — Unknown ratio format' });
      continue;
    }

    if (mockCooldown.includes(signal.ticker)) {
      report.push({ ...signal, split_type: parsed.type, action: 'Skipped — 7-Day Cooldown Active' });
      continue;
    }

    if (!settings.is_auto_buy_enabled) {
      report.push({ ...signal, split_type: parsed.type, action: 'Skipped — Auto-Buy Disabled (Not Logged)' });
    } else if (parsed.type === 'reverse' && !settings.allow_reverse_splits) {
      report.push({ ...signal, split_type: parsed.type, action: 'Skipped - Restricted Type (Logged Once)' });
    } else {
      // Simulate 10% chance of a halt/illiquid stock
      const isHalt = Math.random() < 0.1;
      if (isHalt) {
        report.push({ ...signal, split_type: parsed.type, action: 'Pending - Exchange Halt (Retry in 2hrs)' });
      } else {
        report.push({ ...signal, split_type: parsed.type, action: `Auto-Buy Triggered (Simulated) — $${settings.trade_size_dollars} (Logged)` });
      }
    }
  }

  console.log('── Execution Report ──────────────────────────');
  console.table(report.map(r => ({
    Ticker: r.ticker,
    Date: r.date,
    Ratio: r.ratio,
    Type: r.split_type,
    Exchange: r.exchange || 'N/A',
    Source: r.source,
    Action: r.action,
  })));

  // Check for AIRE and UK specifically
  const aireFound = deduped.find(s => s.ticker === 'AIRE');
  const ukFound = deduped.find(s => s.ticker === 'UK');
  console.log('\n── Target Stock Check ─────────────────────────');
  console.log(`  $AIRE: ${aireFound ? '✅ FOUND — ' + aireFound.ratio + ' on ' + aireFound.date : '❌ NOT FOUND'}`);
  console.log(`  $UK:   ${ukFound ? '✅ FOUND — ' + ukFound.ratio + ' on ' + ukFound.date : '❌ NOT FOUND'}`);
  console.log('═══════════════════════════════════════════════');
}

run();
