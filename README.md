# Nodex (offline sandbox build)

A smart-money analytics dashboard for Solana: smart wallets, what top traders are buying,
insider-bundled launches, a token risk scanner, watchlists and saved filters.

**This build is fully offline and uses only synthetic data.**

- No real people, wallets, trades, token data or images. Every dataset is generated in memory
  from a fixed seed by [backend/src/data/fixtures.ts](backend/src/data/fixtures.ts).
- No external services: no hosted database, no blockchain or market-data APIs, no analytics.
  The API makes no outbound network calls.
- No secrets or API keys are needed or read.
- No accounts or logins. There is one local user: the watchlist and saved filters live in the
  API process's memory and reset on restart.

## Architecture

```text
React/Vite client  ──/api proxy──>  Express API (localhost:3001)
                                        │
                                        ├─ src/data/fixtures.ts   synthetic, seeded dataset (starting state)
                                        ├─ src/workers/*          simulated pipeline, mutates the dataset on a timer
                                        ├─ src/lib/*              scoring, risk, filtering logic (pure, tested)
                                        └─ src/services/*         in-memory watchlists, filters
```

### Simulated worker

The original app had a background worker that pulled market data, trader swaps and launch
transactions from external providers. Here that worker is simulated:
[backend/src/workers/pipeline.ts](backend/src/workers/pipeline.ts) runs the same stages as local
random processes over the synthetic data.

| Step | What it simulates |
| --- | --- |
| `market-health` | Prices random-walk, liquidity follows, and a few pools are pulled (rugs) |
| `discovery` | New launches are listed; rugged and aged-out tokens are dropped |
| `smart-money` | Tracked traders open, add to and trim positions; new tokens enter the list |
| `insiders` | Insiders distribute; new bundled launches are analyzed |
| `wallets` | Smart-wallet profit, win rate and activity drift |
| `sightings` | First-seen and peak-since figures advance (using `lib/sightings`) |

The API runs it in-process every `WORKER_INTERVAL_SECONDS` (default 60; the first run is 5 s
after start). It has to run inside the API because the data lives in the API's memory. Each
run's steps are logged with a `[worker]` prefix, and `GET /api/health` reports the pipeline
status. Runs are deterministic for a given `FIXTURE_SEED` and run number.

`npm run worker --prefix backend -- --runs 10` runs the pipeline standalone and prints what
each run did. It works on its own copy of the data, so it doesn't affect a running API.

## Running

Requires Node 22. After dependencies are installed, nothing needs network access.

```bash
npm install        # root; also installs backend/ and frontend/
npm run dev        # API on :3001, web app on :5173
```

Open http://localhost:5173. There is nothing to sign in to; every page works straight away.

### Tests and checks

All tests run offline with Node's built-in test runner; nothing extra to install.

```bash
npm test                           # everything: backend, then frontend
npm test --prefix backend          # backend only
npm test --prefix frontend         # frontend only
npx tsc --noEmit -p backend        # backend type-check
npm run build --prefix frontend    # frontend type-check + build
```

Run a single file or test by name:

```bash
cd backend && npx tsx --test src/routes/api.test.ts
cd backend && npx tsx --test --test-name-pattern="saved filters" src/routes/api.test.ts
cd frontend && node --test tests/scan-history.test.ts
```

| Suite | Covers |
| --- | --- |
| `backend/src/lib/*.test.ts` | Wallet scoring, insider detection, token risk rules, smart-money aggregation, custom filters, sorting, price tracking |
| `backend/src/data/fixtures.test.ts` | The synthetic dataset is deterministic and well-formed |
| `backend/src/workers/pipeline.test.ts` | 50 simulated pipeline runs keep the data consistent |
| `backend/src/routes/api.test.ts` | Every endpoint over HTTP: wallets, buys and their filters, scanner, insiders, watchlists, saved filters, and error cases |
| `frontend/tests/*.test.ts` | Filter value parsing and formatting, saved filters and scan history in browser storage, money and address formatting, chain links |

## Configuration

All optional. See [backend/.env.example](backend/.env.example) and
[frontend/.env.example](frontend/.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | API port |
| `FIXTURE_SEED` | `1337` | Seed for the synthetic dataset |
| `WORKER_ENABLED` | `true` | Run the simulated pipeline (`false` keeps the data static) |
| `WORKER_INTERVAL_SECONDS` | `60` | Time between pipeline runs (minimum 5) |
| `SMART_MONEY_BUY_WINDOW_HOURS` | `72` | Window described on the smart-money table |

## API

No endpoint needs authentication.

| Route | Description |
| --- | --- |
| `GET /api/health` | Health check and pipeline status |
| `GET /api/wallets/top`, `/api/wallets/:address` | Smart wallets and per-wallet analysis |
| `GET /api/tokens/top` | Token rankings |
| `GET /api/smart-money/buys`, `/wallets` | Tokens tracked traders are buying, and the traders |
| `GET /api/insiders` | Launches bought by linked wallets |
| `GET /api/scanner/:chain/:address[/bundle]` | Token risk scan with verdict |
| `/api/watchlist`, `/api/filters` | Watchlist and saved filters (in memory) |

List endpoints accept `page`, `pageSize`, `sortBy`, `sortOrder` and numeric `min*`/`max*`
filters. The scanner accepts any well-formed address: listed fixture tokens are scanned with
their figures, anything else gets a reproducible synthetic token seeded from the address.

## Project layout

```text
backend/
  src/config/        local config (no secrets)
  src/data/          synthetic dataset generator + tests
  src/workers/       simulated pipeline, scheduler and standalone runner + tests
  src/lib/           pure scoring, risk, filter and sorting logic + tests
  src/routes/        HTTP routes + API tests
  src/services/      in-memory stores and the fixture-backed scanner
frontend/
  src/pages/         dashboard pages
  src/components/    UI
  src/stores/        zustand stores
  src/lib/api.ts     API client
  tests/             frontend unit tests (node --test)
```
