import { NextResponse } from 'next/server';
import { getAlpacaAccount, getAlpacaPositions } from '@/utils/alpaca';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [account, positions] = await Promise.all([
      getAlpacaAccount(),
      getAlpacaPositions(),
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
