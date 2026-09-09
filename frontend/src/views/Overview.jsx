import KpiCard from "../components/KpiCard";
import VolumeChart from "../components/VolumeChart";
import RiskDistribution from "../components/RiskDistribution";
import CategoryTable from "../components/CategoryTable";
import LiveTicker from "../components/LiveTicker";

export default function Overview({ stats, timeseries, distribution, categories, liveItems, onSelectTxn }) {
  if (!stats) return null;

  const fraudDelta = stats.fraud_rate_last_24h_pct - stats.fraud_rate_prev_24h_pct;
  const volDelta = stats.volume_prev_24h ? ((stats.volume_last_24h - stats.volume_prev_24h) / stats.volume_prev_24h) * 100 : 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Fraud Rate (24h)"
            value={`${stats.fraud_rate_last_24h_pct}%`}
            delta={fraudDelta}
            deltaLabel="vs prior 24h"
            accent="#FB923C"
          />
          <KpiCard
            label="Amount at Risk"
            value={`$${stats.amount_at_risk.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            accent="#F43F5E"
          />
          <KpiCard
            label="Pending Review"
            value={stats.pending_review.toLocaleString()}
            accent="#FBBF24"
          />
          <KpiCard
            label="Volume (24h)"
            value={stats.volume_last_24h.toLocaleString()}
            delta={volDelta}
            deltaLabel="vs prior 24h"
            accent="#22D3EE"
            invertDelta
          />
        </div>

        <div className="bg-panel border border-hairline rounded-lg p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-display text-sm font-semibold text-text-primary">Transaction Volume &amp; Fraud Rate</h3>
            <div className="flex items-center gap-4 text-[10px] font-mono text-text-dim uppercase">
              <span className="flex items-center gap-1.5"><span className="w-2 h-0.5 bg-cyan-glow inline-block" /> Volume</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-0.5 bg-signal-high inline-block" /> Fraud rate</span>
            </div>
          </div>
          <p className="text-xs text-text-dim mb-2">Last 72 hours, minute buckets</p>
          <VolumeChart data={timeseries} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-panel border border-hairline rounded-lg p-5">
            <h3 className="font-display text-sm font-semibold text-text-primary mb-4">Risk Distribution</h3>
            <RiskDistribution distribution={distribution} />
          </div>
          <div className="bg-panel border border-hairline rounded-lg p-5">
            <h3 className="font-display text-sm font-semibold text-text-primary mb-1">By Merchant Category</h3>
            <p className="text-xs text-text-dim mb-3">Flagged rate per category, all-time</p>
            <CategoryTable data={categories} />
          </div>
        </div>
      </div>

      <div className="bg-panel border border-hairline rounded-lg p-4 h-[calc(100vh-140px)] sticky top-24">
        <LiveTicker items={liveItems} onSelect={onSelectTxn} />
      </div>
    </div>
  );
}
