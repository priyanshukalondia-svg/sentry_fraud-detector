import json
from pathlib import Path

from sqlalchemy import Boolean, Column, Float, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from config import settings

DB_PATH = Path(__file__).with_name("transactions.db")
DATABASE_URL = settings.database_url

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

Base = declarative_base()
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True)
    timestamp = Column(String, nullable=False)
    customer_id = Column(String)
    customer_name = Column(String)
    amount = Column(Float)
    currency = Column(String)
    merchant_category = Column(String)
    billing_country = Column(String)
    ip_country = Column(String)
    distance_km = Column(Float)
    device_type = Column(String)
    is_new_device = Column(Boolean, default=False)
    account_age_days = Column(Integer)
    num_txns_last_hour = Column(Integer)
    num_txns_last_24h = Column(Integer)
    failed_attempts_last_hour = Column(Integer)
    cvv_match = Column(Boolean, default=True)
    avs_match = Column(Boolean, default=True)
    shipping_billing_match = Column(Boolean, default=True)
    email_domain_age_days = Column(Integer)
    night_txn = Column(Boolean, default=False)
    card_brand = Column(String)
    card_last4 = Column(String)
    hour_of_day = Column(Integer)
    risk_score = Column(Float)
    risk_band = Column(String)
    model_confidence = Column(Float)
    anomaly_score = Column(Float)
    reason_codes = Column(String, default="[]")
    status = Column(String, default="pending")
    _is_fraud_ground_truth = Column(Boolean, default=False)
    _fraud_type_ground_truth = Column(String)


def init_db(reset: bool = False):
    if reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def _row_to_txn(row):
    txn = {
        "id": row.id,
        "timestamp": row.timestamp,
        "customer_id": row.customer_id,
        "customer_name": row.customer_name,
        "amount": row.amount,
        "currency": row.currency,
        "merchant_category": row.merchant_category,
        "billing_country": row.billing_country,
        "ip_country": row.ip_country,
        "distance_km": row.distance_km,
        "device_type": row.device_type,
        "is_new_device": bool(row.is_new_device),
        "account_age_days": row.account_age_days,
        "num_txns_last_hour": row.num_txns_last_hour,
        "num_txns_last_24h": row.num_txns_last_24h,
        "failed_attempts_last_hour": row.failed_attempts_last_hour,
        "cvv_match": bool(row.cvv_match),
        "avs_match": bool(row.avs_match),
        "shipping_billing_match": bool(row.shipping_billing_match),
        "email_domain_age_days": row.email_domain_age_days,
        "night_txn": bool(row.night_txn),
        "card_brand": row.card_brand,
        "card_last4": row.card_last4,
        "hour_of_day": row.hour_of_day,
        "risk_score": row.risk_score,
        "risk_band": row.risk_band,
        "model_confidence": row.model_confidence,
        "anomaly_score": row.anomaly_score,
        "reason_codes": json.loads(row.reason_codes) if row.reason_codes else [],
        "status": row.status,
        "_is_fraud_ground_truth": bool(row._is_fraud_ground_truth),
        "_fraud_type_ground_truth": row._fraud_type_ground_truth,
    }
    return txn


def _to_row(txn):
    return Transaction(
        id=txn["id"],
        timestamp=txn["timestamp"],
        customer_id=txn.get("customer_id"),
        customer_name=txn.get("customer_name"),
        amount=txn.get("amount"),
        currency=txn.get("currency"),
        merchant_category=txn.get("merchant_category"),
        billing_country=txn.get("billing_country"),
        ip_country=txn.get("ip_country"),
        distance_km=txn.get("distance_km"),
        device_type=txn.get("device_type"),
        is_new_device=bool(txn.get("is_new_device", False)),
        account_age_days=txn.get("account_age_days"),
        num_txns_last_hour=txn.get("num_txns_last_hour"),
        num_txns_last_24h=txn.get("num_txns_last_24h"),
        failed_attempts_last_hour=txn.get("failed_attempts_last_hour"),
        cvv_match=bool(txn.get("cvv_match", True)),
        avs_match=bool(txn.get("avs_match", True)),
        shipping_billing_match=bool(txn.get("shipping_billing_match", True)),
        email_domain_age_days=txn.get("email_domain_age_days"),
        night_txn=bool(txn.get("night_txn", False)),
        card_brand=txn.get("card_brand"),
        card_last4=txn.get("card_last4"),
        hour_of_day=txn.get("hour_of_day"),
        risk_score=txn.get("risk_score"),
        risk_band=txn.get("risk_band"),
        model_confidence=txn.get("model_confidence"),
        anomaly_score=txn.get("anomaly_score"),
        reason_codes=json.dumps(txn.get("reason_codes", [])),
        status=txn.get("status", "pending"),
        _is_fraud_ground_truth=bool(txn.get("_is_fraud_ground_truth", False)),
        _fraud_type_ground_truth=txn.get("_fraud_type_ground_truth"),
    )


def insert_transactions(transactions):
    if not transactions:
        return
    session = SessionLocal()
    try:
        for txn in transactions:
            session.merge(_to_row(txn))
        session.commit()
    finally:
        session.close()


def fetch_all_transactions():
    session = SessionLocal()
    try:
        rows = session.query(Transaction).order_by(Transaction.timestamp.desc()).all()
        return [_row_to_txn(r) for r in rows]
    finally:
        session.close()


def get_transaction(txn_id):
    session = SessionLocal()
    try:
        row = session.get(Transaction, txn_id)
        return _row_to_txn(row) if row else None
    finally:
        session.close()


def update_review_status(txn_id, status):
    session = SessionLocal()
    try:
        row = session.get(Transaction, txn_id)
        if row:
            row.status = status
            session.commit()
    finally:
        session.close()


def fetch_transactions(limit=50, offset=0, risk_band=None, status=None, search=None):
    session = SessionLocal()
    try:
        query = session.query(Transaction)
        if risk_band:
            query = query.filter(Transaction.risk_band == risk_band)
        if status:
            query = query.filter(Transaction.status == status)
        if search:
            term = f"%{search.lower()}%"
            query = query.filter(
                (Transaction.id.ilike(term))
                | (Transaction.customer_name.ilike(term))
                | (Transaction.customer_id.ilike(term))
                | (Transaction.merchant_category.ilike(term))
            )
        rows = query.order_by(Transaction.timestamp.desc()).limit(limit).offset(offset).all()
        return [_row_to_txn(r) for r in rows]
    finally:
        session.close()


def get_alerts(limit=25):
    session = SessionLocal()
    try:
        rows = (
            session.query(Transaction)
            .filter(Transaction.risk_band.in_(["high", "critical"]))
            .filter(Transaction.status == "pending")
            .order_by(Transaction.timestamp.desc())
            .limit(limit)
            .all()
        )
        return [_row_to_txn(r) for r in rows]
    finally:
        session.close()
