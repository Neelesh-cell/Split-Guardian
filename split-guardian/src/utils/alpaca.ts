export const ALPACA_API_KEY = process.env.APCA_API_KEY_ID || 'PKLI4IWRXT5DVA27FYQ4HWRQMK';
export const ALPACA_API_SECRET = process.env.APCA_API_SECRET_KEY || 'Eud1TwbmmCDRNwzXZGGgJNcXm13WmG81cugG7wcE1GqX';
export const ALPACA_BASE_URL = 'https://paper-api.alpaca.markets';

export async function getAlpacaAccount() {
  const res = await fetch(`${ALPACA_BASE_URL}/v2/account`, {
    headers: {
      'APCA-API-KEY-ID': ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
      'Accept': 'application/json'
    },
    // Don't cache to get real-time P/L
    cache: 'no-store'
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch Alpaca account: ${await res.text()}`);
  }
  return res.json();
}

export async function getAlpacaPositions() {
  const res = await fetch(`${ALPACA_BASE_URL}/v2/positions`, {
    headers: {
      'APCA-API-KEY-ID': ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
      'Accept': 'application/json'
    },
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Alpaca positions: ${await res.text()}`);
  }
  return res.json();
}

export async function getAsset(ticker: string) {
  const res = await fetch(`${ALPACA_BASE_URL}/v2/assets/${ticker}`, {
    headers: {
      'APCA-API-KEY-ID': ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
      'Accept': 'application/json'
    },
    cache: 'no-store'
  });
  
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`ASSET_NOT_FOUND: ${ticker}`);
    }
    throw new Error(`Failed to fetch asset info for ${ticker}: ${await res.text()}`);
  }
  return res.json();
}

export async function getLatestQuote(ticker: string) {
  // Use Alpaca Data API to get the latest quote
  // Paper keys can access the data API using the data API base URL
  const DATA_URL = 'https://data.alpaca.markets/v2/stocks';
  const res = await fetch(`${DATA_URL}/${ticker}/quotes/latest`, {
    headers: {
      'APCA-API-KEY-ID': ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
      'Accept': 'application/json'
    },
    cache: 'no-store'
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch quote for ${ticker}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.quote.ap; // Ask price
}

export async function executeMarketBuy(ticker: string, tradeSizeDollars: number) {
  try {
    // 1. Pre-Trade Verification (Asset Check)
    try {
      const asset = await getAsset(ticker);
      if (asset.status !== 'active') {
        throw new Error(`ASSET_INACTIVE`);
      }
      if (!asset.tradable) {
        throw new Error(`NOT_TRADABLE`);
      }
    } catch (e: any) {
      // Re-throw known asset errors directly
      if (e.message.includes('ASSET_INACTIVE') || e.message.includes('NOT_TRADABLE') || e.message.includes('ASSET_NOT_FOUND')) {
        throw e;
      }
      throw new Error(`Asset verification failed: ${e.message}`);
    }

    // 2. Quote Check
    const askPrice = await getLatestQuote(ticker);
    if (!askPrice || askPrice <= 0) {
      throw new Error(`Invalid ask price for ${ticker}: ${askPrice}`);
    }
    
    const qty = Math.floor(tradeSizeDollars / askPrice);
    
    if (qty <= 0) {
      throw new Error(`Calculated quantity is 0 for ${ticker} (Trade Size: $${tradeSizeDollars}, Ask Price: $${askPrice})`);
    }

    const orderPayload = {
      symbol: ticker,
      qty: String(qty),
      side: 'buy',
      type: 'market',
      time_in_force: 'day'
    };

    const res = await fetch(`${ALPACA_BASE_URL}/v2/orders`, {
      method: 'POST',
      headers: {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    if (!res.ok) {
      const errTxt = await res.text();
      return { success: false, error: errTxt };
    }

    const orderData = await res.json();
    return { success: true, order: orderData, qty, askPrice };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
