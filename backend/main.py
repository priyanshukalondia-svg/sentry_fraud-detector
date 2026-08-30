import asyncio
import random
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from data_generator import TransactionGenerator
from database import (
    fetch_all_transactions,
    fetch_transactions,
    get_alerts,
    get_transaction as db_get_transaction,
    init_db,
    insert_transactions,
    update_review_status,
)
from model import FraudRiskModel

app = FastAPI(
    title="Fraud Detection API",
    version="1.0.0",
    description="Production-ready fraud detection dashboard backend",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)

# --- Global in-memory state (demo system, not for production persistence) ---
gen = TransactionGenerator(seed=123)
model = FraudRiskModel()
TRANSACTIONS = []          # list of enriched transaction dicts, newest first
REVIEW_STATUS = {}         # txn_id -> "approved" | "blocked" | "pending"
ws_clients = set()


def _ensure_model_ready():
    if not model.is_trained:
        print("Training fraud risk model on synthetic data...")
        metrics = model.train(n_samples=6000)
        print("Model trained:", metrics)


def _enrich_and_store(raw_txns):
    _ensure_model_ready()
    scored = model.score(raw_txns)
    all_enriched = []
    for txn, s in zip(raw_txns, scored):
        enriched = {**txn, **s}
        enriched["status"] = "pending" if s["risk_band"] in ("high", "critical") else "auto_approved"
        REVIEW_STATUS[enriched["id"]] = enriched["status"]
        all_enriched.append(enriched)

    if all_enriched:
        insert_transactions(all_enriched)
        global TRANSACTIONS
        TRANSACTIONS = fetch_all_transactions()

    return [{**t} for t in raw_txns]


@app.on_event("startup")
async def startup():
    init_db()
    _ensure_model_ready()
    global TRANSACTIONS
    TRANSACTIONS = fetch_all_transactions()

    if not TRANSACTIONS:
        print("Generating historical transaction backlog...")
        history = gen.generate_batch(1400, span_hours=72)
        _enrich_and_store(history)
        TRANSACTIONS = fetch_all_transactions()
    else:
        print("Loaded transactions from database.")

    asyncio.create_task(_live_feed_loop())


async def _live_feed_loop():
    """Periodically generate a new transaction and broadcast it to connected clients."""
    while True:
        await asyncio.sleep(random.uniform(1.5, 4.0))
        txn, is_fraud, fraud_type = gen.generate_transaction(ts=datetime.utcnow())
        txn["_is_fraud_ground_truth"] = is_fraud
        txn["_fraud_type_ground_truth"] = fraud_type
        _enrich_and_store([txn])
        enriched = TRANSACTIONS[0]
        dead = set()
        for ws in ws_clients:
            try:
                await ws.send_json({"type": "new_transaction", "data": _public(enriched)})
            except Exception:
                dead.add(ws)
        ws_clients.difference_update(dead)


def _public(txn):
    """Strip ground-truth/internal fields before sending to the client."""
    return {k: v for k, v in txn.items() if not k.startswith("_")}


@app.get("/")
async def root():
    return {
        "name": app.title,
        "version": app.version,
        "status": "ok",
        "docs": "/docs",
    }


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "model_trained": model.is_trained,
        "txn_count": len(TRANSACTIONS),
        "database_url": settings.database_url,
    }


@app.get("/api/model/metrics")
async def model_metrics():
    return model.metrics


@app.get("/api/stats")
async def stats():
    if not TRANSACTIONS:
        return {}
    total = len(TRANSACTIONS)
    critical = sum(1 for t in TRANSACTIONS if t["risk_band"] == "critical")
    high = sum(1 for t in TRANSACTIONS if t["risk_band"] == "high")
    flagged = critical + high
    amount_at_risk = sum(t["amount"] for t in TRANSACTIONS if t["risk_band"] in ("high", "critical"))
    total_amount = sum(t["amount"] for t in TRANSACTIONS)
    avg_score = sum(t["risk_score"] for t in TRANSACTIONS) / total
    pending_review = sum(1 for t in TRANSACTIONS if t.get("status") == "pending")

    # last 24h vs previous 24h for trend deltas
    now = datetime.utcnow()
    last_24h = [t for t in TRANSACTIONS if datetime.fromisoformat(t["timestamp"].replace("Z", "")) > now - timedelta(hours=24)]
    prev_24h = [t for t in TRANSACTIONS if now - timedelta(hours=48) < datetime.fromisoformat(t["timestamp"].replace("Z", "")) <= now - timedelta(hours=24)]

    def fraud_rate(txns):
        if not txns:
            return 0.0
        return sum(1 for t in txns if t["risk_band"] in ("high", "critical")) / len(txns)

    return {
        "total_transactions": total,
        "flagged_transactions": flagged,
        "critical_count": critical,
        "high_count": high,
        "fraud_rate_pct": round(flagged / total * 100, 2),
        "amount_at_risk": round(amount_at_risk, 2),
        "total_amount_processed": round(total_amount, 2),
        "avg_risk_score": round(avg_score, 1),
        "pending_review": pending_review,
        "fraud_rate_last_24h_pct": round(fraud_rate(last_24h) * 100, 2),
        "fraud_rate_prev_24h_pct": round(fraud_rate(prev_24h) * 100, 2),
        "volume_last_24h": len(last_24h),
        "volume_prev_24h": len(prev_24h),
    }


