import { NextResponse } from 'next/server';
import { getAlpacaAccount } from '@/utils/alpaca';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const account = await getAlpacaAccount();
    
    // Calculate P/L
    // Equity - Last Equity (or use Portfolio Value if using a different metric)
    const equity = parseFloat(account.equity);
    // Realized/Unrealized P/L from initial balance (assuming $100k start)
    const startingBalance = 100000;
    const netPl = equity - startingBalance;

    return NextResponse.json({
      success: true,
      equity: equity,
      buyingPower: parseFloat(account.buying_power),
      netPl: netPl,
      status: account.status
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
