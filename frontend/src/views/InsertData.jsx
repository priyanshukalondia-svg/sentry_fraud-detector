import { useRef, useState } from "react";

const SAMPLE_COLUMNS = [
  "id",
  "timestamp",
  "customer_id",
  "customer_name",
  "amount",
  "currency",
  "merchant_category",
  "billing_country",
  "ip_country",
  "distance_km",
  "device_type",
  "is_new_device",
  "account_age_days",
  "num_txns_last_hour",
  "num_txns_last_24h",
  "failed_attempts_last_hour",
  "cvv_match",
  "avs_match",
  "shipping_billing_match",
  "email_domain_age_days",
  "night_txn",
  "card_brand",
  "card_last4",
  "hour_of_day",
  "risk_band",
  "risk_score",
  "model_confidence",
  "anomaly_score",
];

export default function InsertData({ onUpload, uploading, lastMessage, manualMode, onRestoreLive }) {
  const inputRef = useRef(null);
  const [selectedName, setSelectedName] = useState("");

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedName(file.name);
    await onUpload(file);
    event.target.value = null;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-hairline bg-panel p-6 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Import transactions from file</h2>
            <p className="mt-2 text-sm text-text-dim">
              This pauses automatic synthetic generation and uses the uploaded transaction list to rebuild the overview, alert queue, and risk analysis.
            </p>
          </div>

          {manualMode && (
            <button
              onClick={onRestoreLive}
              className="rounded-md border border-cyan-glow/40 bg-cyan-glow/10 px-3 py-2 text-xs font-medium text-cyan-glow hover:bg-cyan-glow/20 transition-colors"
            >
              Resume live generation
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div className="rounded-xl border border-dashed border-hairline bg-panel-raised px-4 py-5 text-sm text-text-muted">
            <div className="font-medium text-text-primary">Upload file</div>
            <div className="mt-1">CSV, XLSX, or XLS</div>
          </div>

          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-md bg-cyan-glow px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? "Uploading..." : "Choose file"}
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />

        {selectedName && (
          <div className="mt-4 rounded-md border border-hairline bg-panel-hover px-3 py-2 text-sm text-text-primary">
            Selected file: <span className="font-medium">{selectedName}</span>
          </div>
        )}

        {lastMessage && (
          <div className="mt-4 rounded-md border border-cyan-glow/30 bg-cyan-glow/10 px-3 py-2 text-sm text-cyan-glow">
            {lastMessage}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-hairline bg-panel p-6 shadow-panel">
        <h3 className="text-lg font-semibold text-text-primary">Accepted format</h3>
        <p className="mt-2 text-sm text-text-dim">
          Use a flat table with one row per transaction. Column names can be close matches to the schema below; the system normalizes common aliases automatically.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline text-text-muted">
                <th className="py-2 pr-4">Column</th>
                <th className="py-2 pr-4">Example</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_COLUMNS.map((column) => (
                <tr key={column} className="border-b border-hairline/70 text-text-primary">
                  <td className="py-2 pr-4 font-mono text-xs">{column}</td>
                  <td className="py-2 pr-4 text-text-dim">
                    {column === "amount" && "120.50"}
                    {column === "timestamp" && "2026-09-10T14:30:00Z"}
                    {column === "is_new_device" && "true"}
                    {column === "cvv_match" && "false"}
                    {column === "risk_band" && "high"}
                    {column === "score" && "82.5"}
                    {!['amount','timestamp','is_new_device','cvv_match','risk_band','score'].includes(column) && 'sample value'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
