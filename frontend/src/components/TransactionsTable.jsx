import SignalBar, { RiskPill } from "./SignalBar";
import { timeAgo } from "../api";

const STATUS_STYLE = {
  pending: "text-signal-medium bg-signal-medium/10 border-signal-medium/30",
  auto_approved: "text-text-dim bg-panel-raised border-hairline",
  approved: "text-signal-low bg-signal-low/10 border-signal-low/30",
  blocked: "text-signal-critical bg-signal-critical/10 border-signal-critical/30",
};
const STATUS_LABEL = {
  pending: "Pending",
  auto_approved: "Auto-approved",
  approved: "Approved",
  blocked: "Blocked",
};

export default function TransactionsTable({ items, onSelect, total, offset, limit, onPageChange, riskFilter, onRiskFilter }) {
  const bands = ["all", "critical", "high", "medium", "low"];
  return (
    <div className="bg-panel border border-hairline rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-hairline">
        {bands.map((b) => (
          <button
            key={b}
            onClick={() => onRiskFilter(b === "all" ? null : b)}
            className={`px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors ${
              (riskFilter || "all") === b
                ? "bg-panel-raised text-text-primary border border-hairline-bright"
                : "text-text-dim hover:text-text-muted"
            }`}
          >
            {b}
          </button>
        ))}
        <span className="ml-auto text-xs text-text-dim font-mono">{total.toLocaleString()} results</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-text-dim border-b border-hairline">
              <th className="px-5 py-2.5 font-medium">Transaction</th>
              <th className="px-3 py-2.5 font-medium">Customer</th>
              <th className="px-3 py-2.5 font-medium">Category</th>
              <th className="px-3 py-2.5 font-medium text-right">Amount</th>
              <th className="px-3 py-2.5 font-medium">Risk Signal</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr
                key={t.id}
                onClick={() => onSelect(t)}
                className="border-b border-hairline/60 last:border-0 hover:bg-panel-hover cursor-pointer transition-colors"
              >
                <td className="px-5 py-3 font-mono text-xs text-text-muted">{t.id}</td>
                <td className="px-3 py-3 text-text-primary">{t.customer_name}</td>
                <td className="px-3 py-3 text-text-muted text-xs">{t.merchant_category}</td>
                <td className="px-3 py-3 text-right font-mono text-text-primary tabular-nums">${t.amount.toFixed(2)}</td>
                <td className="px-3 py-3">
                  <SignalBar score={t.risk_score} band={t.risk_band} width={72} />
                </td>
                <td className="px-3 py-3">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${STATUS_STYLE[t.status]}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </td>
                <td className="px-3 py-3 text-right text-xs text-text-dim font-mono">{timeAgo(t.timestamp)}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-text-dim text-sm">
                  No transactions match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-5 py-3.5 border-t border-hairline">
        <span className="text-xs text-text-dim font-mono">
          {Math.min(offset + 1, total)}–{Math.min(offset + limit, total)} of {total.toLocaleString()}
        </span>
        <div className="flex gap-2">
          <button
            disabled={offset === 0}
            onClick={() => onPageChange(Math.max(0, offset - limit))}
            className="px-3 py-1.5 rounded text-xs border border-hairline text-text-muted hover:text-text-primary hover:border-hairline-bright disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <button
            disabled={offset + limit >= total}
            onClick={() => onPageChange(offset + limit)}
            className="px-3 py-1.5 rounded text-xs border border-hairline text-text-muted hover:text-text-primary hover:border-hairline-bright disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
