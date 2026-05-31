# 🛡️ Split-Guardian

> **Automated Stock Split Execution for Professional Portfolios**

Split-Guardian is a production-ready, multi-tenant SaaS Fintech engine designed to identify and autonomously execute trades based on global stock split events. By eliminating human latency, the system ensures precision sizing and zero-delay market entry the moment a split signal is verified.

## 🚀 Key Features

- **Zero Latency Execution**: Our background Hunter engine triggers trades instantly via the Alpaca API.
- **Enterprise-Grade Intelligence**: Real-time split signals aggregated and deduplicated from top institutional sources (Benzinga, TipRanks, StockTitan).
- **Risk Protection**: 7-day "Trade Memory" cooldown, strict multi-tenant isolation, and explicit Forward/Reverse split execution gating.
- **Sizing Mastery**: Dynamic allocation supporting fractional dollars and exact share quantities.
- **Real-Time Visibility**: A high-performance, mobile-responsive dashboard for live P/L tracking and portfolio metrics.

## 💻 Tech Stack

- **Frontend**: [Next.js](https://nextjs.org/) (React), Tailwind CSS
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL, Row Level Security)
- **Brokerage Integration**: [Alpaca Trading API](https://alpaca.markets/) (OAuth 2.0 & Live Trading)
- **Deployment**: [Vercel](https://vercel.com/)
