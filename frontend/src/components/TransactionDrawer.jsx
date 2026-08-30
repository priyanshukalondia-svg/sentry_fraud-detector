import SignalBar, { RiskPill } from "./SignalBar";
import { timeAgo } from "../api";

function Field({ label, value, mono = true, warn = false }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-text-dim mb-1">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""} ${warn ? "text-signal-high" : "text-text-primary"}`}>{value}</div>
    </div>
  );
}

export default function TransactionDrawer({ txn, onClose, onReview }) {
  if (!txn) return null;
  const flags = [
    { label: "CVV Match", ok: txn.cvv_match },
    { label: "AVS Match", ok: txn.avs_match },
    { label: "Shipping = Billing", ok: txn.shipping_billing_match },
    { label: "Known Device", ok: !txn.is_new_device },
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[440px] h-full bg-panel border-l border-hairline-bright overflow-y-auto animate-slide-in">
        <div className="sticky top-0 bg-panel/95 backdrop-blur-md border-b border-hairline px-6 py-5 flex items-start justify-between z-10">
          <div>
            <div className="font-mono text-xs text-text-dim mb-1">{txn.id}</div>
            <div className="flex items-center gap-2">
              <RiskPill band={txn.risk_band} />
              <span className="text-xs text-text-dim">{timeAgo(txn.timestamp)}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-text-dim hover:text-text-primary transition-colors p-1">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div className="bg-panel-raised rounded-lg p-4 border border-hairline">
            <div className="text-[10px] uppercase tracking-wider text-text-dim mb-2">Risk Score</div>
            <div className="flex items-center justify-between">
              <SignalBar score={txn.risk_score} band={txn.risk_band} width={160} />
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-hairline text-xs">
              <span className="text-text-dim">Model confidence <span className="font-mono text-text-primary">{txn.model_confidence}%</span></span>
              <span className="text-text-dim">Anomaly signal <span className="font-mono text-text-primary">{txn.anomaly_score}%</span></span>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-dim mb-2.5">Reason Codes</div>
            <div className="space-y-1.5">
              {txn.reason_codes.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-text-primary bg-panel-raised/60 rounded px-2.5 py-2">
                  <span className="w-1 h-1 rounded-full bg-signal-high mt-1.5 shrink-0" />
                  {r}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Customer" value={txn.customer_name} mono={false} />
            <Field label="Customer ID" value={txn.customer_id} />
            <Field label="Amount" value={`$${txn.amount.toFixed(2)}`} />
            <Field label="Card" value={`${txn.card_brand} •••• ${txn.card_last4}`} />
            <Field label="Merchant Category" value={txn.merchant_category} mono={false} />
            <Field label="Device" value={txn.device_type} mono={false} />
            <Field label="Billing Country" value={txn.billing_country} />
            <Field label="IP Country" value={txn.ip_country} warn={txn.billing_country !== txn.ip_country} />
            <Field label="IP/Billing Distance" value={`${txn.distance_km.toLocaleString()} km`} warn={txn.distance_km > 500} />
            <Field label="Account Age" value={`${txn.account_age_days} days`} warn={txn.account_age_days <= 3} />
            <Field label="Txns / hour" value={txn.num_txns_last_hour} warn={txn.num_txns_last_hour >= 4} />
            <Field label="Failed attempts / hr" value={txn.failed_attempts_last_hour} warn={txn.failed_attempts_last_hour >= 2} />
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-text-dim mb-2.5">Verification Flags</div>
            <div className="grid grid-cols-2 gap-2">
              {flags.map((f) => (
                <div key={f.label} className="flex items-center gap-2 bg-panel-raised/60 rounded px-2.5 py-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${f.ok ? "bg-signal-low" : "bg-signal-critical"}`} />
                  <span className="text-xs text-text-primary">{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          {onReview && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => onReview(txn.id, "block")}
                className="flex-1 py-2.5 rounded-md bg-signal-critical/15 border border-signal-critical/40 text-signal-critical text-sm font-medium hover:bg-signal-critical/25 transition-colors"
              >
                Block
              </button>
              <button
                onClick={() => onReview(txn.id, "approve")}
                className="flex-1 py-2.5 rounded-md bg-signal-low/15 border border-signal-low/40 text-signal-low text-sm font-medium hover:bg-signal-low/25 transition-colors"
              >
                Approve
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
