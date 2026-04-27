"use client";
import React from 'react';
import { TrendingUp, TrendingDown, Info, ShieldAlert, Bookmark } from 'lucide-react';
import { MacroSignal } from '@/types/macro';
import { useBookmarks } from '@/hooks/useBookmarks';
import { cn } from '@/lib/utils';

export default function SignalCard({ signal }: { signal: MacroSignal }) {
  const { toggleBookmark, isBookmarked } = useBookmarks();
  const isPositive = signal.probability >= 0.5;
  const confidencePercent = (signal.probability * 100).toFixed(0);
  const bookmarked = isBookmarked(signal.marketId);

  return (
    <div className="group relative overflow-hidden bg-card/40 backdrop-blur-sm border border-border p-6 rounded-2xl hover:bg-card/60 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300">
      {/* Decorative Gradient Glow */}
      <div className={cn(
        "absolute -right-4 -top-4 w-20 h-20 blur-3xl opacity-10 rounded-full transition-opacity group-hover:opacity-20",
        isPositive ? 'bg-green-500' : 'bg-red-500'
      )} />

      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          {isPositive ? (
            <div className="bg-green-500/10 p-2 rounded-lg">
              <TrendingUp size={16} className="text-green-500" />
            </div>
          ) : (
            <div className="bg-red-500/10 p-2 rounded-lg">
              <ShieldAlert size={16} className="text-red-500" />
            </div>
          )}
          <span className={cn("text-[10px] font-black tracking-widest uppercase", isPositive ? 'text-green-500' : 'text-red-500')}>
            {isPositive ? 'BULLISH_SIGNAL' : 'RISK_ALERT'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleBookmark(signal.marketId);
            }}
            className={cn("p-1 rounded-md transition-all", 
              bookmarked ? 'text-blue-500 scale-110' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Bookmark size={16} fill={bookmarked ? "currentColor" : "none"} />
          </button>
          <span className="text-[10px] font-black font-mono text-muted-foreground uppercase opacity-70">
            CONF: {confidencePercent}%
          </span>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 opacity-60">
          {signal.eventTitle}
        </div>
        <h5 className="text-base font-black text-foreground leading-tight group-hover:text-primary transition-colors tracking-tight">
          {signal.headline}
        </h5>
        <p className="text-[10px] text-muted-foreground italic mt-1 font-medium opacity-80">
          {signal.marketTitle}
        </p>
      </div>

      {/* Logic Preview - Line clamped for neatness */}
      <p className="text-[11px] text-muted-foreground line-clamp-2 italic leading-relaxed mb-6 font-medium">
        {signal.logic}
      </p>

      <div className="flex items-center justify-between pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 cursor-help group/info">
          <Info size={14} className="text-muted-foreground group-hover/info:text-primary transition-colors" />
          <span className="text-[10px] text-muted-foreground group-hover/info:text-primary uppercase font-black tracking-widest transition-colors">
            INSIGHTS
          </span>
        </div>
        <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn("h-full transition-all duration-1000", isPositive ? 'bg-green-500' : 'bg-red-500')} 
              style={{ width: `${confidencePercent}%` }} 
            />
        </div>
      </div>
    </div>
  );
}