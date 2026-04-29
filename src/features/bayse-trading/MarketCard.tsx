"use client";
import React, { useState, useEffect } from 'react';
import {
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
  ChevronRight,
  ShieldCheck,
  Activity,
  Loader2,
  ArrowUpRight
} from 'lucide-react';
import { MacroSignal } from '@/types/macro';
import DivergenceLine from '@/components/charts/DivergenceLine';
import QuoteDrawer from '@/components/ui/QuoteDrawer';
import { useBookmarks } from '@/hooks/useBookmarks';
import { cn } from '@/lib/utils';

// --- SENTIMENT & TRADE LOGIC ---

const SENTIMENT_CONFIG = {
  BULLISH: { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'BULLISH' },
  BEARISH: { icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-500/10', label: 'BEARISH' },
  RISK_ALERT: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'RISK_ALERT' },
  NEUTRAL: { icon: Minus, color: 'text-muted-foreground', bg: 'bg-muted/10', label: 'NEUTRAL' },
};

function computeTradeScore(signal: MacroSignal) {
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
  if (score >= 75) { action = 'STRONG BUY ↑'; actionColor = 'text-emerald-400'; }
  else if (score >= 58) { action = 'ACCUMULATE ↑'; actionColor = 'text-sky-500'; }
  else if (score >= 42) { action = 'NEUTRAL'; actionColor = 'text-muted-foreground'; }
  else { action = 'UNDERWEIGHT ↓'; actionColor = 'text-rose-500'; }

  return { score, action, actionColor };
}

// --- MAIN COMPONENT ---

