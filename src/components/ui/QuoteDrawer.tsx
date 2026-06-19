"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import {
  Zap, X, CheckCircle2, ArrowUpRight, ArrowDownRight,
  AlertTriangle, TrendingUp, TrendingDown, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuoteDrawerProps {
  eventId: string;
  marketId: string;
  defaultOutcome?: string;
  engine: "AMM" | "CLOB";
  onOrderConfirmed?: (orderId: string) => void;
  onClose?: () => void;
  currencyProp?: "USD" | "NGN";
  aiProbability?: number;
  yesOutcomeId?: string;
  noOutcomeId?: string;
  marketTitle?: string;
}

interface QuoteResponse {
  price: number;
  currentMarketPrice: number;
  quantity: number;
  costOfShares: number;
  fee: number;
  amount: number;
  completeFill: boolean;
  priceImpactAbsolute: number;
  profitPercentage: number;
  currencyBaseMultiplier: number;
  tradeGoesOverMaxLiability: boolean;
}

interface OrderResponse {
  id: string;
  status: "pending" | "open" | "partial_filled" | "filled" | "cancelled" | "rejected";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function getLiquidityWarning(priceImpact: number): {
  level: "none" | "low" | "high";
  message: string;
} {
  if (priceImpact > 5) return {
    level: "high",
    message: "Very few people are trading this market right now. Your order will move the price significantly — only trade what you're comfortable losing.",
  };
  if (priceImpact > 0.5) return {
    level: "low",
    message: "This market has moderate activity. Your trade may affect the price slightly.",
  };
  return { level: "none", message: "" };
}

function formatCurrency(amount: number, currency: "USD" | "NGN"): string {
  if (currency === "NGN") return `\u20a6${Math.round(amount).toLocaleString()}`;
  return `$${amount.toFixed(2)}`;
}

const QUICK_AMOUNTS = {
  USD: [10, 25, 50, 100],
  NGN: [500, 1000, 2500, 5000],
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QuoteDrawer({
  eventId,
  marketId,
  engine,
  onOrderConfirmed,
  onClose,
  currencyProp = "USD",
  aiProbability,
  yesOutcomeId,
  noOutcomeId,
  marketTitle,
}: QuoteDrawerProps) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [outcomeLabel, setOutcomeLabel] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState<string>(currencyProp === "NGN" ? "1000" : "25");
  const [currency] = useState<"USD" | "NGN">(currencyProp);

  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResponse | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  const debouncedAmount = useDebounce(amount, 400);

  const resolveOutcomeId = (label: "YES" | "NO") =>
    label === "YES" ? yesOutcomeId ?? "YES" : noOutcomeId ?? "NO";

  // ─── Quote Fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    const parsed = parseFloat(debouncedAmount);
    if (!parsed || parsed <= 0) { setQuote(null); return; }

    const controller = new AbortController();
    const fetchQuote = async () => {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const resolvedOutcome = resolveOutcomeId(outcomeLabel);
        if (resolvedOutcome === "YES" || resolvedOutcome === "NO") {
          setQuoteError("Market data still loading. Please wait a moment and try again.");
          setQuoteLoading(false);
          return;
        }

        const body: Record<string, unknown> = {
          side, outcome: resolvedOutcome, amount: parsed, currency,
          ...(engine === "CLOB" ? { price: 0.5 } : {}),
        };

        const { data } = await axios.post<QuoteResponse>(
          `/api/bayse/events/${eventId}/markets/${marketId}/quote`,
          body, { signal: controller.signal }
        );
        setQuote(data);
      } catch (err: unknown) {
        if (axios.isCancel(err)) return;
        const msg = axios.isAxiosError(err)
          ? err.response?.data?.message ?? err.message
          : "Could not get a price quote right now.";
        setQuoteError(
          msg.toLowerCase().includes("liquidity") ? "Not enough market activity for this order size. Try a smaller amount." :
          msg.toLowerCase().includes("failed to reach") || msg.toLowerCase().includes("timeout") ? "Connection issue. Please try again in a moment." :
          "Could not get a price quote. Please try again."
        );
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    };

    fetchQuote();
    return () => controller.abort();
  }, [debouncedAmount, side, outcomeLabel, currency, engine, eventId, marketId]);

  // ─── Order Placement ─────────────────────────────────────────────────────────

  const placeOrder = async () => {
    if (!quote) return;
    setOrdering(true);
    setOrderError(null);
    try {
      const resolvedOutcome = resolveOutcomeId(outcomeLabel);
      if (resolvedOutcome === "YES" || resolvedOutcome === "NO") {
        setOrderError("Market data not ready. Please refresh and try again.");
        return;
      }
      const { data } = await axios.post<OrderResponse>(
        `/api/bayse/events/${eventId}/markets/${marketId}/orders`,
        { side, outcome: resolvedOutcome, amount: parseFloat(amount), currency,
          ...(engine === "CLOB" ? { price: 0.5, timeInForce: "GTC" } : {}) }
      );
      setOrderResult(data);
      onOrderConfirmed?.(data.id);
    } catch {
      setOrderError("Order could not be placed. Please try again.");
    } finally {
      setOrdering(false);
    }
  };

  // ─── Derived Display Values ──────────────────────────────────────────────────

  // Real payout from the live AMM quote (accounts for price impact)
  const payout = quote ? quote.quantity * quote.currencyBaseMultiplier : 0;
  const profit = quote ? payout - quote.amount : 0;

  // Theoretical payout at current odds (what Bayse displays — no price impact)
  const theoreticalPayout = quote ? quote.amount / quote.currentMarketPrice : 0;
  // Only show the "quiet market" context when the gap is significant
  const isQuietMarket = (quote?.priceImpactAbsolute ?? 0) > 5;

  const liquidityWarning = quote ? getLiquidityWarning(quote.priceImpactAbsolute) : { level: "none", message: "" };
  const chanceLabel = outcomeLabel === "YES"
    ? `${((quote?.currentMarketPrice ?? 0) * 100).toFixed(0)}% chance`
    : `${(100 - (quote?.currentMarketPrice ?? 0) * 100).toFixed(0)}% chance`;

  // ─── Order Confirmed State ───────────────────────────────────────────────────

  if (orderResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
        <div className="relative z-10 w-full max-w-sm bg-[#0d1117] border border-white/10  p-8 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 l bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-white mb-1">Trade Placed!</p>
            <p className="text-sm text-slate-400">Your position is now live on Bayse.</p>
          </div>
          <div className="w-full bg-white/5 p-4 space-y-2 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Status</span>
              <span className="text-emerald-400 font-semibold capitalize">{orderResult.status.replace("_", " ")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Order ID</span>
              <span className="text-slate-300 font-mono text-xs truncate ml-4">{orderResult.id}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-full py-3 bg-white/10 hover:bg-white/15 text-white font-semibold transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Drawer ─────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-2xl bg-[#0d1117] border border-white/10 overflow-hidden max-h-[100vh] sm:max-h-[85vh] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Zap size={15} className="text-blue-400" fill="currentColor" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white text-sm leading-tight">Place a Trade</p>
              {marketTitle && (
                <p className="text-xs text-slate-500 truncate max-w-[240px] sm:max-w-[500px] mt-0.5">{marketTitle}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7  bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors shrink-0 ml-3"
          >
            <X size={14} className="text-slate-400" />
          </button>
        </div>

        {/* ── Two-column body ── */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-y-auto sm:overflow-hidden">

          {/* LEFT — Controls */}
          <div className="sm:w-[44%] px-5 py-5 space-y-5 sm:overflow-y-auto sm:border-r sm:border-white/5 shrink-0">

            {/* Outcome selector */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2.5">I think this will...</p>
              <div className="grid grid-cols-2 gap-2">
                {(["YES", "NO"] as const).map((label) => (
                  <button
                    key={label}
                    onClick={() => setOutcomeLabel(label)}
                    className={cn(
                      "py-3.5 font-bold text-sm flex items-center justify-center gap-2 transition-all",
                      outcomeLabel === label && label === "YES"
                        ? "bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                        : outcomeLabel === label && label === "NO"
                        ? "bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]"
                        : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {label === "YES"
                      ? <><TrendingUp size={14} /> Happen</>
                      : <><TrendingDown size={14} /> Not Happen</>
                    }
                  </button>
                ))}
              </div>
            </div>

            {/* Buy / Sell */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2.5">I want to...</p>
              <div className="grid grid-cols-2 gap-2">
                {(["BUY", "SELL"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    className={cn(
                      "py-3 font-bold text-sm flex items-center justify-center gap-2 transition-all",
                      side === s
                        ? "bg-blue-600 text-white shadow-[0_0_16px_rgba(37,99,235,0.25)]"
                        : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {s === "BUY"
                      ? <><ArrowUpRight size={14} /> Buy</>
                      : <><ArrowDownRight size={14} /> Sell</>
                    }
                  </button>
                ))}
              </div>
            </div>

            {/* Amount input */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2.5">
                How much? ({currency})
              </p>
              <div className="relative mb-3">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg select-none">
                  {currency === "NGN" ? "\u20a6" : "$"}
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 pl-9 pr-4 py-3.5 text-white font-bold text-xl focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all"
                  placeholder={currency === "NGN" ? "1000" : "25"}
                  min={currency === "NGN" ? 100 : 1}
                />
              </div>
              {/* Quick amount chips */}
              <div className="grid grid-cols-4 gap-1.5">
                {QUICK_AMOUNTS[currency].map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(String(q))}
                    className={cn(
                      "py-2 text-xs font-semibold transition-all",
                      amount === String(q)
                        ? "bg-blue-600/30 border border-blue-500/40 text-blue-300"
                        : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-transparent"
                    )}
                  >
                    {currency === "NGN" ? `\u20a6${q >= 1000 ? `${q / 1000}k` : q}` : `$${q}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — Quote result + actions */}
          <div className="sm:w-[56%] px-5 py-5 flex flex-col gap-4 sm:overflow-y-auto">

            {/* Quote card */}
            <div className={cn(
              " border transition-all duration-300 flex-1 flex flex-col",
              quoteLoading ? "border-white/5 bg-white/2" :
              liquidityWarning.level === "high" ? "border-orange-500/20 bg-orange-500/5" :
              quote ? "border-emerald-500/20 bg-emerald-500/5" :
              "border-white/5 bg-white/2"
            )}>

              {/* Loading */}
              {quoteLoading && (
                <div className="flex flex-col items-center justify-center gap-3 flex-1 min-h-[180px] text-slate-500">
                  <Loader2 size={22} className="animate-spin text-blue-500/60" />
                  <span className="text-sm">Getting your price...</span>
                </div>
              )}

              {/* Error */}
              {quoteError && !quoteLoading && (
                <div className="flex items-start gap-3 p-5 flex-1">
                  <AlertTriangle size={16} className="text-orange-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-orange-300 leading-relaxed">{quoteError}</p>
                </div>
              )}

              {/* Quote data */}
              {quote && !quoteLoading && (
                <div className="p-5 space-y-4 flex-1 flex flex-col">

                  {/* Liquidity warning */}
                  {liquidityWarning.level !== "none" && (
                    <div className={cn(
                      "flex items-start gap-2 p-3 text-xs leading-relaxed shrink-0",
                      liquidityWarning.level === "high"
                        ? "bg-orange-500/10 border border-orange-500/20 text-orange-300"
                        : "bg-yellow-500/10 border border-yellow-500/20 text-yellow-300"
                    )}>
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      {liquidityWarning.message}
                    </div>
                  )}

                  {/* Hero payout number */}
                  <div className="text-center py-3 flex-1 flex flex-col items-center justify-center">
                    <p className="text-xs text-slate-500 mb-1">If you&apos;re right, you get</p>
                    <p className={cn(
                      "text-5xl font-black tracking-tight leading-none",
                      profit > 0 ? "text-emerald-400" : "text-rose-400"
                    )}>
                      {formatCurrency(payout, currency)}
                    </p>
                    <p className={cn(
                      "text-sm font-semibold mt-2",
                      profit > 0 ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {profit > 0 ? "+" : ""}{formatCurrency(profit, currency)} profit
                    </p>

                    {/* Quiet market note */}
                    {isQuietMarket && (
                      <div className="mt-3 w-full px-3 py-2.5 bg-amber-500/8 border border-amber-500/15 text-left">
                        <p className="text-xs text-amber-300/80 leading-relaxed">
                          🔇 <span className="font-semibold text-amber-300">Quiet market</span> — not many people betting here yet, so your return is lower. In a busier market you&apos;d get about{" "}
                          <span className="font-bold text-white">{formatCurrency(Math.round(theoreticalPayout), currency)}</span>.
                          {" "}Try a smaller amount for a better rate.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-white/5 shrink-0" />

                  {/* Breakdown rows */}
                  <div className="space-y-2.5 shrink-0">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">You&apos;re paying</span>
                      <span className="text-sm font-bold text-white">{formatCurrency(quote.amount, currency)}</span>
                    </div>
                    {!quote.completeFill && (
                      <div className="px-3 py-2 bg-blue-500/8 border border-blue-500/15 text-[11px] text-blue-300/80 leading-relaxed">
                        <span className="font-semibold text-blue-400">Market Capacity Reached:</span> Bayse can only take <span className="font-bold text-white">{formatCurrency(quote.amount, currency)}</span> right now. You won&apos;t be charged for the rest.
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Current odds</span>
                      <span className="text-sm font-bold text-white">{chanceLabel}</span>
                    </div>
                    {aiProbability && (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <Zap size={11} className="text-blue-400" fill="currentColor" />
                          <span className="text-sm text-blue-400">AI thinks</span>
                        </div>
                        <span className="text-sm font-bold text-blue-400">
                          {(aiProbability * 100).toFixed(0)}% chance
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Max liability warning */}
                  {quote.tradeGoesOverMaxLiability && (
                    <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 shrink-0">
                      <AlertTriangle size={12} className="text-rose-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-rose-300">This trade exceeds the maximum allowed position size.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {!quote && !quoteLoading && !quoteError && (
                <div className="flex flex-col items-center justify-center gap-3 flex-1 min-h-[180px]">
                  <div className="w-12 h-12  bg-white/3 border border-white/5 flex items-center justify-center">
                    <Zap size={20} className="text-slate-600" />
                  </div>
                  <p className="text-slate-600 text-xs text-center leading-relaxed">
                    Enter an amount on the left<br className="hidden sm:block" />
                    <span className="sm:hidden"> </span>to see your potential return
                  </p>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 shrink-0 pb-1">
              <button
                onClick={onClose}
                disabled={ordering}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-semibold transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={placeOrder}
                disabled={!quote || quoteLoading || ordering || liquidityWarning.level === "high"}
                className={cn(
                  "flex-[2] py-4 font-bold text-white flex items-center justify-center gap-2 transition-all text-sm",
                  !quote || quoteLoading || ordering
                    ? "bg-white/10 text-slate-500 cursor-not-allowed"
                    : liquidityWarning.level === "high"
                    ? "bg-orange-500/20 text-orange-400 cursor-not-allowed"
                    : side === "BUY"
                    ? "bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                    : "bg-rose-600 hover:bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]"
                )}
              >
                {ordering ? (
                  <><Loader2 size={16} className="animate-spin" /> Placing trade...</>
                ) : liquidityWarning.level === "high" ? (
                  "Market too illiquid"
                ) : quote ? (
                  `${side === "BUY" ? "Buy" : "Sell"} for ${formatCurrency(quote.amount, currency)}${!quote.completeFill ? " (partial)" : ""}`
                ) : (
                  "Enter an amount first"
                )}
              </button>
            </div>

            {orderError && (
              <p className="text-center text-rose-400 text-xs -mt-2 pb-1">{orderError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}