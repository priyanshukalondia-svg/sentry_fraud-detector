import ScopeGauge from "./ScopeGauge";

const VIEW_TITLES = {
  overview: ["Overview", "Live signal across all processed transactions"],
  transactions: ["Transactions", "Search and inspect every scored transaction"],
  alerts: ["Alert Queue", "High and critical risk transactions awaiting review"],
};

export default function TopBar({ view, connected, avgRisk, search, onSearch }) {
  const [title, subtitle] = VIEW_TITLES[view] || ["", ""];
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-6 px-8 py-5 border-b border-hairline bg-void/85 backdrop-blur-md">
      <div>
        <h1 className="font-display text-xl font-semibold text-text-primary tracking-tight">{title}</h1>
        <p className="text-xs text-text-dim mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-5">
        {view !== "overview" && (
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="#545D70" strokeWidth="1.5" />
              <path d="M11 11L14 14" stroke="#545D70" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search ID, customer, category..."
              className="bg-panel border border-hairline rounded-md pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-dim w-64 focus:outline-none focus:border-cyan-glow/50 focus:ring-1 focus:ring-cyan-glow/20 transition-colors"
            />
          </div>
        )}

        <div className="flex items-center gap-2 pl-1">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-signal-low animate-pulse-dot" : "bg-signal-critical"}`} />
          <span className="text-[11px] font-mono text-text-muted uppercase tracking-wide">
            {connected ? "Live" : "Reconnecting"}
          </span>
        </div>

        <div className="w-px h-9 bg-hairline" />

        <ScopeGauge value={avgRisk} />
      </div>
    </header>
  );
}
