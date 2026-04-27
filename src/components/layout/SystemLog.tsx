"use client";
import React, { useState, useEffect } from 'react';

export default function SystemLog() {
  const [logs, setLogs] = useState<string[]>([]);

  const messages = [
    "FETCHING_NBS_MACRO_DATA...",
    "ANALYZING_CPI_CORRELATION...",
    "BAYSE_API_HEARTBEAT_OK",
    "RE-WEIGHTING_SOURCE_IMF_0.85",
    "SIGNAL_DIVERGENCE_DETECTED_NG-FX-001",
    "UPDATING_FAIR_VALUE_ENGINE...",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
      setLogs(prev => [`[${timestamp}] ${randomMsg}`, ...prev].slice(0, 5));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-secondary/50 border border-border rounded-2xl p-5 font-mono text-[10px] h-36 overflow-hidden backdrop-blur-sm">
      <div className="text-muted-foreground mb-3 border-b border-border pb-2 flex justify-between font-black uppercase tracking-widest">
        <span>LIVE_SYSTEM_LOG</span>
        <span className="text-primary animate-pulse">●</span>
      </div>
      <div className="space-y-1.5">
        {logs.map((log, i) => (
          <div key={i} className={i === 0 ? "text-primary font-bold" : "text-muted-foreground/60"}>
            {log}
          </div>
        ))}
      </div>
    </div>
  );
}