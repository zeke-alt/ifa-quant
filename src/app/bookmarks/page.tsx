"use client";
import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import MarketCard from '@/features/bayse-trading/MarketCard';
import SignalCard from '@/features/macro-feed/SignalCard';
import { analyzeMarkets } from '@/lib/api-client';
import { MacroSignal } from '@/types/macro';
import { Bookmark, LayoutGrid, List, ArrowLeft, Zap, Activity, RefreshCcw } from 'lucide-react';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useLayout } from '@/context/LayoutContext';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import CowrieIcon from '@/components/ui/CowrieIcon';

export default function BookmarksPage() {
  const [signals, setSignals] = useState<MacroSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const { bookmarks } = useBookmarks();
  const { isSidebarCollapsed } = useLayout();
  const [searchQuery, setSearchQuery] = useState("");
  const [currency, setCurrency] = useState<'USD' | 'NGN'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('bayse_pref_currency') as 'USD' | 'NGN') || 'USD';
    }
    return 'USD';
  });

  // Save preferences when they change
  useEffect(() => { 
    if (typeof window !== 'undefined') {
      localStorage.setItem('bayse_pref_currency', currency); 
    }
  }, [currency]);

  const fetchSignals = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const data = await analyzeMarkets(force);
      setSignals(data.signals || []);
    } catch (err) {
      console.error("BOOKMARKS_FETCH_ERROR:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  const bookmarkedSignals = signals.filter(s => {
    const isBookmarked = bookmarks.includes(s.marketId);
    if (!isBookmarked) return false;
    
    const searchLower = searchQuery.toLowerCase();
    return (
      (s.headline || "").toLowerCase().includes(searchLower) ||
      (s.eventTitle || "").toLowerCase().includes(searchLower) ||
      (s.marketTitle || "").toLowerCase().includes(searchLower) ||
      (s.category || "").toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen bg-background text-foreground transition-all duration-300 selection:bg-primary/20">
      <Sidebar />
      
      <main className={cn(
        "flex flex-col min-h-screen transition-all duration-300 pt-16 lg:pt-0",
        isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
      )}>
        <div className="flex-1 p-4 lg:p-6 max-w-[1800px] mx-auto w-full">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-border pb-4 gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
                  <ArrowLeft size={16} />
                </Link>
                <h1 className="text-xl font-bold text-foreground tracking-tighter flex items-center gap-2 uppercase italic">
                  Saved_Alpha <span className="text-muted-foreground font-mono text-xs tracking-[0.3em] not-italic">VAULT_01</span>
                </h1>
              </div>
              <p className="text-[9px] font-mono uppercase text-muted-foreground mt-1 tracking-widest ml-7">
                Curated_Inference_Cache // Sync: {new Date().toLocaleTimeString()}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative group hidden sm:block">
                <input 
                  type="text"
                  placeholder="Query_Vault..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-accent/20 border border-border py-1.5 pl-3 pr-8 text-[10px] font-mono focus:outline-none focus:border-primary/40 w-40 transition-all"
                />
                <Zap size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
              </div>

              <div className="flex items-center gap-2 bg-accent/20 border border-border p-0.5">
                <button 
                  onClick={() => setView('grid')}
                  className={cn("px-4 py-1.5 text-[9px] font-bold transition-all uppercase tracking-widest flex items-center gap-2", view === 'grid' ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                >
                  <LayoutGrid size={12} /> Grid_Matrix
                </button>
                <button 
                  onClick={() => setView('list')}
                  className={cn("px-4 py-1.5 text-[9px] font-bold transition-all uppercase tracking-widest flex items-center gap-2", view === 'list' ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                >
                  <List size={12} /> Stream_List
                </button>
              </div>

              {/* USD / NGN Toggle */}
              <div className="flex bg-accent/20 border border-border p-0.5">
                {(['USD', 'NGN'] as const).map((c) => (
                  <button key={c} onClick={() => setCurrency(c)} className={cn(
                    "px-3 py-1.5 text-[10px] font-bold uppercase transition-all",
                    currency === c ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                  )}>{c}</button>
                ))}
              </div>

              {/* Refresh Button */}
              <button 
                onClick={() => fetchSignals()} 
                className="p-2 border border-border bg-accent/20 hover:bg-accent/40 transition-colors"
                title="Sync Analysis"
              >
                <RefreshCcw size={14} className={cn(loading && "animate-spin text-primary")} />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="h-96 flex flex-col items-center justify-center border border-border bg-accent/10">
              <RefreshCcw className="animate-spin text-primary mb-4" size={24} />
              <span className="text-[10px] font-mono text-muted-foreground animate-pulse tracking-[0.5em]">SYNCING_VAULT_LEDGER</span>
            </div>
          ) : bookmarkedSignals.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center border border-border bg-accent/10 text-center p-8">
              <div className="w-16 h-16 border border-border flex items-center justify-center text-muted-foreground/20 mb-6">
                <Bookmark size={32} />
              </div>
              <h2 className="text-sm font-bold text-muted-foreground tracking-[0.2em] uppercase mb-2">No_Saved_Signals</h2>
              <p className="text-[11px] text-muted-foreground/60 font-mono max-w-xs mx-auto mb-8">
                Your intelligence cache is empty. Aggregate market alpha from the main terminal.
              </p>
              <Link href="/">
                <button className="bg-primary text-primary-foreground px-8 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-all flex items-center gap-2">
                  <Zap size={14} fill="currentColor" /> Explore_Terminal
                </button>
              </Link>
            </div>
          ) : (
            <div className={cn(
              "grid gap-4",
              view === 'grid' ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 lg:max-w-4xl lg:mx-auto"
            )}>
              {bookmarkedSignals.map((signal) => (
                view === 'grid' ? (
                  <MarketCard key={signal.marketId} signal={signal} currency={currency} />
                ) : (
                  <SignalCard key={signal.marketId} signal={signal} />
                )
              ))}
            </div>
          )}

          {/* Footer Decoration */}
          <div className="mt-12 py-8 border-t border-border flex flex-col items-center gap-3">
            <Activity size={16} className="text-muted-foreground/20 animate-pulse" />
            <p className="text-[8px] font-mono font-bold text-muted-foreground/40 uppercase tracking-[0.5em]">
              OJA_VAULT_SUBSYSTEM_ONLINE // NODE_01
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
