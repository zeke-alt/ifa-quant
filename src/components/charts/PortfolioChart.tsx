"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { date: "Jan", value: 4000, benchmark: 3800 },
  { date: "Feb", value: 3500, benchmark: 3900 },
  { date: "Mar", value: 5000, benchmark: 4200 },
  { date: "Apr", value: 4800, benchmark: 4500 },
  { date: "May", value: 6000, benchmark: 4800 },
  { date: "Jun", value: 7500, benchmark: 5200 },
  { date: "Jul", value: 8200, benchmark: 5500 },
  { date: "Aug", value: 7800, benchmark: 5800 },
  { date: "Sep", value: 9500, benchmark: 6200 },
  { date: "Oct", value: 11000, benchmark: 6500 },
  { date: "Nov", value: 10500, benchmark: 6800 },
  { date: "Dec", value: 12304, benchmark: 7100 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#050607]/90 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" />
          <p className="text-[10px] font-black text-white uppercase tracking-[0.3em]">{label}_SNAPSHOT</p>
        </div>
        <div className="space-y-1">
          <p className="text-3xl font-mono font-bold text-white tracking-tighter">
            ${payload[0].value.toLocaleString()}
          </p>
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">
            Portfolio_Valuation
          </p>
        </div>
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-8">
          <div>
             <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Benchmark</p>
             <p className="text-xs font-mono font-bold text-white/60">${payload[1]?.value.toLocaleString()}</p>
          </div>
          <div className="text-right">
             <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Performance</p>
             <p className="text-xs font-mono font-bold text-green-500">+{((payload[0].value / payload[1]?.value - 1) * 100).toFixed(1)}%</p>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function PortfolioChart() {
  return (
    <div className="w-full h-full min-h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.65 0.22 250)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="oklch(0.65 0.22 250)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorBenchmark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="white" stopOpacity={0.05} />
              <stop offset="95%" stopColor="white" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="4 4" 
            vertical={false} 
            stroke="rgba(255,255,255,0.03)" 
          />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10, fontWeight: 900 }}
            dy={15}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: "rgba(255,255,255,0.2)", fontSize: 10, fontWeight: 900 }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
          
          <Area
            type="monotone"
            dataKey="benchmark"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={1}
            strokeDasharray="5 5"
            fillOpacity={1}
            fill="url(#colorBenchmark)"
            animationDuration={3000}
          />

          <Area
            type="monotone"
            dataKey="value"
            stroke="oklch(0.65 0.22 250)"
            strokeWidth={4}
            fillOpacity={1}
            fill="url(#colorValue)"
            animationDuration={2000}
            activeDot={{ r: 6, strokeWidth: 0, fill: 'oklch(0.65 0.22 250)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
