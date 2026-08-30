export default function CategoryTable({ data }) {
  const maxRate = Math.max(...(data || []).map((d) => d.fraud_rate_pct), 1);
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[1fr_60px_60px_70px] gap-2 text-[10px] uppercase tracking-wider text-text-dim px-1 pb-2 border-b border-hairline">
        <span>Category</span>
        <span className="text-right">Volume</span>
        <span className="text-right">Flagged</span>
        <span className="text-right">Rate</span>
      </div>
      {(data || []).map((row) => (
        <div
          key={row.category}
          className="grid grid-cols-[1fr_60px_60px_70px] gap-2 items-center px-1 py-2 rounded hover:bg-panel-hover transition-colors text-xs"
        >
          <span className="text-text-primary truncate">{row.category}</span>
          <span className="text-right font-mono text-text-muted tabular-nums">{row.volume}</span>
          <span className="text-right font-mono text-text-muted tabular-nums">{row.flagged}</span>
          <div className="flex items-center justify-end gap-1.5">
            <div className="w-8 h-1 rounded-full bg-panel-raised overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(row.fraud_rate_pct / maxRate) * 100}%`,
                  background: row.fraud_rate_pct > 8 ? "#FB7185" : "#22D3EE",
                }}
              />
            </div>
            <span className="font-mono tabular-nums text-text-muted w-8 text-right">{row.fraud_rate_pct}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
