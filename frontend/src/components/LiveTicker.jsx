import SignalBar, { RiskPill } from "./SignalBar";
import { timeAgo } from "../api";

export default function LiveTicker({ items, onSelect }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm font-semibold text-text-primary">Live Feed</h3>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-text-dim uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-glow animate-pulse-dot" /> streaming
        </span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 -mr-1">
        {items.length === 0 && (
          <div className="text-xs text-text-dim py-8 text-center">Waiting for transactions…</div>
        )}
        {items.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className="w-full text-left bg-panel-raised/60 hover:bg-panel-hover border border-hairline hover:border-hairline-bright rounded-md px-3 py-2.5 transition-all animate-slide-in"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[11px] text-text-muted truncate max-w-[110px]">{t.id}</span>
              <span className="text-[10px] text-text-dim font-mono">{timeAgo(t.timestamp)}</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-primary font-medium truncate">{t.customer_name}</span>
              <span className="font-mono text-xs text-text-primary tabular-nums">${t.amount.toFixed(2)}</span>
            </div>
            <SignalBar score={t.risk_score} band={t.risk_band} width={64} size="sm" />
          </button>
        ))}
      </div>
    </div>
  );
}
