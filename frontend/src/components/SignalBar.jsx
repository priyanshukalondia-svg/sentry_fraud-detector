import { riskColor } from "../api";

/**
 * Renders a risk score as a segmented signal-strength bar rather than a bare
 * number or a plain colored pill. This is the recurring visual motif of the
 * dashboard: risk is a signal to be read at a glance, like a level meter.
 */
export default function SignalBar({ score, band, width = 88, showScore = true, size = "md" }) {
  const color = riskColor(band);
  const segments = 12;
  const filled = Math.round((score / 100) * segments);
  const heightClass = size === "sm" ? "h-2.5" : "h-3.5";

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-end gap-[2px]" style={{ width }}>
        {Array.from({ length: segments }).map((_, i) => {
          const isFilled = i < filled;
          const barHeight = size === "sm" ? 6 + (i % 3) * 2 : 8 + (i % 4) * 2.5;
          return (
            <div
              key={i}
              className={`flex-1 rounded-[1px] transition-colors ${heightClass}`}
              style={{
                height: barHeight,
                background: isFilled ? color : "#232A38",
                boxShadow: isFilled ? `0 0 6px ${color}55` : "none",
              }}
            />
          );
        })}
      </div>
      {showScore && (
        <span
          className="font-mono text-xs tabular-nums font-medium w-9 text-right"
          style={{ color }}
        >
          {score.toFixed(0)}
        </span>
      )}
    </div>
  );
}

export function RiskPill({ band }) {
  const color = riskColor(band);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider"
      style={{ color, background: `${color}1A`, border: `1px solid ${color}40` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {band}
    </span>
  );
}
