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
  Info
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



function runBacktest(
  priceHistory: PricePoint[],
  strategy: Strategy
): BacktestResult {
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

  const winners = trades.filter((t) => t.pnl > 0);
  const winRate = trades.length ? (winners.length / trades.length) * 100 : 0;
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

  return {
    trades,
    equity,
    winRate: parseFloat(winRate.toFixed(1)),
    totalReturn: parseFloat(totalReturn.toFixed(2)),
    avgReturn: parseFloat(avgReturn.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    totalTrades: trades.length,
  };
}



const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    const val = payload[0].value as number;
    const isUp = val >= 100;
    return (
      <div className="bg-card border border-border px-3 py-2 rounded-xl text-[10px] font-mono shadow-xl">
        <p className="text-muted-foreground mb-0.5">{label}</p>
        <p className={`font-black text-sm ${isUp ? "text-green-500" : "text-red-500"}`}>
          {val.toFixed(2)}
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
  color = "text-foreground",
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-secondary/40 border border-border rounded-2xl p-4 shadow-sm">
      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2 opacity-40">
        {label}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <span className={cn("text-lg font-black tracking-tight", color)}>
            {value}
          </span>
          {unit && (
            <span className="text-[10px] font-black text-muted-foreground/40 ml-1">
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
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingMarkets, setFetchingMarkets] = useState(true);
  const [error, setError] = useState("");
  const [showBookmarkedOnly, setShowBookmarkedOnly] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [parsingAi, setParsingAi] = useState(false);
  const [aiReasoning, setAiReasoning] = useState("");
  const { bookmarks } = useBookmarks();
  const { isSidebarCollapsed } = useLayout();

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
        const histData = await histRes.json();
        history = histData.history || [];
        if (history.length < 5) throw new Error("Not enough history to optimize.");
      }

      const res = await fetch("/api/quant/parse-strategy", {
        method: "POST",
        body: JSON.stringify({ 
          prompt: aiPrompt,
          mode,
          history
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setStrategy({
        direction: data.direction,
        entryThreshold: data.entryThreshold,
        exitThreshold: data.exitThreshold,
        holdDays: data.holdDays,
      });
      setAiReasoning(data.reasoning);
      setAiPrompt(""); 
    } catch (err: any) {
      setError(err.message || "AI failed to process. Try again.");
    } finally {
      setParsingAi(false);
    }
  };

  // Fetch markets on mount
  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const res = await fetch("/api/markets");
        const data = await res.json();
        setMarkets(data.markets || []);
        if (data.markets?.length) setSelectedMarket(data.markets[0].id);
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
        setError("This market has no recorded price history yet — it may be too new or hasn't traded enough. Select a different market.");
        setLoading(false);
        return;
      }

      const backtestResult = runBacktest(history, strategy);
      setResult(backtestResult);
    } catch {
      setError("Failed to fetch market history. Try another market.");
    } finally {
      setLoading(false);
    }
  }, [selectedMarket, strategy]);

  const handleReset = () => {
    setResult(null);
    setError("");
    setStrategy({ direction: "BUY", entryThreshold: 0.3, exitThreshold: 0.7, holdDays: 14 });
  };



  return (
    <div className="min-h-screen bg-background text-foreground transition-all duration-300">
      <Sidebar />

      <main className={cn(
        "p-6 lg:p-12 transition-all duration-500 ease-in-out",
        isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
      )}>
        <div className="max-w-7xl mx-auto pt-16 lg:pt-0">

          {/* ── Header ── */}
          <div className="flex flex-col md:flex-row items-start justify-between mb-12 gap-6">
            <div>
              <h1 className="text-3xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic mb-2 flex items-center gap-4">
                <FlaskConical className="text-primary" />
                QUANT_LAB
              </h1>
              <p className="text-muted-foreground text-[10px] font-black tracking-widest uppercase opacity-70">
                Advanced Backtesting & Strategy Optimization
              </p>
            </div>
            <div className="flex items-center gap-3">
              {result && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 bg-slate-900 border border-slate-700 hover:border-slate-500 px-4 py-2 rounded-xl text-[10px] font-mono text-slate-400 hover:text-white transition-colors"
                >
                  <RotateCcw size={12} />
                  RESET
                </button>
              )}
              <button
                onClick={handleRun}
                disabled={loading || !selectedMarket || fetchingMarkets}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-xl text-[10px] font-mono font-bold text-white transition-colors"
              >
                {loading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Play size={12} />
                )}
                {loading ? "RUNNING..." : "RUN_BACKTEST"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-8 items-start">

            {/* ── Left: Config + Results ── */}
            <div className="col-span-12 lg:col-span-8 space-y-8">

              {/* Config Panel */}
              <div className="bg-card border border-border rounded-3xl p-8 shadow-sm backdrop-blur-sm">
                <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-8 opacity-40">
                  Strategy Config
                </h2>

                {/* AI Strategy Builder */}
                <div className="mb-8 p-4 bg-blue-600/5 border border-blue-500/20 rounded-2xl">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-[9px] font-mono text-blue-400 uppercase tracking-widest block">
                      AI Strategic Assistant (BETA)
                    </label>
                    <button
                      onClick={() => handleAiParse('optimize')}
                      disabled={parsingAi || !selectedMarket}
                      className="flex items-center gap-1.5 px-3 py-1 bg-blue-500 hover:bg-blue-400 text-white text-[8px] font-mono font-bold rounded-lg transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                    >
                      <Zap size={10} />
                      AUTO-OPTIMIZE
                    </button>
                  </div>
                  
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Or type a strategy: 'buy when cheap, sell at 80%'"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAiParse('parse')}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500/50 text-white text-[11px] font-mono px-4 py-3 rounded-xl outline-none transition-colors pr-10"
                    />
                    <button 
                      onClick={() => handleAiParse('parse')}
                      disabled={parsingAi || !aiPrompt}
                      className="absolute right-2 top-1.5 p-1.5 text-blue-500 hover:text-white disabled:opacity-30 transition-colors"
                    >
                      {parsingAi ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} className="animate-pulse" />}
                    </button>
                  </div>

                  {aiReasoning && (
                    <div className="mt-4 p-4 bg-primary/5 border-l-2 border-primary rounded-xl flex gap-3">
                      <div className="mt-1">
                        <Info size={14} className="text-primary" />
                      </div>
                      <p className="text-[11px] text-foreground font-medium italic leading-relaxed">
                        <span className="font-black text-primary uppercase not-italic tracking-tighter mr-2">AI Logic //</span> {aiReasoning}
                      </p>
                    </div>
                  )}
                  
                  {!aiReasoning && (
                    <p className="text-[9px] font-black text-muted-foreground mt-3 italic opacity-60">
                      Gemini will analyze the chart or your words to configure the optimal trade.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Market */}
                  <div className="sm:col-span-2 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                        Market
                      </label>
                      <button
                        onClick={() => setShowBookmarkedOnly(prev => !prev)}
                        className={`flex items-center gap-1.5 text-[8px] font-mono font-bold px-2 py-1 rounded-lg border transition-all ${
                          showBookmarkedOnly
                            ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <Bookmark size={8} fill={showBookmarkedOnly ? "currentColor" : "none"} />
                        BOOKMARKS ONLY
                      </button>
                    </div>
                    <select
                      value={selectedMarket}
                      onChange={(e) => setSelectedMarket(e.target.value)}
                      disabled={fetchingMarkets}
                      className="bg-slate-950 border border-slate-800 focus:border-orange-500/50 text-white text-[11px] font-mono px-4 py-2.5 rounded-xl outline-none transition-colors disabled:opacity-50"
                    >
                      {fetchingMarkets ? (
                        <option>Loading markets...</option>
                      ) : (
                        markets
                          .filter(m => !showBookmarkedOnly || bookmarks.includes(m.id))
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.question.length > 80
                                ? m.question.slice(0, 80) + "…"
                                : m.question}
                            </option>
                          ))
                      )}
                    </select>
                    
                    <div className="mt-1 bg-blue-500/5 border border-blue-500/10 rounded-xl px-4 py-3">
                      <p className="text-[9px] font-mono text-blue-400/80 leading-relaxed">
                        <span className="font-black text-blue-400 uppercase tracking-tighter mr-1">Pro Tip //</span> 
                        For the best results, select markets with high trading volume or those open for at least 30 days. New or low-activity markets may have sparse price history.
                      </p>
                    </div>
                  </div>

                  {/* Direction */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                      Direction
                    </label>
                    <div className="flex gap-2">
                      {(["BUY", "SELL"] as const).map((dir) => (
                        <button
                          key={dir}
                          onClick={() => setStrategy((s) => ({ ...s, direction: dir }))}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-mono font-bold border transition-all ${
                            strategy.direction === dir
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
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                      Max Hold (days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={strategy.holdDays}
                      onChange={(e) =>
                        setStrategy((s) => ({ ...s, holdDays: parseInt(e.target.value) || 1 }))
                      }
                      className="bg-slate-950 border border-slate-800 focus:border-orange-500/50 text-white text-[11px] font-mono px-4 py-2.5 rounded-xl outline-none transition-colors"
                    />
                  </div>

                  {/* Entry Threshold */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                      Entry Prob Threshold
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0.01}
                        max={0.99}
                        step={0.01}
                        value={strategy.entryThreshold}
                        onChange={(e) =>
                          setStrategy((s) => ({ ...s, entryThreshold: parseFloat(e.target.value) }))
                        }
                        className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500/50 text-white text-[11px] font-mono px-4 py-2.5 rounded-xl outline-none transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500">
                        {(strategy.entryThreshold * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Exit Threshold */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                      Exit Prob Threshold
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0.01}
                        max={0.99}
                        step={0.01}
                        value={strategy.exitThreshold}
                        onChange={(e) =>
                          setStrategy((s) => ({ ...s, exitThreshold: parseFloat(e.target.value) }))
                        }
                        className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500/50 text-white text-[11px] font-mono px-4 py-2.5 rounded-xl outline-none transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500">
                        {(strategy.exitThreshold * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Strategy hint */}
                <div className="mt-8 p-4 bg-secondary rounded-2xl border border-border/50">
                  <p className="text-[10px] font-black text-muted-foreground leading-relaxed uppercase tracking-tight">
                    <span className="text-primary mr-2 italic font-black uppercase">Hint //</span>{" "}
                    {strategy.direction === "BUY"
                      ? `BUY when prob < ${(strategy.entryThreshold * 100).toFixed(0)}% — market underpricing YES. Exit when prob > ${(strategy.exitThreshold * 100).toFixed(0)}% or after ${strategy.holdDays} days.`
                      : `SELL when prob > ${(strategy.entryThreshold * 100).toFixed(0)}% — market overpricing YES. Exit when prob < ${(strategy.exitThreshold * 100).toFixed(0)}% or after ${strategy.holdDays} days.`}
                  </p>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 rounded-2xl px-5 py-4">
                  <AlertTriangle size={14} className="text-red-400 shrink-0" />
                  <p className="text-[10px] font-mono text-red-400">{error}</p>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center justify-center h-48 gap-4">
                  <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-500 text-[10px] font-mono tracking-widest uppercase animate-pulse">
                    Running backtest against historical data...
                  </p>
                </div>
              )}

              {/* Results */}
              {result && !loading && (
                <>
                  {/* Equity Curve */}
                  <div className="bg-card border border-border rounded-3xl p-8 shadow-sm backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40">
                        Equity Curve
                      </h2>
                      <span className={cn(
                        "text-[10px] font-black px-3 py-1 rounded-xl uppercase tracking-widest shadow-sm",
                        result.totalReturn >= 0
                          ? "bg-green-500/10 text-green-600 dark:text-green-400"
                          : "bg-red-500/10 text-red-600 dark:text-red-400"
                      )}>
                        {result.totalReturn >= 0 ? "+" : ""}{result.totalReturn}pp TOTAL
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={result.equity} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="5%"
                              stopColor={result.totalReturn >= 0 ? "#22c55e" : "#ef4444"}
                              stopOpacity={0.2}
                            />
                            <stop
                              offset="95%"
                              stopColor={result.totalReturn >= 0 ? "#22c55e" : "#ef4444"}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "#475569", fontSize: 9, fontFamily: "monospace" }}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fill: "#475569", fontSize: 9, fontFamily: "monospace" }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <ReferenceLine y={100} stroke="#475569" strokeDasharray="4 4" />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={result.totalReturn >= 0 ? "#22c55e" : "#ef4444"}
                          strokeWidth={2}
                          fill="url(#eqGrad)"
                          dot={false}
                          activeDot={{ r: 4, fill: result.totalReturn >= 0 ? "#22c55e" : "#ef4444" }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Trade Log */}
                  <div className="bg-card border border-border rounded-3xl p-8 shadow-sm backdrop-blur-sm">
                    <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-8 opacity-40">
                      Trade Log{" "}
                      <span className="text-[10px] lowercase font-medium tracking-normal ml-2">
                        ({result.trades.length} trades)
                      </span>
                    </h2>
                    
                    {result.trades.length === 0 ? (
                      <p className="text-[11px] font-black text-muted-foreground/40 text-center py-16 uppercase tracking-widest">
                        NO_TRADES_TRIGGERED — Adjust thresholds
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] border-b border-border/50 opacity-40">
                          <div className="col-span-3">Date</div>
                          <div className="col-span-2">Type</div>
                          <div className="col-span-2 text-center">Entry</div>
                          <div className="col-span-2 text-center">Exit</div>
                          <div className="col-span-3 text-right">P&L (pp)</div>
                        </div>

                        {result.trades.map((trade, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-12 gap-2 px-4 py-4 rounded-xl border border-border/40 hover:bg-secondary/40 transition-colors"
                          >
                            <div className="col-span-3 text-[11px] font-black text-muted-foreground">{trade.date}</div>
                            <div className="col-span-2">
                              <span className={cn(
                                "text-[9px] font-black px-2 py-0.5 rounded-lg uppercase",
                                trade.type === "BUY"
                                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                  : "bg-red-500/10 text-red-600 dark:text-red-400"
                              )}>
                                {trade.type}
                              </span>
                            </div>
                            <div className="col-span-2 text-center text-[11px] font-black text-foreground">
                              {(trade.entry * 100).toFixed(1)}%
                            </div>
                            <div className="col-span-2 text-center text-[11px] font-black text-foreground">
                              {(trade.exit * 100).toFixed(1)}%
                            </div>
                            <div className={cn(
                              "col-span-3 text-right text-[11px] font-black tabular-nums",
                              trade.pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                            )}>
                              {trade.pnl >= 0 ? `+${trade.pnl}` : trade.pnl}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Empty state */}
              {!result && !loading && !error && (
                <div className="flex flex-col items-center justify-center h-64 gap-4 border border-dashed border-slate-800 rounded-3xl">
                  <FlaskConical size={32} className="text-slate-700" />
                  <div className="text-center">
                    <p className="text-[11px] font-mono text-slate-500 uppercase tracking-widest">
                      Configure strategy & hit RUN_BACKTEST
                    </p>
                    <p className="text-[9px] font-mono text-slate-700 mt-1">
                      Equity curve, trade log, and performance stats will appear here
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Right: Stats Sidebar ── */}
            <div className="hidden lg:block lg:col-span-4 sticky top-12 space-y-6">
              <div className="bg-card border border-border rounded-3xl p-6 shadow-sm backdrop-blur-sm">
                <h2 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-8 opacity-40">
                  Performance
                </h2>

                {result ? (
                  <div className="space-y-3">
                    <StatCard
                      label="Total Return"
                      value={result.totalReturn >= 0 ? `+${result.totalReturn}` : `${result.totalReturn}`}
                      unit="pp"
                      color={result.totalReturn >= 0 ? "text-green-400" : "text-red-400"}
                      icon={result.totalReturn >= 0
                        ? <TrendingUp size={14} className="text-green-400" />
                        : <TrendingDown size={14} className="text-red-400" />}
                    />
                    <StatCard
                      label="Win Rate"
                      value={`${result.winRate}`}
                      unit="%"
                      color={result.winRate >= 50 ? "text-green-400" : "text-red-400"}
                      icon={result.winRate >= 50
                        ? <CheckCircle2 size={14} className="text-green-400" />
                        : <XCircle size={14} className="text-red-400" />}
                    />
                    <StatCard
                      label="Total Trades"
                      value={result.totalTrades}
                      color="text-foreground"
                      icon={<Minus size={14} className="text-muted-foreground/60" />}
                    />
                    <StatCard
                      label="Avg Return / Trade"
                      value={result.avgReturn >= 0 ? `+${result.avgReturn}` : `${result.avgReturn}`}
                      unit="pp"
                      color={result.avgReturn >= 0 ? "text-green-500" : "text-red-500"}
                    />
                    <StatCard
                      label="Max Drawdown"
                      value={`-${result.maxDrawdown}`}
                      unit="pp"
                      color="text-orange-500"
                      icon={<AlertTriangle size={14} className="text-orange-500" />}
                    />

                    {/* Verdict */}
                    <div className={cn(
                      "mt-4 p-5 rounded-2xl border text-center transition-all",
                      result.totalReturn > 5 && result.winRate >= 50
                        ? "bg-green-500/5 border-green-500/20"
                        : result.totalReturn < 0
                        ? "bg-red-500/5 border-red-500/20"
                        : "bg-secondary border-border"
                    )}>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2 opacity-40">
                        Strategy Verdict
                      </p>
                      <p className={cn(
                        "text-base font-black uppercase tracking-tight",
                        result.totalReturn > 5 && result.winRate >= 50
                          ? "text-green-600 dark:text-green-400"
                          : result.totalReturn < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                      )}>
                        {result.totalReturn > 5 && result.winRate >= 50
                          ? "STRONG EDGE"
                          : result.totalReturn > 0
                          ? "MARGINAL EDGE"
                          : result.totalTrades === 0
                          ? "NO SIGNALS"
                          : "NO EDGE"}
                      </p>
                    </div>
                  </div>
                ) : (
                  // Skeleton
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-16 bg-secondary animate-pulse rounded-2xl" />
                    ))}
                  </div>
                )}
              </div>

              {/* How it works */}
              <div className="bg-secondary/40 border border-border rounded-3xl p-6">
                <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 opacity-40">
                  Protocol Logic
                </h3>
                <div className="space-y-3">
                  {[
                    { id: "01", text: "Select a Bayse prediction market" },
                    { id: "02", text: "Set entry/exit probability thresholds" },
                    { id: "03", text: "Run the backtest against historical data" },
                    { id: "04", text: "Analyze performance & refine your strategy" }
                  ].map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <span className="text-[10px] font-black text-primary opacity-60">{item.id}.</span>
                      <p className="text-[11px] font-medium text-muted-foreground leading-snug">{item.text}</p>
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


