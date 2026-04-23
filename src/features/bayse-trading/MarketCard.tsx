"use client";
import React, { useState } from 'react';
import {
  ArrowRight,
  Loader2,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Minus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { MacroSignal } from '@/types/macro';
import DivergenceLine from '@/components/charts/DivergenceLine';
import { executeTrade } from '@/lib/actions';

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
 * - Probability (40%):        the AI's core directional conviction
 * - Source reliability (30%): how trustworthy the underlying data is
 * - Historical accuracy (30%): how often this signal type has been right before
 *
 * Sentiment modifier:
 * - BULLISH/BEARISH: no penalty (clear direction)
 * - NEUTRAL:         slight penalty (-5) — unclear direction reduces confidence
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
    (probability * 0.4 +
      source_reliability * 0.3 +
      historical_accuracy * 0.3) * 100
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

// ── Component ───────────────────────────────────────────────────────────────
export default function MarketCard({ signal }: { signal: MacroSignal }) {
  const [loading, setLoading] = useState(false);

  /**
   * Controls the "fuller breakdown" panel below the card.
   * Collapsed by default — user expands it for more context.
   */
  const [expanded, setExpanded] = useState(false);

  const probability = Number(signal.probability);
  const prob = (probability * 100).toFixed(0);
  const sentiment = signal.sentiment ?? 'NEUTRAL';
  const config = SENTIMENT_CONFIG[sentiment] ?? SENTIMENT_CONFIG.NEUTRAL;
  const SentimentIcon = config.icon;

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

  /**
   * Derived "market price" — an approximation of where the crowd
   * is pricing this outcome, separate from Gemini's fair value.
   *
   * Formula: blend of probability and a reliability-adjusted offset.
   * - High reliability (0.9): market price ≈ AI probability (crowd agrees)
   * - Low reliability (0.1):  market price drifts further from AI probability
   */

  // Trade recommendation
  const { score, action, actionColor, actionBg, reasoning } = computeTradeScore(signal);

  const tradeUrl = (() => {
    const base = `https://app.bayse.markets/market/${signal.eventId}`;
    if (signal.sentiment === 'BULLISH') return `${base}?outcome=YES&tradeType=BUY`;
    if (signal.sentiment === 'BEARISH') return `${base}?outcome=NO&tradeType=BUY`;
    return base;
  })();

  const direction = signal.direction;
  const directionLabel =
    direction === 'BUY_YES' ? `BUY ↑`
      : direction === 'BUY_NO' ? `BUY ↓`
        : 'HOLD';
  const directionColor =
    direction === 'BUY_YES' ? 'text-green-500'
      : direction === 'BUY_NO' ? 'text-red-500'
        : 'text-slate-400';

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl group transition-all hover:border-blue-500/40">
      <div className="p-6">

        {/* ── Header ── */}
        <div className="flex justify-between items-start mb-6">
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${config.bg}`}>
            <SentimentIcon size={12} className={config.color} />
            <span className={`text-[9px] font-mono font-bold ${config.color}`}>{config.label}</span>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-500 font-mono uppercase tracking-tighter">AI Prediction</div>
            <div className="text-xl font-bold text-white font-mono">{prob}%</div>
          </div>
        </div>


        <div className="flex flex-col gap-2 h-30 mb-4">
          {/* Headline */}
          <h3 className="text-white font-bold text-lg overflow-hidden">
            {signal.market_question}
          </h3>

          {/* ── Market Question ── */}
          <h4 className="text-slate-500 opacity-80 text-sm overflow-hidden">
            {signal.headline}
          </h4>
        </div>

        {/* ── Divergence Chart ── */}
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
            marketPrice={signal.yesProbability * 100}  // 👈 add this
          />\
        </div>

        {/* ── Reliability Stats ── */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { label: 'SRC_RELIABILITY', value: signal.source_reliability },
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

        {/* ── Footer: Momentum + Trade Score + Trade Button ── */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-mono text-slate-500">
            MOMENTUM: <span className={momentumColor}>{momentumLabel}</span>
          </div>

          <div className={`text-[10px] font-mono ${directionColor}`}>
            {directionLabel}
          </div>

          {/* Trade score badge */}
          <div className={`px-2 py-1 rounded-lg border text-[9px] font-mono font-bold ${actionBg} ${actionColor}`}>
            {action}
          </div>
        </div>

        {/* ── Trade Button + Breakdown Toggle ── */}
        <div className="flex items-center gap-2">
          <a
            href={tradeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition"
          >
            Trade on Bayse
            <ArrowRight size={14} />
          </a>

          {/*
           * Breakdown toggle button.
           * Expands the reasoning panel below — gives the user
           * plain-language context for the trade recommendation.
           */}
          <button
            onClick={() => setExpanded(prev => !prev)}
            className="p-2 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white transition"
            title="View reasoning"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* ── Expanded Breakdown Panel ─────────────────────────────────────────
          Hidden by default. Shows:
          - Trade score out of 100
          - Plain-language reasoning for the recommendation
          - Key logic excerpt from Gemini's full analysis
      ──────────────────────────────────────────────────────────────────────── */}
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

          {/* Plain-language recommendation reasoning */}
          <div>
            <div className="text-[9px] font-mono text-slate-500 mb-1">RECOMMENDATION</div>
            <p className="text-[11px] text-slate-300 leading-relaxed">{reasoning}</p>
          </div>

          {/* Gemini's raw logic (first 300 chars) */}
          <div>
            <div className="text-[9px] font-mono text-slate-500 mb-1">AI_REASONING</div>
            <LogicText text={signal.logic} />
          </div>
        </div>
      )}
    </div>
  );
}