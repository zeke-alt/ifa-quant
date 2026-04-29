'use client';
import { useMemo } from 'react';
import { MacroSignal } from '@/types/macro';
import { cn } from '@/lib/utils';
import { TrendingUp, Droplets, MessageSquare, Target, Activity } from 'lucide-react';

interface OjaScoreProps {
  signals: MacroSignal[];
}

function computeOjaScore(signals: MacroSignal[]) {
  if (!signals.length) return { score: 0, label: 'DEAD', color: 'text-slate-500', ringColor: '#334155', components: null };

  const divergences = signals.map(s => Math.abs(Number(s.probability) - (1 - Number(s.source_reliability))));
  const avgDivergence = divergences.reduce((a, b) => a + b, 0) / divergences.length;
  const divergenceScore = Math.min(100, avgDivergence * 200);

  const avgReliability = signals.reduce((a, s) => a + Number(s.source_reliability), 0) / signals.length;
  const liquidityScore = avgReliability < 0.2 ? avgReliability * 100 * 0.3 : Math.min(100, avgReliability * 120);

  const sentimentMap: Record<string, number> = { BULLISH: 1, NEUTRAL: 0.4, BEARISH: 0.2, RISK_ALERT: 0 };
  const avgSentiment = signals.reduce((a, s) => a + (sentimentMap[s.sentiment] ?? 0.4), 0) / signals.length;
  const sentimentScore = avgSentiment * 100;

  const avgConfidence = signals.reduce((a, s) => a + Math.abs(Number(s.probability) - 0.5) * 2, 0) / signals.length;
  const confidenceScore = avgConfidence * 100;

  const raw = divergenceScore * 0.45 + liquidityScore * 0.25 + sentimentScore * 0.15 + confidenceScore * 0.15;
  const score = Math.round(Math.min(100, raw));

  const label = score >= 86 ? 'EUPHORIC' : score >= 71 ? 'HOT' : score >= 56 ? 'OPPORTUNISTIC' : score >= 41 ? 'CAUTIOUS' : score >= 26 ? 'COLD' : 'DEAD';

  const color =
    score >= 71 ? 'text-emerald-500' :
    score >= 56 ? 'text-orange-500' :
    score >= 41 ? 'text-sky-500' :
    score >= 26 ? 'text-slate-500' :
    'text-rose-500';

  const ringColor =
    score >= 71 ? '#10b981' :
    score >= 56 ? '#f97316' :
    score >= 41 ? '#0ea5e9' :
    score >= 26 ? '#64748b' :
    '#f43f5e';

  return {
    score, label, color, ringColor,
    components: {
      divergence: Math.round(divergenceScore),
      liquidity: Math.round(liquidityScore),
      sentiment: Math.round(sentimentScore),
      confidence: Math.round(confidenceScore),
    }
  };
}

export default function OjaScore({ signals }: OjaScoreProps) {
  const { score, label, color, ringColor, components } = useMemo(
    () => computeOjaScore(signals),
    [signals]
  );

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-6">
        {/* Sharp Gauge */}
        <div className="relative shrink-0 w-[100px] h-[100px] border border-white/5 p-2">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-2xl font-mono font-bold leading-none tracking-tighter", color)}>{score}</span>
            <span className="text-[7px] font-bold text-slate-600 mt-1 uppercase">Score</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1 bg-white/5 border border-white/5">
               <Activity size={10} className={color} />
            </div>
            <h2 className={cn("text-sm font-bold tracking-widest uppercase", color)}>{label}</h2>
          </div>
          <div className="space-y-1 mb-4">
             <div className="flex items-center gap-2">
                <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Inference_Engine:</span>
                <span className="text-[8px] font-mono font-bold text-slate-400">OJA_v4_STABLE</span>
             </div>
             <div className="flex items-center gap-2">
                <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Vector_Sync:</span>
                <span className="text-[8px] font-mono font-bold text-slate-400">{signals.length}_NODES</span>
             </div>
          </div>
        </div>
      </div>

      {components && (
        <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-4">
          {[
            { label: 'Divergence', value: components.divergence, color: 'text-orange-500', bar: 'bg-orange-500', icon: Target },
            { label: 'Liquidity', value: components.liquidity, color: 'text-emerald-500', bar: 'bg-emerald-500', icon: Droplets },
            { label: 'Sentiment', value: components.sentiment, color: 'text-sky-500', bar: 'bg-sky-500', icon: MessageSquare },
            { label: 'Reliability', value: components.confidence, color: 'text-purple-500', bar: 'bg-purple-500', icon: TrendingUp },
          ].map(({ label, value, color, bar, icon: Icon }) => (
            <div key={label} className="bg-white/[0.02] border border-white/5 p-2 font-mono">
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon size={10} className={cn("opacity-40", color)} />
                  <span className="text-[7px] font-bold text-slate-600 uppercase">{label}</span>
                </div>
                <span className={cn("text-[9px] font-bold", color)}>{value}%</span>
              </div>
              <div className="h-0.5 bg-white/5 w-full">
                <div className={cn("h-full transition-all duration-1000", bar)} style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}