"use client";
import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import MarketCard from '@/features/bayse-trading/MarketCard';
import SignalCard from '@/features/macro-feed/SignalCard';
import ConfidenceGauge from '@/components/charts/ConfidenceGauge';
import SystemLog from '@/components/layout/SystemLog';
import { analyzeMarkets } from '@/lib/api-client';
import { MacroSignal } from '@/types/macro';
import { LayoutGrid, Trophy, TrendingUp, TrendingDown, AlertTriangle, Minus, Brain } from 'lucide-react';

/**
 * Main Macro Terminal Dashboard
 * 
 * This is the primary interface for the Bayse Macro Intel platform.
 * It coordinates data fetching, state management, and the rendering 
 * of signals, leaderboards, and intelligence reports.
 */

interface SignalsData {
  global_confidence: number;
  active_signals: number;
  data_points: number;
  signals: MacroSignal[];
}

/**
 * Trade Score Calculation Logic
 * 
 * Computes a normalized [0-100] score to rank the quality of a signal.
 * Formula: (Prob * 0.4 + Reliability * 0.3 + Accuracy * 0.3) * 100 + SentimentModifier
 */
function computeTradeScore(signal: MacroSignal) {
  const probability = Number(signal.probability);
  const source_reliability = Number(signal.source_reliability);
  const historical_accuracy = Number(signal.historical_accuracy);
  const sentimentModifier =
    signal.sentiment === 'RISK_ALERT' ? -15
      : signal.sentiment === 'NEUTRAL' ? -5
        : signal.sentiment === 'BEARISH' ? -10
          : 0;
  return Math.min(100, Math.max(0,
    (probability * 0.4 + source_reliability * 0.3 + historical_accuracy * 0.3) * 100
    + sentimentModifier
  ));
}

const SENTIMENT_CONFIG: Record<string, { color: string; icon: any }> = {
  BULLISH: { color: 'text-green-400', icon: TrendingUp },
  BEARISH: { color: 'text-red-400', icon: TrendingDown },
  RISK_ALERT: { color: 'text-orange-400', icon: AlertTriangle },
  NEUTRAL: { color: 'text-slate-400', icon: Minus },
};

/**
 * Leaderboard Component
 * 
 * Displays markets ranked by "Divergence" (The gap between AI Fair Value and Market Price).
 * High divergence often indicates a potential trading opportunity (mispricing).
 */
