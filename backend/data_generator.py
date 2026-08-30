"""
Synthetic e-commerce transaction generator.

Produces realistic-looking transactions with a minority of embedded fraud
patterns (card testing, account takeover, velocity abuse, geo mismatch,
high-value new-account fraud) so the detection model has real signal to find.
"""
import random
import uuid
from datetime import datetime, timedelta

import numpy as np

MERCHANT_CATEGORIES = [
    "Electronics", "Fashion & Apparel", "Home & Garden", "Digital Goods",
    "Groceries", "Travel", "Gift Cards", "Beauty", "Sporting Goods", "Toys",
]

COUNTRIES = [
    ("US", "United States"), ("GB", "United Kingdom"), ("CA", "Canada"),
    ("DE", "Germany"), ("FR", "France"), ("AU", "Australia"), ("IN", "India"),
    ("BR", "Brazil"), ("NG", "Nigeria"), ("RU", "Russia"), ("VN", "Vietnam"),
    ("SG", "Singapore"),
]

DEVICE_TYPES = ["Desktop", "Mobile - iOS", "Mobile - Android", "Tablet"]

FIRST_NAMES = ["Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Sophia", "Mason",
               "Isabella", "Lucas", "Mia", "James", "Amelia", "Benjamin", "Harper",
               "Elijah", "Evelyn", "Oliver", "Charlotte", "Henry", "Priya", "Wei",
               "Fatima", "Diego", "Yuki", "Ahmed", "Sofia", "Carlos", "Anya", "Kwame"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
              "Davis", "Rodriguez", "Martinez", "Chen", "Patel", "Kim", "Nguyen",
              "Silva", "Mueller", "Ivanov", "Okafor", "Andersen", "Rossi"]

RISK_COUNTRIES = {"NG", "RU"}  # higher base rate of fraud in this synthetic world


def _rand_ip_mismatch_country(billing_country):
    """Occasionally return a country different from billing to simulate geo mismatch."""
    other = [c for c in COUNTRIES if c[0] != billing_country]
    return random.choice(other)[0]


