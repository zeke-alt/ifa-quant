"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { 
  Zap, 
  X, 
  ChevronRight, 
  Info, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight,
  RefreshCcw,
  AlertTriangle
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuoteDrawerProps {
  eventId: string;
  marketId: string;
  /** The outcome string returned by Bayse, e.g. "YES" | "NO" */
  defaultOutcome?: string;
  /** "AMM" | "CLOB" — controls whether price field renders */
  engine: "AMM" | "CLOB";
  /** Called when user confirms the order */
  onOrderConfirmed?: (orderId: string) => void;
  /** Called when drawer closes without action */
  onClose?: () => void;
  /** External currency setting from the dashboard */
  currencyProp?: "USD" | "NGN";
  /** The AI's assessed probability for ROI projections */
  aiProbability?: number;
  /** Real Bayse IDs for outcomes */
  yesOutcomeId?: string;
  noOutcomeId?: string;
}

interface QuoteResponse {
  price: number;             // effective per-share price (AMM: includes fee; CLOB: limit price)
  currentMarketPrice: number;
  quantity: number;          // shares you receive
  costOfShares: number;      // gross cost before fee (CLOB buy) or same as amount (AMM)
  fee: number;               // 0 on AMM (embedded), explicit on CLOB
  amount: number;            // total you pay
  completeFill: boolean;     // CLOB only — false means partial liquidity
}

