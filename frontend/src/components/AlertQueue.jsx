import SignalBar, { RiskPill } from "./SignalBar";
import { timeAgo } from "../api";

export default function AlertQueue({ items, onReview, onSelect, loading }) {
  if (!loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-full bg-signal-low/10 border border-signal-low/30 flex items-center justify-center mb-4">
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5L6.5 12L13 4" stroke="#34D399" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="font-display text-text-primary font-medium">Queue clear</div>
        <div className="text-xs text-text-dim mt-1">No high or critical risk transactions waiting on review.</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {items.map((t) => (
        <div
          key={t.id}
          className="bg-panel border border-hairline hover:border-hairline-bright rounded-lg p-4 transition-colors"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <RiskPill band={t.risk_band} />
                <span className="text-[10px] text-text-dim font-mono">{timeAgo(t.timestamp)}</span>
              </div>
              <button onClick={() => onSelect(t)} className="font-mono text-xs text-text-muted hover:text-cyan-glow transition-colors">
                {t.id}
              </button>
            </div>
            <SignalBar score={t.risk_score} band={t.risk_band} width={64} showScore={false} />
          </div>

          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-text-primary font-medium">{t.customer_name}</span>
            <span className="font-mono text-sm text-text-primary tabular-nums">${t.amount.toFixed(2)}</span>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {t.reason_codes.slice(0, 3).map((r, i) => (
              <span key={i} className="text-[10px] text-text-muted bg-panel-raised border border-hairline rounded px-2 py-1">
                {r}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onReview(t.id, "block")}
              className="flex-1 py-2 rounded-md bg-signal-critical/10 border border-signal-critical/30 text-signal-critical text-xs font-medium hover:bg-signal-critical/20 transition-colors"
            >
              Block
            </button>
            <button
              onClick={() => onReview(t.id, "approve")}
              className="flex-1 py-2 rounded-md bg-signal-low/10 border border-signal-low/30 text-signal-low text-xs font-medium hover:bg-signal-low/20 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => onSelect(t)}
              className="px-3 py-2 rounded-md border border-hairline text-text-dim hover:text-text-primary hover:border-hairline-bright text-xs transition-colors"
            >
              Details
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
