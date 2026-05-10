export const ALPACA_API_KEY = process.env.APCA_API_KEY_ID || 'PKLI4IWRXT5DVA27FYQ4HWRQMK';
export const ALPACA_API_SECRET = process.env.APCA_API_SECRET_KEY || 'Eud1TwbmmCDRNwzXZGGgJNcXm13WmG81cugG7wcE1GqX';
export const ALPACA_BASE_URL = 'https://paper-api.alpaca.markets';

function getHeaders(accessToken?: string): Record<string, string> {
  if (accessToken) {
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    };
  }
  return {
    'APCA-API-KEY-ID': ALPACA_API_KEY,
    'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
    'Accept': 'application/json'
  };
}

export async function getAlpacaAccount(accessToken?: string) {
  const res = await fetch(`${ALPACA_BASE_URL}/v2/account`, {
    headers: getHeaders(accessToken),
    cache: 'no-store' // Don't cache to get real-time P/L
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch Alpaca account: ${await res.text()}`);
  }
  return res.json();
}

export async function getAlpacaPositions(accessToken?: string) {
  const res = await fetch(`${ALPACA_BASE_URL}/v2/positions`, {
    headers: getHeaders(accessToken),
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Alpaca positions: ${await res.text()}`);
  }
  return res.json();
}

export async function getAlpacaOrders(accessToken?: string, limit: number = 20) {
  const res = await fetch(`${ALPACA_BASE_URL}/v2/orders?status=all&limit=${limit}&direction=desc`, {
    headers: getHeaders(accessToken),
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Alpaca orders: ${await res.text()}`);
  }
  return res.json();
}

export async function getAsset(ticker: string, accessToken?: string) {
  const res = await fetch(`${ALPACA_BASE_URL}/v2/assets/${ticker}`, {
    headers: getHeaders(accessToken),
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

export async function getLatestQuote(ticker: string, accessToken?: string) {
  // Use Alpaca Data API to get the latest quote
  const DATA_URL = 'https://data.alpaca.markets/v2/stocks';
  const res = await fetch(`${DATA_URL}/${ticker}/quotes/latest`, {
    headers: getHeaders(accessToken),
    cache: 'no-store'
  });
  
  if (!res.ok) {
    throw new Error(`Failed to fetch quote for ${ticker}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.quote.ap; // Ask price
}

export async function executeMarketBuy(ticker: string, orderType: 'quantity' | 'amount', value: number, accessToken?: string) {
  try {
    // 1. Pre-Trade Verification (Asset Check)
    try {
      const asset = await getAsset(ticker, accessToken);
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

    // 2. Quote Check & Qty Calculation
    const askPrice = await getLatestQuote(ticker, accessToken);
    if (!askPrice || askPrice <= 0) {
      throw new Error(`Invalid ask price for ${ticker}: ${askPrice}`);
    }
    
    let finalQty = 0;
    if (orderType === 'amount') {
      finalQty = Math.floor(value / askPrice);
      if (finalQty <= 0) {
        throw new Error(`Calculated quantity is 0 for ${ticker} (Trade Size: $${value}, Ask Price: $${askPrice})`);
      }
    } else {
      finalQty = value;
      if (finalQty <= 0) throw new Error(`Quantity must be greater than 0.`);
    }

    const orderPayload = {
      symbol: ticker,
      qty: String(finalQty),
      side: 'buy',
      type: 'market',
      time_in_force: 'day'
    };

    const res = await fetch(`${ALPACA_BASE_URL}/v2/orders`, {
      method: 'POST',
      headers: {
        ...getHeaders(accessToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload)
    });

    if (!res.ok) {
      const errTxt = await res.text();
      return { success: false, error: errTxt };
    }

    const orderData = await res.json();
    return { success: true, order: orderData, qty: finalQty, askPrice };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function executeMarketSell(ticker: string, orderType: 'quantity' | 'amount', value: number, accessToken?: string) {
  try {
    // 1. Pre-trade Position Check
    const positions = await getAlpacaPositions(accessToken);
    const position = positions.find((p: any) => p.symbol === ticker);
    
    if (!position) {
      throw new Error(`Insufficient shares to sell: You do not hold any shares of ${ticker}.`);
    }

    const heldQty = parseFloat(position.qty);
    const currentPrice = parseFloat(position.current_price);

    let sellQty = 0;
    if (orderType === 'amount') {
      sellQty = Math.floor(value / currentPrice);
    } else {
      sellQty = value;
    }

    if (sellQty <= 0) {
      throw new Error(`Calculated sell quantity is 0 for ${ticker} (Current Price: $${currentPrice}).`);
    }
    if (sellQty > heldQty) {
      throw new Error(`Insufficient shares: Attempted to sell ${sellQty} shares, but only hold ${heldQty} shares of ${ticker}.`);
    }

    const orderPayload = {
      symbol: ticker,
      qty: String(sellQty),
      side: 'sell',
      type: 'market',
      time_in_force: 'day'
    };

    const res = await fetch(`${ALPACA_BASE_URL}/v2/orders`, {
      method: 'POST',
      headers: {
        ...getHeaders(accessToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload)
    });

    if (!res.ok) {
      const errTxt = await res.text();
      return { success: false, error: errTxt };
    }

    const orderData = await res.json();
    return { success: true, order: orderData, qty: sellQty, currentPrice };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
