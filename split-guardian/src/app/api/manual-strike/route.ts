import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { executeMarketBuy, executeMarketSell } from '@/utils/alpaca';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ticker, action, tradeBy, value, email } = body;

    if (!ticker || !action || !tradeBy || !value || !email) {
      return NextResponse.json({ success: false, error: 'Missing required parameters (including email)' }, { status: 400 });
    }

    const orderType = tradeBy === 'quantity' ? 'quantity' : 'amount';
    const numValue = Number(value);

    if (isNaN(numValue) || numValue <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid value' }, { status: 400 });
    }

    const devEmail = process.env.NEXT_PUBLIC_DEV_EMAIL;
    const isDev = email === devEmail;

    // 1. Fetch user from Supabase
    const { data: user, error } = await supabase.from('users').select('*').eq('user_email', email).single();
    if (error || !user) {
      console.error(`User not found for email ${email}`);
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (!isDev && !user.alpaca_access_token) {
      return NextResponse.json({ success: false, error: 'User has no Alpaca access token' }, { status: 400 });
    }

    const tokenToUse = (isDev && !user.alpaca_access_token) ? undefined : user.alpaca_access_token;

    // 2. Execute trade for this user only
    console.log(`Executing manual strike for user: ${email} | ${action} ${value} ${orderType} of ${ticker}`);
    
    let userRes;
    if (action.toLowerCase() === 'buy') {
      userRes = await executeMarketBuy(ticker, orderType, numValue, tokenToUse);
    } else {
      userRes = await executeMarketSell(ticker, orderType, numValue, tokenToUse);
    }

    const result = {
      account: user.alpaca_account_id,
      email: user.user_email,
      success: userRes.success,
      error: userRes.error,
      qty: userRes.qty
    };

    if (userRes.success) {
      return NextResponse.json({
        success: true,
        summary: `Executed successfully for ${email}.`,
        details: [result]
      });
    } else {
      return NextResponse.json({
        success: false,
        error: userRes.error,
        details: [result]
      });
    }

  } catch (error: any) {
    console.error('Manual Strike Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
