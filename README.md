# 🛡️ Split-Guardian: Algorithmic Split Automation

**A production-ready Fintech engine for identifying and executing trades based on global stock split events.**

### Core Architecture
* **Intelligence:** Multi-source scraping engine (Benzinga, TipRanks, etc.) with automated deduplication.
* **Risk Logic:** 7-day "Trade Memory" cooldown and a Forward/Reverse split execution gate.
* **Persistence:** Supabase PG-Vector and RLS-secured data layer for 24/7 audit trails.
* **Execution:** Direct bridge to Alpaca Trading API for low-latency market entry.
* **Visibility:** Real-time mobile-responsive dashboard with live P/L tracking.
