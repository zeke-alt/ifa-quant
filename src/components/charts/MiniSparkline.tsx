"use client";
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

const dummyData = [
  {p: 40}, {p: 45}, {p: 38}, {p: 52}, 
  {p: 48}, {p: 65}, {p: 58}, {p: 72}, 
  {p: 68}, {p: 85}
];

export default function MiniSparkline({ color = "oklch(0.65 0.22 250)" }) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dummyData}>
          <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
          <Line 
            type="basis" 
            dataKey="p" 
            stroke={color} 
            strokeWidth={2.5} 
            dot={false} 
            isAnimationActive={true}
            animationDuration={1500}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}