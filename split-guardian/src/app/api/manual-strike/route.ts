import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { executeMarketBuy, executeMarketSell } from '@/utils/alpaca';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ticker, action, tradeBy, value } = body;

    if (!ticker || !action || !tradeBy || !value) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    const orderType = tradeBy === 'quantity' ? 'quantity' : 'amount';
    const numValue = Number(value);

    if (isNaN(numValue) || numValue <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid value' }, { status: 400 });
    }

    const results: any[] = [];

    // 1. Execute for .env.local master account
    try {
      console.log(`Executing manual strike for MASTER account: ${action} ${value} ${orderType} of ${ticker}`);
      let masterRes;
      if (action.toLowerCase() === 'buy') {
        masterRes = await executeMarketBuy(ticker, orderType, numValue);
      } else {
        masterRes = await executeMarketSell(ticker, orderType, numValue);
      }
      
      results.push({
        account: 'MASTER (.env)',
        email: 'developer',
        success: masterRes.success,
        error: masterRes.error,
        qty: masterRes.qty
      });
    } catch (e: any) {
      results.push({ account: 'MASTER (.env)', email: 'developer', success: false, error: e.message });
    }

    // 2. Fetch all linked accounts from Supabase
    const { data: users, error } = await supabase.from('users').select('*');
    if (error) {
      console.error('Failed to fetch users from Supabase:', error);
    }

    if (users && users.length > 0) {
      // 3. Loop over all users and execute
      for (const user of users) {
        if (!user.alpaca_access_token) continue;

        try {
          console.log(`Executing manual strike for sub-account: ${user.user_email}`);
          let userRes;
          if (action.toLowerCase() === 'buy') {
            userRes = await executeMarketBuy(ticker, orderType, numValue, user.alpaca_access_token);
          } else {
            userRes = await executeMarketSell(ticker, orderType, numValue, user.alpaca_access_token);
          }
          
          results.push({
            account: user.alpaca_account_id,
            email: user.user_email,
            success: userRes.success,
            error: userRes.error,
            qty: userRes.qty
          });
        } catch (e: any) {
          results.push({ account: user.alpaca_account_id, email: user.user_email, success: false, error: e.message });
        }
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      summary: `Executed for ${successful} accounts, failed for ${failed} accounts.`,
      details: results
    });

  } catch (error: any) {
    console.error('Manual Strike Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
