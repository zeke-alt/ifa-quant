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
import { cn } from '@/lib/utils';


const SENTIMENT_CONFIG = {
  BULLISH: { icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/10', label: 'BULLISH' },
  BEARISH: { icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-500/10', label: 'BEARISH' },
  RISK_ALERT: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'RISK_ALERT' },
  NEUTRAL: { icon: Minus, color: 'text-muted-foreground', bg: 'bg-secondary', label: 'NEUTRAL' },
};


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
    actionColor = 'text-muted-foreground';
    actionBg = 'bg-secondary border-border';
    reasoning = `Mixed signals. The AI probability and data quality don't align strongly enough to justify a trade right now. Wait for the market to develop more clarity before entering.`;
  } else {
    action = 'AVOID ↓';
    actionColor = 'text-red-400';
    actionBg = 'bg-red-500/10 border-red-500/30';
    reasoning = `Weak or risky signal. ${signal.sentiment === 'RISK_ALERT' ? 'A RISK_ALERT sentiment was flagged — ' : ''}Low source reliability or poor historical accuracy makes this trade unfavorable. The downside risk outweighs potential gains.`;
  }

  return { score, action, actionColor, actionBg, reasoning };
}


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

      <div className="bg-card/50 backdrop-blur-sm border border-border rounded-3xl group transition-all duration-300 flex flex-col justify-between hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1">
        <div className="p-8">

          {/* ── Header ── */}
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${config.bg} border border-transparent group-hover:border-current/10 transition-colors`}>
                <SentimentIcon size={14} className={config.color} />
                <span className={`text-[10px] font-black tracking-wider ${config.color}`}>{config.label}</span>
              </div>
              <button
                onClick={() => toggleBookmark(signal.marketId)}
                className={`p-2 rounded-xl border transition-all ${
                  bookmarked 
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' 
                    : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                }`}
                title={bookmarked ? "Remove bookmark" : "Add bookmark"}
              >
                <Bookmark size={14} fill={bookmarked ? "currentColor" : "none"} />
              </button>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-1 opacity-80">AI Prediction</div>
              <div className="text-3xl font-black text-foreground font-mono tracking-tighter">{prob}%</div>
              <div className="text-[10px] text-muted-foreground font-mono mt-1 font-bold">
                COST: {currency === 'NGN' ? '₦' : '$'}{(Number(signal.yesProbability) * (currency === 'NGN' ? 100 : 1)).toFixed(2)}
              </div>
            </div>
          </div>

          {/* ── Event context + headline ── */}
          <div className="flex flex-col gap-2 mb-6">
            <div className="flex items-center gap-2">
              <div className="bg-secondary px-2 py-1 rounded-lg text-[9px] font-black text-muted-foreground uppercase tracking-widest border border-border">
                {signal.eventTitle}
              </div>
              <span className="text-[9px] font-mono text-muted-foreground/60 uppercase font-bold">{signal.category}</span>
            </div>

            <h3 className="text-foreground font-black text-xl leading-[1.1] tracking-tight group-hover:text-primary transition-colors">
              {signal.headline}
            </h3>

            <p className="text-muted-foreground text-xs italic opacity-80 font-medium">
              {signal.marketTitle}
            </p>
          </div>

          {/* ── Divergence chart ── */}
          <div className="border border-border rounded-2xl p-5 bg-background/50 mb-6">
            <div className="flex justify-between text-[10px] font-mono mb-3">
              <div className="flex items-center gap-1.5 text-primary font-bold">
                <Target size={14} /> AI_FAIR_VALUE
              </div>
              <div className="text-muted-foreground opacity-60 font-bold">MARKET_SENTIMENT</div>
            </div>
            <DivergenceLine
              aiProb={probability * 100}
              eventId={signal.eventId}
              marketId={signal.marketId}
              marketPrice={signal.yesProbability * 100}
            />
          </div>

          {/* ── Reliability stats ── */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { label: 'CONFIDENCE', value: signal.source_reliability },
              { label: 'ACCURACY', value: signal.historical_accuracy },
            ].map(({ label, value }) => (
              <div key={label} className="bg-secondary/50 rounded-2xl p-3 border border-border/50">
                <div className="text-[9px] font-black text-muted-foreground mb-1.5 tracking-wider uppercase">{label}</div>
                <div className="text-sm font-black text-foreground font-mono">{(value * 100).toFixed(0)}%</div>
                <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-1000"
                    style={{ width: `${value * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* ── Momentum + direction + trade score ── */}
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="text-[10px] font-mono text-muted-foreground font-bold">
              MOMENTUM: <span className={cn("font-black", momentumColor)}>{momentumLabel}</span>
            </div>
            <div className={cn("text-[10px] font-black font-mono", directionColor)}>
              {directionLabel}
            </div>
            <div className={cn("px-2 py-1 rounded-lg border text-[10px] font-black font-mono", actionBg, actionColor)}>
              {action}
            </div>
          </div>

          {/* ── Trade button + breakdown toggle ── */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowQuote(true)}
              className={cn(
                "flex-1 flex items-center justify-center gap-3",
                "px-6 py-4 rounded-2xl text-xs font-black transition-all",
                "relative overflow-hidden group/btn shadow-xl shadow-primary/10",
                isActionable
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  : 'bg-secondary hover:bg-muted text-muted-foreground border border-border'
              )}
            >
              {isActionable && (
                <span className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none" />
              )}
              <Zap size={14} className={isActionable ? "animate-pulse" : ""} />
              EXECUTE_TRADE
            </button>

            {/* Breakdown toggle */}
            <button
              onClick={() => setExpanded(prev => !prev)}
              className="p-4 rounded-2xl border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-all shadow-sm"
              title="View reasoning"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* ── Expanded breakdown panel ── */}
        {expanded && (
          <div className="border-t border-border px-8 py-6 space-y-6 bg-secondary/20">

            {/* Score bar */}
            <div>
              <div className="flex justify-between text-[10px] font-black text-muted-foreground mb-2 uppercase tracking-widest">
                <span>TRADE_SCORE_INDEX</span>
                <span className={cn("font-black", actionColor)}>{score.toFixed(0)} / 100</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-1000", 
                    score >= 75 ? 'bg-green-500'
                    : score >= 58 ? 'bg-blue-500'
                      : score >= 42 ? 'bg-muted-foreground/40'
                        : 'bg-red-500'
                  )}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>

            {/* Recommendation reasoning */}
            <div className="bg-background/50 p-4 rounded-2xl border border-border">
              <div className="text-[10px] font-black text-muted-foreground mb-2 uppercase tracking-widest">RECOMMENDATION</div>
              <p className="text-xs text-foreground/80 leading-relaxed font-medium">{reasoning}</p>
            </div>

            {/* Gemini's raw logic */}
            <div>
              <div className="text-[10px] font-black text-muted-foreground mb-2 uppercase tracking-widest">AI_ANALYSIS_LOGIC</div>
              <LogicText text={signal.logic} />
            </div>

            {/* Fallback external link for power users */}
            <a
              href={`https://app.bayse.markets/market/${signal.eventId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[10px] font-black text-primary hover:underline transition-all"
            >
              Open Raw Data on Bayse <ArrowRight size={12} />
            </a>
          </div>
        )}
      </div>
    </>
  );
}