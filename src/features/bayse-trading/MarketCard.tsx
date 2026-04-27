"use client";
import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Minus,
  ChevronDown,
  ChevronUp,
  Target,
  X,
  Zap,
  Bookmark,
} from 'lucide-react';
import { MacroSignal } from '@/types/macro';
import DivergenceLine from '@/components/charts/DivergenceLine';
import QuoteDrawer from '@/components/ui/QuoteDrawer';
import { useBookmarks } from '@/hooks/useBookmarks';

// ── Sentiment config ────────────────────────────────────────────────────────
const SENTIMENT_CONFIG = {
  BULLISH: { icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/10', label: 'BULLISH' },
  BEARISH: { icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-500/10', label: 'BEARISH' },
  RISK_ALERT: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'RISK_ALERT' },
  NEUTRAL: { icon: Minus, color: 'text-slate-400', bg: 'bg-slate-500/10', label: 'NEUTRAL' },
};

// ── Trade score engine ──────────────────────────────────────────────────────
/**
 * computeTradeScore
 * -----------------
 * Combines probability, source reliability, historical accuracy, and sentiment
 * into a single 0–100 score, then maps it to a human-readable action label.
 *
 * Weighting rationale:
 * - Probability (40%):         the AI's core directional conviction
 * - Source reliability (30%):  how trustworthy the underlying data is
 * - Historical accuracy (30%): how often this signal type has been right before
 *
 * Sentiment modifier:
 * - BULLISH/BEARISH: no penalty (clear direction)
 * - NEUTRAL:         slight penalty (-5)  — unclear direction reduces confidence
 * - RISK_ALERT:      stronger penalty (-15) — flag for user caution
 */
function computeTradeScore(signal: MacroSignal) {
  // Guard against Gemini returning strings instead of numbers
  const probability = Number(signal.probability);
  const source_reliability = Number(signal.source_reliability);
  const historical_accuracy = Number(signal.historical_accuracy);

  const sentimentModifier =
    signal.sentiment === 'RISK_ALERT' ? -15
      : signal.sentiment === 'NEUTRAL' ? -5
        : signal.sentiment === 'BEARISH' ? -10
          : 0;

  const score = Math.min(100, Math.max(0,
    (probability * 0.4 + source_reliability * 0.3 + historical_accuracy * 0.3) * 100
    + sentimentModifier
  ));

  let action: string;
  let actionColor: string;
  let actionBg: string;
  let reasoning: string;

  if (score >= 75) {
    action = 'STRONG BUY ↑';
    actionColor = 'text-green-400';
    actionBg = 'bg-green-500/10 border-green-500/30';
    reasoning = `High confidence signal. AI probability is ${(probability * 100).toFixed(0)}%, backed by a ${(source_reliability * 100).toFixed(0)}% reliable source with ${(historical_accuracy * 100).toFixed(0)}% historical accuracy. Risk is low — conditions strongly favor a YES outcome.`;
  } else if (score >= 58) {
    action = 'BUY ↑';
    actionColor = 'text-blue-400';
    actionBg = 'bg-blue-500/10 border-blue-500/30';
    reasoning = `Moderate confidence. The signal leans positive but has some uncertainty — either the source isn't fully reliable or historical accuracy is mixed. Consider a smaller position size.`;
  } else if (score >= 42) {
    action = 'HOLD';
    actionColor = 'text-slate-400';
    actionBg = 'bg-slate-500/10 border-slate-500/30';
    reasoning = `Mixed signals. The AI probability and data quality don't align strongly enough to justify a trade right now. Wait for the market to develop more clarity before entering.`;
  } else {
    action = 'AVOID ↓';
    actionColor = 'text-red-400';
    actionBg = 'bg-red-500/10 border-red-500/30';
    reasoning = `Weak or risky signal. ${signal.sentiment === 'RISK_ALERT' ? 'A RISK_ALERT sentiment was flagged — ' : ''}Low source reliability or poor historical accuracy makes this trade unfavorable. The downside risk outweighs potential gains.`;
  }

  return { score, action, actionColor, actionBg, reasoning };
}

// ── LogicText ───────────────────────────────────────────────────────────────
function LogicText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <p className={`text-[11px] text-slate-500 leading-relaxed ${!expanded ? 'line-clamp-4' : ''}`}>
        {text}
      </p>
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] text-orange-400 hover:text-orange-300 mt-1 transition-colors"
      >
        {expanded ? 'Show less ↑' : 'Read more ↓'}
      </button>
    </div>
  );
}

