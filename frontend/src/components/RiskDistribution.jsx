import { riskColor } from "../api";

const BANDS = [
  { key: "low", label: "Low", range: "0–24" },
  { key: "medium", label: "Medium", range: "25–49" },
  { key: "high", label: "High", range: "50–74" },
  { key: "critical", label: "Critical", range: "75–100" },
];

export default function RiskDistribution({ distribution }) {
  const total = Object.values(distribution || {}).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="space-y-4">
      {BANDS.map((b) => {
        const count = distribution?.[b.key] || 0;
        const pct = (count / total) * 100;
        const color = riskColor(b.key);
        return (
          <div key={b.key}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-xs text-text-primary font-medium">{b.label}</span>
                <span className="text-[10px] text-text-dim font-mono">{b.range}</span>
              </div>
              <span className="text-xs font-mono text-text-muted tabular-nums">
                {count.toLocaleString()} · {pct.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-panel-raised overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}66` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
