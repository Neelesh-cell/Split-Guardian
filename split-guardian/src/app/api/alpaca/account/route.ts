import { NextResponse } from 'next/server';
import { getAlpacaAccount, getAlpacaPositions } from '@/utils/alpaca';
import { supabase } from '@/utils/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email parameter is required' }, { status: 400 });
    }

    const { data: user, error: userError } = await supabase.from('users').select('alpaca_access_token').eq('user_email', email).single();

    if (userError || !user?.alpaca_access_token) {
      return NextResponse.json({ success: false, error: 'User not found or Alpaca not connected' }, { status: 404 });
    }

    const [account, positions] = await Promise.all([
      getAlpacaAccount(user.alpaca_access_token),
      getAlpacaPositions(user.alpaca_access_token),
    ]);
    
    const equity = parseFloat(account.equity);
    const startingBalance = 100000;
    const netPl = equity - startingBalance;

    return NextResponse.json({
      success: true,
      equity: equity,
      buyingPower: parseFloat(account.buying_power),
      portfolioValue: parseFloat(account.portfolio_value),
      netPl: netPl,
      status: account.status,
      positions: positions,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
