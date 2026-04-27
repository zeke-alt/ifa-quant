"use client";
import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import MarketCard from '@/features/bayse-trading/MarketCard';
import SignalCard from '@/features/macro-feed/SignalCard';
import ConfidenceGauge from '@/components/charts/ConfidenceGauge';
import OjaScore from '@/components/charts/OjaScore';
import SystemLog from '@/components/layout/SystemLog';
import { analyzeMarkets } from '@/lib/api-client';
import { MacroSignal } from '@/types/macro';
import { LayoutGrid, Trophy, TrendingUp, TrendingDown, AlertTriangle, Minus, Brain, Search, X, Loader2, Bookmark } from 'lucide-react';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useLayout } from '@/context/LayoutContext';
import { cn } from '@/lib/utils';

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
  const { toggleBookmark, isBookmarked } = useBookmarks();
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
        <div className="col-span-1 text-center">Score</div>
        <div className="col-span-1 text-center"></div>
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
        const bookmarked = isBookmarked(s.marketId);

        return (
          <div key={i} className="grid grid-cols-12 gap-2 items-center p-4 border-b border-border/40 hover:bg-secondary/40 transition-all group">
            {/* Rank */}
            <div className="col-span-1 flex items-center justify-center">
              <span className="text-[11px] font-black text-muted-foreground/30 group-hover:text-primary/40 transition-colors">#{i + 1}</span>
            </div>

            {/* Asset */}
            <div className="col-span-5 min-w-0">
              <h4 className="text-[11px] font-black text-foreground truncate uppercase tracking-tight">
                {s.headline.length > 40 ? s.headline.slice(0, 40) + "…" : s.headline}
              </h4>
            </div>

            {/* AI Prob */}
            <div className="col-span-2 text-center">
              <span className="text-[11px] font-black text-foreground/80 font-mono">
                {(s.probability * 100).toFixed(0)}%
              </span>
            </div>

            {/* Divergence */}
            <div className="col-span-2 text-center">
              <span className="text-[11px] font-black text-primary font-mono">
                {(Math.abs(Number(s.probability) - Number(s.yesProbability)) * 100).toFixed(1)}%
              </span>
            </div>

            {/* Score */}
            <div className="col-span-1 flex items-center justify-center">
              <div className={cn(
                "w-2 h-2 rounded-full",
                s.score >= 75 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' :
                  s.score >= 58 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]' :
                    s.score >= 42 ? 'bg-muted-foreground/30' :
                      'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
              )} title={action} />
            </div>

            {/* Bookmark */}
            <div className="col-span-1 flex items-center justify-center">
              <button
                onClick={() => toggleBookmark(s.marketId)}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  bookmarked ? 'text-primary' : 'text-muted-foreground/20 hover:text-foreground'
                )}
              >
                <Bookmark size={14} fill={bookmarked ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        );
      })}

      {ranked.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">
            NO_SIGNALS_AVAILABLE
          </p>
        </div>
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Confidence Gauge */}
      <div className="bg-card border border-border p-8 rounded-3xl shadow-sm backdrop-blur-sm">
        <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-8 opacity-40">AI Synthesis</h2>
        <ConfidenceGauge value={globalConfidence} />
        <div className="mt-8 pt-8 border-t border-border/50 space-y-6">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
            <span className="text-muted-foreground/60">ACTIVE_SIGNALS</span>
            <span className="text-foreground">{signalsData?.active_signals ?? "—"}</span>
          </div>
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
            <span className="text-muted-foreground/60">DATA_POINTS</span>
            <span className="text-foreground">{signalsData?.data_points.toLocaleString() ?? "—"}</span>
          </div>
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
            <span className="text-muted-foreground/60">GLOBAL_CONFIDENCE</span>
            <span className="text-foreground">{globalConfidence}%</span>
          </div>
          
          {/* Sentiment breakdown */}
          <div className="pt-6 border-t border-border/50 space-y-4">
            {['BULLISH', 'BEARISH', 'RISK_ALERT', 'NEUTRAL'].map((s) => {
              const count = signalsData?.signals.filter(sig => sig.sentiment === s).length ?? 0;
              const total = signalsData?.signals.length ?? 1;
              const pct = Math.round((count / total) * 100);
              const color = s === 'BULLISH' ? 'bg-green-500' : s === 'BEARISH' ? 'bg-red-500' : s === 'RISK_ALERT' ? 'bg-orange-500' : 'bg-muted-foreground/30';
              const textColor = s === 'BULLISH' ? 'text-green-600 dark:text-green-400' : s === 'BEARISH' ? 'text-red-600 dark:text-red-400' : s === 'RISK_ALERT' ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground';
              return (
                <div key={s}>
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-tight mb-2">
                    <span className={textColor}>{s}</span>
                    <span className="text-muted-foreground/40">{count} signals</span>
                  </div>
                  <div className="h-1 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="pt-8 border-t border-border/50">
            <OjaScore signals={signalsData?.signals ?? []} />
          </div>
        </div>
      </div>
      

      {/* System Log */}
      <div className="space-y-8">
        <SystemLog />
        <div className="space-y-6">
          <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] ml-2 opacity-40">Recent Logic</h2>
          {signalsData?.signals.map((s, i) => (
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
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'scanner' | 'leaderboard' | 'intelligence'>('scanner');
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [analyzedSearchResults, setAnalyzedSearchResults] = useState<Record<string, MacroSignal>>({});
  const [analyzingEventId, setAnalyzingEventId] = useState<string | null>(null);
  const { bookmarks } = useBookmarks();
  const { isSidebarCollapsed } = useLayout();

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
    const bookmarkMatch = !showBookmarksOnly || bookmarks.includes(s.marketId);
    return sentimentMatch && categoryMatch && bookmarkMatch;
  }) ?? [];

  const categories = ['ALL', ...Array.from(new Set(signalsData?.signals.map(s => s.category).filter((c): c is string => Boolean(c)) ?? []))];
    const TABS = [
    { id: 'scanner', label: 'SIGNAL_CARDS', icon: <LayoutGrid size={12} />, activeClass: 'bg-blue-600 text-white' },
    { id: 'leaderboard', label: 'LEADERBOARD', icon: <Trophy size={12} />, activeClass: 'bg-orange-500 text-white' },
    { id: 'intelligence', label: 'INTELLIGENCE', icon: <Brain size={12} />, activeClass: 'bg-purple-600 text-white' },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground transition-all duration-300 selection:bg-primary/20">
      <Sidebar />
      <main className={cn(
        "p-6 lg:p-12 transition-all duration-500 ease-in-out",
        isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
      )}>
        <div className="max-w-7xl mx-auto pt-16 lg:pt-0">
          {/* Top Info Bar */}
          <div className="flex flex-col md:flex-row items-start justify-between mb-12 gap-6">
            <div>
              <h1 className="text-3xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic mb-2">Terminal_v1.0</h1>
              <p className="text-slate-500 text-[10px] font-mono mt-1 tracking-widest uppercase opacity-70 font-bold">
                Live Macro Sentiment Analysis // Lagos, NG // LAST_SYNC: {lastUpdated || "—"}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              {/* Search Bar */}
              <form onSubmit={handleSearch} className="relative hidden sm:flex items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="SEARCH_MARKETS..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-secondary border border-border focus:border-primary/50 px-10 py-2.5 rounded-xl text-[11px] font-black text-foreground outline-none w-48 lg:w-72 transition-all shadow-sm"
                  />
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
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
                className="bg-secondary border border-border hover:border-primary/50 px-4 py-2.5 rounded-xl text-[10px] font-black text-muted-foreground hover:text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {loading ? "ANALYZING..." : "↻ REFRESH"}
              </button>

              {/* Currency Toggle */}
              <div className="flex bg-secondary border border-border rounded-xl p-1 shadow-sm">
                {(['USD', 'NGN'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCurrency(c)}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                      currency === c ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground/60 hover:text-foreground'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="hidden md:block bg-secondary border border-border px-4 py-2.5 rounded-xl text-[10px] font-black shadow-sm">
                <span className="text-muted-foreground/60 uppercase tracking-widest mr-2">Status:</span>
                <span className={`transition-colors duration-500 ${
                  systemStatus === "OPTIMAL" ? "text-green-500 animate-pulse" :
                  systemStatus === "INITIALIZING" || systemStatus === "ANALYZING" ? "text-primary animate-pulse" :
                  "text-destructive"
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
              <div className="flex items-center gap-1 mb-10 bg-secondary border border-border rounded-2xl p-1.5 w-fit shadow-sm">
                {TABS.map(({ id, label, icon, activeClass }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id as any)}
                    className={cn(
                      "flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-[10px] font-black transition-all",
                      activeTab === id ? activeClass : "text-muted-foreground/60 hover:text-foreground"
                    )}
                  >
                    {icon}
                    <span className="hidden sm:inline uppercase tracking-widest">{label}</span>
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
                        <div key={event.id} className="bg-card border border-border rounded-3xl p-6 group hover:border-primary/30 transition-all shadow-sm flex flex-col backdrop-blur-sm">
                          <div className="flex justify-between items-start mb-6">
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] bg-secondary px-2 py-0.5 rounded-lg border border-border opacity-60">RAW_EVENT</span>
                            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">{event.category}</span>
                          </div>
                          <h3 className="text-foreground font-black text-lg mb-6 line-clamp-2 tracking-tight">{event.title}</h3>
                          
                          <div className="flex-1 space-y-3 mb-8">
                            {event.markets.map((m: any) => (
                              <div key={m.id} className="flex justify-between items-center bg-secondary/50 p-4 rounded-2xl border border-border/50 group/row hover:bg-secondary transition-colors">
                                <span className="text-[11px] text-foreground/80 font-black uppercase tracking-tight">{m.title}</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-[11px] font-black text-primary font-mono">{(m.outcome1Price * 100).toFixed(0)}%</span>
                                  <a 
                                    href={`https://app.bayse.markets/market/${event.id}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-all"
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
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-[10px] font-black text-primary-foreground rounded-2xl transition-all shadow-lg shadow-primary/20 disabled:opacity-50 uppercase tracking-widest"
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
                          className={cn(
                            "text-[10px] font-black px-4 py-2 rounded-xl border transition-all shadow-sm",
                            sentimentFilter === s
                              ? s === 'BULLISH' ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400'
                                : s === 'BEARISH' ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                                  : s === 'RISK_ALERT' ? 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400'
                                    : s === 'NEUTRAL' ? 'bg-muted border-border text-muted-foreground'
                                      : 'bg-primary/10 border-primary/30 text-primary'
                              : 'bg-secondary border-border text-muted-foreground/60 hover:border-primary/20 hover:text-foreground'
                          )}
                        >
                          {s}
                        </button>
                      ))}
                      <div className="w-px bg-border mx-2" />
                      {categories.map((c) => (
                        <button
                          key={c}
                          onClick={() => setCategoryFilter(c)}
                          className={cn(
                            "text-[10px] font-black px-4 py-2 rounded-xl border transition-all shadow-sm",
                            categoryFilter === c
                              ? 'bg-foreground text-background border-foreground'
                              : 'bg-secondary border-border text-muted-foreground/60 hover:border-primary/20 hover:text-foreground'
                          )}
                        >
                          {c}
                        </button>
                      ))}

                      {/* Bookmark Toggle */}
                      <button
                        onClick={() => setShowBookmarksOnly(prev => !prev)}
                        className={`flex items-center gap-2 text-[9px] font-mono font-bold px-3 py-1.5 rounded-lg border transition-all ${
                          showBookmarksOnly
                            ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 shadow-[0_0_10px_rgba(37,99,235,0.2)]'
                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'
                        }`}
                      >
                        <Bookmark size={10} fill={showBookmarksOnly ? "currentColor" : "none"} />
                        BOOKMARKS ({bookmarks.length})
                      </button>
                    </div>

                    {/* Legend Bar */}
                    <div className="flex flex-wrap gap-4 mb-10 p-4 bg-secondary/40 border border-border rounded-2xl backdrop-blur-sm">
                      {[
                        { sentiment: "BULLISH", color: "text-green-600 dark:text-green-400", dot: "bg-green-500", action: "Buy YES — AI sees underpriced upside" },
                        { sentiment: "BEARISH", color: "text-red-600 dark:text-red-400", dot: "bg-red-500", action: "Buy NO — crowd overpricing the outcome" },
                        { sentiment: "RISK_ALERT", color: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500", action: "Stay out — high uncertainty, thin data" },
                        { sentiment: "NEUTRAL", color: "text-muted-foreground", dot: "bg-muted-foreground/30", action: "Monitor — no meaningful mispricing" },
                      ].map(({ sentiment, color, dot, action }) => (
                        <div key={sentiment} className="flex items-center gap-2.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${dot} shadow-sm`} />
                          <span className={`text-[10px] font-black uppercase tracking-tight ${color}`}>{sentiment}</span>
                          <span className="text-[10px] font-medium text-muted-foreground italic opacity-70">{action}</span>
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
                  <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-2 bg-orange-500/10 rounded-lg">
                        <Trophy size={16} className="text-orange-500" />
                      </div>
                      <h2 className="text-sm font-black text-foreground uppercase tracking-[0.2em]">
                        Divergence Leaderboard
                      </h2>
                      <span className="ml-auto text-[10px] font-black text-muted-foreground uppercase opacity-40">
                        Ranked by AI vs Market gap
                      </span>
                    </div>
                    <Leaderboard signals={signalsData?.signals ?? []} currency={currency} />
                  </div>
                )}
                {/* Intelligence Tab */}
                {activeTab === 'intelligence' && (
                  <>
                  <IntelligenceTab signalsData={signalsData} />
                  </>
                )}
              </div>

              {activeTab !== 'intelligence' && (
                <div className="hidden lg:block lg:col-span-4 sticky top-12 h-fit space-y-8">
                <div className="bg-card border border-border p-8 rounded-3xl shadow-sm backdrop-blur-sm">
                  <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-8 opacity-40">AI Synthesis</h2>
                  <OjaScore signals={signalsData?.signals ?? []} />
                  <ConfidenceGauge value={globalConfidence} />
                  <div className="mt-8 pt-8 border-t border-border/50 space-y-4">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-muted-foreground/60">ACTIVE_SIGNALS</span>
                      <span className="text-foreground">{signalsData?.active_signals ?? "—"}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span className="text-muted-foreground/60">DATA_POINTS</span>
                      <span className="text-foreground">{signalsData?.data_points.toLocaleString() ?? "—"}</span>
                    </div>
                  </div>
                </div>
                <SystemLog />
                <div className="space-y-6">
                  <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] ml-2 opacity-40">Recent Logic</h2>
                  {signalsData?.signals.map((s, i) => (
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