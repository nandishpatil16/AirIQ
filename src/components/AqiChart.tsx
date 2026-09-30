'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { CloudLightning } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 border border-slate-200 shadow-lg rounded-xl">
        <p className="font-semibold text-slate-700 mb-2">{label}</p>
        <p className="text-xl font-bold text-blue-600 mb-2">AQI: {data.predictedAqi}</p>
        <div className="border-t border-slate-100 pt-2 mt-2">
          <p className="text-xs text-slate-500 font-medium">Humidity: <span className="text-slate-800 font-semibold">{data.humidity}%</span></p>
          <p className="text-xs text-slate-500 font-medium">API Wind: <span className="text-slate-800 font-semibold">{data.windSpeed} km/h</span></p>
        </div>
      </div>
    );
  }
  return null;
};

export default function AqiChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center rounded-2xl bg-slate-50/50 border border-dashed border-slate-300 p-6 text-center">
        <CloudLightning className="w-8 h-8 text-slate-300 mb-3 animate-pulse" />
        <p className="text-slate-700 font-medium tracking-tight mb-1">Awaiting Telemetry</p>
        <p className="text-slate-500 text-xs font-medium max-w-[200px]">The AI model requires an initial baseline reading from the ESP32 to generate forecasts.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="colorAqi" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis 
          dataKey="time" 
          stroke="#64748b" 
          fontSize={11} 
          tickLine={false}
          axisLine={false}
          tickMargin={12} 
        />
        <YAxis 
          stroke="#64748b" 
          fontSize={11} 
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value}`} 
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
        <Area 
          type="monotone" 
          dataKey="predictedAqi" 
          stroke="#2563eb" 
          strokeWidth={3}
          fillOpacity={1} 
          fill="url(#colorAqi)"
          name="Predicted AQI"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
