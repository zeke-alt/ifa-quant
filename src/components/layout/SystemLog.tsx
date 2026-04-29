"use client";
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Activity } from 'lucide-react';

export default function SystemLog() {
  const [logs, setLogs] = useState<string[]>([]);

  const messages = [
    "FETCHING_NBS_MACRO_DATA",
    "ANALYZING_CPI_CORRELATION",
    "BAYSE_API_HEARTBEAT_OK",
    "RE-WEIGHTING_SOURCE_IMF_0.85",
    "SIGNAL_DIVERGENCE_DETECTED_NG-FX-001",
    "UPDATING_FAIR_VALUE_ENGINE",
    "NEURAL_GRADIENT_SYNC_SUCCESS",
    "LIQUIDITY_DEPTH_SCAN_COMPLETE"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
      setLogs(prev => [`[${timestamp}] ${randomMsg}`, ...prev].slice(0, 4));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-card border border-border rounded-none p-4 font-mono text-[9px] h-[140px] overflow-hidden shadow-2xl">
      <div className="text-muted-foreground mb-3 border-b border-border pb-2 flex justify-between font-bold uppercase tracking-widest">
        <div className="flex items-center gap-2">
           <Activity size={10} className="text-primary" />
           <span>CORE_SYSTEM_LOG</span>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-[8px] font-bold text-emerald-500">LIVE</span>
           <span className="text-emerald-500 animate-pulse text-[10px]">●</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {logs.map((log, i) => (
          <div key={i} className={cn(
            "transition-all duration-500 flex items-center gap-2",
            i === 0 ? "text-emerald-500 font-bold opacity-100" : "text-muted-foreground/60"
          )}>
            <span className="opacity-40 shrink-0 font-bold">{log.split(' ')[0]}</span>
            <span className="tracking-tighter uppercase truncate">{log.split(' ').slice(1).join(' ')}</span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-muted-foreground/20 uppercase tracking-widest animate-pulse">Initializing_Telemetry...</div>
        )}
      </div>
    </div>
  );
}