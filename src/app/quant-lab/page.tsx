"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/layout/Sidebar";
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
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Backtesting Engine ───────────────────────────────────────────────────────

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

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    const val = payload[0].value as number;
    const isUp = val >= 100;
    return (
      <div className="bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-[10px] font-mono">
        <p className="text-slate-500 mb-0.5">{label}</p>
        <p className={`font-bold text-sm ${isUp ? "text-green-400" : "text-red-400"}`}>
          {val.toFixed(2)}
        </p>
      </div>
    );
  }
  return null;
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

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
    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">
          {label}
        </span>
        {icon && <span className="opacity-70">{icon}</span>}
      </div>
      <p className={`text-2xl font-black tracking-tight ${color}`}>
        {value}
        <span className="text-sm font-mono font-normal text-slate-500 ml-1">
          {unit}
        </span>
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QuantLabPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<string>("");
  const [strategy, setStrategy] = useState<Strategy>({
    direction: "BUY",
    entryThreshold: 0.3,
    exitThreshold: 0.7,
    holdDays: 10,
  });
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingMarkets, setFetchingMarkets] = useState(true);
  const [error, setError] = useState("");

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
    setStrategy({ direction: "BUY", entryThreshold: 0.3, exitThreshold: 0.7, holdDays: 10 });
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-blue-500/30">
      <Sidebar />

      <main className="lg:ml-64 p-4 lg:p-12">
        <div className="max-w-6xl mx-auto">

          {/* ── Header ── */}
          <div className="flex items-start justify-between mb-12">
            <div>
              <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tighter uppercase italic">
                Quant_Lab
              </h1>
              <p className="text-slate-500 text-[10px] font-mono mt-1 tracking-widest uppercase opacity-70">
                Signal Backtester // Historical Strategy Analysis // Bayse Markets
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
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl">
                <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">
                  Strategy Config
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Market */}
                  <div className="sm:col-span-2 flex flex-col gap-2">
                    <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                      Market
                    </label>
                    <select
                      value={selectedMarket}
                      onChange={(e) => setSelectedMarket(e.target.value)}
                      disabled={fetchingMarkets}
                      className="bg-slate-950 border border-slate-800 focus:border-orange-500/50 text-white text-[11px] font-mono px-4 py-2.5 rounded-xl outline-none transition-colors disabled:opacity-50"
                    >
                      {fetchingMarkets ? (
                        <option>Loading markets...</option>
                      ) : (
                        markets.map((m) => (
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
                <div className="mt-5 p-3 bg-slate-950/60 border border-slate-800/60 rounded-xl">
                  <p className="text-[9px] font-mono text-slate-500">
                    <span className="text-orange-400">HINT //</span>{" "}
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
                  <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                        Equity Curve
                      </h2>
                      <span className={`text-[9px] font-mono font-bold px-2 py-1 rounded-lg ${
                        result.totalReturn >= 0
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400"
                      }`}>
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
                  <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl">
                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">
                      Trade Log{" "}
                      <span className="text-slate-600 normal-case font-mono font-normal">
                        ({result.trades.length} trades)
                      </span>
                    </h2>

                    {result.trades.length === 0 ? (
                      <p className="text-[10px] font-mono text-slate-600 text-center py-12">
                        NO_TRADES_TRIGGERED — Adjust your thresholds and retry
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[9px] font-mono text-slate-600 uppercase tracking-widest border-b border-slate-800">
                          <div className="col-span-3">Date</div>
                          <div className="col-span-2">Type</div>
                          <div className="col-span-2 text-center">Entry</div>
                          <div className="col-span-2 text-center">Exit</div>
                          <div className="col-span-3 text-right">P&L (pp)</div>
                        </div>

                        {result.trades.map((trade, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-12 gap-2 px-3 py-3 rounded-xl border border-slate-800/50 hover:border-slate-700 transition-colors"
                          >
                            <div className="col-span-3 text-[11px] font-mono text-slate-400">{trade.date}</div>
                            <div className="col-span-2">
                              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-lg ${
                                trade.type === "BUY"
                                  ? "bg-green-500/10 text-green-400"
                                  : "bg-red-500/10 text-red-400"
                              }`}>
                                {trade.type}
                              </span>
                            </div>
                            <div className="col-span-2 text-center text-[11px] font-mono text-white">
                              {(trade.entry * 100).toFixed(1)}%
                            </div>
                            <div className="col-span-2 text-center text-[11px] font-mono text-white">
                              {(trade.exit * 100).toFixed(1)}%
                            </div>
                            <div className={`col-span-3 text-right text-[11px] font-mono font-bold ${
                              trade.pnl >= 0 ? "text-green-400" : "text-red-400"
                            }`}>
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
            <div className="hidden lg:block lg:col-span-4 sticky top-12 space-y-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl">
                <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">
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
                      color="text-white"
                      icon={<Minus size={14} className="text-slate-500" />}
                    />
                    <StatCard
                      label="Avg Return / Trade"
                      value={result.avgReturn >= 0 ? `+${result.avgReturn}` : `${result.avgReturn}`}
                      unit="pp"
                      color={result.avgReturn >= 0 ? "text-green-400" : "text-red-400"}
                    />
                    <StatCard
                      label="Max Drawdown"
                      value={`-${result.maxDrawdown}`}
                      unit="pp"
                      color="text-orange-400"
                      icon={<AlertTriangle size={14} className="text-orange-400" />}
                    />

                    {/* Verdict */}
                    <div className={`mt-2 p-4 rounded-2xl border text-center ${
                      result.totalReturn > 5 && result.winRate >= 50
                        ? "bg-green-500/5 border-green-500/20"
                        : result.totalReturn < 0
                        ? "bg-red-500/5 border-red-500/20"
                        : "bg-slate-800/40 border-slate-700/40"
                    }`}>
                      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">
                        Strategy Verdict
                      </p>
                      <p className={`text-sm font-black uppercase ${
                        result.totalReturn > 5 && result.winRate >= 50
                          ? "text-green-400"
                          : result.totalReturn < 0
                          ? "text-red-400"
                          : "text-slate-400"
                      }`}>
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
                  <div className="space-y-3">
                    {["Total Return", "Win Rate", "Total Trades", "Avg Return", "Max Drawdown"].map((label) => (
                      <div key={label} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                        <p className="text-[9px] font-mono text-slate-700 uppercase tracking-widest mb-2">{label}</p>
                        <div className="h-6 w-16 bg-slate-800/60 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* How it works */}
              <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-5">
                <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-3">
                  How it works
                </p>
                <div className="space-y-2 text-[10px] font-mono text-slate-500 leading-relaxed">
                  <p><span className="text-orange-400">01.</span> Select a Bayse prediction market</p>
                  <p><span className="text-orange-400">02.</span> Set entry/exit probability thresholds</p>
                  <p><span className="text-orange-400">03.</span> Run the backtest against historical data</p>
                  <p><span className="text-orange-400">04.</span> Analyze performance & refine your strategy</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
