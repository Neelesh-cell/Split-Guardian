import Link from 'next/link';

export const metadata = {
  title: 'Terms of Use | Split-Guardian',
  description: 'Terms of Use and Risk Disclosure for Split-Guardian.',
};

export default function TermsOfUse() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-300 font-sans selection:bg-rose-500/30">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
        
        <Link href="/" className="inline-flex items-center text-sm font-medium text-rose-400 hover:text-rose-300 transition-colors mb-8">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          Back to Dashboard
        </Link>

        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-8">
          Terms of <span className="bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">Use</span>
        </h1>
        
        <div className="space-y-8 text-lg leading-relaxed bg-gray-900/50 backdrop-blur-md border border-gray-800 p-8 md:p-12 rounded-3xl shadow-2xl">
          
          <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-xl">
            <h2 className="text-xl font-bold text-rose-400 mb-3 uppercase tracking-wider flex items-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Critical Risk Disclosure
            </h2>
            <p className="text-rose-200/90 font-medium">
              Trading stocks, equities, and other financial instruments involves substantial risk of loss and is not suitable for every investor. The valuation of stock splits can fluctuate, and you may lose some or all of your initial investment. <strong>Split-Guardian does not guarantee profits, minimize losses, or provide financial advice.</strong> Past performance of stock split strategies is not indicative of future results. You are solely responsible for your trading decisions and account balances.
            </p>
          </div>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using the Split-Guardian software, dashboard, automated Hunter engine, or Manual Strike command center, you agree to be bound by these Terms of Use. If you do not agree with any part of these terms, you must immediately revoke your Alpaca OAuth tokens and cease using the software.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Software Purpose</h2>
            <p>
              Split-Guardian is an execution engine designed to automate the process of buying and selling equities based on publicly available stock split calendars and manual user inputs. It connects to your brokerage account via Alpaca Markets OAuth. It is a tool for execution, not an advisory service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Limitation of Liability</h2>
            <p className="mb-4">
              Under no circumstances shall the creators, developers, or operators of Split-Guardian be held liable for any direct, indirect, incidental, consequential, or punitive damages arising from your use of the software. This includes, but is not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-400">
              <li>Financial losses resulting from automated trades executed by the Hunter engine.</li>
              <li>Financial losses resulting from cross-account Manual Strikes.</li>
              <li>Losses caused by software bugs, execution delays, or logic errors.</li>
              <li>Losses resulting from Alpaca API downtime, connectivity issues, or rate limiting.</li>
              <li>Losses due to inaccurate or delayed scraping of stock split data sources.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. API and Brokerage Risks</h2>
            <p>
              Split-Guardian relies entirely on the Alpaca Trading API. We are not affiliated with Alpaca Securities LLC. By using this software, you acknowledge that API outages, incorrect market data, exchange halts, and order rejections are outside of our control. We are not responsible for any failed order executions or orphaned positions caused by API failures.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. User Responsibilities</h2>
            <p>
              You are responsible for monitoring your own brokerage account, ensuring sufficient buying power, managing margin calls, and manually closing positions if the automated systems fail to do so. You agree to use Split-Guardian in compliance with all applicable local, state, and federal laws regarding algorithmic and day trading.
            </p>
          </section>

          <div className="pt-8 mt-8 border-t border-gray-800 text-sm text-gray-500">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

      </div>
    </div>
  );
}
