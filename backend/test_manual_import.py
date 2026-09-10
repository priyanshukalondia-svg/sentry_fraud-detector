import pandas as pd

from main import normalize_uploaded_row


def test_normalize_uploaded_row_handles_common_fields():
    row = {
        "id": "TXN-1",
        "timestamp": "2026-09-10T14:30:00Z",
        "customer_id": "CUST-100",
        "customer_name": "Jane Doe",
        "amount": "120.50",
        "currency": "USD",
        "merchant_category": "Travel",
        "billing_country": "US",
        "ip_country": "US",
        "distance_km": "120",
        "device_type": "Mobile - iOS",
        "is_new_device": "true",
        "account_age_days": "7",
        "num_txns_last_hour": "2",
        "num_txns_last_24h": "10",
        "failed_attempts_last_hour": "1",
        "cvv_match": "false",
        "avs_match": "true",
        "shipping_billing_match": "false",
        "email_domain_age_days": "30",
        "night_txn": "false",
        "card_brand": "Visa",
        "card_last4": "4242",
        "hour_of_day": "14",
    }

    normalized = normalize_uploaded_row(row)

    assert normalized["id"] == "TXN-1"
    assert normalized["amount"] == 120.5
    assert normalized["cvv_match"] is False
    assert normalized["risk_band"] in {"low", "medium", "high", "critical"}
    assert "reason_codes" in normalized
