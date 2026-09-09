import { useCallback, useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import Overview from "./views/Overview";
import TransactionsTable from "./components/TransactionsTable";
import AlertQueue from "./components/AlertQueue";
import TransactionDrawer from "./components/TransactionDrawer";
import { api, useLiveFeed } from "./api";

const REFRESH_MS = 6000;

function bucketKey(iso) {
  const dt = new Date(iso);
  const roundedMinutes = Math.floor(dt.getUTCMinutes() / 5) * 5;
  const utc = new Date(Date.UTC(
    dt.getUTCFullYear(),
    dt.getUTCMonth(),
    dt.getUTCDate(),
    dt.getUTCHours(),
    roundedMinutes,
    0,
    0
  ));
  return utc.toISOString().slice(0, 16);
}

function mergeLiveTransactionIntoSeries(series, txn) {
  if (!txn?.timestamp) return series;

  const key = bucketKey(txn.timestamp);
  const next = [...series];
  const index = next.findIndex((item) => item.hour === key);
  const isFlagged = ["high", "critical"].includes(txn.risk_band);

  if (index >= 0) {
    const item = next[index];
    const volume = item.volume + 1;
    const flagged = item.flagged + (isFlagged ? 1 : 0);
    next[index] = {
      ...item,
      volume,
      flagged,
      fraud_rate_pct: volume ? (flagged / volume) * 100 : 0,
      amount: (item.amount || 0) + (txn.amount || 0),
    };
    return next.sort((a, b) => a.hour.localeCompare(b.hour));
  }

  next.push({
    hour: key,
    volume: 1,
    flagged: isFlagged ? 1 : 0,
    fraud_rate_pct: isFlagged ? 100 : 0,
    amount: txn.amount || 0,
  });

  return next.sort((a, b) => a.hour.localeCompare(b.hour));
}

export default function App() {
  const [view, setView] = useState("overview");
  const [stats, setStats] = useState(null);
  const [timeseries, setTimeseries] = useState([]);
  const [distribution, setDistribution] = useState(null);
  const [categories, setCategories] = useState([]);
  const [liveItems, setLiveItems] = useState([]);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  // Transactions view state
  const [txnPage, setTxnPage] = useState({ items: [], total: 0 });
  const [offset, setOffset] = useState(0);
  const [riskFilter, setRiskFilter] = useState(null);
  const [search, setSearch] = useState("");
  const limit = 20;

  // Alerts view state
  const [alertItems, setAlertItems] = useState([]);

  const refreshOverview = useCallback(async () => {
    try {
      const [s, ts, dist, cats] = await Promise.all([
        api.stats(),
        api.timeseries(72),
        api.riskDistribution(),
        api.categoryBreakdown(),
      ]);
      setStats(s);
      setTimeseries(ts);
      setDistribution(dist);
      setCategories(cats);
      setApiError(false);
    } catch (e) {
      setApiError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshTransactions = useCallback(async () => {
    try {
      const res = await api.transactions({ limit, offset, risk_band: riskFilter, search: search || undefined });
      setTxnPage(res);
      setApiError(false);
    } catch (e) {
      setApiError(true);
    }
  }, [offset, riskFilter, search]);

  const refreshAlerts = useCallback(async () => {
    try {
      const res = await api.alerts(50);
      setAlertItems(res.items);
      setApiError(false);
    } catch (e) {
      setApiError(true);
    }
  }, []);

  // Initial + periodic refresh depending on active view
  useEffect(() => {
    refreshOverview();
    const t = setInterval(refreshOverview, REFRESH_MS);
    return () => clearInterval(t);
  }, [refreshOverview]);

  useEffect(() => {
    if (view === "transactions") {
      refreshTransactions();
      const t = setInterval(refreshTransactions, REFRESH_MS);
      return () => clearInterval(t);
    }
  }, [view, refreshTransactions]);

  useEffect(() => {
    if (view === "alerts") {
      refreshAlerts();
      const t = setInterval(refreshAlerts, REFRESH_MS);
      return () => clearInterval(t);
    }
  }, [view, refreshAlerts]);

  // Live WebSocket feed for the overview ticker and the chart
  const { connected } = useLiveFeed((txn) => {
    setLiveItems((prev) => [txn, ...prev].slice(0, 30));
    setTimeseries((prev) => mergeLiveTransactionIntoSeries(prev, txn));
  });

  const handleReview = async (id, decision) => {
    await api.review(id, decision);
    setAlertItems((prev) => prev.filter((t) => t.id !== id));
    setSelectedTxn(null);
    refreshOverview();
  };

  const handleNavigate = (v) => {
    setView(v);
    setOffset(0);
  };

  return (
    <div className="min-h-screen bg-void text-text-primary font-body flex overflow-x-hidden">
      <Sidebar active={view} onNavigate={handleNavigate} pendingCount={stats?.pending_review || 0} />

      <div className="flex-1 min-w-0">
        <TopBar
          view={view}
          connected={connected}
          avgRisk={stats?.avg_risk_score || 0}
          search={search}
          onSearch={(v) => {
            setSearch(v);
            setOffset(0);
          }}
        />

        <main className="px-6 py-5">
          {apiError && (
            <div className="mb-5 bg-signal-critical/10 border border-signal-critical/30 rounded-lg px-4 py-3 text-sm text-signal-critical">
              Can't reach the backend at <span className="font-mono">localhost:8000</span>. Make sure the FastAPI
              server is running (see README).
            </div>
          )}

          {loading && !stats ? (
            <div className="flex items-center justify-center h-[60vh] text-text-dim text-sm font-mono">
              Loading fraud signal…
            </div>
          ) : (
            <>
              {view === "overview" && stats && (
                <Overview
                  stats={stats}
                  timeseries={timeseries}
                  distribution={distribution}
                  categories={categories}
                  liveItems={liveItems}
                  onSelectTxn={setSelectedTxn}
                />
              )}

              {view === "transactions" && (
                <TransactionsTable
                  items={txnPage.items}
                  total={txnPage.total}
                  offset={offset}
                  limit={limit}
                  onPageChange={setOffset}
                  riskFilter={riskFilter}
                  onRiskFilter={(b) => {
                    setRiskFilter(b);
                    setOffset(0);
                  }}
                  onSelect={setSelectedTxn}
                />
              )}

              {view === "alerts" && (
                <AlertQueue items={alertItems} onReview={handleReview} onSelect={setSelectedTxn} />
              )}
            </>
          )}
        </main>
      </div>

      {selectedTxn && (
        <TransactionDrawer
          txn={selectedTxn}
          onClose={() => setSelectedTxn(null)}
          onReview={selectedTxn.status === "pending" ? handleReview : null}
        />
      )}
    </div>
  );
}
