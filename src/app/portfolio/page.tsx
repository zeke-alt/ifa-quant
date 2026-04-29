"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { useLayout } from "@/context/LayoutContext";
import { cn } from "@/lib/utils";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  History,
  PieChart,
  ArrowRight,
  Filter,
  Download,
  Search,
  Bell,
  RefreshCcw,
  ShieldCheck,
  Zap,
  Target,
  Loader2
} from "lucide-react";
import MiniSparkline from "@/components/charts/MiniSparkline";
import PortfolioChart from "@/components/charts/PortfolioChart";

// ── Components ─────────────────────────────────────────────────────────────

function PortfolioStat({
  label,
  value,
  subValue,
  trend,
  icon: Icon,
  color = "primary"
}: {
  label: string;
  value: string;
  subValue?: string;
  trend?: { val: string; positive: boolean };
  icon: any;
  color?: "primary" | "green" | "red" | "orange";
}) {
  const colorMap = {
    primary: "text-primary bg-primary/10 border-primary/20",
    green: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    red: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    orange: "text-orange-500 bg-orange-500/10 border-orange-500/20",
  };

  const accentColor = color === 'primary' ? 'bg-primary' : color === 'green' ? 'bg-emerald-500' : color === 'red' ? 'bg-rose-500' : 'bg-orange-500';

  return (
    <div className="bg-card border border-border rounded-none p-5 group relative overflow-hidden transition-all hover:border-primary/40">
      <div className={cn("absolute left-0 top-0 bottom-0 w-[1px]", accentColor)} />

      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
            {label}
          </p>
          <h3 className="text-2xl font-bold text-foreground tracking-tighter mb-1 font-mono">
            {value}
          </h3>
          {subValue && (
            <p className="text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-widest opacity-60">
              {subValue}
            </p>
          )}
        </div>
        <div className={cn("p-2 border", colorMap[color])}>
          <Icon size={14} />
        </div>
      </div>

      {trend && (
        <div className="mt-5 flex items-center gap-2 relative z-10 border-t border-border pt-3">
          <div className={cn(
            "flex items-center gap-1 text-[9px] font-bold",
            trend.positive ? "text-emerald-500" : "text-rose-500"
          )}>
            {trend.positive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {trend.val}
          </div>
          <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-widest">vs_period</span>
        </div>
      )}
    </div>
  );
}

function PositionRow({ position }: { position: any }) {
  const isPositive = position.pnlPercent >= 0;

  return (
    <div className="group grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-accent/50 transition-all border-b border-border last:border-0 relative">
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="col-span-4 flex items-center gap-4">
        <div className={cn(
          "w-8 h-8 border border-border flex items-center justify-center shrink-0 transition-all",
          position.sentiment === 'BULLISH' ? "bg-emerald-500/5 text-emerald-500" : "bg-rose-500/5 text-rose-500"
        )}>
          {position.sentiment === 'BULLISH' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        </div>
        <div>
          <h4 className="text-[11px] font-bold text-foreground tracking-tight mb-0.5 uppercase">
            {position.title}
          </h4>
          <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest">
            {position.market}
          </p>
        </div>
      </div>

      <div className="col-span-2 text-right">
        <p className="text-[10px] font-mono font-bold text-foreground/80">{position.shares.toLocaleString()}</p>
        <p className="text-[8px] font-bold text-muted-foreground uppercase">Shares</p>
      </div>

      <div className="col-span-3">
        <div className="flex items-center justify-end gap-3">
          <div className="w-12 h-6 opacity-30 group-hover:opacity-60 transition-opacity">
            <MiniSparkline color={isPositive ? "oklch(0.7 0.2 150)" : "oklch(0.7 0.2 25)"} />
          </div>
          <div className="text-right">
            <p className="text-[10px] font-mono font-bold text-foreground/80">${position.currentPrice}</p>
            <p className={cn("text-[8px] font-bold", isPositive ? "text-emerald-500" : "text-rose-500")}>
              {isPositive ? '+' : ''}{position.pnlPercent}%
            </p>
          </div>
        </div>
      </div>

      <div className="col-span-3 text-right">
        <p className={cn("text-[11px] font-mono font-bold mb-0.5", isPositive ? "text-emerald-500" : "text-rose-500")}>
          {isPositive ? '+' : ''}${position.pnlAmount.toLocaleString()}
        </p>
        <p className="text-[8px] font-bold text-muted-foreground uppercase">Unrealized P&L</p>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { isSidebarCollapsed } = useLayout();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const positions = [
    {
      id: "1",
      title: "Nigeria Inflation",
      market: "Exceed 20% in Q4",
      sentiment: "BULLISH",
      shares: 1250,
      avgPrice: 0.42,
      currentPrice: 0.68,
      pnlPercent: 61.9,
      pnlAmount: 325.00
    },
    {
      id: "2",
      title: "Oil Export Volume",
      market: "Below 1.2M bpd",
      sentiment: "BEARISH",
      shares: 500,
      avgPrice: 0.55,
      currentPrice: 0.48,
      pnlPercent: -12.7,
      pnlAmount: -35.00
    },
    {
      id: "3",
      title: "CBN Interest Rate",
      market: "Hike by 100bps",
      sentiment: "BULLISH",
      shares: 2000,
      avgPrice: 0.35,
      currentPrice: 0.44,
      pnlPercent: 25.7,
      pnlAmount: 180.00
    }
  ];

  const filteredPositions = positions.filter(pos =>
    pos.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pos.market.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

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
              <h1 className="text-xl font-bold text-foreground tracking-tighter flex items-center gap-2">
                <Wallet size={18} className="text-primary" />
                ASSET_TERMINAL <span className="text-muted-foreground font-mono text-xs tracking-[0.3em]">v1.0.0</span>
              </h1>
              <p className="text-[9px] font-mono uppercase text-muted-foreground mt-1 tracking-widest">
                Portfolio_Intelligence // Sync: {new Date().toLocaleTimeString()}
              </p>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20">
                <span className="text-[10px] font-bold tracking-widest">⚠ SIMULATED DATA — Portfolio figures are illustrative only. Not real positions.</span>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-card border border-border p-1">
              <div className="px-4 py-1">
                <p className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Liquidity</p>
                <p className="text-lg font-mono font-bold text-foreground">$4,285.40</p>
              </div>
              <div className="w-[1px] h-8 bg-border" />
              <button className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95">
                Execute Fund <ArrowUpRight size={14} />
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <PortfolioStat
              label="Portfolio Value"
              value="$12,304.11"
              subValue="Capital: $8,018.71"
              icon={Target}
              trend={{ val: "+14.2%", positive: true }}
              color="primary"
            />
            <PortfolioStat
              label="Realized Profit"
              value="+$4,285.40"
              subValue="Trailing 30 Days"
              icon={TrendingUp}
              trend={{ val: "+53.4%", positive: true }}
              color="green"
            />
            <PortfolioStat
              label="Market Exposure"
              value="03 Markets"
              subValue="High Volatility"
              icon={Layers}
              color="orange"
            />
            <PortfolioStat
              label="Efficiency Score"
              value="84/100"
              subValue="Institutional Grade"
              icon={ShieldCheck}
              color="primary"
            />
          </div>

          {/* Performance & Allocation */}
          <div className="grid grid-cols-12 gap-6 mb-6">

            <div className="col-span-12 lg:col-span-8 bg-card border border-border p-6 flex flex-col relative overflow-hidden">
              <div className="flex items-center justify-between mb-8 relative z-10">
                <div>
                  <h3 className="text-[10px] font-bold text-foreground/80 uppercase tracking-widest mb-2">Performance_Matrix</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-primary" />
                      <span className="text-[8px] font-bold text-muted-foreground uppercase">Growth</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-muted" />
                      <span className="text-[8px] font-bold text-muted-foreground uppercase">Benchmark</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-accent/20 p-0.5 border border-border">
                  {['1D', '1W', '1M', '3M', '1Y', 'ALL'].map((t) => (
                    <button key={t} className={cn(
                      "px-3 py-1 text-[8px] font-bold transition-all uppercase tracking-widest",
                      t === '1M' ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                    )}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 min-h-[350px] relative z-10">
                <PortfolioChart />
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
              <div className="flex-1 bg-primary p-6 flex flex-col justify-between relative overflow-hidden">
                <div className="relative z-10">
                  <p className="text-[8px] font-bold text-black/40 uppercase tracking-widest mb-4">Allocation_Index</p>
                  <h2 className="text-3xl font-bold text-black tracking-tighter mb-6 leading-tight">High Alpha<br />Concentrated</h2>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-black/5">
                      <span className="text-[9px] font-bold text-black/40 uppercase tracking-widest">Yield Assets</span>
                      <span className="text-xs font-mono font-bold text-black">$8,200</span>
                    </div>
                    <div className="flex items-center justify-between pb-3 border-b border-black/5">
                      <span className="text-[9px] font-bold text-black/40 uppercase tracking-widest">Cash Reserve</span>
                      <span className="text-xs font-mono font-bold text-black">$4,104</span>
                    </div>
                  </div>
                </div>

                <button className="w-full mt-6 py-3 bg-black text-white text-[9px] font-bold uppercase tracking-widest hover:bg-black/90 transition-all flex items-center justify-center gap-2">
                  Rebalance_Sys <RefreshCcw size={12} />
                </button>
              </div>

              <div className="bg-card border border-border p-5 relative overflow-hidden group">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity size={12} className="text-primary" />
                    <h4 className="text-[9px] font-bold text-primary tracking-widest uppercase">Quant_Pulse</h4>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed font-mono italic">
                    Volatility is <span className="text-foreground font-bold">low</span>. Your Sharpe ratio suggests a <span className="text-primary font-bold">7.2% margin</span> for additional risk.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Positions */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8 bg-card border border-border overflow-hidden flex flex-col group">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-accent/20">
                <div className="flex items-center gap-3">
                  <Activity size={14} className="text-emerald-500" />
                  <h3 className="text-[10px] font-bold text-foreground/80 tracking-widest uppercase">Live_Inventory</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={10} />
                    <input
                      type="text"
                      placeholder="FILTER_NODES..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-background border border-border py-1.5 pl-8 pr-3 text-[9px] font-mono focus:outline-none focus:border-primary/40 w-40"
                    />
                  </div>
                  <button className="text-[9px] font-bold text-muted-foreground/60 hover:text-primary uppercase tracking-widest flex items-center gap-2">
                    <Download size={12} /> Export
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                {loading ? (
                  <div className="p-24 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="animate-spin text-primary" size={24} />
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.5em] animate-pulse">Syncing_Ledger</p>
                  </div>
                ) : (
                  <div className="min-w-[800px]">
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-accent/20 text-[8px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border">
                      <div className="col-span-4">Market_Identity</div>
                      <div className="col-span-2 text-right">Volume_Qty</div>
                      <div className="col-span-3 text-right">Perf_Vectors</div>
                      <div className="col-span-3 text-right">Valuation_Net</div>
                    </div>
                    {filteredPositions.length > 0 ? (
                      filteredPositions.map(pos => (
                        <PositionRow key={pos.id} position={pos} />
                      ))
                    ) : (
                      <div className="p-8 text-center text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
                        No_Matching_Nodes_Found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4 bg-card border border-border p-6 flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <History size={16} className="text-primary" />
                  <h3 className="text-[10px] font-bold text-foreground/80 tracking-widest uppercase">System_Audit</h3>
                </div>
                <Bell size={14} className="text-muted-foreground/40 cursor-pointer" />
              </div>

              <div className="flex-1 space-y-6">
                {[
                  { type: 'DEPOSIT', market: 'Wallet Inflow', date: '02h ago', amount: '+$500.00', status: 'OK', icon: ArrowDownRight },
                  { type: 'SETTLE', market: 'Elections Index', date: '05h ago', amount: '-$120.00', status: 'FILLED', icon: History },
                  { type: 'EXECUTE', market: 'Tech Sector Alpha', date: '01d ago', amount: '+$1,200.00', status: 'FILLED', icon: Zap },
                  { type: 'WITHDRAW', market: 'Bank Transfer', date: '02d ago', amount: '-$300.00', status: 'WAIT', icon: ArrowUpRight },
                ].map((trade, i) => (
                  <div key={i} className="flex items-center justify-between group cursor-pointer border-b border-border pb-4 last:border-0">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-9 h-9 border flex items-center justify-center text-[10px] font-bold transition-all duration-300",
                        trade.type === 'DEPOSIT' || trade.type === 'EXECUTE'
                          ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-500"
                          : "bg-rose-500/5 border-rose-500/10 text-rose-500"
                      )}>
                        <trade.icon size={14} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-foreground/80 uppercase mb-0.5">{trade.market}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[8px] font-mono text-muted-foreground/60 uppercase tracking-widest">{trade.date}</p>
                          <span className={cn("text-[7px] font-bold uppercase", trade.status === 'OK' || trade.status === 'FILLED' ? "text-primary/60" : "text-orange-500/60")}>{trade.status}</span>
                        </div>
                      </div>
                    </div>
                    <p className={cn("text-[10px] font-mono font-bold", trade.amount.startsWith('+') ? "text-emerald-400" : "text-rose-400")}>{trade.amount}</p>
                  </div>
                ))}
              </div>

              <button className="w-full mt-8 py-3 border border-border text-[9px] font-bold text-muted-foreground hover:text-foreground hover:bg-accent transition-all uppercase tracking-widest flex items-center justify-center gap-2">
                Audit_Ledger <ArrowRight size={12} />
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-card">
          <div className="max-w-[1800px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[8px] font-mono text-muted-foreground/40 uppercase tracking-[0.4em]">
              NODE_OPERATIONAL // SYNC: {new Date().toLocaleTimeString()} // v4.2
            </p>
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2 px-3 py-1 bg-accent/20 border border-border">
                <div className="w-1 h-1 bg-emerald-500 animate-pulse" />
                <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest">IFA_QUANT_Sync</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-accent/20 border border-border">
                <div className="w-1 h-1 bg-primary animate-pulse" />
                <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest">Oracle_Feed</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
