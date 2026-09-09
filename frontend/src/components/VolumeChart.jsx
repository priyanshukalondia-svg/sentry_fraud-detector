import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function parseBucketTime(value) {
  if (!value) return null;

  const normalized = typeof value === "string" && value.includes("T") ? `${value.replace("Z", "")}:00Z` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function fmtTime(value) {
  const date = parseBucketTime(value);
  if (!date) return "";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(",", "");
}

function toNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const volume = payload.find((p) => p.dataKey === "volume")?.value ?? 0;
  const rate = payload.find((p) => p.dataKey === "fraudRate")?.value ?? 0;

  return (
    <div className="bg-panel-raised border border-hairline-bright rounded-md px-3 py-2 shadow-xl">
      <div className="text-[10px] text-text-dim font-mono mb-1">{fmtTime(label)}</div>
      <div className="text-xs text-text-primary font-mono">
        <span className="text-cyan-glow">{toNumber(volume)}</span> transactions
      </div>
      <div className="text-xs font-mono" style={{ color: toNumber(rate) > 8 ? "#FB7185" : "#8891A3" }}>
        {toNumber(rate).toFixed(1)}% flagged
      </div>
    </div>
  );
}

export default function VolumeChart({ data = [] }) {
  const chartData = (Array.isArray(data) ? data : []).map((item) => {
    const volume = toNumber(item.volume);
    const flagged = toNumber(item.flagged);
    const rawRate = toNumber(item.fraud_rate_pct);
    const computedRate = volume ? (flagged / volume) * 100 : 0;

    return {
      ...item,
      hour: item.hour ?? item.timestamp ?? item.time ?? "",
      volume,
      flagged,
      fraudRate: rawRate || computedRate,
    };
  });

  if (!chartData.length) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed border-hairline text-xs text-text-dim font-mono">
        No transaction data available
      </div>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="#1A2029" vertical={false} />

          <XAxis
            dataKey="hour"
            tickFormatter={fmtTime}
            tick={{ fill: "#545D70", fontSize: 10, fontFamily: "JetBrains Mono" }}
            axisLine={{ stroke: "#232A38" }}
            tickLine={false}
            minTickGap={36}
            interval={0}
          />

          <YAxis
            yAxisId="left"
            tick={{ fill: "#545D70", fontSize: 10, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
            width={32}
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            unit="%"
            tick={{ fill: "#545D70", fontSize: 10, fontFamily: "JetBrains Mono" }}
            axisLine={false}
            tickLine={false}
            width={36}
          />

          <Tooltip content={<CustomTooltip />} />

          <Bar
            yAxisId="left"
            dataKey="volume"
            fill="url(#volumeGrad)"
            stroke="#22D3EE"
            strokeWidth={1.5}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />

          <Line
            yAxisId="right"
            type="monotone"
            dataKey="fraudRate"
            stroke="#FB923C"
            strokeWidth={2.2}
            dot={{ r: 2.5, fill: "#FB923C", stroke: "#FB923C" }}
            activeDot={{ r: 4, fill: "#FB923C", stroke: "#0F172A", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
