import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Line, ComposedChart } from "recharts";

function fmtHour(h) {
  const d = new Date(h + ":00Z");
  return d.toLocaleString("en-US", { hour: "numeric", hour12: true, month: "short", day: "numeric" }).replace(",", "");
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const volume = payload.find((p) => p.dataKey === "volume")?.value ?? 0;
  const rate = payload.find((p) => p.dataKey === "fraud_rate_pct")?.value ?? 0;
  return (
    <div className="bg-panel-raised border border-hairline-bright rounded-md px-3 py-2 shadow-xl">
      <div className="text-[10px] text-text-dim font-mono mb-1">{fmtHour(label)}</div>
      <div className="text-xs text-text-primary font-mono">
        <span className="text-cyan-glow">{volume}</span> transactions
      </div>
      <div className="text-xs font-mono" style={{ color: rate > 8 ? "#FB7185" : "#8891A3" }}>
        {rate}% flagged
      </div>
    </div>
  );
}

export default function VolumeChart({ data = [] }) {
  const chartMinWidth = Math.max((data.length || 1) * 52, 900);

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: `${chartMinWidth}px` }}>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1A2029" vertical={false} />
            <XAxis
              dataKey="hour"
              tickFormatter={fmtHour}
              tick={{ fill: "#545D70", fontSize: 10, fontFamily: "JetBrains Mono" }}
              axisLine={{ stroke: "#232A38" }}
              tickLine={false}
              minTickGap={20}
              interval={0}
            />
            <YAxis yAxisId="left" tick={{ fill: "#545D70", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} width={30} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: "#545D70", fontSize: 10, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} width={30} unit="%" />
            <Tooltip content={<CustomTooltip />} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="volume"
              stroke="#22D3EE"
              strokeWidth={1.5}
              fill="url(#volumeGrad)"
              isAnimationActive={false}
              activeDot={{ r: 4, fill: "#22D3EE", stroke: "#0F172A", strokeWidth: 2 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="fraud_rate_pct"
              stroke="#FB923C"
              strokeWidth={1.75}
              dot={{ r: 2.5, fill: "#FB923C", stroke: "#FB923C" }}
              activeDot={{ r: 4, fill: "#FB923C", stroke: "#0F172A", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
