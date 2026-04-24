"use client";
import React from 'react';
import { TrendingUp, TrendingDown, Info, ShieldAlert } from 'lucide-react';
import { MacroSignal } from '@/types/macro';

export default function SignalCard({ signal }: { signal: MacroSignal }) {
  // Determine sentiment based on the 0.5 threshold from your probability data
  const isPositive = signal.probability >= 0.5;
  const confidencePercent = (signal.probability * 100).toFixed(0);

  return (
    <div className="group relative overflow-hidden bg-slate-900/40 border border-slate-800 p-5 rounded-2xl hover:bg-slate-900/60 hover:border-blue-500/30 transition-all duration-300">
      {/* Decorative Gradient Glow */}
      <div className={`absolute -right-4 -top-4 w-16 h-16 blur-2xl opacity-10 rounded-full transition-opacity group-hover:opacity-20 ${isPositive ? 'bg-green-500' : 'bg-red-500'}`} />

      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          {isPositive ? (
            <div className="bg-green-500/10 p-1.5 rounded-lg">
              <TrendingUp size={14} className="text-green-500" />
            </div>
          ) : (
            <div className="bg-red-500/10 p-1.5 rounded-lg">
              <ShieldAlert size={14} className="text-red-500" />
            </div>
          )}
          <span className={`text-[10px] font-black tracking-widest uppercase ${isPositive ? 'text-green-500' : 'text-red-400'}`}>
            {isPositive ? 'Bullish Signal' : 'Risk Alert'}
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-600 font-bold uppercase">
          Conf: {confidencePercent}%
        </span>
      </div>

      <div className="mb-3">
        <div className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mb-1">
          {signal.eventTitle}
        </div>
        <h5 className="text-sm font-bold text-slate-100 leading-snug group-hover:text-blue-400 transition-colors">
          {signal.headline}
        </h5>
        <p className="text-[9px] text-slate-500 italic mt-0.5">
          {signal.marketTitle}
        </p>
      </div>

      {/* Logic Preview - Line clamped for neatness */}
      <p className="text-[11px] text-slate-500 line-clamp-2 italic leading-relaxed mb-4">
        {signal.logic}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-slate-800/50">
        <div className="flex items-center gap-1.5 cursor-help">
          <Info size={12} className="text-slate-600" />
          <span className="text-[10px] text-slate-600 uppercase font-mono font-bold tracking-tighter">
            View Analysis
          </span>
        </div>
        <div className="h-1 w-12 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${isPositive ? 'bg-green-500' : 'bg-red-500'}`} 
              style={{ width: `${confidencePercent}%` }} 
            />
        </div>
      </div>
    </div>
  );
}