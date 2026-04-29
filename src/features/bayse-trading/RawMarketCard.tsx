"use client";
import React, { useState } from 'react';
import { 
  ArrowUpRight, 
  Activity, 
  Layers, 
  Zap, 
  Loader2,
  Database,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RawMarketProps {
  event: any;
  onAnalyze: (eventId: string) => void;
  loading: boolean;
}

export default function RawMarketCard({ event, onAnalyze, loading }: RawMarketProps) {
  const market = event.markets?.[0] || {};
  const price = (market.outcome1Price * 100).toFixed(0);

  return (
    <div className="bg-card border border-border group transition-all duration-300 relative overflow-hidden flex flex-col">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-muted-foreground/20" />
      
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2 px-2 py-1 bg-accent/30 border border-border text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
            <Database size={10} />
            RAW_MARKET_NODE
          </div>
          <div className="text-right">
             <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">MARKET PRICE</p>
             <p className="text-2xl font-bold text-foreground font-mono">{price}%</p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-bold text-foreground leading-tight mb-2 uppercase group-hover:text-primary transition-colors line-clamp-2">
            {event.title}
          </h3>
          <div className="flex items-center gap-4">
            <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest">{event.category}</span>
            <span className="text-[8px] font-mono text-muted-foreground/40 uppercase">ID: {event.id.slice(0, 8)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 pt-4 border-t border-border">
           <div>
              <p className="text-[7px] font-bold text-muted-foreground uppercase mb-1">LIQUIDITY</p>
              <p className="text-[11px] font-mono font-bold text-foreground/80">${(event.liquidity || 0).toLocaleString()}</p>
           </div>
           <div>
              <p className="text-[7px] font-bold text-muted-foreground uppercase mb-1">VOL_ORDERS</p>
              <p className="text-[11px] font-mono font-bold text-foreground/80">{market.totalOrders || 0}</p>
           </div>
        </div>

        <div className="flex-1" />

        <div className="space-y-3">
          <button 
            onClick={() => onAnalyze(event.id)}
            disabled={loading}
            className="w-full py-3 bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground transition-all text-[9px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Zap size={14} fill="currentColor" />
            )}
            {loading ? "PROCESSING_VECTORS..." : "RUN_AI_ANALYSIS"}
          </button>
          
          <button 
            onClick={() => window.open(`https://app.bayse.markets/market/${event.id}`, '_blank')}
            className="w-full py-2 border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-all text-[8px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <ArrowUpRight size={12} /> VIEW_ON_BAYSE
          </button>
        </div>
      </div>
    </div>
  );
}
