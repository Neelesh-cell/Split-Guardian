import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';
import { getAlpacaOrders } from '@/utils/alpaca';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ success: false, error: 'Email parameter is required' }, { status: 400 });
    }

    const devEmail = process.env.NEXT_PUBLIC_DEV_EMAIL;
    const isDev = email === devEmail;

    const { data: user, error: userError } = await supabase.from('users').select('*').eq('user_email', email).single();
    
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (!isDev && !user.alpaca_access_token) {
      return NextResponse.json({ success: false, error: 'User has no Alpaca access token' }, { status: 400 });
    }

    const tokenToUse = (isDev && !user.alpaca_access_token) ? undefined : user.alpaca_access_token;

    // 1. Fetch Alpaca Orders
    const orders = await getAlpacaOrders(tokenToUse, 100);
    const filledOrders = orders.filter((o: any) => o.status === 'filled');

    // 2. Fetch existing Supabase trade log
    const { data: existingLogs } = await supabase.from('trade_log').select('*').eq('user_email', email);
    const existingTickers = new Set(existingLogs?.map(log => log.ticker) || []);

    let insertedCount = 0;

    // 3. Database Backfill
    for (const order of filledOrders) {
      if (!existingTickers.has(order.symbol)) {
        const payload = {
          user_email: email,
          ticker: order.symbol,
          split_ratio: 'N/A',
          sources: ['Alpaca Sync'],
          split_type: 'forward', // Must match ENUM ('forward', 'reverse')
          execution_status: 'filled',
          created_at: order.filled_at || order.created_at
        };
        
        const { error: insertErr } = await supabase.from('trade_log').insert(payload);
        if (insertErr) {
          console.error('Error inserting synced order:', insertErr);
        } else {
          insertedCount++;
          existingTickers.add(order.symbol);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      summary: `Successfully synced ${insertedCount} historical order(s) from Alpaca.` 
    });

  } catch (error: any) {
    console.error('History Sync Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