// ── QuoteModal ──────────────────────────────────────────────────────────────
/**
 * Wraps QuoteDrawer in a backdrop overlay.
 * Closes on backdrop click or Escape key.
 * Uses a portal-style fixed overlay so it sits above the card grid.
 */
function QuoteModal({
  signal,
  currency = 'USD',
  onClose,
}: {
  signal: MacroSignal;
  currency?: 'USD' | 'NGN';
  onClose: () => void;
}) {
  const [outcomeId, setOutcomeId] = useState<string | null>(null);
  const [loadingOutcome, setLoadingOutcome] = useState(true);

  // Close on Escape + lock body scroll
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  // Fetch real outcome IDs from Bayse on-demand
  useEffect(() => {
    let isMounted = true;

    async function resolveIds() {
      if (!signal) return;

      // 1. Check if they are already in the signal (cached)
      if (signal.yesOutcomeId && signal.noOutcomeId) {
        setOutcomeId(signal.direction === 'BUY_NO' ? signal.noOutcomeId : signal.yesOutcomeId);
        setLoadingOutcome(false);
        return;
      }

      // 2. Otherwise, fetch them now
      try {
        const res = await fetch(`/api/bayse/events/${signal.eventId}/markets/${signal.marketId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        
        // Handle various possible Bayse API response shapes
        const outcomes = data?.outcomes || data?.market?.outcomes || [];
        
        const yes = outcomes.find((o: any) => 
          o.name?.toLowerCase() === 'yes' || o.title?.toLowerCase() === 'yes'
        );
        const no = outcomes.find((o: any) => 
          o.name?.toLowerCase() === 'no' || o.title?.toLowerCase() === 'no'
        );

        if (isMounted) {
          if (yes?.id) signal.yesOutcomeId = yes.id;
          if (no?.id) signal.noOutcomeId = no.id;

          const activeId = signal.direction === 'BUY_NO' ? no?.id : yes?.id;
          setOutcomeId(activeId || (signal.direction === 'BUY_NO' ? 'NO' : 'YES'));
        }
      } catch (err) {
        console.error("Failed to fetch outcome IDs, falling back to defaults:", err);
        if (isMounted) {
          setOutcomeId(signal.direction === 'BUY_NO' ? 'NO' : 'YES');
        }
      } finally {
        if (isMounted) setLoadingOutcome(false);
      }
    }

    resolveIds();
    return () => { isMounted = false; };
  }, [signal]);

  const engine = (signal as MacroSignal & { engine?: 'AMM' | 'CLOB' }).engine ?? 'AMM';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div className="relative w-full max-w-[420px]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-mono"
        >
          ESC <X size={14} />
        </button>

        {loadingOutcome ? (
          <div className="text-slate-400 text-xs font-mono text-center p-6">
            Loading market data...
          </div>
        ) : (
          <QuoteDrawer
            eventId={signal.eventId}
            marketId={signal.marketId}
            defaultOutcome={outcomeId ?? 'YES'}
            yesOutcomeId={signal.yesOutcomeId}
            noOutcomeId={signal.noOutcomeId}
            engine={engine}
            currencyProp={currency}
            aiProbability={Number(signal.probability)}
            onOrderConfirmed={(_orderId) => onClose()}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

// ── MarketCard ──────────────────────────────────────────────────────────────
export default function MarketCard({ signal, currency = 'USD' }: { signal: MacroSignal, currency?: 'USD' | 'NGN' }) {
  const [expanded, setExpanded] = useState(false);
  // showQuote lives here, inside the component — not at module scope
  const [showQuote, setShowQuote] = useState(false);
  const { toggleBookmark, isBookmarked } = useBookmarks();

  const probability = Number(signal.probability);
  const prob = (probability * 100).toFixed(0);
  const sentiment = signal.sentiment ?? 'NEUTRAL';
  const config = SENTIMENT_CONFIG[sentiment] ?? SENTIMENT_CONFIG.NEUTRAL;
  const SentimentIcon = config.icon;
  const bookmarked = isBookmarked(signal.marketId);

  // Momentum derived from probability deviation from 0.5, weighted by signal quality
  const signalStrength = (signal.source_reliability + signal.historical_accuracy) / 2;
  const momentumValue = (signal.probability - 0.5) * signalStrength * 100;
  const momentumLabel =
    momentumValue > 3 ? `UPWARD +${momentumValue.toFixed(1)}%`
      : momentumValue < -3 ? `DOWNWARD ${momentumValue.toFixed(1)}%`
        : 'STABLE';
  const momentumColor =
    momentumValue > 3 ? 'text-green-500'
      : momentumValue < -3 ? 'text-red-500'
        : 'text-slate-400';

  // Trade recommendation
  const { score, action, actionColor, actionBg, reasoning } = computeTradeScore(signal);

  const direction = signal.direction;
  const directionLabel =
    direction === 'BUY_YES' ? 'BUY ↑'
      : direction === 'BUY_NO' ? 'BUY ↓'
        : 'HOLD';
  const directionColor =
    direction === 'BUY_YES' ? 'text-green-500'
      : direction === 'BUY_NO' ? 'text-red-500'
        : 'text-slate-400';

  // Whether the trade score is actionable (not HOLD or AVOID)
  const isActionable = score >= 58;

  return (
    <>
      {/* ── Quote modal (rendered outside card in DOM order) */}
      {showQuote && (
        <QuoteModal
          signal={signal}
          currency={currency}
          onClose={() => setShowQuote(false)}
        />
      )}

      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl group transition-all flex flex-col justify-between hover:border-blue-500/40 hover:scale-[1.02]">
        <div className="p-6">

          {/* ── Header ── */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${config.bg}`}>
                <SentimentIcon size={12} className={config.color} />
                <span className={`text-[9px] font-mono font-bold ${config.color}`}>{config.label}</span>
              </div>
              <button
                onClick={() => toggleBookmark(signal.marketId)}
                className={`p-1.5 rounded-lg border transition-all ${
                  bookmarked 
                    ? 'bg-blue-600/20 border-blue-500/50 text-blue-400' 
                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                }`}
                title={bookmarked ? "Remove bookmark" : "Add bookmark"}
              >
                <Bookmark size={12} fill={bookmarked ? "currentColor" : "none"} />
              </button>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500 font-mono uppercase tracking-tighter">AI Prediction</div>
              <div className="text-xl font-bold text-white font-mono">{prob}%</div>
              <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                COST: {currency === 'NGN' ? '₦' : '$'}{(Number(signal.yesProbability) * (currency === 'NGN' ? 100 : 1)).toFixed(2)} / SHARE
              </div>
            </div>
          </div>

          {/* ── Event context + headline ── */}
          <div className="flex flex-col gap-1 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-slate-800 px-1.5 py-0.5 rounded text-[8px] font-mono text-slate-400 uppercase tracking-widest border border-slate-700">
                {signal.eventTitle}
              </div>
              <span className="text-[9px] font-mono text-slate-600 uppercase">{signal.category}</span>
            </div>

            <h3 className="text-white font-bold text-lg leading-tight group-hover:text-blue-400 transition-colors">
              {signal.headline}
            </h3>

            <p className="text-slate-500 text-[11px] italic mt-1">
              {signal.marketTitle}
            </p>
          </div>

          {/* ── Divergence chart ── */}
          <div className="border border-slate-800 rounded-xl p-4 bg-slate-950 mb-4">
            <div className="flex justify-between text-[10px] font-mono mb-2">
              <div className="flex items-center gap-1.5 text-blue-500">
                <Target size={12} /> AI_FAIR_VALUE
              </div>
              <div className="text-slate-500 opacity-60">MARKET_SENTIMENT</div>
            </div>
            <DivergenceLine
              aiProb={probability * 100}
              eventId={signal.eventId}
              marketId={signal.marketId}
              marketPrice={signal.yesProbability * 100}
            />
          </div>

          {/* ── Reliability stats ── */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { label: 'ANALYSIS_CONFIDENCE', value: signal.source_reliability },
              { label: 'HIST_ACCURACY', value: signal.historical_accuracy },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-950 rounded-lg p-2">
                <div className="text-[9px] font-mono text-slate-500 mb-1">{label}</div>
                <div className="text-[11px] font-mono text-white">{(value * 100).toFixed(0)}%</div>
                <div className="mt-1 h-0.5 bg-slate-800 rounded-full">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${value * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* ── Momentum + direction + trade score ── */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-mono text-slate-500">
              MOMENTUM: <span className={momentumColor}>{momentumLabel}</span>
            </div>
            <div className={`text-[10px] font-mono ${directionColor}`}>
              {directionLabel}
            </div>
            <div className={`px-2 py-1 rounded-lg border text-[9px] font-mono font-bold ${actionBg} ${actionColor}`}>
              {action}
            </div>
          </div>

          {/* ── Trade button + breakdown toggle ── */}
          <div className="flex items-center gap-2">
            {/*
             * PRIMARY CTA — now opens QuoteDrawer instead of navigating to Bayse.
             * The external link is demoted to a small fallback inside the expanded
             * panel for users who prefer the full Bayse interface.
             *
             * Pulse ring on the button when score is actionable — draws the eye.
             */}
            <button
              onClick={() => setShowQuote(true)}
              className={`
                flex-1 flex items-center justify-center gap-2
                px-4 py-2 rounded-xl text-xs font-bold transition-all
                relative
                ${isActionable
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }
              `}
            >
              {/* Pulse ring — only when actionable */}
              {isActionable && (
                <span className="absolute inset-0 rounded-xl bg-blue-600 opacity-20 pointer-events-none" />
              )}
              <Zap size={13} />
              Quick trade
            </button>

            {/* Breakdown toggle */}
            <button
              onClick={() => setExpanded(prev => !prev)}
              className="p-2 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white transition"
              title="View reasoning"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* ── Expanded breakdown panel ── */}
        {expanded && (
          <div className="border-t border-slate-800 px-6 py-4 space-y-4">

            {/* Score bar */}
            <div>
              <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1">
                <span>TRADE_SCORE</span>
                <span className={actionColor}>{score.toFixed(0)} / 100</span>
              </div>
              <div className="h-1 bg-slate-800 rounded-full">
                <div
                  className={`h-full rounded-full transition-all ${score >= 75 ? 'bg-green-500'
                    : score >= 58 ? 'bg-blue-500'
                      : score >= 42 ? 'bg-slate-400'
                        : 'bg-red-500'
                    }`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>

            {/* Fee efficiency */}
            <div>
              <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1">
                <span>TRADING_FEE_EFFICIENCY</span>
                <span className="text-white">
                  {(
                    (signal.feeRate || 0.1) *
                    Math.max(1 - (sentiment === 'BEARISH' ? 1 - signal.yesProbability : signal.yesProbability), 0.5) *
                    100
                  ).toFixed(1)}%
                </span>
              </div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500/50"
                  style={{
                    width: `${(signal.feeRate
                      ? signal.feeRate * Math.max(1 - signal.yesProbability, 0.5) * 100
                      : 5.0) * 10}%`
                  }}
                />
              </div>
              <p className="text-[9px] text-slate-500 mt-1 italic">
                Variance-based fee: lower at extreme probabilities, higher near 0.50.
              </p>
            </div>

            {/* Recommendation reasoning */}
            <div>
              <div className="text-[9px] font-mono text-slate-500 mb-1">RECOMMENDATION</div>
              <p className="text-[11px] text-slate-300 leading-relaxed">{reasoning}</p>
            </div>

            {/* Gemini's raw logic */}
            <div>
              <div className="text-[9px] font-mono text-slate-500 mb-1">AI_REASONING</div>
              <LogicText text={signal.logic} />
            </div>

            {/* Fallback external link for power users */}
            <a
              href={`https://app.bayse.markets/market/${signal.eventId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-mono text-slate-600 hover:text-slate-400 transition-colors"
            >
              Open on Bayse <ArrowRight size={10} />
            </a>
          </div>
        )}
      </div>
    </>
  );
}