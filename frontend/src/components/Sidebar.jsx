const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: OverviewIcon },
  { id: "transactions", label: "Transactions", icon: TxnIcon },
  { id: "alerts", label: "Alert Queue", icon: AlertIcon },
  { id: "insert-data", label: "Insert Data", icon: UploadIcon },
];

export default function Sidebar({ active, onNavigate, pendingCount }) {
  return (
    <aside className="w-[220px] shrink-0 h-screen sticky top-0 flex flex-col border-r border-hairline bg-panel/60">
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="relative w-7 h-7 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-cyan-glow/40" />
            <div className="absolute inset-[3px] rounded-full border border-cyan-glow/70 animate-pulse-dot" />
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-glow shadow-[0_0_8px_#22D3EE]" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-semibold text-text-primary text-[15px] tracking-tight">Sentry</div>
            <div className="text-[10px] text-text-dim font-mono tracking-wide">FRAUD OPS</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors group relative ${
                isActive
                  ? "bg-panel-raised text-text-primary"
                  : "text-text-muted hover:text-text-primary hover:bg-panel-hover"
              }`}
            >
              {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-cyan-glow rounded-full" />}
              <Icon active={isActive} />
              <span>{item.label}</span>
              {item.id === "alerts" && pendingCount > 0 && (
                <span className="ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded bg-signal-critical/15 text-signal-critical border border-signal-critical/30">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-5 py-5 border-t border-hairline">
        <div className="text-[10px] text-text-dim leading-relaxed">
          Synthetic demo data.
          <br />
          Model retrains on server start.
        </div>
      </div>
    </aside>
  );
}

function OverviewIcon({ active }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 9L5 6L8 8.5L14 3" stroke={active ? "#22D3EE" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 13H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}
function TxnIcon({ active }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke={active ? "#22D3EE" : "currentColor"} strokeWidth="1.5" />
      <path d="M4.5 6.5H11.5M4.5 9H8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
function AlertIcon({ active }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L14.5 13.5H1.5L8 2Z" stroke={active ? "#22D3EE" : "currentColor"} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 6.5V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function UploadIcon({ active }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2V10M5.5 7.5L8 5L10.5 7.5" stroke={active ? "#22D3EE" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12.5V12C3 10.9 3.9 10 5 10H11C12.1 10 13 10.9 13 12V12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
