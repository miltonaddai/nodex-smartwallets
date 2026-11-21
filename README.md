# Nodex

Nodex is a smart wallet tracker for Solana. It follows a set of top-performing trading wallets
and shows what they are buying, how each wallet has performed, and whether a token is safe to
follow them into.

- **See what smart money is buying.** Tokens the tracked wallets are net buying, ranked by how
  many of them are in.
- **Judge a wallet by its record.** Profit, win rate, volume and every position, for any period.
- **Spot fake "whales".** Launches bought by one person through many linked wallets.
- **Check a token before you buy.** A risk scan with a buy-or-avoid verdict.
- **Follow the wallets you trust.** A watchlist of wallets and tokens.

There are no accounts: every page works as soon as the app is open.

## Features

### Smart Wallets (`/wallets`)

**Tokens being bought** lists every token the tracked wallets are net buying over the buy
window (72 hours by default). Tokens are ranked by how many tracked wallets are in them, with
ties going to the wallets with the larger 30-day PnL. Each row shows:

- market cap
- net amount bought
- 24h price change
- the time of the latest buy
- when Nodex first saw the token
- its peak price since then, as a multiple

A row expands to show which wallets bought and how much.

The table can be narrowed with:

- a maximum market cap
- a minimum number of buying wallets
- a **custom filter** built from any of the table's fields, such as "top traders buying ≥ 3"
  and "sold under 30% of what they bought". Custom filters can be named and saved, and show
  up as one-click chips.

**Tracked wallets** lists the traders being followed, with their rank, 30-day PnL and volume.

### Wallet profile (`/wallets/:address`)

A single wallet's performance over 24 hours, 7 days, 30 days or all time:

- profit, realized and unrealized PnL
- win rate
- trading volume and trade count
- the number of early ("alpha") token entries

Below that, every token position with its entry, size, PnL and ROI, plus any concentration or
suspicious-activity flags. A wallet can be added to the watchlist from here.

### Insider plays (`/insiders`)

Launches where one person appears to have bought through several wallets. The evidence:

- wallets that co-signed the same buy
- wallets funded by the same private wallet
- bags split into fresh wallets
- identical buys landing in the same slot

Each play shows how much of the supply the linked wallets acquired, how much they still hold,
whether they are holding or distributing, and the shape of the price since launch.

### Token scanner (`/scanner`)

Paste a Solana token address to get a verdict (**avoid**, **caution** or **favorable**) and a
0–100 risk score. The scan checks:

- **Liquidity:** liquidity, and market cap against liquidity
- **Token controls:** mint, freeze and transfer-fee authorities, and permanent delegates
- **Holders:** how concentrated the supply is, with the top holders listed
- **Trading:** bot-farm patterns
- **Launch:** launch bundles
- **Smart money:** which tracked wallets hold the token

Any critical finding means avoid. Recent scans are kept in the browser and reopen instantly.

### Watchlist (`/watchlist`)

The wallets and tokens you follow. Wallets show 7-day PnL, win rate and last activity, and can
be renamed or removed. Tokens show live price, market cap and 24h change.

### Settings (`/settings`)

Light or dark theme.

## How it works

```text
React/Vite client  ──/api proxy──>  Express API (localhost:3001)
                                        │
                                        ├─ src/workers/*    pipeline that refreshes the data on a timer
                                        ├─ src/lib/*        scoring, insider detection, risk and filter logic
                                        ├─ src/services/*   watchlists, saved filters, the scanner
                                        └─ src/data/*       the dataset the pipeline works on
```

The heart of Nodex is a set of pure functions in [backend/src/lib](backend/src/lib):

| Module | What it does |
| --- | --- |
| `alpha-scoring` | Builds each wallet's per-token performance from its trades, then scores the wallet on profit, win rate, entry timing and suspicious activity |
| `smart-money` | Works out which tokens each wallet is net buying and ranks tokens by how many tracked wallets are in |
| `insider-detection` | Scores a launch for common control (co-signed buys, shared private funders, split bags, same-slot buy waves) and tracks whether the insiders still hold |
| `token-risk` | Turns a token's facts into risk flags, positives, a 0–100 score and a verdict |
| `sightings` | Records when a token was first seen and its peak since, ignoring readings that look spoofed |
| `custom-filters`, `sort-rows` | The rules behind custom filters and the table sorting |

