"use client";
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function ConfidenceGauge({ value = 75 }) {
  // Bloomberg uses sharp transitions; oklch is great for that vivid "terminal" look
  const dynamicColor = `oklch(0.7 0.2 ${140 + (value / 100) * 80})`; 

  const data = [
    { value: value },
    { value: 100 - value },
  ];

  return (
    <div className="h-28 w-full relative flex flex-col items-center justify-end group mt-2">
      <div className="absolute inset-0 top-[-20%]"> {/* Shift chart up slightly */}
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="90%" // Moved up from 100% to prevent clipping at bottom
              startAngle={180} 
              endAngle={0}     
              innerRadius={50}
              outerRadius={65}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
              isAnimationActive={true}
            >
              <Cell 
                fill={dynamicColor} 
                className="transition-all duration-1000 ease-out" 
              />
              <Cell fill="currentColor" className="text-muted/20" /> 
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Stats Overlay */}
      <div className="relative z-10 flex flex-col items-center pb-1">
        <span 
          className="text-4xl font-mono font-bold tracking-tighter leading-none"
          style={{ color: dynamicColor }}
        >
          {value}<span className="text-[10px] ml-0.5 opacity-60">%</span>
        </span>
        <div className="flex flex-col items-center mt-1">
          <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
            Confidence
          </span>
        </div>
      </div>
    </div>
  );
}