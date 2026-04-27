/**
 * Divergence Line Chart
 * 
 * Visualizes the historical divergence between the AI's "Fair Value" 
 * assessment and the actual crowd-driven "Market Price" from Bayse.
 */

"use client";
import React, { useEffect, useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip
} from 'recharts';

interface DivergenceLineProps {
  aiProb: number;
  eventId: string;
  marketId: string;
  marketPrice: number;
}

interface PricePoint {
  time: string;
  marketPrice: number;
  aiProb: number;
}

export default function DivergenceLine({ aiProb, eventId, marketId, marketPrice }: DivergenceLineProps) {
  const [data, setData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Price History Effect
   * 
   * Fetches the historical price data for the specific market outcome.
   * Logic: Requests 1-hour interval data from the proxy route, finds the 
   * matching marketId, and formats the 'e' (epoch) and 'p' (price) values.
   */
  useEffect(() => {
    if (!eventId || !marketId) {
      setLoading(false);
      return;
    }

    const fetchHistory = async () => {
      try {
        const res = await fetch(
          `/api/bayse/price-history/${eventId}?interval=1h`
        );
        const json = await res.json();

        // Extract the specific market's history from the event response
        const market = json.markets?.find((m: any) => m.marketId === marketId);
        const priceHistory = market?.priceHistory ?? [];

        if (priceHistory.length === 0) {
          setLoading(false);
          return;
        }

        // Format raw data for the chart component
        const formatted: PricePoint[] = priceHistory.map((point: any) => ({
          time: new Date(point.e).toLocaleDateString('en-NG', {
            month: 'short',
            day: 'numeric',
          }),
          marketPrice: parseFloat((point.p * 100).toFixed(1)), // Convert to percentage
          aiProb, // Current AI Fair Value (Constant across history for comparison)
        }));

        setData(formatted);
      } catch (err) {
        console.error('PRICE_HISTORY_FETCH_ERROR:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [eventId, marketId, aiProb]);

  /**
   * Domain Calculation Logic
   * 
   * Dynamically calculates the Y-axis bounds to ensure the lines are 
   * centered and visible, adding a 10% padding around the data range.
   */
  const domainMin = useMemo(() =>
    data.length > 0
      ? Math.max(0, Math.min(...data.map(d => d.marketPrice), aiProb) - 10)
      : 0,
    [data, aiProb]
  );

  const domainMax = useMemo(() =>
    data.length > 0
      ? Math.min(100, Math.max(...data.map(d => d.marketPrice), aiProb) + 10)
      : 100,
    [data, aiProb]
  );

  // Loading & Empty States
  if (loading) {
    return (
      <div className="h-20 w-full flex items-center justify-center">
        <div className="w-4 h-4 border border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-20 w-full flex items-center justify-center">
        <span className="text-[9px] font-mono text-slate-600">NO_HISTORY_AVAILABLE</span>
      </div>
    );
  }

  const lastMarketPrice = data[data.length - 1]?.marketPrice ?? aiProb;

  return (
    <div className="h-20 w-full relative">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <XAxis dataKey="time" hide />
          <YAxis domain={[domainMin, domainMax]} hide />
          
          {/* Custom Tooltip for detailed hovering */}
          <Tooltip
            contentStyle={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              fontSize: '10px',
              fontFamily: 'monospace',
            }}
            formatter={(value: any, name: any) => [
              `${Number(value).toFixed(1)}%`,
              name === 'aiProb' ? 'AI Fair Value' : 'Market Price',
            ]}
          />

          {/*
           * AI Fair Value (BLUE dashed)
           * Represents the assessment from Gemini. Shown as a constant
           * baseline to reveal if current market sentiment is lagging or leading.
           */}
          <Line
            type="monotone"
            dataKey="aiProb"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            strokeDasharray="4 2"
            activeDot={{ r: 3 }}
          />

          {/*
           * Real Market Price (WHITE solid)
           * Actual YES outcome prices from Bayse. Reveals the trend
           * of crowd sentiment over time.
           */}
          <Line
            type="monotone"
            dataKey="marketPrice"
            stroke="#f8fafc"
            strokeWidth={1.5}
            strokeOpacity={0.6}
            dot={false}
            activeDot={{ r: 3 }}
          />

          {/* Midpoint Reference Line */}
          <ReferenceLine
            y={(aiProb + lastMarketPrice) / 2}
            stroke="#475569"
            strokeDasharray="3 3"
            strokeWidth={0.5}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}