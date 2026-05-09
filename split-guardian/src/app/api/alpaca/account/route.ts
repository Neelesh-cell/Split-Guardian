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

    const devEmail = process.env.NEXT_PUBLIC_DEV_EMAIL;
    const isDev = email === devEmail;

    let { data: user, error: userError } = await supabase.from('users').select('*').eq('user_email', email).single();

    // If user doesn't exist but it's the dev email, create the record so settings can be saved
    if (userError || !user) {
      if (isDev) {
        const { data: newUser, error: insertError } = await supabase.from('users').upsert({ user_email: email }, { onConflict: 'user_email' }).select().single();
        if (!insertError && newUser) {
          user = newUser;
        } else {
          console.warn('Failed to create dev user, falling back to empty user', insertError);
          user = { user_email: email, alpaca_access_token: null };
        }
      } else {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
      }
    }

    if (!isDev && !user?.alpaca_access_token) {
      return NextResponse.json({ success: false, error: 'User has no Alpaca access token' }, { status: 400 });
    }

    const tokenToUse = (isDev && !user?.alpaca_access_token) ? undefined : user?.alpaca_access_token;

    const [account, positions] = await Promise.all([
      getAlpacaAccount(tokenToUse),
      getAlpacaPositions(tokenToUse),
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
