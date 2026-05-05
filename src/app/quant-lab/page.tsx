"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useLayout } from "@/context/LayoutContext";
import { cn } from "@/lib/utils";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  FlaskConical,
  TrendingUp,
  TrendingDown,
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Minus,
  Loader2,
  Bookmark,
  Brain,
  Zap,
  Info,
  Activity
} from "lucide-react";

interface Market {
  id: string;
  question: string;
  probability: number;
}

interface PricePoint {
  t: string;
  p: number;
}

interface BacktestTrade {
  date: string;
  entry: number;
  exit: number;
  pnl: number;
  type: "BUY" | "SELL";
}

interface BacktestResult {
  trades: BacktestTrade[];
  equity: { date: string; value: number }[];
  winRate: number;
  totalReturn: number;
  avgReturn: number;
  maxDrawdown: number;
  totalTrades: number;
}

interface Strategy {
  direction: "BUY" | "SELL";
  entryThreshold: number;
  exitThreshold: number;
  holdDays: number;
}

function calculateStats(trades: BacktestTrade[], equity: { date: string; value: number }[]) {
  const winners = trades.filter((t) => t.pnl > 0);
  const winRate = trades.length ? (winners.length / trades.length) * 100 : 0;
  const equityValue = equity.length ? equity[equity.length - 1].value : 100;
  const totalReturn = equityValue - 100;
  const avgReturn = trades.length
    ? trades.reduce((s, t) => s + t.pnl, 0) / trades.length
    : 0;

  let peak = 100;
  let maxDrawdown = 0;
  for (const { value } of equity) {
    if (value > peak) peak = value;
    const dd = peak - value;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Quant metrics
  const returns = trades.map(t => t.pnl);
  const stdDev = returns.length > 1 ? Math.sqrt(returns.map(x => Math.pow(x - (avgReturn || 0), 2)).reduce((a, b) => a + b) / returns.length) : 0;
  const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized proxy

  return {
    trades,
    equity,
    winRate: parseFloat(winRate.toFixed(1)),
    totalReturn: parseFloat(totalReturn.toFixed(2)),
    avgReturn: parseFloat(avgReturn.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    totalTrades: trades.length,
    sharpe: parseFloat(sharpe.toFixed(2)),
  };
}

function generateMonteCarlo(history: PricePoint[], paths = 5, days = 14) {
  if (history.length < 2) return [];
  
  // Calculate daily volatility
  const returns = [];
  for (let i = 1; i < history.length; i++) {
    const prev = history[i-1].p || 0.01;
    returns.push((history[i].p - prev) / prev);
  }
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const vol = Math.sqrt(returns.map(x => Math.pow(x - avgReturn, 2)).reduce((a, b) => a + b) / returns.length);

  const lastPoint = history[history.length - 1];
  const lastPrice = lastPoint.p;
  const lastDate = new Date(lastPoint.t);
  
  const allPaths = [];
  for (let p = 0; p < paths; p++) {
    const path = [];
    let currentPrice = lastPrice;
    for (let d = 1; d <= days; d++) {
      const shock = (Math.random() * 2 - 1) * (vol || 0.02);
      currentPrice = Math.max(0.01, Math.min(0.99, currentPrice * (1 + shock)));
      const date = new Date(lastDate);
      date.setDate(date.getDate() + d);
      path.push({ 
        t: date.toISOString(), 
        p: parseFloat(currentPrice.toFixed(4)),
      });
    }
    allPaths.push(path);
  }
  return allPaths;
}

function runBacktest(
  priceHistory: PricePoint[],
  strategy: Strategy
): BacktestResult & { sharpe: number } {
  const trades: BacktestTrade[] = [];
  const equity: { date: string; value: number }[] = [];

  let inTrade = false;
  let entryPrice = 0;
  let entryDate = "";
  let entryIdx = 0;
  let equityValue = 100;

  for (let i = 0; i < priceHistory.length; i++) {
    const { t, p } = priceHistory[i];
    const dateLabel = new Date(t).toLocaleDateString("en-NG", {
      month: "short",
      day: "numeric",
    });

    if (!inTrade) {
      const shouldEnter =
        strategy.direction === "BUY"
          ? p < strategy.entryThreshold
          : p > strategy.entryThreshold;

      if (shouldEnter) {
        inTrade = true;
        entryPrice = p;
        entryDate = dateLabel;
        entryIdx = i;
      }
    } else {
      const dayHeld = i - entryIdx;
      const shouldExit =
        dayHeld >= strategy.holdDays ||
        (strategy.direction === "BUY"
          ? p > strategy.exitThreshold
          : p < strategy.exitThreshold);

      if (shouldExit) {
        const pnl =
          strategy.direction === "BUY"
            ? (p - entryPrice) * 100
            : (entryPrice - p) * 100;

        trades.push({
          date: entryDate,
          entry: entryPrice,
          exit: p,
          pnl: parseFloat(pnl.toFixed(2)),
          type: strategy.direction,
        });

        equityValue += pnl;
        inTrade = false;
      }
    }

    equity.push({ date: dateLabel, value: parseFloat(equityValue.toFixed(2)) });
  }

  return calculateStats(trades, equity);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    const val = payload[0].value as number;
    const isUp = val >= 100;
    return (
      <div className="bg-card border border-border p-2 text-[9px] font-mono shadow-2xl">
        <p className="text-muted-foreground mb-1 uppercase font-bold">{label}</p>
        <p className={cn("font-bold text-[11px]", isUp ? "text-emerald-500" : "text-rose-500")}>
          VAL: {val.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

function StatCard({
  label,
  value,
  unit = "",
  color = "text-white",
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border p-4 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />
      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
        {label}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <span className={cn("text-xl font-mono font-bold tracking-tighter", color)}>
            {value}
          </span>
          {unit && (
            <span className="text-[9px] font-bold text-muted-foreground/40 ml-1">
              {unit}
            </span>
          )}
        </div>
        {icon}
      </div>
    </div>
  );
}

export default function QuantLabPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<string>("");
  const [strategy, setStrategy] = useState<Strategy>({
    direction: "BUY",
    entryThreshold: 0.3,
    exitThreshold: 0.7,
    holdDays: 14,
  });
  const [result, setResult] = useState<(BacktestResult & { sharpe: number }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingMarkets, setFetchingMarkets] = useState(true);
  const [error, setError] = useState("");
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [parsingAi, setParsingAi] = useState(false);
  const [aiReasoning, setAiReasoning] = useState("");
  const [mcPaths, setMcPaths] = useState<any[][]>([]);
  const [showMC, setShowMC] = useState(false);
  const { bookmarks } = useBookmarks();
  const { isSidebarCollapsed } = useLayout();

  // Load from local storage
  useEffect(() => {
    const savedStrategy = localStorage.getItem('bayse_quant_strategy');
    if (savedStrategy) {
      try {
        setStrategy(JSON.parse(savedStrategy));
      } catch (e) {
        console.error("Failed to parse saved strategy");
      }
    }
    const savedBookmarksOnly = localStorage.getItem('bayse_quant_bookmarked_only');
    if (savedBookmarksOnly) {
      setShowBookmarkedOnly(savedBookmarksOnly === 'true');
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('bayse_quant_strategy', JSON.stringify(strategy));
  }, [strategy]);

  useEffect(() => {
    localStorage.setItem('bayse_quant_bookmarked_only', String(showBookmarkedOnly));
  }, [showBookmarkedOnly]);

  const handleAiParse = async (mode: 'parse' | 'optimize' = 'parse') => {
    if (mode === 'parse' && !aiPrompt) return;
    if (mode === 'optimize' && !selectedMarket) return;

    setParsingAi(true);
    setError("");
    setAiReasoning("");

    try {
      let history = [];
      if (mode === 'optimize') {
        const histRes = await fetch(`/api/price-history/${selectedMarket}?timePeriod=1M&outcome=YES`);
        if (!histRes.ok) throw new Error("Could not fetch price history.");
        const histData = await histRes.json();
        history = histData.history || [];
        if (history.length < 5) throw new Error("Not enough history to optimize.");
      }

      const res = await fetch("/api/quant/parse-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: mode === 'optimize' ? "Optimize based on history" : aiPrompt,
          mode,
          history
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setStrategy({
        direction: (data.direction === "BUY" || data.direction === "SELL") ? data.direction : strategy.direction,
        entryThreshold: typeof data.entryThreshold === 'number' ? data.entryThreshold : strategy.entryThreshold,
        exitThreshold: typeof data.exitThreshold === 'number' ? data.exitThreshold : strategy.exitThreshold,
        holdDays: typeof data.holdDays === 'number' ? data.holdDays : strategy.holdDays,
      });
      setAiReasoning(data.reasoning || "AI optimization complete.");
      setAiPrompt("");
    } catch (err: any) {
      console.error("AI_PARSE_ERROR:", err);
      setError(err.message || "AI failed to process. Try again.");
    } finally {
      setParsingAi(false);
    }
  };

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        // Fetch from Vault to ensure all analyzed/searched events are included
        const res = await fetch("/api/analyze?vault=true");
        const data = await res.json();
        const vaultSignals = data.signals || [];
        
        const marketMap = new Map();
        vaultSignals.forEach((s: any) => {
          if (marketMap.has(s.eventId)) {
            marketMap.get(s.eventId).marketIds.push(s.marketId);
          } else {
            marketMap.set(s.eventId, {
              id: s.eventId,
              marketIds: [s.marketId],
              question: s.eventTitle || s.market_question || `Event ${s.eventId}`,
              probability: s.probability
            });
          }
        });
        const uniqueMarkets = Array.from(marketMap.values()) as Market[];
        
        setMarkets(uniqueMarkets);
        if (uniqueMarkets.length) setSelectedMarket(uniqueMarkets[0].id);
      } catch {
        setError("Could not load markets. Check your API connection.");
      } finally {
        setFetchingMarkets(false);
      }
    };
    fetchMarkets();
  }, []);

  const handleRun = useCallback(async () => {
    if (!selectedMarket) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`/api/price-history/${selectedMarket}?timePeriod=1M&outcome=YES`);
      const data = await res.json();
      const history: PricePoint[] = data.history || [];

      if (history.length < 2) {
        setError("This market has no recorded price history yet.");
        setLoading(false);
        return;
      }

      const backtestResult = runBacktest(history, strategy);
      setResult(backtestResult);
      
      // Generate Monte Carlo paths
      const paths = generateMonteCarlo(history, 8, 14);
      setMcPaths(paths);
      setShowMC(true);
    } catch {
      setError("Failed to fetch market history.");
    } finally {
      setLoading(false);
    }
  }, [selectedMarket, strategy]);

  const handleReset = () => {
    setResult(null);
    setError("");
    setMcPaths([]);
    setShowMC(false);
    setStrategy({ direction: "BUY", entryThreshold: 0.3, exitThreshold: 0.7, holdDays: 14 });
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-all duration-300 selection:bg-primary/20 font-mono">
      <Sidebar />

      <main className={cn(
        "flex flex-col min-h-screen transition-all duration-300 pt-16 lg:pt-0",
        isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
      )}>
        <div className="flex-1 p-4 lg:p-6 max-w-[1800px] mx-auto w-full">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b border-border pb-4 gap-4">
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tighter flex items-center gap-2 uppercase italic">
                <FlaskConical className="text-primary" size={20} />
                Quant_Lab <span className="text-muted-foreground font-mono text-xs tracking-[0.3em] not-italic">Backtest_v1</span>
              </h1>
              <p className="text-[9px] font-mono uppercase text-muted-foreground mt-1 tracking-widest font-bold">
                Strategic_Simulation_Environment // 
              </p>
            </div>
            <div className="flex items-center gap-2">
              {result && (
                <button
                  onClick={handleReset}
                  className="px-4 py-2 border border-border text-[9px] font-bold text-muted-foreground hover:text-foreground hover:bg-accent transition-all uppercase tracking-widest flex items-center gap-2"
                >
                  <RotateCcw size={12} /> Reset_State
                </button>
              )}
              <button
                onClick={handleRun}
                disabled={loading || !selectedMarket || fetchingMarkets}
                className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 disabled:opacity-30"
              >
                {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                {loading ? "SIMULATING..." : "RUN_BACKTEST"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">

            {/* Left Col */}
            <div className="col-span-12 lg:col-span-8 space-y-6">

              {/* Strategy Config */}
              <div className="bg-card border border-border p-6 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-px bg-primary/40" />
                <h2 className="text-[10px] font-bold text-foreground/80 uppercase tracking-widest mb-6 border-b border-border pb-3 flex items-center gap-2">
                  <Zap size={12} className="text-primary" /> Strategy Config
                </h2>

                {/* AI Assistant */}
                <div className="mb-6 p-4 border border-blue-500/20 bg-blue-500/5">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-[8px] font-bold text-blue-400 uppercase tracking-widest">AI Strategic Assistant (BETA)</label>
                    <button
                      onClick={() => handleAiParse('optimize')}
                      disabled={parsingAi || !selectedMarket}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-[8px] font-bold px-3 py-1 uppercase tracking-widest transition-all disabled:opacity-30"
                    >
                      Auto_Optimize
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Input natural language strategy..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className="w-full bg-background border border-border p-2.5 text-[10px] text-foreground focus:border-blue-500/40 outline-none"
                    />
                    <button onClick={() => handleAiParse('parse')} disabled={parsingAi || !aiPrompt} className="absolute right-2 top-2.5 text-blue-500 hover:text-primary">
                      {parsingAi ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />}
                    </button>
                  </div>

                  {aiReasoning && (
                    <div className="mt-4 p-3 bg-accent/20 border border-border flex gap-3">
                      <Info size={12} className="text-primary mt-0.5 shrink-0" />
                      <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                        <span className="font-bold text-primary uppercase not-italic mr-2">Inference_Result:</span> {aiReasoning}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Market Selection */}
                  <div className="sm:col-span-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">MARKET (SAVED ALPHA ONLY)</label>
                    </div>
                    <select
                      value={selectedMarket}
                      onChange={(e) => setSelectedMarket(e.target.value)}
                      className="w-full bg-background border border-border p-2.5 text-[10px] text-foreground outline-none focus:border-primary/40 rounded-sm"
                    >
                      {fetchingMarkets ? (
                        <option>Loading_Nodes...</option>
                      ) : (
                        markets
                          .filter(m => (m as any).marketIds?.some((id: string) => bookmarks.includes(id)))
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.question.startsWith('[HISTORICAL]') ? '📜' : '🔴'} {m.question.slice(0, 80)}
                            </option>
                          ))
                      )}
                    </select>
                    <div className="mt-1 bg-blue-500/5 border border-blue-500/10 px-4 py-3">
                      <p className="text-[9px] font-mono text-blue-400/80 leading-relaxed">
                        <span className="font-black text-blue-400 uppercase tracking-tighter mr-1">Selection_Protocol //</span>
                        For tomorrow's presentation, prioritize <span className="text-white font-bold underline">USD/NGN Exchange Rate</span> markets. They have the highest data density. Use 📜 [HISTORICAL] nodes for clean backtest curves (0-1 resolution) and 🔴 [LIVE] nodes to demonstrate real-time AI signal drift.
                      </p>
                    </div>
                  </div>

                  {/* Direction */}
                  <div className="space-y-2">
                    <label className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Direction</label>
                    <div className="flex gap-2">
                      {(["BUY", "SELL"] as const).map((dir) => (
                        <button
                          key={dir}
                          onClick={() => setStrategy((s) => ({ ...s, direction: dir }))}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-mono font-bold border transition-all ${strategy.direction === dir
                              ? dir === "BUY"
                                ? "bg-green-500/10 border-green-500/40 text-green-400"
                                : "bg-red-500/10 border-red-500/40 text-red-400"
                              : "bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600"
                            }`}
                        >
                          {dir === "BUY" ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                          {dir}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hold Days */}
                  <div className="space-y-2">
                    <label className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Max_Hold_Days</label>
                    <input
                      type="number"
                      value={strategy.holdDays ?? ""}
                      onChange={(e) => setStrategy({ ...strategy, holdDays: parseInt(e.target.value) || 0 })}
                      className="w-full bg-background border border-border p-2 text-[10px] text-foreground outline-none rounded-sm"
                    />
                  </div>

                  {/* Entry/Exit */}
                  <div className="space-y-2">
                    <label className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Entry_Gate (Prob)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step={0.01}
                        value={strategy.entryThreshold ?? ""}
                        onChange={(e) => {
                          let val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                          if (val > 1) val = val / 100; // Auto-convert 20 to 0.2
                          val = Math.max(0, Math.min(1, val)); // Clamp 0-1
                          setStrategy({ ...strategy, entryThreshold: val });
                        }}
                        className="w-full bg-background border border-border p-2 text-[10px] text-foreground outline-none rounded-sm"
                      />
                      <span className="absolute right-2 top-2 text-[8px] text-muted-foreground/60">{(strategy.entryThreshold * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Exit_Gate (Prob)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step={0.01}
                        value={strategy.exitThreshold ?? ""}
                        onChange={(e) => {
                          let val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                          if (val > 1) val = val / 100; // Auto-convert 20 to 0.2
                          val = Math.max(0, Math.min(1, val)); // Clamp 0-1
                          setStrategy({ ...strategy, exitThreshold: val });
                        }}
                        className="w-full bg-background border border-border p-2 text-[10px] text-foreground outline-none rounded-sm"
                      />
                      <span className="absolute right-2 top-2 text-[8px] text-muted-foreground/60">{(strategy.exitThreshold * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                {/* HINT FOR BEGINNERS */}
                <div className="mt-8 p-5 bg-accent/20 border border-border rounded-xl">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed">
                    <span className="text-primary italic mr-2 font-black">HINT //</span>
                    {strategy.direction === "BUY"
                      ? `BUY WHEN PROB < ${(strategy.entryThreshold * 100).toFixed(0)}% — MARKET UNDERPRICING YES. EXIT WHEN PROB > ${(strategy.exitThreshold * 100).toFixed(0)}% OR AFTER ${strategy.holdDays} DAYS.`
                      : `SELL WHEN PROB > ${(strategy.entryThreshold * 100).toFixed(0)}% — MARKET OVERPRICING YES. EXIT WHEN PROB < ${(strategy.exitThreshold * 100).toFixed(0)}% OR AFTER ${strategy.holdDays} DAYS.`}
                  </p>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-4 border border-rose-500/20 bg-rose-500/5 flex items-center gap-3">
                  <AlertTriangle size={14} className="text-rose-500 shrink-0" />
                  <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest">{error}</p>
                </div>
              )}

              {/* Results */}
              {result && !loading && (
                <>
                  <div className="bg-card border border-border p-6">
                    <h2 className="text-[10px] font-bold text-foreground/80 uppercase tracking-widest mb-6 flex justify-between items-center">
                      <span className="flex items-center gap-2">
                        Equity_Stream_Analytics
                        <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 text-[7px] font-mono font-bold uppercase tracking-widest">
                          {mcPaths.length > 0 ? result?.equity?.length : 0}_DATA_POINTS
                        </span>
                        {mcPaths.length > 0 && (
                          <button 
                            onClick={() => setShowMC(!showMC)}
                            className={cn("px-2 py-0.5 border text-[7px] font-black uppercase transition-all", showMC ? "bg-purple-500/20 border-purple-500 text-purple-400" : "border-border text-muted-foreground")}
                          >
                            {showMC ? "Hide_MC_Projections" : "Show_MC_Projections"}
                          </button>
                        )}
                      </span>
                      <span className={cn("text-[9px]", result.totalReturn >= 0 ? "text-emerald-500" : "text-rose-500")}>
                        {result.totalReturn >= 0 ? "+" : ""}{result.totalReturn}pp_CUMULATIVE
                      </span>
                    </h2>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={result.equity} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                          <defs>
                            <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={result.totalReturn >= 0 ? "#10b981" : "#f43f5e"} stopOpacity={0.1} />
                              <stop offset="95%" stopColor={result.totalReturn >= 0 ? "#10b981" : "#f43f5e"} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="currentColor" strokeOpacity={0.05} strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: "currentColor", fontSize: 8, opacity: 0.4 }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fill: "currentColor", fontSize: 8, opacity: 0.4 }} tickLine={false} axisLine={false} />
                          <ReferenceLine y={100} stroke="currentColor" strokeOpacity={0.1} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="stepAfter" dataKey="value" stroke={result.totalReturn >= 0 ? "#10b981" : "#f43f5e"} strokeWidth={1} fill="url(#eqGrad)" dot={false} />
                          
                          {showMC && mcPaths.map((path, idx) => (
                            <Area 
                              key={`mc-${idx}`}
                              data={path.map(p => ({ date: new Date(p.t).toLocaleDateString("en-NG", { month: "short", day: "numeric" }), value: (p.p * 100) + (result.equity[result.equity.length-1].value - (result.equity[result.equity.length-1].value / 2)) }))} 
                              type="monotone" 
                              dataKey="value" 
                              stroke="#a855f7" 
                              strokeOpacity={0.1} 
                              fill="none" 
                              strokeWidth={0.5} 
                              isAnimationActive={false}
                            />
                          ))}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-card border border-border p-6">
                    <h2 className="text-[10px] font-bold text-foreground/80 uppercase tracking-widest mb-6">Execution_Ledger ({result.trades.length}_Trades)</h2>
                    <div className="space-y-1">
                      <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[8px] font-bold text-muted-foreground uppercase border-b border-border mb-2">
                        <div className="col-span-3">Timestamp</div>
                        <div className="col-span-2">Op</div>
                        <div className="col-span-2 text-center">In</div>
                        <div className="col-span-2 text-center">Out</div>
                        <div className="col-span-3 text-right">Net_PL</div>
                      </div>
                      {result.trades.map((trade, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 border border-border hover:bg-accent/20 transition-all text-[10px]">
                          <div className="col-span-3 text-muted-foreground font-bold">{trade.date}</div>
                          <div className="col-span-2">
                            <span className={cn("px-1.5 py-0.5 border text-[8px] font-bold", trade.type === "BUY" ? "border-emerald-500/20 text-emerald-500" : "border-rose-500/20 text-rose-500")}>{trade.type}</span>
                          </div>
                          <div className="col-span-2 text-center text-foreground/70">{(trade.entry * 100).toFixed(0)}%</div>
                          <div className="col-span-2 text-center text-foreground/70">{(trade.exit * 100).toFixed(0)}%</div>
                          <div className={cn("col-span-3 text-right font-bold", trade.pnl >= 0 ? "text-emerald-500" : "text-rose-500")}>{trade.pnl >= 0 ? "+" : ""}{trade.pnl}pp</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {!result && !loading && (
                <div className="h-64 border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground/40 uppercase tracking-widest gap-4">
                  <Activity size={24} className="animate-pulse" />
                  <span className="text-[9px] font-bold">Awaiting_Simulation_Input...</span>
                </div>
              )}
            </div>

            {/* Right Col */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              {/* PROTOCOL LOGIC GUIDE */}
              <div className="bg-card border border-border p-6 rounded-xl">
                <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-6">Protocol_Logic</h2>
                <div className="space-y-5">
                  {[
                    { step: "01.", text: "Select a Bayse prediction market" },
                    { step: "02.", text: "Set entry/exit probability thresholds" },
                    { step: "03.", text: "Run the backtest against historical data" },
                    { step: "04.", text: "Analyze performance & refine your strategy" }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 group">
                      <span className="text-blue-500 font-black text-xs italic shrink-0 transition-transform group-hover:scale-110">{item.step}</span>
                      <span className="text-[10px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card border border-border p-6 sticky top-6">
                <h2 className="text-[10px] font-bold text-foreground uppercase tracking-widest mb-6">Simulation_Stats</h2>
                {result ? (
                  <div className="space-y-2">
                    <StatCard label="Total_Return" value={result.totalReturn} unit="pp" color={result.totalReturn >= 0 ? "text-emerald-500" : "text-rose-500"} icon={<TrendingUp size={14} className={result.totalReturn >= 0 ? "text-emerald-500" : "text-rose-500"} />} />
                    <StatCard label="Sharpe_Ratio" value={result.sharpe} color="text-blue-400" icon={<Activity size={14} />} />
                    <StatCard label="Win_Rate" value={result.winRate} unit="%" color={result.winRate >= 50 ? "text-emerald-500" : "text-rose-500"} icon={<CheckCircle2 size={14} />} />
                    <StatCard label="Trade_Volume" value={result.totalTrades} color="text-foreground" />
                    <StatCard label="Max_Drawdown" value={`-${result.maxDrawdown}`} unit="pp" color="text-orange-500" />
                  </div>
                ) : (
                  <div className="space-y-4 opacity-20">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-muted border border-border" />)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