export default function MarketCard({ signal, currency = 'USD' }: { signal: MacroSignal, currency?: 'USD' | 'NGN' }) {
  const [expanded, setExpanded] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [logicExpanded, setLogicExpanded] = useState(false);
  const { toggleBookmark, isBookmarked } = useBookmarks();

  const prob = (Number(signal.probability) * 100).toFixed(0);
  const { score, action, actionColor } = computeTradeScore(signal);
  const config = SENTIMENT_CONFIG[signal.sentiment as keyof typeof SENTIMENT_CONFIG] ?? SENTIMENT_CONFIG.NEUTRAL;
  
  // Momentum Logic
  const momentumValue = (Number(signal.probability) - 0.5) * ((signal.source_reliability + signal.historical_accuracy) / 2) * 100;
  const momentumLabel = momentumValue > 2 ? `+${momentumValue.toFixed(1)}%` : momentumValue < -2 ? `${momentumValue.toFixed(1)}%` : 'STABLE';
  const momentumColor = momentumValue > 2 ? 'text-emerald-500' : momentumValue < -2 ? 'text-rose-500' : 'text-muted-foreground';

  return (
    <>
      <div className={cn(
        "bg-card border border-border rounded-none group transition-all duration-500 flex flex-col justify-between relative overflow-hidden",
        signal.sentiment === 'BULLISH' ? 'hover:border-emerald-500/50 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]' :
        signal.sentiment === 'BEARISH' ? 'hover:border-rose-500/50 hover:shadow-[0_0_30px_rgba(244,63,94,0.15)]' :
        signal.sentiment === 'RISK_ALERT' ? 'hover:border-orange-500/50 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]' :
        'hover:border-blue-500/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]'
      )}>
        
        {/* Bloomberg Side-Bar */}
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 group-hover:w-1.5",
          signal.sentiment === 'BULLISH' ? 'bg-emerald-500' : 
          signal.sentiment === 'BEARISH' ? 'bg-rose-500' : 
          signal.sentiment === 'RISK_ALERT' ? 'bg-orange-500' : 'bg-muted-foreground'
        )} />

        {/* Dynamic Color Highlight on Hover */}
        <div className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
          signal.sentiment === 'BULLISH' ? 'bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent' :
          signal.sentiment === 'BEARISH' ? 'bg-gradient-to-br from-rose-500/10 via-transparent to-transparent' :
          signal.sentiment === 'RISK_ALERT' ? 'bg-gradient-to-br from-orange-500/10 via-transparent to-transparent' :
          'bg-gradient-to-br from-blue-500/10 via-transparent to-transparent'
        )} />

        <div className="p-5 flex flex-col flex-1">
          {/* Header: AI Prediction & Sentiment */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className={cn("flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20", config.color)}>
                <config.icon size={10} strokeWidth={3} />
                <span className="text-[10px] font-bold tracking-widest">{config.label}</span>
              </div>
              <button onClick={() => toggleBookmark(signal.marketId)} className="p-2 bg-accent hover:bg-accent/80 transition-colors border border-border">
                <Bookmark size={12} fill={isBookmarked(signal.marketId) ? "currentColor" : "none"} className="text-muted-foreground" />
              </button>
            </div>
            <div className="text-right font-mono">
              <p className="text-[10px] text-muted-foreground uppercase mb-1 font-bold tracking-widest">AI PREDICTION</p>
              <p className="text-3xl font-bold text-foreground leading-none tracking-tighter group-hover:text-blue-500 transition-colors">{prob}%</p>
              <p className="text-[9px] text-muted-foreground mt-1 uppercase font-bold">COST: <span className="text-foreground/80">{currency === 'NGN' ? '₦' : '$'}{currency === 'NGN' ? (signal.yesProbability * 100).toFixed(2) : signal.yesProbability.toFixed(2)}</span></p>
            </div>
          </div>

          {/* Question & Category Box */}
          <div className="flex items-center justify-between gap-3 mb-6">
            <div 
              className="bg-accent border border-border px-4 py-2 flex-1 group/q hover:border-primary/50 transition-colors cursor-pointer flex items-center justify-between" 
              onClick={() => window.open(`https://app.bayse.markets/market/${signal.eventId}`, '_blank')}
            >
               <p className="text-[10px] font-bold text-muted-foreground uppercase leading-tight line-clamp-1">
                 {signal.eventTitle}
               </p>
               <ArrowUpRight size={12} className="text-muted-foreground/60 group-hover/q:text-primary transition-colors shrink-0" />
            </div>
            <span className="text-[9px] font-bold text-muted-foreground/80 uppercase tracking-widest">{signal.category}</span>
          </div>

          {/* Headline & Selection */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-primary leading-tight mb-2 tracking-tight group-hover:text-primary/80 transition-colors line-clamp-2">
              {signal.headline}
            </h3>
            <p className="text-[11px] text-muted-foreground italic font-mono line-clamp-1">{signal.marketTitle}</p>
          </div>

          {/* Divergence Visual */}
          <div className="bg-muted/30 border border-border p-3 mb-6">
            <div className="flex justify-between text-[9px] font-bold text-muted-foreground uppercase mb-3 tracking-widest">
              <div className="flex items-center gap-2 text-primary">
                <div className="w-3 h-3 border border-primary/50 flex items-center justify-center rounded-full p-0.5">
                   <div className="w-full h-full border border-primary rounded-full" />
                </div>
                AI_FAIR_VALUE
              </div>
              <span>MARKET_SENTIMENT</span>
            </div>
            <DivergenceLine 
              aiProb={Number(signal.probability) * 100}
              eventId={signal.eventId}
              marketId={signal.marketId}
              marketPrice={signal.yesProbability * 100}
            />
          </div>

          {/* Metrics Grid: Reliability & Accuracy */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            <div className="bg-accent/40 border border-border p-2 font-mono">
              <p className="text-[7px] text-muted-foreground uppercase mb-1 font-bold">CONFIDENCE</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-foreground/80">{(signal.source_reliability * 100).toFixed(0)}%</span>
                <div className="w-10 h-0.5 bg-muted"><div className="h-full bg-primary" style={{ width: `${signal.source_reliability * 100}%` }} /></div>
              </div>
            </div>
            <div className="bg-accent/40 border border-border p-2 font-mono">
              <p className="text-[7px] text-muted-foreground uppercase mb-1 font-bold">ACCURACY</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-foreground/80">{(signal.historical_accuracy * 100).toFixed(0)}%</span>
                <div className="w-10 h-0.5 bg-muted"><div className="h-full bg-blue-500" style={{ width: `${signal.historical_accuracy * 100}%` }} /></div>
              </div>
            </div>
          </div>

          {/* Status Bar: Momentum & Conviction */}
          <div className="flex items-center justify-between border-t border-border pt-5 mb-5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">MOMENTUM:</span>
              <span className={cn("text-[11px] font-mono font-bold uppercase", momentumColor)}>
                {momentumValue > 0 ? "UPWARD" : "DOWNWARD"} {momentumLabel}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-emerald-500 uppercase flex items-center gap-1">BUY <TrendingUp size={10}/></span>
              <div className={cn("px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1", actionColor)}>
                {action}
              </div>
            </div>
          </div>

          <div className="flex-1" />
          {/* Actions */}
          <div className="flex gap-3">
            <button 
              onClick={() => setShowQuote(true)}
              className="flex-1 bg-blue-600 text-white py-4 text-[8px] font-bold uppercase tracking-[0.2em] hover:bg-blue-500 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
            >
              <Zap size={14} fill="currentColor" /> EXECUTE_TRADE
            </button>
            <button 
              onClick={() => window.open(`https://app.bayse.markets/market/${signal.eventId}`, '_blank')}
              className="px-5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 hover:text-emerald-300 transition-all flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest"
            >
              <ArrowUpRight size={14} /> BAYSE
            </button>
            <button 
              onClick={() => setExpanded(!expanded)}
              className="px-5 border border-border bg-accent text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            >
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
        </div>

        {/* Expansion: Conviction Index & Logic */}
        {expanded && (
          <div className="bg-accent/20 border-t border-border p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div>
              <div className="flex justify-between text-[8px] font-bold text-muted-foreground uppercase mb-2">
                <span>TRADE_SCORE_INDEX</span>
                <span className={actionColor}>{score.toFixed(0)} / 100</span>
              </div>
              <div className="h-1 bg-muted w-full">
                <div className={cn("h-full transition-all duration-700", actionColor.replace('text', 'bg'))} style={{ width: `${score}%` }} />
              </div>
            </div>

            <div className="bg-muted/50 p-4 border border-border relative group/rec">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/40" />
              <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-2">RECOMMENDATION</div>
              <p className="text-[10px] text-foreground leading-relaxed font-bold tracking-tight">
                {signal.recommendation || (signal.probability > 0.65 ? "Institutional assessment suggests strong convergence. Accumulate position while divergence remains above 10%." : "Maintain neutral exposure. Monitor target vectors for high-conviction entry signals.")}
              </p>
            </div>

            <div className="space-y-2">
               <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2 text-[8px] font-bold text-muted-foreground uppercase">AI_ANALYSIS_LOGIC</div>
                 <button 
                  onClick={() => setLogicExpanded(!logicExpanded)}
                  className="text-[8px] font-bold text-primary hover:text-primary/80 uppercase tracking-widest transition-colors flex items-center gap-1"
                 >
                   {logicExpanded ? "Read less ↑" : "Read more ↓"}
                 </button>
               </div>
               <p className={cn(
                 "text-[10px] text-muted-foreground leading-relaxed font-mono transition-all duration-300",
                 !logicExpanded && "line-clamp-4"
               )}>
                 {signal.logic}
               </p>
            </div>
          </div>
        )}
      </div>

      {showQuote && (
        <QuoteDrawer 
          eventId={signal.eventId}
          marketId={signal.marketId}
          engine="AMM"
          currencyProp={currency}
          aiProbability={Number(signal.probability)}
          yesOutcomeId={signal.yesOutcomeId}
          noOutcomeId={signal.noOutcomeId}
          onClose={() => setShowQuote(false)} 
        />
      )}
    </>
  );
}