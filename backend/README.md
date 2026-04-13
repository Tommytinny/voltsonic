# VoltSonic Backend

FastAPI + PostgreSQL backend for VoltSonic.

## What it gives you

- a structured API layer for read-heavy frontend screens
- PostgreSQL-backed storage for indexed rounds and bets
- a contract indexer entrypoint so the frontend can stop relying on broad `eth_getLogs`

## Quick start

1. Copy env values:

```bash
cp .env.example .env
```

2. Start PostgreSQL:

```bash
docker compose up -d
```

If you already started the older scaffold once, reset the local Postgres volume before first run of this indexer version so the new columns and `sync_state` table are created cleanly:

```bash
docker compose down -v
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

6. Open docs:

`http://127.0.0.1:8000/docs`

7. Trigger a bounded sync:

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/sync?max_blocks=200"
```

For the first backfill from the deployment block, you can be more explicit:

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/sync?from_block=39806939&max_blocks=200"
```

## Current routes

- `GET /health`
- `GET /api/v1/rounds`
- `GET /api/v1/rounds/{round_id}`
- `GET /api/v1/bets`
- `GET /api/v1/bets/{bet_id}`
- `GET /api/v1/bets/recent/open`
- `GET /api/v1/bets/recent/closed`
- `GET /api/v1/rounds/latest/result`
- `POST /api/v1/sync`

## Env you should set

- `VOLTSONIC_RPC_URL`
- `VOLTSONIC_CONTRACT_ADDRESS`
- `INDEXER_START_BLOCK`
- `INDEXER_BLOCK_CHUNK_SIZE`

The default chunk size is `10` blocks to stay compatible with tight free-tier RPC log limits.

For the token-based VoltSonic flow, set `VOLTSONIC_CONTRACT_ADDRESS` to the deployed VoltSonic proxy address, not the `$VOLT` ERC-20 token address.