@app.get("/api/timeseries")
async def timeseries(hours: int = 72):
    now = datetime.utcnow()
    buckets = defaultdict(lambda: {"volume": 0, "flagged": 0, "amount": 0.0})
    for t in TRANSACTIONS:
        ts = datetime.fromisoformat(t["timestamp"].replace("Z", ""))
        if ts < now - timedelta(hours=hours):
            continue
        bucket_key = ts.strftime("%Y-%m-%dT%H:00")
        buckets[bucket_key]["volume"] += 1
        buckets[bucket_key]["amount"] += t["amount"]
        if t["risk_band"] in ("high", "critical"):
            buckets[bucket_key]["flagged"] += 1

    keys = sorted(buckets.keys())
    series = []
    for k in keys:
        b = buckets[k]
        series.append({
            "hour": k,
            "volume": b["volume"],
            "flagged": b["flagged"],
            "fraud_rate_pct": round(b["flagged"] / b["volume"] * 100, 1) if b["volume"] else 0,
            "amount": round(b["amount"], 2),
        })
    return series


@app.get("/api/risk-distribution")
async def risk_distribution():
    buckets = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for t in TRANSACTIONS:
        buckets[t["risk_band"]] += 1
    return buckets


@app.get("/api/category-breakdown")
async def category_breakdown():
    agg = defaultdict(lambda: {"volume": 0, "flagged": 0})
    for t in TRANSACTIONS:
        c = t["merchant_category"]
        agg[c]["volume"] += 1
        if t["risk_band"] in ("high", "critical"):
            agg[c]["flagged"] += 1
    return [
        {"category": c, "volume": v["volume"], "flagged": v["flagged"],
         "fraud_rate_pct": round(v["flagged"] / v["volume"] * 100, 1) if v["volume"] else 0}
        for c, v in sorted(agg.items(), key=lambda kv: -kv[1]["volume"])
    ]


@app.get("/api/transactions")
async def list_transactions(
    limit: int = 50,
    offset: int = 0,
    risk_band: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
):
    results = TRANSACTIONS
    if risk_band:
        results = [t for t in results if t["risk_band"] == risk_band]
    if status:
        results = [t for t in results if t.get("status") == status]
    if search:
        s = search.lower()
        results = [
            t for t in results
            if s in t["id"].lower() or s in t["customer_name"].lower()
            or s in t["customer_id"].lower() or s in t["merchant_category"].lower()
        ]
    total = len(results)
    page = results[offset: offset + limit]
    return {"total": total, "items": [_public(t) for t in page]}


@app.get("/api/alerts")
async def alerts(limit: int = 25):
    flagged = [t for t in TRANSACTIONS if t["risk_band"] in ("high", "critical") and t.get("status") == "pending"]
    return {"total": len(flagged), "items": [_public(t) for t in flagged[:limit]]}


@app.post("/api/transactions/{txn_id}/review")
async def review_transaction(txn_id: str, decision: str = Query(..., pattern="^(approve|block)$")):
    global TRANSACTIONS
    for t in TRANSACTIONS:
        if t["id"] == txn_id:
            t["status"] = "approved" if decision == "approve" else "blocked"
            REVIEW_STATUS[txn_id] = t["status"]
            update_review_status(txn_id, t["status"])
            TRANSACTIONS = fetch_all_transactions()
            return {"id": txn_id, "status": t["status"]}
    return {"error": "not found"}, 404


@app.get("/api/transactions/{txn_id}")
async def get_transaction(txn_id: str):
    for t in TRANSACTIONS:
        if t["id"] == txn_id:
            return _public(t)
    db_record = db_get_transaction(txn_id)
    if db_record:
        return _public(db_record)
    return {"error": "not found"}, 404


@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    await websocket.accept()
    ws_clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive ping from client, ignored
    except WebSocketDisconnect:
        ws_clients.discard(websocket)
