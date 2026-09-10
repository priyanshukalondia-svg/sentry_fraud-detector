import { useEffect, useRef, useState, useCallback } from "react";

const DEFAULT_API_BASE = "https://fraud-detection-scheme.onrender.com";
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/$/, "");

const DEFAULT_WS_URL = `${API_BASE.startsWith("https") ? "wss" : "ws"}://${new URL(API_BASE).host}/ws/live`;
const WS_URL = import.meta.env.VITE_WS_URL || DEFAULT_WS_URL;

async function j(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

export const api = {
  health: () => j(`${API_BASE}/api/health`),
  stats: () => j(`${API_BASE}/api/stats`),
  modelMetrics: () => j(`${API_BASE}/api/model/metrics`),
  timeseries: (hours = 72) => j(`${API_BASE}/api/timeseries?hours=${hours}`),
  riskDistribution: () => j(`${API_BASE}/api/risk-distribution`),
  categoryBreakdown: () => j(`${API_BASE}/api/category-breakdown`),
  transactions: ({ limit = 50, offset = 0, risk_band, status, search } = {}) => {
    const params = new URLSearchParams({ limit, offset });
    if (risk_band) params.set("risk_band", risk_band);
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    return j(`${API_BASE}/api/transactions?${params.toString()}`);
  },
  alerts: (limit = 25) => j(`${API_BASE}/api/alerts?limit=${limit}`),
  review: (id, decision) =>
    fetch(`${API_BASE}/api/transactions/${id}/review?decision=${decision}`, { method: "POST" }).then((r) =>
      r.json()
    ),
  stopLiveGeneration: () => fetch(`${API_BASE}/api/data/stop-live-generation`, { method: "POST" }).then((r) => r.json()),
  resumeLiveGeneration: () => fetch(`${API_BASE}/api/data/resume-live-generation`, { method: "POST" }).then((r) => r.json()),
  uploadTransactions: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/api/data/upload`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Upload failed");
    return data;
  },
};

/**
 * Connects to the live transaction WebSocket feed. Calls onMessage for each
 * new transaction. Auto-reconnects with backoff if the connection drops.
 */
export function useLiveFeed(onMessage) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const retryRef = useRef(1000);
  const cbRef = useRef(onMessage);
  cbRef.current = onMessage;

  useEffect(() => {
    let cancelled = false;
    let pingInterval;

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        retryRef.current = 1000;
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send("ping");
        }, 15000);
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "new_transaction") cbRef.current?.(msg.data);
        } catch (e) {
          /* ignore malformed */
        }
      };
      ws.onclose = () => {
        setConnected(false);
        clearInterval(pingInterval);
        if (!cancelled) {
          setTimeout(connect, retryRef.current);
          retryRef.current = Math.min(retryRef.current * 1.6, 15000);
        }
      };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      cancelled = true;
      clearInterval(pingInterval);
      wsRef.current?.close();
    };
  }, []);

  return { connected };
}

export function riskColor(band) {
  return {
    low: "#34D399",
    medium: "#FBBF24",
    high: "#FB923C",
    critical: "#F43F5E",
  }[band] || "#8891A3";
}

export function timeAgo(iso) {
  const d = new Date(iso.replace("Z", "") + "Z");
  const diffMs = Date.now() - d.getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}
