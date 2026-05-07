import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This contains the user_email
    
    // Check if error was returned
    const errorParam = searchParams.get('error');
    if (errorParam) {
      console.error('Alpaca OAuth Error:', errorParam);
      return NextResponse.redirect(new URL('/?error=oauth_denied', request.url));
    }

    if (!code || !state) {
      return NextResponse.json({ success: false, error: 'Missing code or state parameter' }, { status: 400 });
    }

    const email = state;
    const clientId = process.env.NEXT_PUBLIC_ALPACA_CLIENT_ID;
    const clientSecret = process.env.ALPACA_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/alpaca/callback`;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('Missing Alpaca OAuth environment variables');
      return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 });
    }

    // 1. Exchange the code for an access token
    const tokenParams = new URLSearchParams();
    tokenParams.append('grant_type', 'authorization_code');
    tokenParams.append('code', code);
    tokenParams.append('client_id', clientId);
    tokenParams.append('client_secret', clientSecret);
    tokenParams.append('redirect_uri', redirectUri);

    const tokenRes = await fetch('https://api.alpaca.markets/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString()
    });

    if (!tokenRes.ok) {
      const errTxt = await tokenRes.text();
      console.error('Failed to exchange Alpaca token:', errTxt);
      return NextResponse.json({ success: false, error: 'Failed to exchange token' }, { status: 400 });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch the user's Alpaca account ID using the new token
    const accountRes = await fetch('https://api.alpaca.markets/v2/account', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!accountRes.ok) {
      const accErr = await accountRes.text();
      console.error('Failed to fetch Alpaca account with token:', accErr);
      return NextResponse.json({ success: false, error: 'Failed to fetch account info' }, { status: 400 });
    }

    const accountData = await accountRes.json();
    const accountId = accountData.id;

    // 3. Upsert the record into the Supabase 'users' table
    const { error: dbError } = await supabase
      .from('users')
      .upsert({
        user_email: email,
        alpaca_access_token: accessToken,
        alpaca_account_id: accountId
      }, { onConflict: 'user_email' });

    if (dbError) {
      console.error('Supabase upsert error:', dbError);
      return NextResponse.json({ success: false, error: 'Failed to save user data' }, { status: 500 });
    }

    // 4. Redirect the user back to the main dashboard with the session email
    const redirectUrl = new URL(`/dashboard?success=alpaca_linked&session_email=${encodeURIComponent(email)}`, request.url);
    return NextResponse.redirect(redirectUrl);

  } catch (error: any) {
    console.error('Alpaca OAuth Callback Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
