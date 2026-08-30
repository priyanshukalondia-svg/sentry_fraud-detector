# Sentry — Fraud Detection Console

Sentry is a local fraud operations dashboard designed to simulate how a modern digital commerce team might monitor, investigate, and action suspicious transactions in near real time. The project combines a Python FastAPI backend, synthetic transaction generation, explainable ML risk scoring, and a React-based monitoring interface.

The system is built as a portfolio-ready prototype that demonstrates the full flow from transaction generation to signal scoring, database persistence, API exposure, and live operational visualization.

## Product overview

This project models a fraud monitoring workflow for a retail and digital payments environment. It generates synthetic transactions across common merchant categories, scores each one for fraud risk, and surfaces the most suspicious events for review through a live operational dashboard.

The application includes:
- a live transaction feed
- real-time risk calculations and operational KPIs
- transaction search and filtering
- a review queue for high-risk events
- explainable signal-based reasoning for flagged transactions

## Live dashboard

### Overview

![Dashboard overview](docs/screenshots/overview.png)

### Transactions view

![Transactions view](docs/screenshots/transactions.png)

### Alert queue

![Alert queue](docs/screenshots/alerts.png)

## Key features

### Fraud risk scoring
- Synthetic transaction data is generated with realistic fraud patterns such as high-velocity spending, device mismatch, abnormal merchant activity, and risky user behavior.
- A scikit-learn model is trained on labeled synthetic data and combined with anomaly detection to produce a 0–100 risk score.
- Scores are translated into operational risk bands: low, medium, high, and critical.

### Explainability
- Each flagged transaction includes risk reasoning derived from transaction attributes and behavioral patterns.
- This makes the system suitable for demonstration of analyst triage and manual review workflows rather than a black-box model only.

### Monitoring experience
- A live overview tracks overall fraud rate, amount at risk, pending review volume, and transaction volume.
- The dashboard visualizes volume trends, risk distribution, and merchant category performance.
- A WebSocket live feed mirrors new incoming activity as it is generated and scored.

### Review workflow
- High-risk transactions are queued for manual decisioning.
- Operators can approve or block transactions from the alert queue.
- Review actions are persisted and reflected in dashboard metrics.

## System architecture

### Backend
The backend is built with Python and FastAPI.

Core components:
- `backend/data_generator.py` — generates realistic synthetic transaction activity
- `backend/model.py` — trains and scores the fraud-risk model
- `backend/database.py` — persists transaction data and review state
- `backend/main.py` — exposes the API and WebSocket endpoints
- `backend/config.py` — centralizes configuration and CORS settings

### Frontend
The frontend is built with React, Vite, Tailwind CSS, and Recharts.

It provides:
- overview dashboard panels
- transaction investigation views
- searchable/filterable transaction tables
- live alert queue and manual review controls

## Tech stack

- Python 3.10+
- FastAPI
- SQLAlchemy
- scikit-learn
- Pandas / NumPy
- React
- Vite
- Tailwind CSS
- Recharts

## Getting started

### Prerequisites
- Python 3.10 or newer
- Node.js 18 or newer
- npm

### 1) Start the backend
Open a terminal in the project root and run:

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
# source .venv/bin/activate

pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

The backend will initialize the SQLite database, train the model, and begin generating data on startup.

### 2) Start the frontend
Open a second terminal and run:

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Then open:

```text
http://localhost:5173
```

The frontend is configured to call the backend on `http://localhost:8000`.

## API overview

The backend exposes the following operational endpoints:
- `/api/health` — service health and model status
- `/api/stats` — key fraud KPIs
- `/api/timeseries` — hourly transaction and fraud-rate trend data
- `/api/risk-distribution` — count of transactions by risk band
- `/api/category-breakdown` — flagged-rate summary by merchant category
- `/api/transactions` — searchable, filterable transaction records
- `/api/alerts` — pending review queue
- `/ws/live` — live transaction stream for the dashboard

## Data model and scoring logic

The system generates synthetic commerce events and scores them using a hybrid approach:
1. a supervised classifier trained on labeled fraud patterns
2. an unsupervised anomaly signal for irregular behavior
3. explainable reason codes derived from the transaction attributes

This allows the dashboard to show not only that something is risky, but also why it is considered risky from an operational perspective.

## Use case

This project is best understood as a fraud-monitoring command center for digital commerce teams. It demonstrates how an organization might surface suspicious payment behavior in real time, prioritize high-risk cases, and provide a simple interface for operational review.

Although the data is synthetic, the structure and logic map closely to real-world fraud operations workflows.

## Project status

This repository is intended as a working demonstration and portfolio-ready prototype for:
- fraud detection and operational analytics
- ML-backed monitoring interfaces
- dashboard-driven risk review workflows
- end-to-end demo architecture for product showcases

## Notes

This is a synthetic environment, not a live production payments system. It is designed to showcase architecture, data flows, and dashboard UX in a realistic way without exposing or depending on real customer or transaction data.
