"use client";
import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import MarketCard from '@/features/bayse-trading/MarketCard';
import SignalCard from '@/features/macro-feed/SignalCard';
import ConfidenceGauge from '@/components/charts/ConfidenceGauge';
import SystemLog from '@/components/layout/SystemLog';
import { analyzeMarkets } from '@/lib/api-client';
import { MacroSignal } from '@/types/macro';
import { LayoutGrid, Trophy, TrendingUp, TrendingDown, AlertTriangle, Minus, Brain, Search, X, Loader2 } from 'lucide-react';

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
function Leaderboard({ signals, currency = 'USD' }: { signals: MacroSignal[], currency?: 'USD' | 'NGN' }) {
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
                {s.marketTitle}
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
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [analyzedSearchResults, setAnalyzedSearchResults] = useState<Record<string, MacroSignal>>({});
  const [analyzingEventId, setAnalyzingEventId] = useState<string | null>(null);

  // Load initial currency from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('bayse_terminal_currency') as 'NGN' | 'USD';
    if (saved && (saved === 'NGN' || saved === 'USD')) {
      setCurrency(saved);
    }
  }, []);

  // Save currency to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('bayse_terminal_currency', currency);
  }, [currency]);

  /**
   * Request AI Analysis for a specific search result
   */
  const requestAnalysis = async (eventId: string) => {
    console.log("ANALYSIS_REQUESTED:", eventId);
    setAnalyzingEventId(eventId);
    try {
      const res = await fetch(`/api/analyze?eventId=${eventId}`);
      const data = await res.json();
      console.log("ANALYSIS_RESPONSE:", data);
      if (data.signals && data.signals.length > 0) {
        setAnalyzedSearchResults(prev => ({
          ...prev,
          [eventId]: data.signals[0]
        }));
      } else {
        alert("AI Analysis failed for this market. It may lack sufficient data.");
      }
    } catch (err) {
      console.error("ANALYSIS_REQUEST_ERROR:", err);
      alert("AI Analysis service is currently busy. Please try again in a moment.");
    } finally {
      setAnalyzingEventId(null);
    }
  };

  /**
   * Market Search Handler
   * 
   * Fetches raw event data from Bayse API based on keyword.
   */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    console.log("SEARCH_TRIGGERED:", searchQuery);
    setIsSearching(true);
    try {
      const res = await fetch(`/api/bayse/events?keyword=${encodeURIComponent(searchQuery)}&limit=10`);
      const data = await res.json();
      console.log("SEARCH_RESULTS:", data.events?.length || 0, "events found");
      setSearchResults(data.events ?? []);
      if (!data.events || data.events.length === 0) {
        alert(`No markets found for "${searchQuery}"`);
      }
    } catch (err) {
      console.error("SEARCH_ERROR:", err);
      alert("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
  };

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
      const data = await analyzeMarkets(force, currency);
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

  useEffect(() => { fetchSignals(); }, [fetchSignals, currency]);

  const globalConfidence = signalsData ? Math.round(signalsData.global_confidence * 100) : 0;

  const filteredSignals = signalsData?.signals.filter((s) => {
    const sentimentMatch = sentimentFilter === 'ALL' || s.sentiment === sentimentFilter;
    const categoryMatch = categoryFilter === 'ALL' || s.category === categoryFilter;
    return sentimentMatch && categoryMatch;
  }) ?? [];

  const categories = ['ALL', ...Array.from(new Set(signalsData?.signals.map(s => s.category).filter((c): c is string => Boolean(c)) ?? []))];
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
          <div className="flex justify-between items-center mb-12 gap-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tighter uppercase italic">Terminal_v1.0</h1>
              <p className="text-slate-500 text-[10px] font-mono mt-1 tracking-widest uppercase opacity-70">
                Live Macro Sentiment Analysis // Lagos, NG // LAST_SYNC: {lastUpdated || "—"}
              </p>
            </div>
            <div className="flex gap-2 md:gap-4 items-center">
              {/* Search Bar */}
              <form onSubmit={handleSearch} className="relative hidden sm:flex items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="SEARCH_MARKETS..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-900 border border-slate-800 focus:border-blue-500 px-10 py-2 rounded-xl text-[10px] font-mono text-white outline-none w-48 lg:w-64 transition-all"
                  />
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  {searchQuery && (
                    <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <button 
                  type="submit" 
                  disabled={isSearching}
                  className="bg-blue-600 hover:bg-blue-500 p-2 rounded-xl text-white disabled:opacity-50 transition-colors"
                >
                  {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </button>
              </form>

              <button
                onClick={() => fetchSignals(true)}
                disabled={loading}
                className="bg-slate-900 border border-slate-700 hover:border-blue-500 px-3 md:px-4 py-2 rounded-xl text-[10px] font-mono text-slate-400 hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "ANALYZING..." : "↻ REFRESH"}
              </button>

              {/* Currency Toggle */}
              <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
                {(['USD', 'NGN'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`px-3 py-1 rounded-lg text-[9px] font-mono font-bold transition-all ${
                      currency === c ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
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

              {/* SEARCH RESULTS VIEW */}
              {searchResults.length > 0 ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Search Results for "{searchQuery}"</h2>
                    <button onClick={clearSearch} className="text-[10px] font-mono text-blue-500 hover:underline">Clear Results</button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {searchResults.map((event: any) => {
                      // If this event has been analyzed, show the MarketCard instead
                      if (analyzedSearchResults[event.id]) {
                        return <MarketCard key={event.id} signal={analyzedSearchResults[event.id]} currency={currency} />;
                      }

                      return (
                        <div key={event.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 group hover:border-blue-500/30 transition-all flex flex-col">
                          <div className="flex justify-between items-start mb-4">
                            <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">RAW_EVENT</span>
                            <span className="text-[9px] font-mono text-slate-600 uppercase">{event.category}</span>
                          </div>
                          <h3 className="text-white font-bold text-lg mb-4 line-clamp-2">{event.title}</h3>
                          
                          <div className="flex-1 space-y-2 mb-6">
                            {event.markets.map((m: any) => (
                              <div key={m.id} className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                                <span className="text-[11px] text-slate-300 font-medium">{m.title}</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-[11px] font-mono text-white">{(m.outcome1Price * 100).toFixed(0)}%</span>
                                  <a 
                                    href={`https://app.bayse.markets/market/${event.id}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 rounded-lg transition"
                                  >
                                    <TrendingUp size={12} />
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>

                          <button 
                            onClick={() => requestAnalysis(event.id)}
                            disabled={analyzingEventId === event.id}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-blue-600 text-[10px] font-mono font-bold text-slate-300 hover:text-white rounded-xl transition-all disabled:opacity-50"
                          >
                            {analyzingEventId === event.id ? (
                              <Loader2 className="animate-spin" size={14} />
                            ) : (
                              <Brain size={14} />
                            )}
                            {analyzingEventId === event.id ? "ANALYZING..." : "RUN_AI_INTELLIGENCE"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : activeTab === 'scanner' && (
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
                        <MarketCard key={i} signal={s} currency={currency} />
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
                    <Leaderboard signals={signalsData?.signals ?? []} currency={currency} />
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