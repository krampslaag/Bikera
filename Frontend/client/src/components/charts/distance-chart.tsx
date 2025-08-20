import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";

interface DistanceChartProps {
  data?: any[];
}

export function DistanceChart({ data = [] }: DistanceChartProps) {
  const chartData = data?.map((block) => ({
    timestamp: new Date(block.Timestamp).toLocaleString(),
    distance: parseFloat(block.Travel_Distance),
    target: parseFloat(block.Target_Distance)
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="timestamp" />
        <YAxis />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="distance"
          stroke="hsl(var(--primary))"
          name="Travel Distance"
        />
        <Line
          type="monotone"
          dataKey="target"
          stroke="hsl(var(--muted))"
          strokeDasharray="5 5"
          name="Target Distance"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
