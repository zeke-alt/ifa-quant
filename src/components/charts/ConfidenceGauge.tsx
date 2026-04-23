/**
 * Confidence Gauge Component
 * 
 * Renders a semi-circular gauge that visualizes a percentage value.
 * Used to display AI synthesis confidence and reliability scores.
 */

"use client";
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function ConfidenceGauge({ value = 75 }) {
  /**
   * Dynamic Color Logic
   * 
   * Calculates a HSL color based on the percentage value.
   * - 0%   -> Red (0 degrees)
   * - 50%  -> Yellow (60 degrees)
   * - 100% -> Green (120 degrees)
   */
  const hue = (value / 100) * 120;
  const dynamicColor = `hsl(${hue}, 80%, 45%)`;

  /**
   * Data Preparation
   * 
   * We use two segments for the pie chart:
   * 1. The 'filled' portion representing the actual value.
   * 2. The 'remaining' portion representing the background track.
   */
  const data = [
    { value: value },
    { value: 100 - value },
  ];

  return (
    <div className="h-32 w-full relative flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="100%"
            startAngle={180} 
            endAngle={0}     
            innerRadius={60}
            outerRadius={80}
            dataKey="value"
            stroke="none"
            isAnimationActive={true}
          >
            {/* The Active Segment (The Value) */}
            <Cell fill={dynamicColor} className="transition-all duration-500" />
            
            {/* The Background Track (Dark Slate) */}
            <Cell fill="#1e293b" /> 
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      {/* Centered Text Overlay: Displays the numerical percentage */}
      <div className="absolute bottom-2 flex flex-col items-center">
        <span 
          className="text-2xl font-bold transition-colors duration-500"
          style={{ color: dynamicColor }}
        >
          {value}%
        </span>
        <span className="text-[10px] text-slate-500 uppercase font-mono tracking-widest">
          Reliability
        </span>
      </div>
    </div>
  );
}