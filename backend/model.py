"""
Fraud risk scoring model.

Trains a RandomForest on engineered features from the synthetic generator
(which has ground-truth fraud labels) and an IsolationForest for anomaly
detection as a secondary signal. Produces a blended 0-100 risk score plus
human-readable reason codes for explainability in the dashboard.
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.model_selection import train_test_split

from data_generator import TransactionGenerator, FEATURE_COLUMNS


def _to_feature_frame(transactions):
    df = pd.DataFrame(transactions)
    X = pd.DataFrame()
    X["amount"] = df["amount"]
    X["distance_km"] = df["distance_km"]
    X["account_age_days"] = df["account_age_days"]
    X["num_txns_last_hour"] = df["num_txns_last_hour"]
    X["num_txns_last_24h"] = df["num_txns_last_24h"]
    X["failed_attempts_last_hour"] = df["failed_attempts_last_hour"]
    X["cvv_match"] = df["cvv_match"].astype(int)
    X["avs_match"] = df["avs_match"].astype(int)
    X["shipping_billing_match"] = df["shipping_billing_match"].astype(int)
    X["is_new_device"] = df["is_new_device"].astype(int)
    X["email_domain_age_days"] = df["email_domain_age_days"]
    X["night_txn"] = df["night_txn"].astype(int)
    return X


class FraudRiskModel:
    def __init__(self, random_state=42):
        self.random_state = random_state
        self.clf = RandomForestClassifier(
            n_estimators=200, max_depth=8, min_samples_leaf=3,
            class_weight="balanced_subsample", random_state=random_state, n_jobs=-1,
        )
        self.iso = IsolationForest(
            n_estimators=200, contamination=0.06, random_state=random_state, n_jobs=-1,
        )
        self.feature_names = None
        self.is_trained = False
        self.metrics = {}

    def train(self, n_samples=6000):
        gen = TransactionGenerator(seed=7)
        rows = gen.generate_batch(n_samples, span_hours=24 * 30)
        y = np.array([1 if r["_is_fraud_ground_truth"] else 0 for r in rows])
        X = _to_feature_frame(rows)
        self.feature_names = list(X.columns)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.25, random_state=self.random_state, stratify=y
        )
        self.clf.fit(X_train, y_train)
        self.iso.fit(X_train)

        preds = self.clf.predict(X_test)
        probs = self.clf.predict_proba(X_test)[:, 1]
        tp = int(((preds == 1) & (y_test == 1)).sum())
        fp = int(((preds == 1) & (y_test == 0)).sum())
        fn = int(((preds == 0) & (y_test == 1)).sum())
        tn = int(((preds == 0) & (y_test == 0)).sum())
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
        self.metrics = {
            "n_train": len(X_train), "n_test": len(X_test),
            "precision": round(precision, 3), "recall": round(recall, 3),
            "f1": round(f1, 3), "fraud_rate_test": round(float(y_test.mean()), 4),
            "confusion_matrix": {"tp": tp, "fp": fp, "fn": fn, "tn": tn},
        }
        self.is_trained = True
        return self.metrics

    def score(self, transactions):
        """Return list of dicts: risk_score (0-100), risk_band, reason_codes[]."""
        if not self.is_trained:
            raise RuntimeError("Model must be trained before scoring")
        X = _to_feature_frame(transactions)
        fraud_proba = self.clf.predict_proba(X)[:, 1]
        anomaly_raw = -self.iso.score_samples(X)  # higher = more anomalous
        a_min, a_max = anomaly_raw.min(), anomaly_raw.max()
        anomaly_norm = (anomaly_raw - a_min) / (a_max - a_min + 1e-9)

        blended = 0.75 * fraud_proba + 0.25 * anomaly_norm
        scores = np.clip(blended * 100, 0, 100)

        results = []
        for i, txn in enumerate(transactions):
            s = float(scores[i])
            band = "critical" if s >= 75 else "high" if s >= 50 else "medium" if s >= 25 else "low"
            results.append({
                "risk_score": round(s, 1),
                "risk_band": band,
                "reason_codes": self._reason_codes(txn),
                "model_confidence": round(float(fraud_proba[i]) * 100, 1),
                "anomaly_score": round(float(anomaly_norm[i]) * 100, 1),
            })
        return results

    @staticmethod
    def _reason_codes(txn):
        reasons = []
        if txn["num_txns_last_hour"] >= 4:
            reasons.append(f"{txn['num_txns_last_hour']} transactions in the last hour")
        if txn["failed_attempts_last_hour"] >= 2:
            reasons.append(f"{txn['failed_attempts_last_hour']} failed attempts in the last hour")
        if not txn["cvv_match"]:
            reasons.append("CVV mismatch")
        if not txn["avs_match"]:
            reasons.append("Address (AVS) mismatch")
        if txn["ip_country"] != txn["billing_country"]:
            reasons.append(f"IP country ({txn['ip_country']}) differs from billing ({txn['billing_country']})")
        if txn["distance_km"] > 500:
            reasons.append(f"Billing/IP distance of {int(txn['distance_km'])} km")
        if txn["is_new_device"]:
            reasons.append("Unrecognized device")
        if txn["account_age_days"] <= 3:
            reasons.append("Account created within last 3 days")
        if not txn["shipping_billing_match"]:
            reasons.append("Shipping address differs from billing")
        if txn["email_domain_age_days"] <= 14:
            reasons.append("Email domain registered very recently")
        if txn["amount"] < 5:
            reasons.append("Micro-amount consistent with card testing")
        if txn["amount"] > 500:
            reasons.append("High transaction amount")
        if txn["night_txn"]:
            reasons.append("Placed during overnight hours")
        return reasons[:5] if reasons else ["No significant risk signals"]
