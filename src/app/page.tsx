"use client";
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import MarketCard from '@/features/bayse-trading/MarketCard';
import RawMarketCard from '@/features/bayse-trading/RawMarketCard';
import ConfidenceGauge from '@/components/charts/ConfidenceGauge';
import OjaScore from '@/components/charts/OjaScore';
import SystemLog from '@/components/layout/SystemLog';
import TerminalTips from '@/components/layout/TerminalTips';
import SignalCard from '@/features/macro-feed/SignalCard';
import { analyzeMarkets, bayse } from '@/lib/api-client';
import { MacroSignal } from '@/types/macro';
import {
  LayoutGrid,
  Trophy,
  Activity,
  RefreshCcw,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Minus,
  Brain,
  BrainCircuit,
  Search,
  X,
  Filter,
  Bookmark,
  Database,
  Zap
} from 'lucide-react';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useLayout } from '@/context/LayoutContext';
import { cn } from '@/lib/utils';
import CowrieIcon from '@/components/ui/CowrieIcon';

// --- CONFIG ---
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
    <div className="space-y-2 rounded-none">
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
            <div className="col-span-5 min-w-0"
              onClick={() => window.open(`https://app.bayse.markets/market/${s.eventId}`, '_blank')}>
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

const SENTIMENT_TABS = [
  { id: 'ALL', color: 'border-muted-foreground/40', text: 'text-muted-foreground', icon: Activity },
  { id: 'BULLISH', color: 'border-emerald-500', text: 'text-emerald-500', icon: TrendingUp },
  { id: 'BEARISH', color: 'border-rose-500', text: 'text-rose-500', icon: TrendingDown },
  { id: 'RISK_ALERT', color: 'border-orange-500', text: 'text-orange-500', icon: AlertTriangle },
  { id: 'NEUTRAL', color: 'border-primary', text: 'text-primary', icon: Minus },
];

const NAV_TABS = [
  { id: 'scanner', label: 'Signals', icon: <LayoutGrid size={12} />, color: 'primary' },
  { id: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={12} />, color: 'orange-500' },
  { id: 'intelligence', label: 'Intelligence', icon: <BrainCircuit size={12} />, color: 'purple-500' }
];

