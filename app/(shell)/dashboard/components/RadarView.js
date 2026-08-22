"use client";

/* ============================================================================
   RadarView — "Trading Radar" nav entry.
   Thin wrapper around MarketIntelligenceView, which is the single live
   command-center powered by the QAIS SK Engine (chart + AI panel + Currency
   Heat Map + Session Map + Live Opportunities + Liquidity Map + Analysis
   Workspace + Market Summary + Live Notifications).
   ============================================================================ */

import MarketIntelligenceView from "./MarketIntelligenceView";

export default function RadarView() {
  return <MarketIntelligenceView />;
}
