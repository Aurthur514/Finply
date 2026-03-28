# Finply AI Financial Sandbox

Finply is a full-stack financial sandbox for paper trading, market monitoring, technical analysis, sentiment research, macro-aware recommendations, and risk simulation. It is designed to stay usable even when free market-data providers are slow or unavailable, with explicit provider health and offline-fallback handling.

## Stack

- Backend: FastAPI, SQLAlchemy, SQLite
- Frontend: React, TypeScript, TailwindCSS, Recharts
- Market data: `ccxt`, `yfinance`, optional free stock-provider keys (`Twelve Data`, `Financial Modeling Prep`, `Alpha Vantage`), plus NSE-aware stock handling for supported India symbols
- AI features: local heuristic models plus optional OpenAI-powered prediction, transcription, and research support

## What It Does

- Paper trading with orders, positions, trades, and watchlists
- Technical analysis and chart-driven workflows
- Macro-aware recommendation engine with global market drivers and scenario forecasts
- Research Memo workflow for analyst-style investment briefs
- News summaries, sentiment summary, and sentiment timeline views
- Assistant chat with optional voice input where supported
- Portfolio risk simulation
- Provider-health visibility and safer stock-data fallbacks

## Current Highlights

- Stock data uses a provider chain instead of trusting a single free source:
  - India symbols such as `TCS`, `INFY`, and `RELIANCE` try `NSE` first where available
  - Other stock paths use `Twelve Data -> FMP -> Alpha Vantage -> Yahoo Finance -> Finply Offline Feed`
- The UI surfaces stock-data health and quote provenance so fallback prices are not silently presented as live.
- Technical Analysis uses native-currency display for non-USD instruments when available.
- Sentiment tooling includes:
  - `Sentiment Summary`
  - `Sentiment Timeline`
  - `News Intelligence`
  - `Research Memo`
- Trading actions are constrained more conservatively when the app is relying on offline fallback pricing.

## Project Layout

```text
finance-ai-app/
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── market_data.py
│   ├── trading_engine.py
│   ├── recommendation_engine.py
│   ├── openai_service.py
│   ├── routers/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── frontend.out.log
│   └── frontend.err.log
├── run-local.bat
└── README.md
```

## Local Setup

### Backend

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend

```powershell
cd frontend
npm install
```

## Run Locally

From the repo root:

```powershell
run-local.bat
```

This starts:

- Frontend: `http://127.0.0.1:3000`
- Backend: `http://127.0.0.1:8000`
- API docs: `http://127.0.0.1:8000/docs`

`run-local.bat` prefers `backend\venv\Scripts\python.exe` when present.

## Logs

The launcher writes logs here:

- Backend stdout: `backend/server.out.log`
- Backend stderr: `backend/server.err.log`
- Frontend stdout: `frontend/frontend.out.log`
- Frontend stderr: `frontend/frontend.err.log`

## Environment Variables

Create `backend/.env` from `backend/.env.example`.

Common optional settings:

```env
DATABASE_URL=sqlite:///./sentinel.db
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
TWELVE_DATA_API_KEY=your_twelve_data_key
FMP_API_KEY=your_financial_modeling_prep_key
NEWS_API_KEY=your_news_api_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_PREDICTION_MODEL=gpt-4o-mini
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=alloy
```

## Market Data Notes

- Stock data reliability depends on external free providers, so Finply uses provider chaining and fallback behavior instead of assuming one source will always work.
- Stock provider health is available from `GET /stocks/market/providers/health`.
- Stock search can use `Financial Modeling Prep` when `FMP_API_KEY` is configured.
- India symbols such as `TCS`, `INFY`, and `RELIANCE` are normalized for cleaner search and display.
- Crypto data uses the existing crypto-specific flow and is separate from the stock fallback chain.

## Sentiment And Research Features

- `GET /news/summary` powers symbol-level sentiment aggregation.
- The frontend includes:
  - headline-level bullish / bearish / neutral aggregation
  - confidence and article-count context
  - theme extraction
  - a time-based sentiment timeline
  - Research Memo views for structured narrative analysis

## Assistant And Voice Features

- If `OPENAI_API_KEY` is configured, the backend can use OpenAI for:
  - voice transcription
  - richer prediction and research output
- If OpenAI transcription is not configured, the frontend attempts browser speech recognition as a fallback where supported.
- The AI Copilot no longer reads responses aloud in the UI.

## Notes

- Stock quotes and historical data may still fall back to the offline demo feed when live providers are rate-limited or unavailable.
- The app includes offline/demo fallbacks for several market data paths so the UI can still function when live data providers are unavailable.
- Prediction endpoints are cached in both frontend and backend to reduce repeated recomputation.
- Stock request health is surfaced in the UI so degraded provider conditions are visible.
- Some crypto or live data providers may still be unavailable depending on local network access.

## Build

Frontend production build:

```powershell
cd frontend
npm run build
```

Backend syntax sanity check:

```powershell
python -m compileall backend
```
