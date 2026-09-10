import asyncio
import io
import random
import re
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import pandas as pd
from fastapi import FastAPI, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
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
    allow_origin_regex=settings.cors_origin_regex,
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
LIVE_FEED_ENABLED = True
live_task: Optional[asyncio.Task] = None

ALLOWED_UPLOAD_EXTENSIONS = {"csv", "xlsx", "xls"}
COLUMN_ALIASES = {
    "txn_id": "id",
    "transaction_id": "id",
    "transaction": "id",
    "customer": "customer_name",
    "customername": "customer_name",
    "customer_id": "customer_id",
    "customerid": "customer_id",
    "amount_usd": "amount",
    "total_amount": "amount",
    "date": "timestamp",
    "datetime": "timestamp",
    "created_at": "timestamp",
    "merchant": "merchant_category",
    "merchant_category_name": "merchant_category",
    "country": "billing_country",
    "billing_country_code": "billing_country",
    "ip_country_code": "ip_country",
    "distance": "distance_km",
    "card_type": "card_brand",
    "last4": "card_last4",
    "hour": "hour_of_day",
    "risk": "risk_band",
    "risk_level": "risk_band",
    "score": "risk_score",
    "reason": "reason_codes",
    "reason_codes_csv": "reason_codes",
}
BOOL_FIELDS = {
    "is_new_device", "cvv_match", "avs_match", "shipping_billing_match", "night_txn",
}
INT_FIELDS = {
    "account_age_days", "num_txns_last_hour", "num_txns_last_24h", "failed_attempts_last_hour",
    "hour_of_day", "email_domain_age_days",
}
FLOAT_FIELDS = {"amount", "distance_km", "risk_score", "model_confidence", "anomaly_score"}


def _normalize_column_name(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower()).strip("_")


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return bool(value)
    text = str(value).strip().lower()
    return text in {"1", "true", "yes", "y", "t"}