class TransactionGenerator:
    def __init__(self, seed=42):
        self.rng = random.Random(seed)
        np.random.seed(seed)
        self._counter = 0
        self._customer_pool = self._build_customer_pool(400)

    def _build_customer_pool(self, n):
        customers = []
        for i in range(n):
            country_code, _ = self.rng.choice(COUNTRIES)
            account_age_days = int(np.random.exponential(scale=250)) + 1
            customers.append({
                "customer_id": f"CUST-{10000 + i}",
                "name": f"{self.rng.choice(FIRST_NAMES)} {self.rng.choice(LAST_NAMES)}",
                "home_country": country_code,
                "account_age_days": account_age_days,
                "avg_spend": max(15, np.random.normal(85, 40)),
            })
        return customers

    def _new_id(self):
        self._counter += 1
        return f"TXN-{100000 + self._counter}-{uuid.uuid4().hex[:5].upper()}"

    def generate_transaction(self, ts=None, force_fraud_type=None):
        """Generate one transaction dict. Returns (transaction_dict, is_fraud_bool)."""
        ts = ts or datetime.utcnow()
        customer = self.rng.choice(self._customer_pool)

        # Decide if this transaction is fraudulent, and which archetype.
        fraud_type = force_fraud_type
        if fraud_type is None:
            base_rate = 0.055
            if customer["home_country"] in RISK_COUNTRIES:
                base_rate *= 1.8
            is_fraud = self.rng.random() < base_rate
            if is_fraud:
                fraud_type = self.rng.choice(
                    ["card_testing", "account_takeover", "velocity_abuse",
                     "geo_mismatch", "new_account_highvalue", "stolen_card"]
                )
        else:
            is_fraud = True

        billing_country = customer["home_country"]
        device = self.rng.choice(DEVICE_TYPES)
        category = self.rng.choice(MERCHANT_CATEGORIES)
        hour = ts.hour

        # --- Base (legitimate-leaning) feature distributions ---
        amount = max(3.0, np.random.lognormal(mean=np.log(max(customer["avg_spend"], 10)), sigma=0.6))
        ip_country = billing_country
        distance_km = abs(np.random.normal(5, 8))
        account_age_days = customer["account_age_days"]
        num_txns_last_hour = np.random.poisson(0.3)
        num_txns_last_24h = np.random.poisson(1.4)
        failed_attempts_last_hour = np.random.poisson(0.05)
        cvv_match = True
        avs_match = True
        is_new_device = self.rng.random() < 0.08
        shipping_billing_match = self.rng.random() > 0.05
        email_domain_age_days = int(np.random.exponential(scale=800)) + 30
        night_txn = hour >= 1 and hour <= 5

        # --- Inject fraud-archetype signal ---
        if is_fraud and fraud_type == "card_testing":
            amount = round(self.rng.uniform(0.5, 3.5), 2)
            num_txns_last_hour = self.rng.randint(6, 22)
            num_txns_last_24h = num_txns_last_hour + self.rng.randint(0, 10)
            failed_attempts_last_hour = self.rng.randint(2, 15)
            cvv_match = self.rng.random() < 0.35
            is_new_device = True
        elif is_fraud and fraud_type == "account_takeover":
            is_new_device = True
            ip_country = _rand_ip_mismatch_country(billing_country)
            distance_km = self.rng.uniform(800, 9000)
            failed_attempts_last_hour = self.rng.randint(1, 6)
            shipping_billing_match = self.rng.random() < 0.2
            amount = max(amount, np.random.uniform(120, 900))
        elif is_fraud and fraud_type == "velocity_abuse":
            num_txns_last_hour = self.rng.randint(4, 12)
            num_txns_last_24h = num_txns_last_hour + self.rng.randint(3, 20)
            amount = np.random.uniform(40, 500)
        elif is_fraud and fraud_type == "geo_mismatch":
            ip_country = _rand_ip_mismatch_country(billing_country)
            distance_km = self.rng.uniform(1500, 12000)
            avs_match = self.rng.random() < 0.3
            shipping_billing_match = self.rng.random() < 0.4
        elif is_fraud and fraud_type == "new_account_highvalue":
            account_age_days = self.rng.randint(0, 2)
            amount = np.random.uniform(300, 2500)
            email_domain_age_days = self.rng.randint(0, 10)
            is_new_device = True
            night_txn = self.rng.random() < 0.5
        elif is_fraud and fraud_type == "stolen_card":
            cvv_match = self.rng.random() < 0.4
            avs_match = self.rng.random() < 0.4
            amount = np.random.uniform(150, 1800)
            is_new_device = True
            shipping_billing_match = self.rng.random() < 0.3

        card_last4 = f"{self.rng.randint(0, 9999):04d}"
        card_brand = self.rng.choice(["Visa", "Mastercard", "Amex", "Discover"])

        txn = {
            "id": self._new_id(),
            "timestamp": ts.isoformat() + "Z",
            "customer_id": customer["customer_id"],
            "customer_name": customer["name"],
            "amount": round(float(amount), 2),
            "currency": "USD",
            "merchant_category": category,
            "billing_country": billing_country,
            "ip_country": ip_country,
            "distance_km": round(float(distance_km), 1),
            "device_type": device,
            "is_new_device": bool(is_new_device),
            "account_age_days": int(account_age_days),
            "num_txns_last_hour": int(num_txns_last_hour),
            "num_txns_last_24h": int(num_txns_last_24h),
            "failed_attempts_last_hour": int(failed_attempts_last_hour),
            "cvv_match": bool(cvv_match),
            "avs_match": bool(avs_match),
            "shipping_billing_match": bool(shipping_billing_match),
            "email_domain_age_days": int(email_domain_age_days),
            "night_txn": bool(night_txn),
            "card_brand": card_brand,
            "card_last4": card_last4,
            "hour_of_day": hour,
        }
        return txn, is_fraud, fraud_type

    def generate_batch(self, n, start_time=None, span_hours=72):
        """Generate n transactions spread across span_hours ending now, sorted by time."""
        start_time = start_time or (datetime.utcnow() - timedelta(hours=span_hours))
        rows = []
        for _ in range(n):
            offset_seconds = self.rng.uniform(0, span_hours * 3600)
            ts = start_time + timedelta(seconds=offset_seconds)
            txn, is_fraud, fraud_type = self.generate_transaction(ts=ts)
            txn["_is_fraud_ground_truth"] = is_fraud
            txn["_fraud_type_ground_truth"] = fraud_type
            rows.append(txn)
        rows.sort(key=lambda r: r["timestamp"])
        return rows


FEATURE_COLUMNS = [
    "amount", "distance_km", "account_age_days", "num_txns_last_hour",
    "num_txns_last_24h", "failed_attempts_last_hour", "cvv_match", "avs_match",
    "shipping_billing_match", "is_new_device", "email_domain_age_days", "night_txn",
]
