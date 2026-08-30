export default function KpiCard({ label, value, delta, deltaLabel, accent = "#22D3EE", invertDelta = false }) {
  const hasDelta = delta !== undefined && delta !== null;
  const isUp = hasDelta && delta > 0;
  const isGood = hasDelta && (invertDelta ? delta < 0 : delta < 0); // for fraud metrics, down = good
  return (
    <div className="relative bg-panel border border-hairline rounded-lg p-5 overflow-hidden group hover:border-hairline-bright transition-colors">
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.08] blur-2xl transition-opacity group-hover:opacity-[0.14]"
        style={{ background: accent }}
      />
      <div className="text-[11px] uppercase tracking-wider text-text-dim font-medium mb-2.5">{label}</div>
      <div className="font-mono text-2xl font-semibold text-text-primary tabular-nums">{value}</div>
      {hasDelta && (
        <div className="flex items-center gap-1 mt-2">
          <svg width="10" height="10" viewBox="0 0 10 10" className={isUp ? "" : "rotate-180"}>
            <path
              d="M5 1.5L8.5 7H1.5L5 1.5Z"
              fill={hasDelta && (invertDelta ? isUp : !isUp) ? "#34D399" : "#FB7185"}
            />
          </svg>
          <span
            className="text-xs font-mono tabular-nums"
            style={{ color: (invertDelta ? isUp : !isUp) ? "#34D399" : "#FB7185" }}
          >
            {Math.abs(delta).toFixed(1)}
            {typeof delta === "number" && Math.abs(delta) < 100 ? "%" : ""}
          </span>
          <span className="text-xs text-text-dim ml-0.5">{deltaLabel}</span>
        </div>
      )}
    </div>
  );
}
