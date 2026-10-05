# VoltSonic Backend

FastAPI + PostgreSQL backend for VoltSonic.

## What it gives you

- a structured API layer for read-heavy frontend screens
- PostgreSQL-backed storage for round snapshots and user bet history
- a scheduler that reads round state directly from the contract and saves the newest ten rounds

## Quick start

1. Copy env values:

```bash
cp .env.example .env
```

2. Start PostgreSQL:

```bash
docker compose up -d
```

3. Create and activate a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

4. Install dependencies into the virtual environment:

```bash
pip install -e .
```

5. Run the API:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

For Render or other hosted environments, use a production start command that binds to all interfaces and the platform port:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

6. Open docs:

`http://127.0.0.1:8000/docs`

7. The scheduler creates and updates round rows automatically. It also reads the latest ten round summaries directly from the contract at startup and on each scheduler cycle. No block-log indexer or manual sync endpoint is used.

## Current routes

- `GET /health`
- `GET /api/v1/rounds`
- `GET /api/v1/rounds/{round_id}`
- `GET /api/v1/bets`
- `GET /api/v1/bets/{bet_id}`
- `GET /api/v1/bets/recent/open`
- `GET /api/v1/bets/recent/closed`
- `GET /api/v1/rounds/latest/result`
- `POST /api/v1/bets` (save a wallet-confirmed bet)

## Env you should set

- `VOLTSONIC_RPC_URLS`
- `VOLTSONIC_CONTRACT_ADDRESS`
- `VOLTSONIC_PRIVATE_KEY` (contract owner key used by the settlement scheduler)
- `CORS_ORIGINS`

If your frontend is hosted on Vercel, set `CORS_ORIGINS` to include your Vercel app URL, for example:

```bash
CORS_ORIGINS=["https://your-app.vercel.app"]
```

Set `VOLTSONIC_CONTRACT_ADDRESS` to the deployed VoltSonic contract address. Wagers and payouts use native ETH.