export default function Dashboard() {
  const [signalsData, setSignalsData] = useState<SignalsData | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'scanner' | 'leaderboard' | 'intelligence'>('scanner');
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [loading, setLoading] = useState(true);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const savedCurrency = localStorage.getItem('bayse_pref_currency');
    if (savedCurrency === 'USD' || savedCurrency === 'NGN') setCurrency(savedCurrency);

    const savedTab = localStorage.getItem('bayse_pref_tab');
    if (savedTab === 'scanner' || savedTab === 'leaderboard' || savedTab === 'intelligence') setActiveTab(savedTab);

    const savedSentiment = localStorage.getItem('bayse_pref_sentiment');
    if (savedSentiment) setSentimentFilter(savedSentiment);

    const savedCategory = localStorage.getItem('bayse_pref_category');
    if (savedCategory) setCategoryFilter(savedCategory);
  }, []);

  // Save preferences when they change
  useEffect(() => { localStorage.setItem('bayse_pref_currency', currency); }, [currency]);
  useEffect(() => { localStorage.setItem('bayse_pref_tab', activeTab); }, [activeTab]);
  useEffect(() => { localStorage.setItem('bayse_pref_sentiment', sentimentFilter); }, [sentimentFilter]);
  useEffect(() => { localStorage.setItem('bayse_pref_category', categoryFilter); }, [categoryFilter]);
  const [lastUpdated, setLastUpdated] = useState("");

  const { isSidebarCollapsed } = useLayout();
  const { toggleBookmark, isBookmarked } = useBookmarks();

  const [rawMarkets, setRawMarkets] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [analyzedSearchResults, setAnalyzedSearchResults] = useState<Record<string, MacroSignal>>({});
  const [analyzingEventId, setAnalyzingEventId] = useState<string | null>(null);

  const fetchSignals = useCallback(async (force = false, query = "") => {
    setLoading(true);
    try {
      const data = await analyzeMarkets(force, currency, query);
      setSignalsData(data);
      if (query) {
        setLastUpdated(`Search: "${query}" @ ${new Date().toLocaleTimeString()}`);
      } else {
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Inference stream interrupted", err);
    } finally {
      setLoading(false);
    }
    // We intentionally exclude 'currency' from dependencies here because 
    // switching display currency shouldn't trigger a full AI re-analysis.
    // The MarketCard handles currency-based symbol switching locally.
  }, []);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

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
    fetchSignals(); // Restore the original dashboard signals
  };

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

  // --- FILTER LOGIC ---
  const categories = useMemo(() => {
    const sets = new Set(signalsData?.signals?.map((s: any) => s.category).filter(Boolean));
    return ['ALL', ...Array.from(sets)] as string[];
  }, [signalsData]);

  const topSignals = useMemo(() => {
    return signalsData?.signals?.filter((s: any) => {
      const matchesSentiment = sentimentFilter === 'ALL' || s.sentiment === sentimentFilter;
      const matchesCategory = categoryFilter === 'ALL' || s.category === categoryFilter;
      return matchesSentiment && matchesCategory;
    }) ?? [];
  }, [signalsData, sentimentFilter, categoryFilter]);



  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <Sidebar />
      <main className={cn(
        "flex flex-col min-h-screen transition-all duration-300 pt-16 lg:pt-0",
        isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
      )}>
        <div className="flex-1 p-4 lg:p-6 max-w-[1800px] mx-auto w-full">

          {/* HEADER SECTION */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-border pb-4 gap-4">
            <div>
              <h1 className="text-4xl font-black text-foreground italic tracking-tighter relative group">
                TERMINAL_V1.0
              </h1>
              <p className="text-[9px] font-mono uppercase text-muted-foreground mt-2 tracking-[0.2em] font-bold">
                LIVE MACRO SENTIMENT ANALYSIS // LAGOS, NG // LAST_SYNC: {lastUpdated || "OFFLINE"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* SEARCH BAR */}
              <form onSubmit={handleSearch} className="relative group flex-1 md:w-64 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    placeholder="Search_Markets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-card border border-border py-2 pl-10 pr-4 text-[11px] font-mono focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40"
                  />
                  {searchQuery && (
                    <X
                      size={12}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-primary"
                      onClick={clearSearch}
                    />
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="bg-primary/10 hover:bg-primary/20 p-2 border border-primary/20 text-primary disabled:opacity-50 transition-colors"
                >
                  {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </button>
              </form>

              <div className="flex bg-card border border-border p-0.5">
                {(['USD', 'NGN'] as const).map((c) => (
                  <button key={c} onClick={() => setCurrency(c)} className={cn(
                    "px-3 py-1 text-[10px] font-bold uppercase transition-all",
                    currency === c ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                  )}>{c}</button>
                ))}
              </div>
              <button onClick={() => fetchSignals(true)} className="p-2 border border-border hover:bg-accent transition-colors">
                <RefreshCcw size={14} className={cn(loading && "animate-spin text-primary")} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">

            {/* LEFT COLUMN: PRIMARY WORKSPACE */}
            <div className="col-span-12 lg:col-span-8 space-y-4">

              {/* TABS & FILTERS */}
              <div className="bg-card border border-border rounded-sm overflow-hidden">
                <div className="flex items-center gap-1 p-1 border-b border-border bg-accent/20">
                  {NAV_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={cn(
                        "flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-[10px] font-bold uppercase transition-all border-b-2",
                        activeTab === tab.id
                          ? `bg-${tab.color}/10 border-${tab.color} text-${tab.color}`
                          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50",
                        tab.id === 'intelligence' && "lg:hidden"
                      )}
                    >
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === 'scanner' && (
                  <div className="p-3 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Filter size={10} className="text-muted-foreground mr-2" />
                      {SENTIMENT_TABS.map((tab) => (
                        <button key={tab.id} onClick={() => setSentimentFilter(tab.id)} className={cn(
                          "flex items-center gap-2 text-[9px] font-bold px-3 py-1.5 transition-all uppercase border rounded-none",
                          sentimentFilter === tab.id ? `${tab.color} ${tab.text} bg-accent border-current/40` : "border-border text-muted-foreground hover:text-foreground"
                        )}>
                          <tab.icon size={10} /> {tab.id}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                      {categories.map((cat) => (
                        <button key={cat} onClick={() => setCategoryFilter(cat)} className={cn(
                          "text-[8px] font-mono font-bold px-2 py-1 transition-all uppercase",
                          categoryFilter === cat ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                        )}>[ {cat} ]</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* CONTENT VIEWPORT */}
              <div className={activeTab === 'intelligence' ? 'lg:hidden' : ''}>
                {loading && !signalsData ? (
                  <div className="h-96 flex flex-col items-center justify-center border border-border bg-card">
                    <Loader2 className="animate-spin text-primary mb-4" size={32} />
                    <span className="text-[10px] font-mono text-muted-foreground animate-pulse tracking-[0.5em]">SYNCING_GLOBAL_LEDGER</span>
                  </div>
                ) : (
                  <>
                    {/* SEARCH RESULTS VIEW */}
                    {searchResults.length > 0 ? (
                      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-between">
                          <h2 className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            <Search size={14} /> Search Results for "{searchQuery}"
                          </h2>
                          <button onClick={clearSearch} className="text-[10px] font-mono text-primary hover:underline">CLEAR_RESULTS</button>
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
                      <div className="flex flex-col gap-8">
                        {/* 1. TOP INTELLIGENCE (The 5-6 High Conviction Signals) */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border border-primary/10">
                            <Zap size={12} className="text-primary" />
                            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Top_Intelligence_Signals</span>
                            <span className="ml-auto text-[8px] font-mono text-muted-foreground/40 uppercase">Vetted_Alpha_Nodes</span>
                          </div>

                          {topSignals.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {topSignals.map((s: any, i: number) => (
                                <MarketCard key={i} signal={s} currency={currency} />
                              ))}
                            </div>
                          ) : !loading && (
                            <div className="p-12 text-center border border-dashed border-border opacity-50">
                              <p className="text-[10px] font-mono uppercase tracking-[0.3em]">No_Analyzed_Signals_Found</p>
                            </div>
                          )}
                        </div>
                      </div>
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
                    {activeTab === 'intelligence' && (
                      <IntelligenceTab signalsData={signalsData} />
                    )}
                  </>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: PERSISTENT ANALYSIS (Desktop) */}
            <div className="hidden lg:flex lg:col-span-4 flex-col gap-6">
              <div className="border border-border bg-card p-5 rounded-none border-t-purple-500 border-t-2">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.3em] flex items-center gap-2">
                    <BrainCircuit size={14} /> Intelligence_Nexus
                  </h2>
                  <span className="text-[8px] font-mono text-muted-foreground">LIVE_FEED</span>
                </div>
                <ConfidenceGauge value={Math.round((signalsData?.global_confidence ?? 0) * 100)} />

                {/* Real-time Metrics */}
                <div className="grid grid-cols-2 gap-4 mt-6 py-4 border-y border-border bg-accent/20">
                  <div className="text-center">
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Active_Signals</p>
                    <p className="text-lg font-mono font-bold text-primary">{signalsData?.active_signals || 0}</p>
                  </div>
                  <div className="text-center border-l border-border">
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Data_Points</p>
                    <p className="text-lg font-mono font-bold text-blue-500">{signalsData?.data_points?.toLocaleString() || 0}</p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-border">
                  <OjaScore signals={signalsData?.signals ?? []} />
                </div>
              </div>

              <SystemLog />
              <TerminalTips />

              {/* RECENT LOGIC SECTION */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em]">RECENT_LOGIC</h2>
                  <span className="text-[8px] font-mono text-muted-foreground/60">NODE_HISTORY</span>
                </div>

                <div className="space-y-3">
                  {signalsData?.signals?.slice(0, 3).map((s: any, i: number) => (
                    <div key={i} className="bg-card border border-border p-4 relative group hover:border-primary/30 transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <span className={cn(
                          "text-[8px] font-bold uppercase tracking-widest",
                          s.sentiment === 'BULLISH' ? 'text-emerald-500' : 'text-orange-500'
                        )}>
                          {s.sentiment}_SIGNAL
                        </span>
                        <div className="flex items-center gap-3">
                          <button onClick={() => toggleBookmark(s.marketId)}>
                            <Bookmark size={10} fill={isBookmarked(s.marketId) ? "currentColor" : "none"} className={cn(isBookmarked(s.marketId) ? "text-primary" : "text-muted-foreground")} />
                          </button>
                          <span className="text-[8px] font-mono text-muted-foreground uppercase font-bold">CONF: {(s.source_reliability * 100).toFixed(0)}%</span>
                        </div>
                      </div>

                      <p className="text-[8px] font-bold text-muted-foreground uppercase mb-1 leading-tight line-clamp-1">{s.eventTitle}</p>
                      <h4 className="text-[11px] font-bold text-foreground mb-1 leading-tight group-hover:text-primary transition-colors line-clamp-2">{s.headline}</h4>
                      <p className="text-[9px] text-muted-foreground italic font-mono mb-3 line-clamp-1">{s.marketTitle}</p>

                      <p className="text-[9px] text-muted-foreground/80 leading-relaxed line-clamp-2 italic mb-4">
                        {s.recommendation || s.logic}
                      </p>

                      <div className="pt-3 border-t border-border flex items-center justify-between">
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                          <Activity size={8} /> INSIGHTS
                        </span>
                        <div className="w-16 h-1 bg-accent">
                          <div className={cn(
                            "h-full",
                            s.sentiment === 'BULLISH' ? 'bg-emerald-500' : 'bg-orange-500'
                          )} style={{ width: `${(s.probability * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}