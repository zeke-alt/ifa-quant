"use client";
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

const dummyData = [{p:40},{p:45},{p:42},{p:50},{p:48},{p:55},{p:52},{p:60}];

export default function MiniSparkline({ color = "#3b82f6" }) {
  return (
    <div className="h-8 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dummyData}>
          <YAxis domain={['datamin', 'datamax']} hide />
          <Line type="monotone" dataKey="p" stroke={color} strokeWidth={2} dot={false} isAnimationActive />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}