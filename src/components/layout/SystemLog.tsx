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
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[9px] h-32 overflow-hidden">
      <div className="text-slate-500 mb-2 border-b border-slate-800 pb-1 flex justify-between">
        <span>LIVE_SYSTEM_LOG</span>
        <span className="animate-pulse">●</span>
      </div>
      <div className="space-y-1">
        {logs.map((log, i) => (
          <div key={i} className={i === 0 ? "text-blue-400" : "text-slate-600"}>
            {log}
          </div>
        ))}
      </div>
    </div>
  );
}