def _coerce_float(value: Any, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    return float(value)


def _coerce_int(value: Any, default: int = 0) -> int:
    if value is None or value == "":
        return default
    return int(float(value))


def _coerce_timestamp(value: Any) -> str:
    if value is None or value == "":
        return datetime.utcnow().isoformat() + "Z"
    if isinstance(value, datetime):
        dt = value
    else:
        text = str(value).strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        dt = pd.to_datetime(text).to_pydatetime()
    if dt.tzinfo is not None:
        dt = dt.astimezone().replace(tzinfo=None)
    return dt.isoformat() + "Z"


def normalize_uploaded_row(raw_row: Dict[str, Any]) -> Dict[str, Any]:
    canonical_row: Dict[str, Any] = {}
    for key, value in raw_row.items():
        canonical_key = COLUMN_ALIASES.get(_normalize_column_name(key), _normalize_column_name(key))
        canonical_row[canonical_key] = value

    def value_for(field: str, fallback: Any = None):
        return canonical_row.get(field, fallback)

    normalized = {
        "id": str(value_for("id") or f"MANUAL-{uuid.uuid4().hex[:12].upper()}"),
        "timestamp": _coerce_timestamp(value_for("timestamp")),
        "customer_id": str(value_for("customer_id") or "UNKNOWN-CUST"),
        "customer_name": str(value_for("customer_name") or "Unknown Customer"),
        "amount": _coerce_float(value_for("amount"), 0.0),
        "currency": str(value_for("currency") or "USD"),
        "merchant_category": str(value_for("merchant_category") or "Uncategorized"),
        "billing_country": str(value_for("billing_country") or "US"),
        "ip_country": str(value_for("ip_country") or value_for("billing_country") or "US"),
        "distance_km": _coerce_float(value_for("distance_km"), 0.0),
        "device_type": str(value_for("device_type") or "Desktop"),
        "is_new_device": _coerce_bool(value_for("is_new_device", False)),
        "account_age_days": _coerce_int(value_for("account_age_days"), 0),
        "num_txns_last_hour": _coerce_int(value_for("num_txns_last_hour"), 0),
        "num_txns_last_24h": _coerce_int(value_for("num_txns_last_24h"), 0),
        "failed_attempts_last_hour": _coerce_int(value_for("failed_attempts_last_hour"), 0),
        "cvv_match": _coerce_bool(value_for("cvv_match", True)),
        "avs_match": _coerce_bool(value_for("avs_match", True)),
        "shipping_billing_match": _coerce_bool(value_for("shipping_billing_match", True)),
        "email_domain_age_days": _coerce_int(value_for("email_domain_age_days"), 365),
        "night_txn": _coerce_bool(value_for("night_txn", False)),
        "card_brand": str(value_for("card_brand") or "Visa"),
        "card_last4": str(value_for("card_last4") or "0000"),
        "hour_of_day": _coerce_int(value_for("hour_of_day"), datetime.utcnow().hour),
        "reason_codes": [],
        "status": "pending",
        "risk_score": _coerce_float(value_for("risk_score"), 0.0),
        "risk_band": str(value_for("risk_band") or "low").lower(),
        "model_confidence": _coerce_float(value_for("model_confidence"), 0.0),
        "anomaly_score": _coerce_float(value_for("anomaly_score"), 0.0),
        "_is_fraud_ground_truth": _coerce_bool(value_for("_is_fraud_ground_truth", False)),
        "_fraud_type_ground_truth": value_for("_fraud_type_ground_truth"),
    }

    if "reason_codes" in canonical_row and canonical_row["reason_codes"] not in (None, ""):
        raw_reasons = canonical_row["reason_codes"]
        if isinstance(raw_reasons, str):
            try:
                parsed = pd.read_json(io.StringIO(raw_reasons), typ="list")
                normalized["reason_codes"] = parsed.tolist() if hasattr(parsed, "tolist") else []
            except Exception:
                normalized["reason_codes"] = [part.strip() for part in raw_reasons.split("|") if part.strip()]
        elif isinstance(raw_reasons, list):
            normalized["reason_codes"] = [str(item) for item in raw_reasons]

    return normalized


def _pause_live_generation():
    global LIVE_FEED_ENABLED, live_task
    LIVE_FEED_ENABLED = False
    if live_task and not live_task.done():
        live_task.cancel()


def _resume_live_generation():
    global LIVE_FEED_ENABLED, live_task
    LIVE_FEED_ENABLED = True
    if live_task is None or live_task.done():
        live_task = asyncio.create_task(_live_feed_loop())


def _apply_uploaded_transactions(rows):
    global TRANSACTIONS
    if not rows:
        raise ValueError("No transactions were provided in the uploaded file.")

    normalized_rows = [normalize_uploaded_row(row) for row in rows]
    _ensure_model_ready()
    scored = model.score(normalized_rows)
    enriched = []
    for txn, score in zip(normalized_rows, scored):
        merged = {**txn, **score}
        merged["status"] = "pending" if score["risk_band"] in ("high", "critical") else "auto_approved"
        REVIEW_STATUS[merged["id"]] = merged["status"]
        enriched.append(merged)

    insert_transactions(enriched)
    TRANSACTIONS = fetch_all_transactions()
    return TRANSACTIONS


def _ensure_model_ready():
    if not model.is_trained:
        print("Training fraud risk model on synthetic data...")
        metrics = model.train(n_samples=6000)
        print("Model trained:", metrics)


def _ensure_seed_data():
    global TRANSACTIONS
    TRANSACTIONS = fetch_all_transactions()
    if TRANSACTIONS:
        return TRANSACTIONS

    print("Generating historical transaction backlog...")
    history = gen.generate_batch(6000, span_hours=12)
    _enrich_and_store(history)
    TRANSACTIONS = fetch_all_transactions()
    return TRANSACTIONS


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
    global TRANSACTIONS, live_task
    TRANSACTIONS = _ensure_seed_data()
    if TRANSACTIONS:
        print(f"Loaded {len(TRANSACTIONS)} transactions from the database.")
    live_task = asyncio.create_task(_live_feed_loop())


async def _live_feed_loop():
    """Periodically generate a new transaction and broadcast it to connected clients."""
    global TRANSACTIONS
    try:
        while LIVE_FEED_ENABLED:
            if not TRANSACTIONS:
                _ensure_seed_data()
            await asyncio.sleep(random.uniform(0.8, 2.0))
            if not LIVE_FEED_ENABLED:
                break
            txn, is_fraud, fraud_type = gen.generate_transaction(ts=datetime.utcnow())
            txn["_is_fraud_ground_truth"] = is_fraud
            txn["_fraud_type_ground_truth"] = fraud_type
            _enrich_and_store([txn])
            if not TRANSACTIONS:
                TRANSACTIONS = fetch_all_transactions()
            enriched = TRANSACTIONS[0]
            dead = set()
            for ws in ws_clients:
                try:
                    await ws.send_json({"type": "new_transaction", "data": _public(enriched)})
                except Exception:
                    dead.add(ws)
            ws_clients.difference_update(dead)
    except asyncio.CancelledError:
        pass


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
        _ensure_seed_data()
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
async def timeseries(hours: float = 72):
    if not TRANSACTIONS:
        _ensure_seed_data()
    now = datetime.utcnow()
    start = now - timedelta(hours=hours)
    bucket_step = timedelta(minutes=5)
    buckets = defaultdict(lambda: {"volume": 0, "flagged": 0, "amount": 0.0})

    current = start.replace(second=0, microsecond=0)
    rounded = current - timedelta(minutes=current.minute % 5)
    while rounded <= now:
        buckets[rounded.strftime("%Y-%m-%dT%H:%M")] = {"volume": 0, "flagged": 0, "amount": 0.0}
        rounded += bucket_step

    for t in TRANSACTIONS:
        ts = datetime.fromisoformat(t["timestamp"].replace("Z", ""))
        if ts < start:
            continue
        bucket_dt = ts - timedelta(minutes=ts.minute % 5, seconds=ts.second, microseconds=ts.microsecond)
        bucket_key = bucket_dt.strftime("%Y-%m-%dT%H:%M")
        if bucket_key not in buckets:
            buckets[bucket_key] = {"volume": 0, "flagged": 0, "amount": 0.0}
        buckets[bucket_key]["volume"] += 1
        buckets[bucket_key]["amount"] += t["amount"]
        if t["risk_band"] in ("high", "critical"):
            buckets[bucket_key]["flagged"] += 1

    series = []
    for k in sorted(buckets.keys()):
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


@app.post("/api/data/stop-live-generation")
async def stop_live_generation():
    _pause_live_generation()
    return {"status": "ok", "live_feed_enabled": False}


@app.post("/api/data/resume-live-generation")
async def resume_live_generation():
    global TRANSACTIONS
    _resume_live_generation()
    if not TRANSACTIONS:
        TRANSACTIONS = _ensure_seed_data()
    return {"status": "ok", "live_feed_enabled": True}


@app.post("/api/data/upload")
async def upload_transactions_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file was provided.")

    name = file.filename.lower()
    if not any(name.endswith(ext) for ext in ALLOWED_UPLOAD_EXTENSIONS):
        raise HTTPException(status_code=400, detail="Unsupported file type. Upload a CSV, XLSX, or XLS file.")

    content = await file.read()
    buffer = io.BytesIO(content)
    try:
        if name.endswith("csv"):
            frame = pd.read_csv(buffer)
        else:
            frame = pd.read_excel(buffer)
    except Exception as exc:  # pragma: no cover - runtime validation path
        raise HTTPException(status_code=400, detail=f"Could not parse file: {exc}") from exc

    if frame.empty:
        raise HTTPException(status_code=400, detail="The uploaded file contains no rows.")

    rows = frame.to_dict(orient="records")
    try:
        _pause_live_generation()
        imported = _apply_uploaded_transactions(rows)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "status": "ok",
        "mode": "manual",
        "live_feed_enabled": False,
        "records_loaded": len(imported),
        "message": "Live transaction generation has been paused and the uploaded records are now active in the dashboard.",
    }


@app.websocket("/ws/live")
async def ws_live(websocket: WebSocket):
    await websocket.accept()
    ws_clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive ping from client, ignored
    except WebSocketDisconnect:
        ws_clients.discard(websocket)