interface OrderResponse {
  id: string;
  status: "pending" | "open" | "partial_filled" | "filled" | "cancelled" | "rejected";
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Bayse fee formula: fee = feeRate × C × P × max(1 − P, 0.5)
// We surface this for educational context in the UI (not used for calculation —
// we always display the server-returned fee from the quote response).
const DEBOUNCE_MS = 400;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a number as USD with 2 decimal places */
const usd = (n: number) => `$${n.toFixed(2)}`;

/** Format a probability price as a percentage */
const pct = (p: number) => `${(p * 100).toFixed(1)}%`;

/** Round-trip: debounce quote fetches so we don't hammer the API on every keystroke */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuoteDrawer({
  eventId,
  marketId,
  defaultOutcome = "YES",
  engine,
  onOrderConfirmed,
  onClose,
  currencyProp = "USD",
  aiProbability,
  yesOutcomeId,
  noOutcomeId,
}: QuoteDrawerProps) {
  // ── Form state
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [outcome, setOutcome] = useState(defaultOutcome);
  const [amount, setAmount] = useState<string>("100");        // raw input string
  const [limitPrice, setLimitPrice] = useState<string>("0.65"); // CLOB only
  const [currency, setCurrency] = useState<"USD" | "NGN">(currencyProp);
  const [tif, setTif] = useState<"GTC" | "FAK" | "FOK">("GTC"); // CLOB time-in-force

  // ── Quote state
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // ── Order state
  const [ordering, setOrdering] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResponse | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Keep internal currency in sync with global setting if it changes
  useEffect(() => {
    setCurrency(currencyProp);
  }, [currencyProp]);

  // Debounce the amount input so we only fetch quotes after user stops typing
  const debouncedAmount = useDebounce(amount, DEBOUNCE_MS);
  const debouncedLimitPrice = useDebounce(limitPrice, DEBOUNCE_MS);

  // ── Auto-fetch quote whenever inputs settle
  useEffect(() => {
    const parsedAmount = parseFloat(debouncedAmount);
    if (!parsedAmount || parsedAmount <= 0) {
      setQuote(null);
      return;
    }

    const controller = new AbortController();

    const fetchQuote = async () => {
      setQuoteLoading(true);
      setQuoteError(null);

      try {
        // POST to our internal Next.js API route, which signs the request
        // with HMAC-SHA256 and forwards to Bayse.
        // Route: /api/bayse/events/[eventId]/markets/[marketId]/quote
        const body: Record<string, unknown> = {
          side,
          outcome,
          amount: parsedAmount,
          currency,
        };

        // CLOB markets need a limit price
        if (engine === "CLOB") {
          body.price = parseFloat(debouncedLimitPrice);
        }

        const { data } = await axios.post<QuoteResponse>(
          `/api/bayse/events/${eventId}/markets/${marketId}/quote`,
          body,
          { signal: controller.signal }
        );

        setQuote(data);
      } catch (err: unknown) {
        if (axios.isCancel(err)) return; // stale request, ignore
        const msg =
          axios.isAxiosError(err)
            ? err.response?.data?.message ?? err.message
            : "Failed to fetch quote";
        setQuoteError(msg);
        setQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    };

    fetchQuote();
    return () => controller.abort(); // cancel in-flight request on next render
  }, [debouncedAmount, debouncedLimitPrice, side, outcome, currency, engine, eventId, marketId]);

  // ── Place order — only called after user reviews quote
  const placeOrder = async () => {
    if (!quote) return;
    setOrdering(true);
    setOrderError(null);

    try {
      const body: Record<string, unknown> = {
        side,
        outcome,
        amount: parseFloat(amount),
        currency,
      };

      if (engine === "CLOB") {
        body.price = parseFloat(limitPrice);
        body.timeInForce = tif;
      }

      const { data } = await axios.post<OrderResponse>(
        `/api/bayse/events/${eventId}/markets/${marketId}/orders`,
        body
      );

      setOrderResult(data);
      onOrderConfirmed?.(data.id);
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err)
          ? err.response?.data?.message ?? err.message
          : "Order failed";
      setOrderError(msg);
    } finally {
      setOrdering(false);
    }
  };

  // ── Derived display values
  const currencySymbol = currency === "USD" ? "$" : "₦";
  // For NGN, base multiplier is 100 — so ₦100 = $1
  const displayAmount = currency === "NGN"
    ? `₦${parseFloat(amount || "0").toLocaleString()}`
    : usd(parseFloat(amount || "0"));

  const showFee = quote && quote.fee > 0; // AMM has fee=0 (embedded in price)
  const feeNote =
    engine === "AMM"
      ? "Fee is embedded in the execution price above."
      : `${currencySymbol}${quote?.fee.toFixed(2) ?? "—"} deducted from shares received`;

  const priceImpact =
    quote && quote.currentMarketPrice
      ? ((quote.price - quote.currentMarketPrice) / quote.currentMarketPrice) * 100
      : null;

  // ─── Render ────────────────────────────────────────────────────────────────

  // If order succeeded, show confirmation state
  if (orderResult) {
    return (
      <div className="quote-drawer quote-drawer--confirmed">
        <div className="qd-confirm-icon">
          <CheckCircle2 size={32} />
        </div>
        <p className="qd-confirm-title">Order Executed</p>
        <p className="qd-confirm-sub">
          The order has been broadcast to the Bayse network.
        </p>
        
        <div className="w-full bg-black/20 border border-white/5 rounded-lg p-3 my-2 space-y-2">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-slate-500 uppercase">Status</span>
            <span className="qd-status-badge">{orderResult.status}</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-slate-500 uppercase">Order ID</span>
            <span className="text-slate-300 truncate ml-4">{orderResult.id}</span>
          </div>
        </div>

        <button className="qd-btn qd-btn--secondary w-full" onClick={onClose}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="quote-drawer">
      {/* ── Header */}
      <div className="qd-header">
        <Zap size={14} className="text-blue-400" />
        <span className="qd-header-title">Trade Intelligence</span>
        <span className={`qd-engine-badge qd-engine-badge--${engine.toLowerCase()}`}>
          {engine}
        </span>
        <button className="qd-close" onClick={onClose} aria-label="Close">
          <X size={12} />
        </button>
      </div>

      {/* ── Side + Outcome selectors */}
      <div className="qd-row">
        <div className="qd-field qd-field--half">
          <label className="qd-label">Side</label>
          <div className="qd-toggle-group">
            {(["BUY", "SELL"] as const).map((s) => (
              <button
                key={s}
                className={`qd-toggle ${side === s ? `qd-toggle--active qd-toggle--${s.toLowerCase()}` : ""}`}
                onClick={() => setSide(s)}
              >
                <div className="flex items-center justify-center gap-1.5">
                  {s === "BUY" ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                  {s}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="qd-field qd-field--half">
          <label className="qd-label">Outcome</label>
          <div className="qd-toggle-group">
            {[
              { label: "YES", id: yesOutcomeId ?? "YES" },
              { label: "NO", id: noOutcomeId ?? "NO" },
            ].map((o) => (
              <button
                key={o.label}
                className={`qd-toggle ${outcome === o.id ? "qd-toggle--active" : ""}`}
                onClick={() => setOutcome(o.id)}
              >
                <div className="flex items-center justify-center gap-1.5">
                  {o.label === "YES" ? (
                    <ArrowUpRight size={10} />
                  ) : (
                    <ArrowDownRight size={10} />
                  )}
                  {o.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Currency selector */}
      <div className="qd-field">
        <label className="qd-label">Currency</label>
        <div className="qd-toggle-group">
          {(["USD", "NGN"] as const).map((c) => (
            <button
              key={c}
              className={`qd-toggle ${currency === c ? "qd-toggle--active" : ""}`}
              onClick={() => setCurrency(c)}
            >
              {c === "USD" ? "$ USD" : "₦ NGN"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Amount input */}
      <div className="qd-field">
        <label className="qd-label" htmlFor="qd-amount">
          Amount ({currency})
        </label>
        <div className="qd-input-wrap">
          <span className="qd-input-prefix">{currencySymbol}</span>
          <input
            id="qd-amount"
            className="qd-input"
            type="number"
            min={currency === "NGN" ? 100 : 1}
            step={currency === "NGN" ? 100 : 1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={currency === "NGN" ? "e.g. 5000" : "e.g. 100"}
          />
        </div>
      </div>

      {/* ── CLOB-only: limit price + time-in-force */}
      {engine === "CLOB" && (
        <>
          <div className="qd-field">
            <label className="qd-label" htmlFor="qd-price">
              Limit price (0–1)
            </label>
            <div className="qd-input-wrap">
              <input
                id="qd-price"
                className="qd-input"
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder="0.65"
              />
              <span className="qd-input-suffix">
                ≈ {pct(parseFloat(limitPrice || "0"))}
              </span>
            </div>
          </div>

          <div className="qd-field">
            <label className="qd-label">Time-in-force</label>
            <div className="qd-toggle-group">
              {(["GTC", "FAK", "FOK"] as const).map((t) => (
                <button
                  key={t}
                  className={`qd-toggle ${tif === t ? "qd-toggle--active" : ""}`}
                  onClick={() => setTif(t)}
                  title={
                    t === "GTC" ? "Good Till Cancel"
                    : t === "FAK" ? "Fill and Kill"
                    : "Fill or Kill"
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Quote preview panel */}
      <div className={`qd-quote-panel ${quoteLoading ? "qd-quote-panel--loading" : ""} ${quote ? "qd-quote-panel--ready" : ""}`}>
        {quoteLoading && (
          <div className="qd-quote-skeleton">
            <span className="qd-loader" />
            <span className="qd-quote-hint">Fetching quote…</span>
          </div>
        )}

        {quoteError && !quoteLoading && (
          <div className="qd-quote-error">
            <span className="qd-error-icon">⚠</span> {quoteError}
          </div>
        )}

        {quote && !quoteLoading && (
          <>
            <div className="qd-quote-row">
              <span className="qd-quote-label">
                <Info size={10} className="opacity-50" /> Execution price
              </span>
              <span className="qd-quote-value">
                {pct(quote.price)}
                {priceImpact !== null && Math.abs(priceImpact) > 0.1 && (
                  <span className={`qd-impact ${priceImpact > 0 ? "qd-impact--pos" : "qd-impact--neg"}`}>
                    {priceImpact > 0 ? "+" : ""}{priceImpact.toFixed(2)}%
                  </span>
                )}
              </span>
            </div>

            <div className="qd-quote-row">
              <span className="qd-quote-label">Market price</span>
              <span className="qd-quote-value qd-quote-value--muted">
                {pct(quote.currentMarketPrice)}
              </span>
            </div>

            <div className="qd-quote-row">
              <span className="qd-quote-label">Shares received</span>
              <span className="qd-quote-value">{quote.quantity.toFixed(2)}</span>
            </div>

            {/* Fee row — explicit for CLOB, note for AMM */}
            <div className="qd-quote-row qd-quote-row--fee">
              <span className="qd-quote-label">
                Trading fee
                {engine === "AMM" && (
                  <span className="qd-badge qd-badge--info">embedded</span>
                )}
              </span>
              <span className="qd-quote-value qd-quote-value--fee">
                {engine === "CLOB" && quote.fee > 0
                  ? `${currencySymbol}${quote.fee.toFixed(2)}`
                  : "—"}
              </span>
            </div>

            <div className="qd-quote-divider" />

            <div className="qd-quote-row qd-quote-row--total">
              <span className="qd-quote-label qd-quote-label--total">
                Total cost
              </span>
              <span className="qd-quote-value qd-quote-value--total">
                {currencySymbol}{quote.amount.toFixed(currency === "NGN" ? 0 : 2)}
              </span>
            </div>
            
            {/* Projected Alpha — linked to AI Prediction */}
            {quote && aiProbability && (
              <div className="mt-4 p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap size={10} /> Projected Alpha
                  </span>
                  <span className="text-[10px] font-mono text-white bg-blue-600 px-1.5 py-0.5 rounded">
                    AI: {(aiProbability * 100).toFixed(0)}%
                  </span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Payout if Correct</span>
                    <span className="text-white font-mono">
                      {currencySymbol}{((quote.quantity) * (currency === "NGN" ? 100 : 1)).toFixed(currency === "NGN" ? 0 : 2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Net Profit (Est.)</span>
                    <span className="text-green-400 font-mono">
                      +{currencySymbol}{( ((quote.quantity) * (currency === "NGN" ? 100 : 1)) - quote.amount ).toFixed(currency === "NGN" ? 0 : 2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] pt-1 border-t border-blue-500/10 mt-1">
                    <span className="text-blue-300 font-bold">Projected ROI</span>
                    <span className="text-blue-300 font-bold font-mono">
                      {(( ( ((quote.quantity) * (currency === "NGN" ? 100 : 1)) - quote.amount ) / quote.amount ) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {engine === "AMM" && (
              <p className="qd-fee-note">{feeNote}</p>
            )}

            {/* CLOB partial fill warning */}
            {engine === "CLOB" && !quote.completeFill && (
              <div className="qd-warn">
                ⚠ Only partial liquidity available at this price. Unfilled portion depends on your TIF setting.
              </div>
            )}
          </>
        )}

        {!quote && !quoteLoading && !quoteError && (
          <p className="qd-quote-hint">Enter an amount to preview your order.</p>
        )}
      </div>

      {/* ── Action buttons */}
      <div className="qd-actions">
        <button
          className="qd-btn qd-btn--secondary"
          onClick={onClose}
          disabled={ordering}
        >
          Cancel
        </button>
        <button
          className={`qd-btn qd-btn--primary qd-btn--${side.toLowerCase()}`}
          onClick={placeOrder}
          disabled={!quote || quoteLoading || ordering}
        >
          {ordering
            ? "Placing…"
            : quote
            ? `${side} · ${currencySymbol}${parseFloat(amount || "0").toLocaleString()}`
            : "Get quote first"}
        </button>
      </div>

      {orderError && (
        <div className="qd-order-error">⚠ {orderError}</div>
      )}
    </div>
  );
}
