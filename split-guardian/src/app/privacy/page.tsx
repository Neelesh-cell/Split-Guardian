import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Split-Guardian',
  description: 'Privacy Policy for Split-Guardian trading automation.',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-300 font-sans selection:bg-indigo-500/30">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
        
        <Link href="/" className="inline-flex items-center text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors mb-8">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          Back to Dashboard
        </Link>

        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-8">
          Privacy <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Policy</span>
        </h1>
        
        <div className="space-y-8 text-lg leading-relaxed bg-gray-900/50 backdrop-blur-md border border-gray-800 p-8 md:p-12 rounded-3xl shadow-2xl">
          
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Information We Collect</h2>
            <p className="mb-4">
              When you use Split-Guardian to automate your trading or execute manual strikes, we collect the minimal amount of information necessary to provide our services. This includes:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-400">
              <li><strong>Email Address:</strong> Used to uniquely identify your account and configurations.</li>
              <li><strong>Alpaca OAuth Tokens:</strong> We securely store authorization tokens provided by Alpaca to execute trades on your behalf.</li>
              <li><strong>Alpaca Account IDs:</strong> To manage multi-account executions and portfolio metrics.</li>
              <li><strong>Trade Logs:</strong> History of automated (Hunter) and manual executions for your review.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Zero Password Storage</h2>
            <p>
              Security is our top priority. <strong>We never ask for, collect, or store your Alpaca username or password.</strong> All authentication is handled securely via Alpaca's official OAuth protocol. You grant us permission via an access token, which you can revoke at any time from your Alpaca dashboard.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. How We Use Your Data</h2>
            <p className="mb-4">
              The data we store is used exclusively for the operational functionality of Split-Guardian:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-400">
              <li>Executing real-time stock split automation (Hunter engine).</li>
              <li>Executing cross-account manual strikes.</li>
              <li>Providing real-time portfolio metrics on your dashboard.</li>
              <li>Maintaining trade execution logs.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Data Storage and Security</h2>
            <p>
              Your email, tokens, and account information are stored securely in our Supabase database. We utilize industry-standard encryption and security practices to protect your data from unauthorized access, disclosure, or destruction. 
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Third-Party Services</h2>
            <p>
              Split-Guardian relies on third-party APIs to function, specifically Alpaca Markets for brokerage services and Supabase for database hosting. By using our service, you also agree to the respective privacy policies of these providers. We do not sell, rent, or share your personal information with any external marketing or advertising agencies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Contact Us</h2>
            <p>
              If you have any questions or concerns about this Privacy Policy, or if you wish to have your account and data permanently deleted from our systems, please contact the administrator of this Split-Guardian instance.
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
