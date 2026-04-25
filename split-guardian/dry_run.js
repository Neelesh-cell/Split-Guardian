async function scrapeBenzinga() {
  try {
    const res = await fetch('https://www.benzinga.com/calendars/stock-splits', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    // For the dry run, we use mocked outputs to avoid anti-bot systems blocking the CI
    return [{ ticker: 'TSLA', ratio: '3:1', source: 'Benzinga', date: '2026-05-01' }];
  } catch(e) {
    return [{ ticker: 'TSLA', ratio: '3:1', source: 'Benzinga', date: '2026-05-01' }];
  }
}

async function scrapeStockTitan() {
  return [{ ticker: 'NVDA', ratio: '10:1', source: 'StockTitan', date: '2026-05-02' }];
}

async function scrapeHedgeFollow() {
  return [{ ticker: 'AAPL', ratio: '1:4', source: 'HedgeFollow', date: '2026-05-03' }];
}

async function scrapeTipRanks() {
  return [{ ticker: 'TSLA', ratio: '3:1', source: 'TipRanks', date: '2026-05-01' }];
}

function parseRatio(ratioStr) {
  let [num1, num2] = [0, 0];
  if (ratioStr.includes(':')) {
    [num1, num2] = ratioStr.split(':').map(Number);
  } else if (ratioStr.includes('-for-')) {
    [num1, num2] = ratioStr.split('-for-').map(Number);
  } else {
    return { type: 'unknown' };
  }
  
  if (num1 > num2) {
    return { type: 'forward', ratio: ratioStr };
  } else {
    return { type: 'reverse', ratio: ratioStr };
  }
}

async function run() {
  console.log("Starting Dry Run Scrape...");
  const results = [
    ...(await scrapeBenzinga()),
    ...(await scrapeStockTitan()),
    ...(await scrapeHedgeFollow()),
    ...(await scrapeTipRanks())
  ];
  
  const deduplicated = [];
  const seenTickers = new Set();
  
  // Simulate 7 day cooldown state (DB mock)
  const mockDbCooldown = ['NVDA']; 
  
  const report = [];
  
  results.forEach(item => {
    const parsed = parseRatio(item.ratio);
    item.split_type = parsed.type;
    
    if (seenTickers.has(item.ticker)) {
      report.push({...item, action: 'Skipped - Deduplication (Already detected today)'});
    } else if (mockDbCooldown.includes(item.ticker)) {
      seenTickers.add(item.ticker);
      report.push({...item, action: 'Skipped - 7-Day Cooldown Active'});
    } else {
      seenTickers.add(item.ticker);
      if (item.split_type === 'forward') {
        report.push({...item, action: 'Auto-Buy Triggered (Simulated)'});
      } else {
        report.push({...item, action: 'Manual Review Required (Reverse Split)'});
      }
    }
  });
  
  console.log(JSON.stringify(report, null, 2));
}

run();
