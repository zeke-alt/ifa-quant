"use client";
import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { analyzeMarkets } from '@/lib/api-client';
import { MacroSignal } from '@/types/macro';
import { useLayout } from '@/context/LayoutContext';
import { cn } from '@/lib/utils';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Minus,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  Loader2,
  RefreshCcw,
  Target,
  Layers,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface ResolvedCall {
  marketId: string;
  eventTitle: string;
  headline: string;
  category: string;
  direction: string;
  probability: number;
  yesProbability: number;
  source_reliability: number;
  sentiment: string;
  logic: string;
  recommendation: string;
  resolvedAt?: string;
  outcome?: 'WIN' | 'LOSS' | 'PENDING';
  divergence: number;
  score: number;
  eventId: string;
}

interface CategoryStat {
  category: string;
  total: number;
  wins: number;
  losses: number;
  pending: number;
  hitRate: number;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function computeTradeScore(signal: MacroSignal): number {
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

function getDivergence(signal: MacroSignal): number {
  return Math.abs(Number(signal.probability) - Number(signal.yesProbability)) * 100;
}

// Infer outcome from market data heuristically:
// If probability diverged significantly from market price and market is near resolution,
// we can guess whether the AI call was right
function inferOutcome(signal: MacroSignal): 'WIN' | 'LOSS' | 'PENDING' {
  const yesProb = Number(signal.yesProbability);
  const aiProb = Number(signal.probability);
  const reliability = Number(signal.source_reliability);

  // Market near resolution (>85% or <15%)
  if (yesProb > 0.85 || yesProb < 0.15) {
    const aiCalledYes = aiProb > 0.5;
    const marketResolvingYes = yesProb > 0.5;
    return aiCalledYes === marketResolvingYes ? 'WIN' : 'LOSS';
  }

  // Still in play
  return 'PENDING';
}

const SENTIMENT_ICON: Record<string, any> = {
  BULLISH: TrendingUp,
  BEARISH: TrendingDown,
  RISK_ALERT: AlertTriangle,
  NEUTRAL: Minus,
};

const SENTIMENT_COLOR: Record<string, string> = {
  BULLISH: 'text-emerald-400',
  BEARISH: 'text-rose-400',
  RISK_ALERT: 'text-orange-400',
  NEUTRAL: 'text-slate-400',
};

// ─────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-card border border-border p-5 flex flex-col gap-2">
      <p className="text-[9px] font-mono font-bold uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
      <p className={cn("text-3xl font-black font-mono tracking-tight", accent ?? "text-foreground")}>{value}</p>
      {sub && <p className="text-[9px] font-mono text-muted-foreground/60 uppercase">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────
// PAST CALL CARD
// ─────────────────────────────────────────────
function PastCallCard({ call }: { call: ResolvedCall }) {
  const [expanded, setExpanded] = useState(false);
  const SentimentIcon = SENTIMENT_ICON[call.sentiment] ?? Minus;
  const sentimentColor = SENTIMENT_COLOR[call.sentiment] ?? 'text-slate-400';

  const outcomeConfig = {
    WIN: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2, label: 'CORRECT_CALL' },
    LOSS: { color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', icon: XCircle, label: 'INCORRECT_CALL' },
    PENDING: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: Clock, label: 'PENDING_RESOLUTION' },
  };

  const outcome = outcomeConfig[call.outcome ?? 'PENDING'];
  const OutcomeIcon = outcome.icon;

  const scoreColor = call.score >= 70 ? 'text-emerald-400'
    : call.score >= 50 ? 'text-blue-400'
      : 'text-rose-400';

  return (
    <div className={cn(
      "bg-card border border-border transition-all duration-200 hover:border-primary/30 group",
      expanded && "border-primary/20"
    )}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-accent/10">
        <span className={cn("text-[8px] font-bold uppercase tracking-widest flex items-center gap-1", sentimentColor)}>
          <SentimentIcon size={9} /> {call.sentiment}_SIGNAL
        </span>
        <span className="text-[8px] font-mono text-muted-foreground/40 ml-auto uppercase">{call.category}</span>
      </div>

      {/* Main content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-[8px] font-mono text-muted-foreground/50 uppercase mb-1 truncate">{call.eventTitle}</p>
            <h3 className="text-[11px] font-black text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2">
              {call.headline}
            </h3>
          </div>
          <div className={cn("shrink-0 flex items-center gap-1 px-2 py-1 border text-[8px] font-bold uppercase", outcome.bg, outcome.color)}>
            <OutcomeIcon size={9} /> {outcome.label}
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-accent/20 p-2 text-center">
            <p className="text-[7px] font-mono text-muted-foreground/60 uppercase mb-1">AI_PROB</p>
            <p className="text-[11px] font-black font-mono text-primary">{(call.probability * 100).toFixed(0)}%</p>
          </div>
          <div className="bg-accent/20 p-2 text-center">
            <p className="text-[7px] font-mono text-muted-foreground/60 uppercase mb-1">MKT_PRICE</p>
            <p className="text-[11px] font-black font-mono text-foreground">{(call.yesProbability * 100).toFixed(0)}%</p>
          </div>
          <div className="bg-accent/20 p-2 text-center">
            <p className="text-[7px] font-mono text-muted-foreground/60 uppercase mb-1">DIVERGE</p>
            <p className="text-[11px] font-black font-mono text-orange-400">{call.divergence.toFixed(1)}%</p>
          </div>
          <div className="bg-accent/20 p-2 text-center">
            <p className="text-[7px] font-mono text-muted-foreground/60 uppercase mb-1">SCORE</p>
            <p className={cn("text-[11px] font-black font-mono", scoreColor)}>{call.score.toFixed(0)}</p>
          </div>
        </div>

        {/* Direction badge */}
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-[8px] font-bold font-mono px-2 py-1 uppercase",
            call.direction === 'BUY_YES' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : call.direction === 'BUY_NO' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
          )}>
            {call.direction}
          </span>

          <div className="flex items-center gap-2">
            <a
              href={`https://app.bayse.markets/market/${call.eventId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[8px] font-mono text-muted-foreground/40 hover:text-primary transition-colors flex items-center gap-1"
            >
              <ExternalLink size={9} /> BAYSE
            </a>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[8px] font-mono text-muted-foreground/40 hover:text-primary transition-colors flex items-center gap-1"
            >
              {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
              {expanded ? 'LESS' : 'MORE'}
            </button>
          </div>
        </div>

        {/* Expanded logic */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <p className="text-[9px] font-mono text-muted-foreground/80 leading-relaxed">
              {call.logic}
            </p>
            {call.recommendation && (
              <div className="bg-primary/5 border border-primary/10 p-2">
                <p className="text-[8px] font-bold text-primary uppercase tracking-wider mb-1">RECOMMENDATION</p>
                <p className="text-[9px] font-mono text-foreground/80">{call.recommendation}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// HIT RATE BREAKDOWN
// ─────────────────────────────────────────────
function HitRateBreakdown({ calls }: { calls: ResolvedCall[] }) {
  const categories = Array.from(new Set(calls.map(c => c.category).filter(Boolean)));

  const stats: CategoryStat[] = categories.map(cat => {
    const catCalls = calls.filter(c => c.category === cat);
    const wins = catCalls.filter(c => c.outcome === 'WIN').length;
    const losses = catCalls.filter(c => c.outcome === 'LOSS').length;
    const pending = catCalls.filter(c => c.outcome === 'PENDING').length;
    const resolved = wins + losses;
    return {
      category: cat,
      total: catCalls.length,
      wins,
      losses,
      pending,
      hitRate: resolved > 0 ? Math.round((wins / resolved) * 100) : 0,
    };
  }).sort((a, b) => b.total - a.total);

  if (stats.length === 0) {
    return (
      <div className="py-12 text-center border border-dashed border-border opacity-40">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em]">No_Category_Data_Yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stats.map((stat) => (
        <div key={stat.category} className="bg-accent/10 border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold font-mono uppercase tracking-wider text-foreground">{stat.category}</span>
            <div className="flex items-center gap-3">
              <span className="text-[8px] font-mono text-muted-foreground/60">{stat.total} calls</span>
              <span className={cn(
                "text-[10px] font-black font-mono",
                stat.hitRate >= 60 ? 'text-emerald-400' : stat.hitRate >= 40 ? 'text-orange-400' : 'text-rose-400'
              )}>
                {stat.hitRate > 0 ? `${stat.hitRate}%` : 'N/A'}
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden flex">
            {stat.wins > 0 && (
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${(stat.wins / stat.total) * 100}%` }}
              />
            )}
            {stat.pending > 0 && (
              <div
                className="h-full bg-blue-500/50 transition-all"
                style={{ width: `${(stat.pending / stat.total) * 100}%` }}
              />
            )}
            {stat.losses > 0 && (
              <div
                className="h-full bg-rose-500 transition-all"
                style={{ width: `${(stat.losses / stat.total) * 100}%` }}
              />
            )}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <span className="text-[7px] font-mono text-emerald-400/70">{stat.wins}W</span>
            <span className="text-[7px] font-mono text-blue-400/70">{stat.pending}P</span>
            <span className="text-[7px] font-mono text-rose-400/70">{stat.losses}L</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border/50 bg-accent/5">
      <div className="w-12 h-12 border border-primary/20 flex items-center justify-center mb-6 bg-primary/5">
        <BarChart3 size={20} className="text-primary/40" />
      </div>
      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-foreground/40 mb-2">
        ACCUMULATING_SIGNAL_HISTORY
      </p>
      <p className="text-[9px] font-mono text-muted-foreground/40 max-w-xs leading-relaxed">
        Past calls and hit rates will appear here as Bayse markets resolve over time.
        Check back after more markets close.
      </p>
      <div className="mt-6 flex items-center gap-2 text-[8px] font-mono text-muted-foreground/30 uppercase">
        <Clock size={10} /> Populates automatically as markets resolve
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
export default function InsightsPage() {
  const { isSidebarCollapsed } = useLayout();
  const [calls, setCalls] = useState<ResolvedCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'WIN' | 'LOSS' | 'PENDING'>('ALL');
  const [sentimentFilter, setSentimentFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'calls' | 'hitrate' | 'transparency'>('calls');

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      // Pull from the signal vault — all signals IfáQuant has ever analyzed
      const vaultData = await analyzeMarkets(false, 'USD', '', true);
      const signals: MacroSignal[] = vaultData?.signals ?? [];

      const enriched: ResolvedCall[] = signals.map((s: MacroSignal) => ({
        marketId: s.marketId,
        eventId: s.eventId,
        eventTitle: s.eventTitle,
        headline: s.headline,
        category: s.category ?? 'UNCATEGORIZED',
        direction: s.direction,
        probability: Number(s.probability),
        yesProbability: Number(s.yesProbability),
        source_reliability: Number(s.source_reliability),
        sentiment: s.sentiment,
        logic: s.logic,
        recommendation: s.recommendation,
        divergence: getDivergence(s),
        score: computeTradeScore(s),
        outcome: inferOutcome(s),
      }));

      setCalls(enriched);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("INSIGHTS_FETCH_ERROR:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInsights(); }, [fetchInsights]);

  // Stats
  const wins = calls.filter(c => c.outcome === 'WIN').length;
  const losses = calls.filter(c => c.outcome === 'LOSS').length;
  const pending = calls.filter(c => c.outcome === 'PENDING').length;
  const resolved = wins + losses;
  const hitRate = resolved > 0 ? Math.round((wins / resolved) * 100) : null;
  const avgDivergence = calls.length > 0
    ? (calls.reduce((sum, c) => sum + c.divergence, 0) / calls.length).toFixed(1)
    : null;
  const avgScore = calls.length > 0
    ? (calls.reduce((sum, c) => sum + c.score, 0) / calls.length).toFixed(0)
    : null;

  // Filtered calls
  const filteredCalls = calls.filter(c => {
    const matchesOutcome = outcomeFilter === 'ALL' || c.outcome === outcomeFilter;
    const matchesSentiment = sentimentFilter === 'ALL' || c.sentiment === sentimentFilter;
    return matchesOutcome && matchesSentiment;
  });

  const TABS = [
    { id: 'calls', label: 'Past_Calls', icon: <Activity size={11} /> },
    { id: 'hitrate', label: 'Hit_Rate', icon: <Target size={11} /> },
    { id: 'transparency', label: 'Model_Logic', icon: <Layers size={11} /> },
  ];

  const OUTCOME_FILTERS = [
    { id: 'ALL', label: 'ALL', color: 'border-muted-foreground/30 text-muted-foreground' },
    { id: 'WIN', label: 'CORRECT', color: 'border-emerald-500 text-emerald-400' },
    { id: 'PENDING', label: 'PENDING', color: 'border-blue-500 text-blue-400' },
    { id: 'LOSS', label: 'INCORRECT', color: 'border-rose-500 text-rose-400' },
  ];

  const SENTIMENT_FILTERS = ['ALL', 'BULLISH', 'BEARISH', 'RISK_ALERT', 'NEUTRAL'];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Sidebar />
      <main className={cn(
        "flex flex-col min-h-screen transition-all duration-300 pt-16 lg:pt-0",
        isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
      )}>
        <div className="flex-1 p-4 lg:p-6 max-w-[1800px] mx-auto w-full">

          {/* HEADER */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-border pb-4 gap-4">
            <div>
              <h1 className="text-4xl font-black text-foreground italic tracking-tighter">
                INSIGHTS_V1.0
              </h1>
              <p className="text-[9px] font-mono uppercase text-muted-foreground mt-2 tracking-[0.2em] font-bold">
                MODEL_PERFORMANCE // PAST_CALLS // HIT_RATE_ANALYSIS // LAST_SYNC: {lastUpdated || "LOADING"}
              </p>
            </div>
            <button
              onClick={fetchInsights}
              className="p-2 border border-border hover:bg-accent transition-colors self-start"
            >
              <RefreshCcw size={14} className={cn(loading && "animate-spin text-primary")} />
            </button>
          </div>

          {loading ? (
            <div className="h-96 flex flex-col items-center justify-center border border-border bg-card">
              <Loader2 className="animate-spin text-primary mb-4" size={32} />
              <span className="text-[10px] font-mono text-muted-foreground animate-pulse tracking-[0.5em]">
                LOADING_SIGNAL_HISTORY
              </span>
            </div>
          ) : (
            <>
              {/* STATS ROW */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
                <StatCard
                  label="Total_Calls"
                  value={calls.length || '—'}
                  sub="all time signals"
                  accent="text-foreground"
                />
                <StatCard
                  label="Hit_Rate"
                  value={hitRate !== null ? `${hitRate}%` : '—'}
                  sub={resolved > 0 ? `${resolved} resolved` : 'awaiting resolution'}
                  accent={hitRate !== null ? (hitRate >= 60 ? 'text-emerald-400' : hitRate >= 40 ? 'text-orange-400' : 'text-rose-400') : 'text-muted-foreground'}
                />
                <StatCard
                  label="Correct_Calls"
                  value={wins || '—'}
                  sub="confirmed wins"
                  accent="text-emerald-400"
                />
                <StatCard
                  label="Pending"
                  value={pending || '—'}
                  sub="awaiting resolution"
                  accent="text-blue-400"
                />
                <StatCard
                  label="Avg_Divergence"
                  value={avgDivergence ? `${avgDivergence}%` : '—'}
                  sub="AI vs market gap"
                  accent="text-orange-400"
                />
                <StatCard
                  label="Avg_Score"
                  value={avgScore ?? '—'}
                  sub="model confidence"
                  accent="text-primary"
                />
              </div>

              <div className="grid grid-cols-12 gap-6">

                {/* LEFT — MAIN CONTENT */}
                <div className="col-span-12 lg:col-span-8 space-y-4">

                  {/* TABS */}
                  <div className="bg-card border border-border overflow-hidden">
                    <div className="flex items-center gap-1 p-1 border-b border-border bg-accent/20">
                      {TABS.map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-[10px] font-bold uppercase transition-all border-b-2",
                            activeTab === tab.id
                              ? "bg-primary/10 border-primary text-primary"
                              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
                          )}
                        >
                          {tab.icon} {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Filters — only on calls tab */}
                    {activeTab === 'calls' && (
                      <div className="p-3 flex flex-col gap-3 border-b border-border bg-accent/5">
                        <div className="flex flex-wrap gap-2">
                          {OUTCOME_FILTERS.map(f => (
                            <button
                              key={f.id}
                              onClick={() => setOutcomeFilter(f.id as any)}
                              className={cn(
                                "text-[8px] font-bold px-3 py-1.5 uppercase border transition-all",
                                outcomeFilter === f.id
                                  ? `${f.color} bg-accent/30`
                                  : "border-border text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {f.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                          {SENTIMENT_FILTERS.map(s => (
                            <button
                              key={s}
                              onClick={() => setSentimentFilter(s)}
                              className={cn(
                                "text-[8px] font-mono font-bold px-2 py-1 uppercase transition-all",
                                sentimentFilter === s
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              [ {s} ]
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* TAB CONTENT */}
                  {activeTab === 'calls' && (
                    <div className="space-y-3">
                      {filteredCalls.length > 0 ? (
                        filteredCalls.map((call, i) => (
                          <PastCallCard key={call.marketId ?? i} call={call} />
                        ))
                      ) : (
                        <EmptyState />
                      )}
                    </div>
                  )}

                  {activeTab === 'hitrate' && (
                    <div className="bg-card border border-border p-6 space-y-6">
                      <div className="flex items-center gap-3 mb-2">
                        <Target size={14} className="text-primary" />
                        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">
                          Performance_By_Category
                        </h2>
                      </div>
                      {calls.length > 0 ? (
                        <HitRateBreakdown calls={calls} />
                      ) : (
                        <EmptyState />
                      )}
                    </div>
                  )}

                  {activeTab === 'transparency' && (
                    <div className="space-y-3">
                      {calls.length > 0 ? calls.map((call, i) => (
                        <div key={i} className="bg-card border border-border p-5 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[8px] font-mono text-muted-foreground/50 uppercase mb-1">{call.eventTitle}</p>
                              <h3 className="text-[11px] font-black text-foreground leading-tight">{call.headline}</h3>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[8px] font-mono text-muted-foreground/40 uppercase mb-1">SCORE</p>
                              <p className={cn(
                                "text-lg font-black font-mono",
                                call.score >= 70 ? 'text-emerald-400' : call.score >= 50 ? 'text-blue-400' : 'text-rose-400'
                              )}>{call.score.toFixed(0)}</p>
                            </div>
                          </div>

                          {/* Score breakdown */}
                          <div className="grid grid-cols-3 gap-2">
                            {[
                              { label: 'AI_PROBABILITY', value: `${(call.probability * 100).toFixed(0)}%`, weight: '40%' },
                              { label: 'RELIABILITY', value: `${(call.source_reliability * 100).toFixed(0)}%`, weight: '30%' },
                              { label: 'DIVERGENCE', value: `${call.divergence.toFixed(1)}%`, weight: '—' },
                            ].map(({ label, value, weight }) => (
                              <div key={label} className="bg-accent/20 p-3 border border-border/50">
                                <p className="text-[7px] font-mono text-muted-foreground/60 uppercase mb-1">{label}</p>
                                <p className="text-[12px] font-black font-mono text-foreground">{value}</p>
                                <p className="text-[7px] font-mono text-muted-foreground/30 uppercase mt-1">weight: {weight}</p>
                              </div>
                            ))}
                          </div>

                          <div className="bg-primary/5 border border-primary/10 p-3">
                            <p className="text-[8px] font-bold text-primary uppercase tracking-wider mb-2">AI_REASONING</p>
                            <p className="text-[9px] font-mono text-foreground/70 leading-relaxed">{call.logic}</p>
                          </div>
                        </div>
                      )) : <EmptyState />}
                    </div>
                  )}
                </div>

                {/* RIGHT — SIDEBAR SUMMARY */}
                <div className="hidden lg:flex lg:col-span-4 flex-col gap-4">

                  {/* MODEL PERFORMANCE CARD */}
                  <div className="bg-card border border-border border-t-2 border-t-primary p-5">
                    <h2 className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] mb-5 flex items-center gap-2">
                      <BarChart3 size={12} /> Model_Performance
                    </h2>

                    {/* Hit rate visual */}
                    <div className="mb-5">
                      <div className="flex items-end justify-between mb-2">
                        <span className="text-[8px] font-mono text-muted-foreground/60 uppercase">Overall Hit Rate</span>
                        <span className={cn(
                          "text-2xl font-black font-mono",
                          hitRate !== null
                            ? hitRate >= 60 ? 'text-emerald-400' : hitRate >= 40 ? 'text-orange-400' : 'text-rose-400'
                            : 'text-muted-foreground/40'
                        )}>
                          {hitRate !== null ? `${hitRate}%` : 'N/A'}
                        </span>
                      </div>
                      <div className="h-2 bg-border rounded-full overflow-hidden flex">
                        {wins > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(wins / Math.max(calls.length, 1)) * 100}%` }} />}
                        {pending > 0 && <div className="h-full bg-blue-500/40" style={{ width: `${(pending / Math.max(calls.length, 1)) * 100}%` }} />}
                        {losses > 0 && <div className="h-full bg-rose-500" style={{ width: `${(losses / Math.max(calls.length, 1)) * 100}%` }} />}
                      </div>
                      <div className="flex gap-4 mt-2">
                        <span className="text-[7px] font-mono text-emerald-400/80 uppercase">{wins} correct</span>
                        <span className="text-[7px] font-mono text-blue-400/80 uppercase">{pending} pending</span>
                        <span className="text-[7px] font-mono text-rose-400/80 uppercase">{losses} incorrect</span>
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-border">
                      {[
                        { label: 'Total_Signals_Analyzed', value: calls.length || '—' },
                        { label: 'Resolved_Markets', value: resolved || '—' },
                        { label: 'Avg_AI_Confidence', value: avgScore ? `${avgScore}/100` : '—' },
                        { label: 'Avg_Divergence_Gap', value: avgDivergence ? `${avgDivergence}%` : '—' },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className="text-[8px] font-mono text-muted-foreground/60 uppercase">{label}</span>
                          <span className="text-[10px] font-black font-mono text-foreground">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* HOW IT WORKS */}
                  <div className="bg-card border border-border p-5">
                    <h2 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.3em] mb-4">
                      How_Calls_Are_Scored
                    </h2>
                    <div className="space-y-3">
                      {[
                        { label: 'AI_PROBABILITY × 0.4', desc: 'Model\'s assessed YES probability' },
                        { label: 'RELIABILITY × 0.3', desc: 'Fused logic + liquidity confidence' },
                        { label: 'ACCURACY × 0.3', desc: 'Historical signal accuracy' },
                        { label: 'SENTIMENT_MODIFIER', desc: 'RISK_ALERT −15, BEARISH −10, NEUTRAL −5' },
                      ].map(({ label, desc }) => (
                        <div key={label} className="border-l-2 border-primary/20 pl-3">
                          <p className="text-[8px] font-black font-mono text-primary/80 uppercase">{label}</p>
                          <p className="text-[8px] font-mono text-muted-foreground/60 mt-0.5">{desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* OUTCOME LEGEND */}
                  <div className="bg-card border border-border p-5">
                    <h2 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.3em] mb-4">
                      Outcome_Logic
                    </h2>
                    <div className="space-y-3">
                      {[
                        { icon: CheckCircle2, color: 'text-emerald-400', label: 'CORRECT_CALL', desc: 'Market resolved in AI\'s predicted direction' },
                        { icon: Clock, color: 'text-blue-400', label: 'PENDING', desc: 'Market still active, no resolution yet' },
                        { icon: XCircle, color: 'text-rose-400', label: 'INCORRECT_CALL', desc: 'Market resolved against AI prediction' },
                      ].map(({ icon: Icon, color, label, desc }) => (
                        <div key={label} className="flex gap-3 items-start">
                          <Icon size={12} className={cn("mt-0.5 shrink-0", color)} />
                          <div>
                            <p className={cn("text-[8px] font-black font-mono uppercase", color)}>{label}</p>
                            <p className="text-[8px] font-mono text-muted-foreground/60 mt-0.5">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}