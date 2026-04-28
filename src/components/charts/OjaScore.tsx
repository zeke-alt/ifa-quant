
'use client';
import { useMemo } from 'react';
import { MacroSignal } from '@/types/macro';

interface OjaScoreProps {
  signals: MacroSignal[];
}



function computeOjaScore(signals: MacroSignal[]) {
  if (!signals.length) return { score: 0, label: 'DEAD', color: 'text-slate-500', ringColor: '#334155', glowColor: 'transparent', components: null, confidenceGated: false };

  // 1. Divergence Score (45%)
  const divergences = signals.map(s =>
    Math.abs(Number(s.probability) - (1 - Number(s.source_reliability)))
  );
  const avgDivergence = divergences.reduce((a, b) => a + b, 0) / divergences.length;
  const divergenceScore = Math.min(100, avgDivergence * 200);

  // 2. Liquidity Score (25%) — approximated from source_reliability
  const avgReliability = signals.reduce((a, s) => a + Number(s.source_reliability), 0) / signals.length;
  const liquidityScore = avgReliability < 0.2
    ? avgReliability * 100 * 0.3
    : Math.min(100, avgReliability * 120);

  // 3. Sentiment Score (15%)
  const sentimentMap: Record<string, number> = {
    BULLISH: 1, NEUTRAL: 0.4, BEARISH: 0.2, RISK_ALERT: 0
  };
  const avgSentiment = signals.reduce((a, s) =>
    a + (sentimentMap[s.sentiment] ?? 0.4), 0) / signals.length;
  const sentimentContradicts = avgSentiment < 0.3 && divergenceScore > 60;
  const sentimentScore = sentimentContradicts ? avgSentiment * 60 : avgSentiment * 100;

  // 4. Confidence Score (15%)
  const avgConfidence = signals.reduce((a, s) =>
    a + Math.abs(Number(s.probability) - 0.5) * 2, 0) / signals.length;
  const confidenceScore = avgConfidence * 100;
  const confidenceGated = confidenceScore < 10;

  // Weighted composite
  const raw =
    divergenceScore * 0.45 +
    liquidityScore  * 0.25 +
    sentimentScore  * 0.15 +
    confidenceScore * 0.15;

  const score = Math.round(confidenceGated ? Math.min(30, raw) : Math.min(100, raw));

  const label =
    score >= 86 ? 'EUPHORIC' :
    score >= 71 ? 'HOT' :
    score >= 56 ? 'OPPORTUNISTIC' :
    score >= 41 ? 'CAUTIOUS' :
    score >= 26 ? 'COLD' :
    'DEAD';

  const color =
    score >= 71 ? 'text-green-600 dark:text-green-400' :
    score >= 56 ? 'text-orange-600 dark:text-orange-400' :
    score >= 41 ? 'text-blue-600 dark:text-blue-400' :
    score >= 26 ? 'text-muted-foreground' :
    'text-red-600 dark:text-red-400';

  const ringColor =
    score >= 71 ? '#22c55e' :
    score >= 56 ? '#f97316' :
    score >= 41 ? '#3b82f6' :
    score >= 26 ? '#475569' :
    '#ef4444';

  const glowColor =
    score >= 71 ? 'rgba(34,197,94,0.25)' :
    score >= 56 ? 'rgba(249,115,22,0.25)' :
    score >= 41 ? 'rgba(59,130,246,0.25)' :
    'transparent';

  return {
    score, label, color, ringColor, glowColor, confidenceGated,
    components: {
      divergence: Math.round(divergenceScore),
      liquidity: Math.round(liquidityScore),
      sentiment: Math.round(sentimentScore),
      confidence: Math.round(confidenceScore),
    }
  };
}

const LABEL_DESCRIPTION: Record<string, string> = {
  EUPHORIC:      'Exceptional opportunity. High conviction across all signals.',
  HOT:           'Strong divergence. Multiple high-quality setups available.',
  OPPORTUNISTIC: 'Solid edge exists. Select trades carefully.',
  CAUTIOUS:      'Mixed signals. Wait for higher conviction.',
  COLD:          'Low activity. Limited edge in current markets.',
  DEAD:          'No meaningful signal detected. Stay flat.',
};

const COMPONENTS = [
  { key: 'divergence' as const, label: 'Divergence',  weight: '45%', trackColor: 'bg-orange-500/80' },
  { key: 'liquidity'  as const, label: 'Liquidity',   weight: '25%', trackColor: 'bg-blue-500/80'   },
  { key: 'Sentiment'  as const, label: 'Sentiment',   weight: '15%', trackColor: 'bg-purple-500/80' },
  { key: 'confidence' as const, label: 'Confidence',  weight: '15%', trackColor: 'bg-green-500/80'  },
] as const;



export default function OjaScore({ signals }: OjaScoreProps) {
  const { score, label, color, ringColor, glowColor, confidenceGated, components } = useMemo(
    () => computeOjaScore(signals),
    [signals]
  );

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="w-full space-y-4">

      {/* ── Ring + label ── */}
      <div className="flex items-center gap-6">

        {/* SVG ring gauge */}
        <div
          className="relative shrink-0 w-[120px] h-[120px] rounded-full"
          style={{ boxShadow: `0 0 28px 4px ${glowColor}` }}
        >
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            {/* track */}
            <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--secondary)" strokeWidth="9" />
            {/* filled arc */}
            <circle
              cx="60" cy="60" r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1), stroke 0.6s ease' }}
            />
          </svg>

          {/* center readout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-[28px] font-black font-mono leading-none ${color}`}>{score}</span>
            <span className="text-[9px] font-black text-muted-foreground mt-1 opacity-50">/100</span>
          </div>
        </div>

        {/* label block */}
        <div className="min-w-0 flex flex-col items-start">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-xl font-black tracking-tighter leading-none ${color}`}>{label}</span>
            {confidenceGated && (
              <span className="text-[8px] font-black bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-lg uppercase tracking-widest">
                GATED
              </span>
            )}
          </div>
          <p className="text-[11px] font-medium text-muted-foreground leading-relaxed italic opacity-80">
            {LABEL_DESCRIPTION[label]}
          </p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Oja Score™</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span className="text-[9px] font-black text-muted-foreground opacity-60">{signals.length} SIGNAL{signals.length !== 1 ? 'S' : ''}</span>
          </div>
        </div>
      </div>

      {/* ── Component breakdown ── */}
      {components && (
        <div className="space-y-4 pt-6 border-t border-border/50">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40">Score Breakdown</p>
          {[
            { label: 'Divergence',  value: components.divergence,  weight: '45%', trackColor: 'bg-orange-500' },
            { label: 'Liquidity',   value: components.liquidity,   weight: '25%', trackColor: 'bg-primary'    },
            { label: 'Sentiment',   value: components.sentiment,   weight: '15%', trackColor: 'bg-purple-500' },
            { label: 'Confidence',  value: components.confidence,  weight: '15%', trackColor: 'bg-green-500'},
          ].map(({ label, value, weight, trackColor }) => (
            <div key={label}>
              <div className="flex justify-between items-center mb-1.5 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-foreground/80 uppercase tracking-wider">{label}</span>
                  <span className="text-[9px] font-medium text-muted-foreground opacity-50">({weight})</span>
                </div>
                <span className="text-[10px] font-black text-foreground font-mono tabular-nums">{value}</span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${trackColor} transition-all duration-1000 shadow-[0_0_8px_rgba(0,0,0,0.1)]`}
                  style={{ width: `${value}%`, opacity: 0.9 }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}