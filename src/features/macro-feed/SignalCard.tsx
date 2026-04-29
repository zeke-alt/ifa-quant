"use client";
import React, { useState } from 'react';
import { 
  ArrowRight, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Minus, 
  ChevronRight, 
  Brain, 
  Clock,
  Target,
  Bookmark,
  ChevronDown,
  ChevronUp,
  ShieldCheck
} from 'lucide-react';
import { MacroSignal } from '@/types/macro';
import { useBookmarks } from '@/hooks/useBookmarks';
import { cn } from '@/lib/utils';

const SENTIMENT_CONFIG = {
  BULLISH: { icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'BULLISH' },
  BEARISH: { icon: TrendingDown, color: 'text-rose-500', bg: 'bg-rose-500/10', label: 'BEARISH' },
  RISK_ALERT: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'RISK_ALERT' },
  NEUTRAL: { icon: Minus, color: 'text-slate-500', bg: 'bg-white/5', label: 'NEUTRAL' },
};

export default function SignalCard({ signal }: { signal: MacroSignal }) {
  const [expanded, setExpanded] = useState(false);
  const { toggleBookmark, isBookmarked } = useBookmarks();
  
  const sentiment = signal.sentiment ?? 'NEUTRAL';
  const config = SENTIMENT_CONFIG[sentiment as keyof typeof SENTIMENT_CONFIG] ?? SENTIMENT_CONFIG.NEUTRAL;
  const Icon = config.icon;

  const probability = Number(signal.probability);
  const probPercent = (probability * 100).toFixed(0);
  const bookmarked = isBookmarked(signal.marketId);

  return (
    <div className={cn(
      "bg-[#0c0d0e] border rounded-none group transition-all duration-300 overflow-hidden relative",
      sentiment === 'BULLISH' ? 'border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/[0.03] hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]' :
      sentiment === 'BEARISH' ? 'border-white/10 hover:border-rose-500/50 hover:bg-rose-500/[0.03] hover:shadow-[0_0_30px_rgba(244,63,94,0.15)]' :
      sentiment === 'RISK_ALERT' ? 'border-white/10 hover:border-orange-500/50 hover:bg-orange-500/[0.03] hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]' :
      'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
    )}>
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 group-hover:w-1.5",
        sentiment === 'BULLISH' ? 'bg-emerald-500' : 
        sentiment === 'BEARISH' ? 'bg-rose-500' : 
        sentiment === 'RISK_ALERT' ? 'bg-orange-500' : 'bg-slate-700'
      )} />

      {/* Dynamic Color Highlight on Hover */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
        sentiment === 'BULLISH' ? 'bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent' :
        sentiment === 'BEARISH' ? 'bg-gradient-to-br from-rose-500/10 via-transparent to-transparent' :
        sentiment === 'RISK_ALERT' ? 'bg-gradient-to-br from-orange-500/10 via-transparent to-transparent' :
        'bg-gradient-to-br from-blue-500/10 via-transparent to-transparent'
      )} />

      <div className="p-5">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-white/5 border border-white/5">
                <Brain size={14} className="text-primary" />
             </div>
             <div>
                <div className="text-[7px] font-bold text-slate-600 uppercase tracking-widest mb-0.5">VEC_ID</div>
                <div className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-tighter">{signal.marketId.slice(0, 12)}</div>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleBookmark(signal.marketId);
              }}
              className="text-slate-600 hover:text-primary transition-colors"
            >
              <Bookmark size={12} fill={bookmarked ? "currentColor" : "none"} />
            </button>
            <div className={cn("flex items-center gap-2 px-2 py-1 border border-white/5 text-[8px] font-bold uppercase tracking-widest", config.bg, config.color)}>
              <Icon size={10} strokeWidth={3} />
              {config.label}
            </div>
          </div>
        </div>

        <h4 
          className="text-slate-100 font-bold text-[13px] leading-snug mb-4 hover:text-blue-400 cursor-pointer transition-colors"
          onClick={() => window.open(`https://app.bayse.markets/market/${signal.eventId}`, '_blank')}
        >
          {signal.headline}
        </h4>

        <div className="flex items-center gap-5 mb-6 font-mono">
           <div className="flex items-center gap-1.5">
              <span className="text-[8px] text-slate-600 uppercase font-bold">AI_FAIR_VALUE:</span>
              <span className="text-[11px] text-primary font-bold">{probPercent}%</span>
           </div>
           <div className="flex items-center gap-1.5">
              <span className="text-[8px] text-slate-600 uppercase font-bold">CONFIDENCE:</span>
              <span className="text-[11px] text-slate-300 font-bold">{(Number(signal.source_reliability) * 100).toFixed(0)}%</span>
           </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-white/5">
           <div className="flex items-center gap-2">
              <Clock size={10} className="text-slate-600" />
              <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Synced: Live</span>
           </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[9px] font-bold text-primary uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1"
            >
              {expanded ? "Read less ↑" : "Read more ↓"}
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
        </div>
      </div>

      {expanded && (
        <div className="bg-black/40 border-t border-white/5 p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
           <div className="bg-white/[0.02] border border-white/5 p-3 relative group/reason">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/40" />
              <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                RECOMMENDATION
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed font-mono italic">
                {signal.logic}
              </p>
           </div>

           <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-white/2 border border-white/5 font-mono">
                 <div className="text-[7px] font-bold text-slate-600 uppercase mb-1">ACCURACY</div>
                 <div className="text-[10px] font-bold text-slate-300">{(Number(signal.historical_accuracy) * 100).toFixed(1)}%</div>
              </div>
              <div className="p-2 bg-white/2 border border-white/5 font-mono">
                 <div className="text-[7px] font-bold text-slate-600 uppercase mb-1">RISK_STATUS</div>
                 <div className={cn("text-[10px] font-bold", sentiment === 'RISK_ALERT' ? 'text-orange-500' : 'text-emerald-500')}>NOMINAL</div>
              </div>
           </div>

           <button className="w-full py-2 bg-primary text-black text-[9px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
              EXECUTE_TRADE <ArrowRight size={10} />
           </button>
        </div>
      )}
    </div>
  );
}