A background **pipeline** ([backend/src/workers/pipeline.ts](backend/src/workers/pipeline.ts))
keeps the data moving. It runs inside the API every `WORKER_INTERVAL_SECONDS` (default 60; the
first run is 5 seconds after start):

| Step | What it does |
| --- | --- |
| `market-health` | Updates prices and liquidity; pools that are pulled count as rugs |
| `discovery` | Lists new launches and drops rugged or aged-out tokens |
| `smart-money` | Tracked wallets open, add to and trim positions |
| `insiders` | Linked wallets distribute; new bundled launches are analyzed |
| `wallets` | Wallet profit, win rate and activity update |
| `sightings` | First-seen and peak-since figures advance |

Each run's steps are logged with a `[worker]` prefix, and `GET /api/health` reports the
pipeline status. `npm run worker --prefix backend -- --runs 10` runs the pipeline on its own
and prints what each run did, without touching a running API.

## Data

This version of Nodex runs fully offline on **synthetic sample data**:

- **Generated data:** every wallet, trade, token and price is generated from a fixed seed by
  [backend/src/data/fixtures.ts](backend/src/data/fixtures.ts). None of it belongs to real
  people, wallets or tokens.
- **Simulated pipeline:** the pipeline simulates market and trading activity on that data
  instead of fetching it.
- **Nothing external:** there are no external services, API keys or outbound network calls.
- **In memory:** watchlists and saved filters live in the API's memory and reset when it
  restarts.

The same `FIXTURE_SEED` always produces the same starting data and the same pipeline runs.

## Running

Requires Node 22.18 or newer. After dependencies are installed, nothing needs network access.

```bash
npm install        # root; also installs backend/ and frontend/
npm run dev        # API on :3001, web app on :5173
```

Open http://localhost:5173.

## Tests

All tests use Node's built-in test runner; there is nothing extra to install.

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
| `backend/src/data/fixtures.test.ts` | The dataset is deterministic and well-formed |
| `backend/src/workers/pipeline.test.ts` | 50 pipeline runs keep the data consistent |
| `backend/src/routes/api.test.ts` | Every endpoint over HTTP: wallets, buys and their filters, scanner, insiders, watchlists, saved filters, and error cases |
| `frontend/tests/*.test.ts` | Filter value parsing and formatting, saved filters and scan history in browser storage, money and address formatting, chain links |

## Configuration

All optional. See [backend/.env.example](backend/.env.example) and
[frontend/.env.example](frontend/.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | API port |
| `FIXTURE_SEED` | `1337` | Seed for the dataset |
| `WORKER_ENABLED` | `true` | Run the pipeline (`false` keeps the data static) |
| `WORKER_INTERVAL_SECONDS` | `60` | Time between pipeline runs (minimum 5) |
| `SMART_MONEY_BUY_WINDOW_HOURS` | `72` | Buy window shown on the Smart Wallets table |

## API

| Route | Description |
| --- | --- |
| `GET /api/health` | Health check and pipeline status |
| `GET /api/wallets/top`, `/api/wallets/:address` | Ranked wallets and a single wallet's profile |
| `GET /api/smart-money/buys`, `/wallets` | Tokens the tracked wallets are buying, and the wallets |
| `GET /api/insiders` | Launches bought by linked wallets |
| `GET /api/scanner/:chain/:address[/bundle]` | Token risk scan with verdict |
| `GET /api/tokens/top` | Token rankings |
| `/api/watchlist`, `/api/watchlist/tokens`, `/api/filters` | Watchlists and saved filters |

List endpoints accept `page`, `pageSize`, `sortBy`, `sortOrder` and numeric `min*`/`max*`
filters. No endpoint needs authentication.

## Project layout

```text
backend/
  src/config/        configuration
  src/data/          dataset generator + tests
  src/workers/       pipeline, scheduler and standalone runner + tests
  src/lib/           scoring, insider detection, risk, filter and sorting logic + tests
  src/routes/        HTTP routes + API tests
  src/services/      watchlists, saved filters and the token scanner
frontend/
  src/pages/         app pages
  src/components/    UI
  src/stores/        zustand stores
  src/lib/           API client and helpers
  tests/             frontend unit tests
```

## License

MIT. See [LICENSE](LICENSE).