function Leaderboard({ signals }: { signals: MacroSignal[] }) {
  const ranked = [...signals]
    .map(s => ({
      ...s,
      score: computeTradeScore(s),
      divergence: Math.abs(s.probability * 100 - (1 - s.source_reliability) * 100),
    }))
    .sort((a, b) => b.divergence - a.divergence);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[9px] font-mono text-slate-600 uppercase tracking-widest border-b border-slate-800">
        <div className="col-span-1">#</div>
        <div className="col-span-5">Market</div>
        <div className="col-span-2 text-center">AI Prob</div>
        <div className="col-span-2 text-center">Divergence</div>
        <div className="col-span-2 text-center">Score</div>
      </div>

      {ranked.map((s, i) => {
        const cfg = SENTIMENT_CONFIG[s.sentiment] ?? SENTIMENT_CONFIG.NEUTRAL;
        const Icon = cfg.icon;
        const scoreColor = s.score >= 75 ? 'text-green-400'
          : s.score >= 58 ? 'text-blue-400'
            : s.score >= 42 ? 'text-slate-400'
              : 'text-red-400';
        const action = s.score >= 75 ? 'STRONG BUY'
          : s.score >= 58 ? 'BUY'
            : s.score >= 42 ? 'HOLD'
              : 'AVOID';

        return (
          <div
            key={s.marketId}
            className={`grid grid-cols-12 gap-2 px-3 py-3 rounded-xl border transition-colors hover:border-slate-600 ${i === 0 ? 'bg-orange-500/5 border-orange-500/20' :
                i === 1 ? 'bg-blue-500/5 border-blue-500/10' :
                  i === 2 ? 'bg-slate-800/30 border-slate-700/50' :
                    'bg-slate-900/30 border-slate-800/50'
              }`}
          >
            {/* Rank */}
            <div className="col-span-1 flex items-center">
              <span className={`text-[11px] font-black font-mono ${i === 0 ? 'text-orange-400' : i === 1 ? 'text-blue-400' : i === 2 ? 'text-slate-400' : 'text-slate-600'
                }`}>
                {i === 0 ? '①' : i === 1 ? '②' : i === 2 ? '③' : `${i + 1}`}
              </span>
            </div>

            {/* Market */}
            <div className="col-span-5 flex flex-col justify-center gap-0.5">
              <p className="text-[11px] text-white font-bold leading-tight line-clamp-2">
                {s.market_question}
              </p>
              <div className="flex items-center gap-1">
                <Icon size={10} className={cfg.color} />
                <span className={`text-[9px] font-mono ${cfg.color}`}>{s.sentiment}</span>
                {s.category && (
                  <span className="text-[9px] font-mono text-slate-600 ml-1">{s.category}</span>
                )}
              </div>
            </div>

            {/* AI Prob */}
            <div className="col-span-2 flex items-center justify-center">
              <span className="text-[12px] font-mono font-bold text-white">
                {(s.probability * 100).toFixed(0)}%
              </span>
            </div>

            {/* Divergence */}
            <div className="col-span-2 flex flex-col items-center justify-center gap-1">
              <span className={`text-[11px] font-mono font-bold ${s.divergence > 20 ? 'text-orange-400' : s.divergence > 10 ? 'text-blue-400' : 'text-slate-500'
                }`}>
                {s.divergence.toFixed(1)}%
              </span>
              <div className="w-full h-0.5 bg-slate-800 rounded-full">
                <div
                  className={`h-full rounded-full ${s.divergence > 20 ? 'bg-orange-400' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(100, s.divergence * 2)}%` }}
                />
              </div>
            </div>

            {/* Score */}
            <div className="col-span-2 flex items-center justify-center">
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-lg ${scoreColor} ${s.score >= 75 ? 'bg-green-500/10' :
                  s.score >= 58 ? 'bg-blue-500/10' :
                    s.score >= 42 ? 'bg-slate-500/10' :
                      'bg-red-500/10'
                }`}>
                {action}
              </span>
            </div>
          </div>
        );
      })}

      {ranked.length === 0 && (
        <p className="text-[10px] font-mono text-slate-600 text-center py-12">
          NO_SIGNALS_AVAILABLE
        </p>
      )}
    </div>
  );
}

/**
 * Intelligence Tab Component
 * 
 * Provides a high-level overview of the AI's collective market synthesis,
 * including a breakdown of sentiment distribution and recent logic.
 */
function IntelligenceTab({ signalsData }: { signalsData: SignalsData | null }) {
  const globalConfidence = signalsData ? Math.round(signalsData.global_confidence * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Confidence Gauge */}
      <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-3xl backdrop-blur-xl">
        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">AI Synthesis</h2>
        <ConfidenceGauge value={globalConfidence} />
        <div className="mt-8 pt-8 border-t border-slate-800/50 space-y-4">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-slate-500">ACTIVE_SIGNALS</span>
            <span className="text-white">{signalsData?.active_signals ?? "—"}</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-slate-500">DATA_POINTS</span>
            <span className="text-white">{signalsData?.data_points.toLocaleString() ?? "—"}</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-slate-500">GLOBAL_CONFIDENCE</span>
            <span className="text-white">{globalConfidence}%</span>
          </div>
          {/* Sentiment breakdown */}
          <div className="pt-4 border-t border-slate-800/50 space-y-2">
            {['BULLISH', 'BEARISH', 'RISK_ALERT', 'NEUTRAL'].map((s) => {
              const count = signalsData?.signals.filter(sig => sig.sentiment === s).length ?? 0;
              const total = signalsData?.signals.length ?? 1;
              const pct = Math.round((count / total) * 100);
              const color = s === 'BULLISH' ? 'bg-green-500' : s === 'BEARISH' ? 'bg-red-500' : s === 'RISK_ALERT' ? 'bg-orange-500' : 'bg-slate-500';
              const textColor = s === 'BULLISH' ? 'text-green-400' : s === 'BEARISH' ? 'text-red-400' : s === 'RISK_ALERT' ? 'text-orange-400' : 'text-slate-400';
              return (
                <div key={s}>
                  <div className="flex justify-between text-[9px] font-mono mb-1">
                    <span className={textColor}>{s}</span>
                    <span className="text-slate-500">{count} signals</span>
                  </div>
                  <div className="h-0.5 bg-slate-800 rounded-full">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* System Log */}
      <div className="space-y-6">
        <SystemLog />
        <div className="space-y-4">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Recent Logic</h2>
          {signalsData?.signals.slice(0, 3).map((s, i) => (
            <SignalCard key={i} signal={s} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Root Dashboard Component
 * 
 * Manages the application's global state, including active tab,
 * filter settings, and the main data fetching lifecycle.
 */
export default function Dashboard() {
  const [systemStatus, setSystemStatus] = useState("INITIALIZING");
  const [signalsData, setSignalsData] = useState<SignalsData | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'scanner' | 'leaderboard' | 'intelligence'>('scanner');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  /**
   * Data Fetching Handler
   * 
   * Triggers the analysis API. If 'force' is true, it bypasses the
   * server-side cache for fresh results.
   */
  const fetchSignals = useCallback(async (force = false) => {
    setLoading(true);
    setSystemStatus("ANALYZING");
    try {
      const data = await analyzeMarkets(force);
      setSignalsData(data);
      setLastUpdated(new Date().toLocaleTimeString());
      setSystemStatus("OPTIMAL");
    } catch (err) {
      console.error("ANALYZE_ERROR:", err);
      setSystemStatus("CONFIG_ERROR");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  const globalConfidence = signalsData ? Math.round(signalsData.global_confidence * 100) : 0;

  const filteredSignals = signalsData?.signals.filter((s) => {
    const sentimentMatch = sentimentFilter === 'ALL' || s.sentiment === sentimentFilter;
    const categoryMatch = categoryFilter === 'ALL' || s.category === categoryFilter;
    return sentimentMatch && categoryMatch;
  }) ?? [];

  const categories = ['ALL', ...Array.from(new Set(signalsData?.signals.map(s => s.category).filter(Boolean) ?? []))];
    const TABS = [
    { id: 'scanner', label: 'SIGNAL_CARDS', icon: <LayoutGrid size={12} />, activeClass: 'bg-blue-600 text-white' },
    { id: 'leaderboard', label: 'LEADERBOARD', icon: <Trophy size={12} />, activeClass: 'bg-orange-500 text-white' },
    { id: 'intelligence', label: 'INTELLIGENCE', icon: <Brain size={12} />, activeClass: 'bg-purple-600 text-white' },
  ];
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-blue-500/30">
      <Sidebar />
      <main className="lg:ml-64 p-4 lg:p-12">
        <div className="max-w-6xl mx-auto">
          {/* Top Info Bar */}
          <div className="flex justify-between items-center mb-12">
            <div>
              <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tighter uppercase italic">Terminal_v1.0</h1>
              <p className="text-slate-500 text-[10px] font-mono mt-1 tracking-widest uppercase opacity-70">
                Live Macro Sentiment Analysis // Lagos, NG // LAST_SYNC: {lastUpdated || "—"}
              </p>
            </div>
            <div className="flex gap-2 md:gap-4 items-center">
              <button
                onClick={() => fetchSignals(true)}
                disabled={loading}
                className="bg-slate-900 border border-slate-700 hover:border-blue-500 px-3 md:px-4 py-2 rounded-xl text-[10px] font-mono text-slate-400 hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "ANALYZING..." : "↻ REFRESH"}
              </button>
              <div className="hidden md:block bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-[10px] font-mono">
                <span className="text-slate-500">SYSTEM_STATUS:</span>{" "}
                <span className={`transition-colors duration-500 ${
                  systemStatus === "OPTIMAL" ? "text-green-500 animate-pulse" :
                  systemStatus === "INITIALIZING" || systemStatus === "ANALYZING" ? "text-blue-500 animate-pulse" :
                  "text-red-500"
                }`}>{systemStatus}</span>
              </div>
            </div>
          </div>

          {loading && !signalsData ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 text-[10px] font-mono tracking-widest uppercase animate-pulse">
                Fetching live markets & generating signals...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-8 items-start">
              {/* Primary Feed */}
              <div className={`col-span-12 ${activeTab === 'intelligence' ? '' : 'lg:col-span-8'}`}>

                {/* Tab Switcher */}
              <div className="flex items-center gap-1 mb-8 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
                {TABS.map(({ id, label, icon, activeClass }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id as any)}
                    className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-[10px] font-mono font-bold transition-all ${
                      activeTab === id ? activeClass : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {icon}
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

                {activeTab === 'scanner' && (
                  <>
                    {/* Filter Bar */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {['ALL', 'BULLISH', 'BEARISH', 'RISK_ALERT', 'NEUTRAL'].map((s) => (
                        <button
                          key={s}
                          onClick={() => setSentimentFilter(s)}
                          className={`text-[9px] font-mono font-bold px-3 py-1.5 rounded-lg border transition-colors ${sentimentFilter === s
                              ? s === 'BULLISH' ? 'bg-green-500/20 border-green-500/50 text-green-400'
                                : s === 'BEARISH' ? 'bg-red-500/20 border-red-500/50 text-red-400'
                                  : s === 'RISK_ALERT' ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                                    : s === 'NEUTRAL' ? 'bg-slate-500/20 border-slate-500/50 text-slate-400'
                                      : 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                              : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'
                            }`}
                        >
                          {s}
                        </button>
                      ))}
                      <div className="w-px bg-slate-800 mx-1" />
                      {categories.map((c) => (
                        <button
                          key={c}
                          onClick={() => setCategoryFilter(c)}
                          className={`text-[9px] font-mono px-3 py-1.5 rounded-lg border transition-colors ${categoryFilter === c
                              ? 'bg-slate-700 border-slate-500 text-white'
                              : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'
                            }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>

                    {/* Legend Bar */}
                    <div className="flex flex-wrap gap-3 mb-6 p-3 bg-slate-900/60 border border-slate-800 rounded-xl">
                      {[
                        { sentiment: "BULLISH", color: "text-green-400", dot: "bg-green-400", action: "Buy YES — AI sees underpriced upside" },
                        { sentiment: "BEARISH", color: "text-red-400", dot: "bg-red-400", action: "Buy NO — crowd overpricing the outcome" },
                        { sentiment: "RISK_ALERT", color: "text-orange-400", dot: "bg-orange-400", action: "Stay out — high uncertainty, thin data" },
                        { sentiment: "NEUTRAL", color: "text-slate-400", dot: "bg-slate-400", action: "Monitor — no meaningful mispricing" },
                      ].map(({ sentiment, color, dot, action }) => (
                        <div key={sentiment} className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                          <span className={`text-[9px] font-mono font-black ${color}`}>{sentiment}</span>
                          <span className="text-[9px] font-mono text-slate-600">{action}</span>
                        </div>
                      ))}
                    </div>


                    {/* MARKET CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {filteredSignals.map((s, i) => (
                        <MarketCard key={i} signal={s} />
                      ))}
                      {filteredSignals.length === 0 && (
                        <p className="text-[10px] font-mono text-slate-600 col-span-2 text-center py-12">
                          NO_SIGNALS_MATCH_FILTER
                        </p>
                      )}
                    </div>
                  </>
                )}
                {activeTab === 'leaderboard' && (
                  <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <Trophy size={14} className="text-orange-400" />
                      <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Divergence Leaderboard
                      </h2>
                      <span className="ml-auto text-[9px] font-mono text-slate-600">
                        Ranked by AI vs Market gap
                      </span>
                    </div>
                    <Leaderboard signals={signalsData?.signals ?? []} />
                  </div>
                )}
                {/* Intelligence Tab */}
                {activeTab === 'intelligence' && (
                  <IntelligenceTab signalsData={signalsData} />
                )}
              </div>

              {activeTab !== 'intelligence' && (
                <div className="hidden lg:block lg:col-span-4 sticky top-12 h-fit space-y-8">
                <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-3xl backdrop-blur-xl">
                  <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">AI Synthesis</h2>
                  <ConfidenceGauge value={globalConfidence} />
                  <div className="mt-8 pt-8 border-t border-slate-800/50 space-y-4">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-slate-500">ACTIVE_SIGNALS</span>
                      <span className="text-white">{signalsData?.active_signals ?? "—"}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-slate-500">DATA_POINTS</span>
                      <span className="text-white">{signalsData?.data_points.toLocaleString() ?? "—"}</span>
                    </div>
                  </div>
                </div>
                <SystemLog />
                <div className="space-y-4">
                  <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest ml-2">Recent Logic</h2>
                  {signalsData?.signals.slice(0, 3).map((s, i) => (
                    <SignalCard key={i} signal={s} />
                  ))}
                </div>
              </div>
            )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}