"use client";
import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import MarketCard from '@/features/bayse-trading/MarketCard';
import SignalCard from '@/features/macro-feed/SignalCard';
import { analyzeMarkets } from '@/lib/api-client';
import { MacroSignal } from '@/types/macro';
import { Bookmark, LayoutGrid, List, ArrowLeft, Zap } from 'lucide-react';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useLayout } from '@/context/LayoutContext';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function BookmarksPage() {
  const [signals, setSignals] = useState<MacroSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const { bookmarks } = useBookmarks();
  const { isSidebarCollapsed } = useLayout();

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await analyzeMarkets();
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

  const bookmarkedSignals = signals.filter(s => bookmarks.includes(s.marketId));

  return (
    <div className="min-h-screen bg-background text-foreground transition-all duration-300">
      <Sidebar />
      
      <main className={cn(
        "p-6 lg:p-12 transition-all duration-500 ease-in-out",
        isSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
      )}>
        <div className="max-w-7xl mx-auto pt-16 lg:pt-0">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link href="/" className="p-2 rounded-xl bg-secondary text-muted-foreground hover:text-primary transition-colors">
                  <ArrowLeft size={18} />
                </Link>
                <h1 className="text-3xl lg:text-5xl font-black text-foreground tracking-tighter uppercase italic">SAVED_ALPHA</h1>
              </div>
              <p className="text-muted-foreground text-[10px] font-black mt-1 tracking-[0.2em] uppercase opacity-40">
                Your Curated Macro Intelligence Feed
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex bg-secondary p-1 rounded-xl border border-border">
                <button 
                  onClick={() => setView('grid')}
                  className={cn("p-2 rounded-lg transition-all", view === 'grid' ? "bg-background text-primary shadow-sm" : "text-muted-foreground")}
                >
                  <LayoutGrid size={16} />
                </button>
                <button 
                  onClick={() => setView('list')}
                  className={cn("p-2 rounded-lg transition-all", view === 'list' ? "bg-background text-primary shadow-sm" : "text-muted-foreground")}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] animate-pulse">Syncing_Vault...</p>
            </div>
          ) : bookmarkedSignals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-secondary flex items-center justify-center text-muted-foreground">
                <Bookmark size={40} strokeWidth={1} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight mb-2 uppercase">No Saved Signals</h2>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto font-medium">
                  You haven't bookmarked any market alpha yet. Head to the terminal to start curating your feed.
                </p>
              </div>
              <Link href="/">
                <button className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center gap-3">
                  <Zap size={14} />
                  Explore Terminal
                </button>
              </Link>
            </div>
          ) : (
            <div className={cn(
              "grid gap-8",
              view === 'grid' ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
            )}>
              {bookmarkedSignals.map((signal) => (
                view === 'grid' ? (
                  <MarketCard key={signal.marketId} signal={signal} />
                ) : (
                  <SignalCard key={signal.marketId} signal={signal} />
                )
              ))}
            </div>
          )}

          {/* Footer Decoration */}
          <div className="mt-20 pt-12 border-t border-border flex flex-col items-center gap-4 text-center">
            <div className="w-1 h-12 bg-gradient-to-b from-primary to-transparent opacity-30" />
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] opacity-40">
              End of Saved Alpha // Oja Intelligence Vault
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
