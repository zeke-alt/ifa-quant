"use client";
import React from 'react';
import { Info, HelpCircle, Lightbulb, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TerminalTips() {
  const tips = [
    {
      icon: <Lightbulb size={12} className="text-amber-500" />,
      title: "ALPHA_DIVERGENCE",
      text: "The gap between AI Fair Value and Market Price. Higher divergence suggests potential market mispricing."
    },
    {
      icon: <Info size={12} className="text-blue-500" />,
      title: "SENTIMENT_LOGIC",
      text: "BULLISH signals indicate the AI expects a 'YES' outcome to be more likely than current market pricing."
    },
    {
      icon: <BookOpen size={12} className="text-emerald-500" />,
      title: "RISK_MANAGEMENT",
      text: "Always check 'Source Reliability'. A high probability with low reliability is a higher-risk play."
    }
  ];

  return (
    <div className="bg-card border border-border p-5 rounded-none relative overflow-hidden group">
      <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-amber-500/40" />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.3em] flex items-center gap-2">
          <HelpCircle size={14} /> Quick_Tips
        </h2>
        <span className="text-[8px] font-mono text-muted-foreground/60 uppercase">Guide</span>
      </div>

      <div className="space-y-6">
        {tips.map((tip, i) => (
          <div key={i} className="flex items-start gap-4 group/tip">
            <div className="mt-1 shrink-0 bg-accent p-1.5 rounded-sm border border-border group-hover/tip:border-amber-500/30 transition-colors">
              {tip.icon}
            </div>
            <div>
              <h4 className="text-[9px] font-bold text-foreground uppercase tracking-widest mb-1 group-hover/tip:text-amber-500 transition-colors">{tip.title}</h4>
              <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                {tip.text}
              </p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
