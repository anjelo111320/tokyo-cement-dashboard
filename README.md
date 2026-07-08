# INSEE Finished Goods Inventory Hub

A production-grade inventory analytics platform for **INSEE Cement's** Sri Lanka operations. It turns raw SAP material-ledger CSV exports into live dashboards that management uses to monitor stock on hand, in-transit movements, inter-plant transfers, and low-stock alerts across ~30 plant and depot locations.

The source data refreshes on a schedule (every 15 minutes by default), and administrators can also upload new CSV datasets on the fly, manage plant/material master data, define brand groups and thresholds, and manage users — all without a redeploy.

> **A note on naming:** the running application is branded **INSEE** (sidebar logo, page titles, PWA manifest). The GitHub repository slug (`tokyo-cement-dashboard`) and some legacy strings still carry the former **Tokyo Cement** name. Treat _INSEE_ as the current product name.

---

## Table of Contents

1. [What the system does](#1-what-the-system-does)
2. [Tech stack](#2-tech-stack)
3. [System architecture](#3-system-architecture)
4. [Repository structure](#4-repository-structure)
5. [Backend — how the Python works](#5-backend--how-the-python-works)
6. [Frontend — how the React works](#6-frontend--how-the-react-works)
7. [End-to-end request trace](#7-end-to-end-request-trace)
8. [Business logic explained](#8-business-logic-explained)
9. [Authentication & authorization](#9-authentication--authorization)
10. [Environment configuration](#10-environment-configuration)
11. [Running locally](#11-running-locally)
12. [Database & migrations](#12-database--migrations)
13. [SharePoint integration setup](#13-sharepoint-integration-setup)
14. [Deployment](#14-deployment)
15. [Testing](#15-testing)
16. [Extending the system](#16-extending-the-system)
17. [Operational notes & troubleshooting](#17-operational-notes--troubleshooting)

---

## 1. What the system does

| Area                        | Description                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Home / Overview**         | KPI cards (on-hand, in-transit in/out, alert count) and a per-plant inventory table, filterable by plant and material.                                                            |
| **Map**                     | Interactive Leaflet map of every plant, coloured by plant type, with stock-alert bubbles and inter-plant transfer arcs.                                                           |
| **Stock Sheet**             | Two report views: **Material View** (per-material breakdown, plants as rows _or_ materials as rows) and **Location Summary** (brand × location grid of floor stock and dispatch). |
| **Settings**                | Data-source status, manual CSV refresh, MT/Bags display units, and low-stock threshold editing.                                                                                   |
| **Admin** (admin role only) | Manage plants, materials, brand groups, uploadable CSV datasets, users, and the SharePoint connection.                                                                            |

The core data model is the **SAP material ledger**: every row is a stock _movement_ classified by an **object type** (`CA`, `BV`, `VM`) and a **category** (`AB`, `ZU`, `KB`, `VN`, `EB`). Everything the dashboards show is derived from filtering and aggregating these movement rows — see [Business logic explained](#8-business-logic-explained).

---

## 2. Tech stack

| Layer            | Technology                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Frontend**     | React 19, TypeScript 6, Vite 8, Tailwind CSS 4, Radix UI, TanStack React Query 5, React Router 7, Leaflet / React-Leaflet, Axios, Lucide icons, oxlint |
| **Backend**      | Python 3.10+, FastAPI, Pydantic v2 / pydantic-settings, Pandas, APScheduler, structlog                                                                 |
| **Database**     | PostgreSQL (async via SQLAlchemy 2 + asyncpg), Alembic migrations                                                                                      |
| **Auth**         | JWT (python-jose) in httpOnly cookies, bcrypt password hashing (passlib)                                                                               |
| **Integrations** | Microsoft Graph / SharePoint via MSAL + httpx                                                                                                          |
| **Deployment**   | Vercel (frontend) + Render (backend, Docker); Docker Compose for local                                                                                 |

Two distinct data stores are used deliberately:

- **CSV cache (in-memory Pandas):** the _analytics_ data — the material ledger and plant master. Read-heavy, rebuilt on a schedule. Never written to by users.
- **PostgreSQL:** the _operational_ data — users, plant/material admin edits, brand groups, thresholds, uploaded datasets, SharePoint config. Written to via the admin/settings APIs.

---

## 3. System architecture

```mermaid
flowchart TB
    subgraph Source["Data sources"]
        SAP["SAP CSV export<br/>(June inventory Data.csv,<br/>plant_names.csv)"]
        UP["Admin CSV upload<br/>(stored in Postgres)"]
    end

    subgraph Backend["FastAPI backend"]
        SCHED["APScheduler<br/>(reload every 15 min)"]
        CACHE["CsvCache<br/>(in-memory DataFrames,<br/>thread-safe RLock)"]
        REPO["Repositories<br/>(csv/ + db/)"]
        SVC["Services<br/>(business logic)"]
        API["API routes<br/>/api/v1/*"]
        DB[("PostgreSQL<br/>users, admin data,<br/>thresholds, datasets")]
    end

    subgraph Frontend["React SPA"]
        RQ["React Query<br/>(cache + refetch)"]
        UI["Feature pages<br/>(home, map, report,<br/>settings, admin)"]
    end

    SAP --> CACHE
    UP --> DB --> CACHE
    SCHED --> CACHE
    CACHE --> REPO --> SVC --> API
    DB --> REPO
    API -->|"JSON over HTTPS + httpOnly cookie"| RQ --> UI
    UI -->|"axios GET/POST"| API
```

**Key idea:** routes are _thin_ (parse request, call a service, wrap the result). Services hold the _business logic_. Repositories are the _only_ things that touch a data source (a Pandas frame or a DB table). This keeps the layers swappable and testable.

---

## 4. Repository structure

```
dashboard-project/
├── backend/                     — FastAPI application
│   ├── main.py                  — app entry point; wires everything together
│   ├── start.sh                 — container entrypoint (migrate → seed → serve)
│   ├── Dockerfile
│   ├── alembic.ini, alembic/    — DB migration config + versioned migrations
│   ├── api/
│   │   ├── router.py            — mounts every /api/v1 sub-router
│   │   └── v1/                  — HTTP route handlers (thin)
│   │       ├── health.py        — /health, /status
│   │       ├── settings.py      — /settings/* (csv-config, ingestion, thresholds)
│   │       ├── material_ledger.py — /material-ledger/* (the dashboard data)
│   │       ├── auth.py          — /auth/* (login, logout, refresh, me)
│   │       └── admin.py         — /admin/* (CRUD for plants, materials, users…)
│   ├── auth/
│   │   ├── jwt.py               — create/decode access & refresh tokens
│   │   ├── password.py          — bcrypt hash/verify
│   │   └── dependencies.py      — get_current_user / require_admin guards
│   ├── core/
│   │   ├── config.py            — env-var settings (pydantic-settings)
│   │   ├── logging.py           — structured JSON logging (structlog)
│   │   ├── middleware.py        — CORS + request-timing header
│   │   ├── scheduler.py         — 15-min CSV refresh job (APScheduler)
│   │   ├── exceptions.py        — AppError hierarchy
│   │   └── material_ledger_config.py — SINGLE SOURCE OF TRUTH for SAP codes
│   ├── models/
│   │   └── material_ledger.py   — domain dataclass for a movement row
│   ├── repositories/
│   │   ├── csv/
│   │   │   ├── csv_base.py       — CsvCache singleton (in-memory DataFrames)
│   │   │   └── material_ledger_csv_repo.py — filters/maps the ledger frame
│   │   └── db/                   — async SQLAlchemy repos (users, plants…)
│   ├── schemas/                 — Pydantic response/request models
│   ├── services/
│   │   ├── material_ledger_service.py — all dashboard aggregation logic
│   │   └── sharepoint_service.py — Microsoft Graph file fetch + test
│   ├── db/
│   │   ├── database.py          — async engine + session factory
│   │   ├── base.py              — SQLAlchemy declarative Base
│   │   └── models/              — ORM tables (user, plant, material…)
│   ├── scripts/
│   │   ├── bootstrap_admin.py   — create/refresh admin from env vars
│   │   └── seed_reference.py    — seed plants+materials from the CSV
│   └── tests/                   — pytest smoke suite (SQLite-backed)
│
├── frontend/                    — React single-page app
│   └── src/
│       ├── main.tsx             — ReactDOM entry; Leaflet icon fix
│       ├── App.tsx              — mounts providers + router
│       ├── app/providers.tsx    — QueryClient, AuthProvider, SidebarProvider
│       ├── routes/index.tsx     — route table + auth guards
│       ├── layouts/             — Sidebar, TopBar, BottomNav, RootLayout
│       ├── features/            — one folder per page
│       │   ├── home/            — overview dashboard
│       │   ├── map/             — Leaflet map + transfer arcs
│       │   ├── report/          — Stock Sheet (material & location views)
│       │   ├── settings/        — settings page
│       │   ├── admin/           — admin console
│       │   ├── auth/            — LoginPage + AuthProvider/Context
│       │   └── material_ledger/hooks/useLedger.ts — React Query hooks
│       ├── services/            — axios client + one service per domain
│       ├── hooks/               — useSettingsStore, useLocalStorage, …
│       ├── constants/           — config, routes, queryKeys
│       ├── types/               — TS interfaces mirroring backend schemas
│       └── utils/               — cn(), formatters
│
├── sample-data/                 — bundled dev CSVs (ledger + plant master)
├── docker-compose.yml           — db + backend + frontend for local dev
└── README.md
```

---

## 5. Backend — how the Python works

The backend is a layered FastAPI app. Data flows **down** through the layers on the way in, and results flow **up** on the way out. Each layer only knows about the one directly below it.

```
HTTP request
   │
   ▼
api/v1/*.py        ── parse query params, enforce auth, call a service
   │
   ▼
services/*.py      ── business logic: filter, aggregate, compute KPIs
   │
   ▼
repositories/      ── the ONLY layer that reads a data source
   ├── csv/        ──   → CsvCache (Pandas DataFrames in memory)
   └── db/         ──   → PostgreSQL (async SQLAlchemy)
   │
   ▼
schemas/*.py       ── Pydantic models shape the JSON response
```

### 5.1 The entry point — `main.py`

`backend/main.py` is the first file Python runs. It:

1. Configures logging (`core/logging.py`).
2. Defines a **lifespan** context manager that runs at startup/shutdown:
   - Refuses to boot in production with a placeholder `SECRET_KEY`.
   - Initializes the Postgres engine (`db/database.py`) **if** `DATABASE_URL` is set.
   - Hydrates the in-memory threshold cache from the DB (so alert settings survive restarts).
   - Calls `csv_cache.load_all()` to read the CSVs into memory.
   - Re-pins any admin-uploaded dataset that was active before restart.
   - Starts the APScheduler refresh job.
3. Builds the app via `create_app()` — adds CORS + timing middleware, mounts `api_router`, and registers a global `AppError` → JSON exception handler.

The whole dependency graph is documented in the module docstring at the top of `main.py`.

### 5.2 The data cache — `repositories/csv/csv_base.py`

This is the heart of the analytics data layer. `CsvCache` is a **singleton** (`csv_cache`) that holds each CSV as a Pandas DataFrame in memory:

- **Why cache?** Parsing a 5,000-row CSV on every request would be slow. Instead the file is parsed once at startup and reloaded every 15 minutes in the background; requests are served from memory in microseconds.
- **Thread safety.** The scheduler runs in a background thread while requests run in the async loop. Every read/write takes a re-entrant lock (`RLock`) so a request can never observe a half-written frame.
- **`.get(key)` returns a _copy_** so callers can filter/mutate freely without corrupting the shared frame.
- **Pinning.** When an admin uploads a dataset, `pin_dataframe()` swaps it in and marks the key "pinned" so the scheduler's disk reload can't clobber it. `unpin()` reverts to the bundled file.
- **Validation.** `REQUIRED_COLUMNS` rejects a malformed export at load time (keeping the previous good data live) rather than silently rendering empty dashboards.

`CSV_FILES` maps the two logical datasets to their filenames:

| Logical key       | File                       | Purpose                                      |
| ----------------- | -------------------------- | -------------------------------------------- |
| `material_ledger` | `June inventory(Data).csv` | SAP movement rows (the analytics data)       |
| `plant_names`     | `plant_names.csv`          | Plant master: names, cities, GPS coordinates |

### 5.3 The scheduler — `core/scheduler.py`

An APScheduler `BackgroundScheduler` fires `csv_cache.load_all()` every `CSV_REFRESH_INTERVAL_SECONDS` (default 900s). `start_scheduler()` is called from `main.py`'s lifespan startup; `stop_scheduler()` on shutdown. Pinned (uploaded) datasets are skipped by the reload.

### 5.4 Config-driven SAP logic — `core/material_ledger_config.py`

**This is the only file you edit when the SAP export changes.** Nothing else in the codebase hard-codes a CSV column name, a category code, or a category colour. It defines:

- `COLUMN_MAP` — internal field name → CSV column header (rename-safe).
- `PLANT_COLUMN_MAP` — the same for plant master columns.
- `CATEGORY_CONFIG` — each category code (`AB`/`ZU`/`KB`/`VN`/`EB`) with its label, order, sign, colour, and role.
- `OBJ_TYPE_CONFIG` — `CA`/`BV`/`VM` object-type labels.
- `PROC_CAT_LABELS` — procurement sub-categories (Stock Transfer, Sales Order…).
- `QUANTITY_UNIT`, `CURRENCY_SYMBOL`, and the `MATERIAL_THRESHOLDS` dict (hydrated from the DB at startup).

### 5.5 Repositories

- `repositories/csv/material_ledger_csv_repo.py` — `get_movements(...)` reads the cached frame, renames columns via `COLUMN_MAP`, and returns filtered `MaterialMovement` dataclasses. This is the _only_ place that understands the raw CSV shape.
- `repositories/db/*` — thin async SQLAlchemy repos: `user_repo`, `plant_repo`, `threshold_repo`, `settings_repo`. Each exposes small query/upsert functions used by services and routes.

### 5.6 Services

`services/material_ledger_service.py` is where the real work happens — `get_inventory_report()`, `get_stock_transfers()`, `get_location_summary()`, `get_inventory_summary()`, `get_inventory_alerts()`, `get_kpis()`, etc. Services take already-loaded movement rows and turn them into the exact shapes the dashboards need. `services/sharepoint_service.py` wraps Microsoft Graph.

### 5.7 Schemas

`schemas/*.py` are Pydantic v2 models that define the response contract. Every route declares `response_model=ApiResponse[...]`, so FastAPI validates and documents the output automatically (visible at `/docs`). The frontend's `types/*.ts` mirror these exactly.

---

## 6. Frontend — how the React works

The frontend is a Vite + React 19 SPA. Its layering mirrors the backend: **components** call **hooks**, hooks call **services**, services call the **axios client**, and TanStack **React Query** caches everything in between.

```
main.tsx  →  App.tsx  →  AppProviders  →  AppRouter  →  Feature page
                              │                              │
                              │                              ▼
                    QueryClient / Auth / Sidebar      component renders
                                                             │
                                          useXxx() hook ─────┤ (React Query)
                                                             ▼
                                          services/*.service.ts
                                                             ▼
                                          services/api.client.ts (axios)
                                                             ▼
                                                    /api/v1/* (backend)
```

### 6.1 Bootstrapping

- `main.tsx` — creates the React root, imports Leaflet CSS, and patches Leaflet's default marker icons (broken by Vite's asset hashing).
- `App.tsx` — renders `<AppProviders>` wrapping `<AppRouter>`.
- `app/providers.tsx` — sets up the `QueryClient` (retry: 2, no refetch-on-focus), `AuthProvider`, and `SidebarProvider`.
- `routes/index.tsx` — the route table. `/login` is public; everything else is wrapped in `<RequireAuth>`, and `/admin` additionally in `<RequireAdmin>`. Pages are code-split with `React.lazy`.

### 6.2 The data-fetching pattern

Every dashboard data need follows the same four-file pattern:

1. **Type** — `src/types/material_ledger.types.ts` defines the TS interface (mirrors the backend Pydantic schema).
2. **Service** — `src/services/material_ledger.service.ts` has a method that calls `apiClient.get(...)` and returns `res.data.data`.
3. **Query key** — `src/constants/queryKeys.ts` centralizes cache keys so refetch/invalidation is consistent.
4. **Hook** — `src/features/material_ledger/hooks/useLedger.ts` wraps the service in `useQuery` with a `staleTime`.

A component then just calls the hook:

```tsx
const { data: report, isLoading } = useInventoryReport();
```

### 6.3 The axios client — `services/api.client.ts`

A single configured axios instance:

- `baseURL = ${apiBaseUrl}/api/v1`, `withCredentials: true` (sends the httpOnly auth cookie on every request).
- 60s timeout (Render free-tier cold starts can take ~50s).
- A **response interceptor** that, on a `401`, silently calls `/auth/refresh` once and retries the original request; if refresh fails it redirects to `/login`. Only `/auth/login` and `/auth/refresh` are excluded from this retry (so `/auth/me` correctly restores a session on page load).

### 6.4 Client-side state

- `hooks/useSettingsStore.ts` — a small shared store for display preferences (MT vs Bags per material, thresholds, zero-stock mode) with `convertQty()` for unit conversion.
- `features/auth/AuthProvider.tsx` — exposes `user`, `isAdmin`, `login`, `logout` via context; the current user comes from a `['auth','me']` React Query.

---

## 7. End-to-end request trace

Here is one real request — loading the **Stock Sheet → Material View** — traced from click to pixels.

```mermaid
sequenceDiagram
    participant U as User
    participant C as ReportPage.tsx
    participant H as useInventoryReport (hook)
    participant S as material_ledger.service.ts
    participant AX as api.client.ts (axios)
    participant R as api/v1/material_ledger.py
    participant SVC as material_ledger_service.py
    participant CR as material_ledger_csv_repo.py
    participant CACHE as CsvCache

    U->>C: opens Stock Sheet
    C->>H: useInventoryReport()
    H->>S: getInventoryReport(materialIds, plantIds)
    S->>AX: GET /material-ledger/inventory-report
    AX->>R: HTTPS + httpOnly cookie
    R->>SVC: svc.get_inventory_report(...)
    SVC->>CR: get_movements(...)
    CR->>CACHE: csv_cache.get("material_ledger")
    CACHE-->>CR: DataFrame copy
    CR-->>SVC: List[MaterialMovement]
    SVC-->>R: InventoryReportSchema (aggregated)
    R-->>AX: { success, data, meta }
    AX-->>S: res.data.data
    S-->>H: InventoryReport
    H-->>C: { data, isLoading }
    C-->>U: renders material cards / grid
```

Every response is wrapped in the same envelope:

```json
{
  "success": true,
  "data": {
    /* ... */
  },
  "meta": { "timestamp": "…Z" }
}
```

### API surface (all under `/api/v1`)

| Group                  | Endpoints                                                                                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Health**             | `GET /health` · `GET /status`                                                                                                                                                           |
| **Material ledger**    | `GET /material-ledger/kpis` · `/inventory-summary` · `/inventory-alerts` · `/stock-transfers` · `/inventory-report` · `/location-summary` · `/materials` · `/brand-groups` · `/plants`  |
| **Settings**           | `GET /settings/csv-config` · `POST /settings/ingestion/trigger` · `GET/POST /settings/thresholds`                                                                                       |
| **Auth**               | `POST /auth/login` · `POST /auth/logout` · `POST /auth/refresh` · `GET /auth/me`                                                                                                        |
| **Admin** (admin only) | CRUD under `/admin/plants`, `/admin/materials` (+ `/materials/sync`), `/admin/brand-groups`, `/admin/datasets` (+ activate/delete), `/admin/users`, and `/admin/sharepoint` (+ `/test`) |

Interactive docs are always available at **`/docs`** (Swagger) and **`/redoc`**.

---

## 8. Business logic explained

### 8.1 The SAP movement model

Every ledger row is a stock movement described by two codes:

**Object type** (`Obj Type`) — _what kind of record it is:_

| Code | Meaning                                                              |
| ---- | -------------------------------------------------------------------- |
| `CA` | Stock account (accounting/closing balance rows)                      |
| `BV` | Goods movement (physical stock)                                      |
| `VM` | Material valuation (carries source→destination detail for transfers) |

**Category** — _what the movement represents:_

| Code | Name                 | Role                            |
| ---- | -------------------- | ------------------------------- |
| `AB` | Beginning inventory  | opening balance                 |
| `ZU` | Receipts             | inflow (production + transfers) |
| `KB` | Cumulative inventory | running total (AB + ZU)         |
| `VN` | Consumption          | outflow (sales + internal use)  |
| `EB` | Ending inventory     | closing balance                 |

> ⚠️ **Avoid triple-counting.** `CA`, `BV`, and `VM` rows can each carry the same physical quantity for one event. Aggregations pick the _specific_ obj-type/category combination they need (e.g. closing stock = `CA` + `EB` only) rather than summing across all obj types.

### 8.2 Inventory report (Stock Sheet)

`get_inventory_report()` builds, per material and per plant:

- **On hand** = sum of `CA`/`EB` closing-stock rows.
- **Transit OUT** = `BV`/`VN` "Stock Transfer" rows at _factory_ plants (dispatched, not yet arrived).
- **Transit IN** = `BV`/`ZU` "Stock Transfer" rows at _depot_ plants (arriving).
- **Without transit** = on-hand + transit-in − transit-out (adjusted position).

Factory plants are detected dynamically (plants with `ZU` + "Production" rows), so nothing is hard-coded.

The Stock Sheet UI (`features/report/ReportPage.tsx`) offers two transposes of the same data — **plants as rows** (grouped by material) or **materials as rows** (grouped by plant) — plus "hide inactive" and MT/Bags toggles. The "where-to-where" hint under each transit figure comes from the separate `VM` transfer feed (`/stock-transfers`); it is a lightweight directional hint and is not guaranteed to reconcile exactly with the `BV`-based transit totals, because they are different underlying record sets.

### 8.3 Location summary & brand groups

`get_location_summary()` produces a **brand × location** grid of floor stock and period dispatch. Brand groups are admin-managed rows in Postgres (not derived from the description at request time), and each material carries an admin-editable `brand_group` — so an admin's manual re-classification is reflected immediately.

### 8.4 Thresholds & low-stock alerts

`MATERIAL_THRESHOLDS` (material_id → minimum MT) drives `get_inventory_alerts()`: any plant whose closing stock for a material falls below its threshold appears as a `low`/`out` alert. Thresholds are **write-through**: the in-memory dict and the `material_thresholds` DB table are kept in sync by both `/settings/thresholds` and `/admin/thresholds`, and the dict is hydrated from the DB at startup so settings survive restarts.

### 8.5 Units — MT vs Bags

All quantities are stored and computed in **metric tonnes (MT)**. The frontend can display per-material **bag counts** using a `bagsPerMt` factor from `useSettingsStore`. Because different materials have different bag sizes, plant-level _totals_ that mix materials are always shown in MT (summing bag counts across materials isn't physically meaningful), while individual per-material cells respect the MT/Bags toggle.

---

## 9. Authentication & authorization

Auth uses **JWTs stored in httpOnly cookies** (not localStorage — protects against XSS token theft).

```mermaid
sequenceDiagram
    participant B as Browser
    participant API as /auth
    participant DB as Postgres

    B->>API: POST /auth/login (email, password)
    API->>DB: look up user, verify bcrypt hash
    API-->>B: Set-Cookie access_token (15 min) + refresh_token (7 d)
    Note over B,API: subsequent requests send cookies automatically

    B->>API: GET /material-ledger/... (access expired → 401)
    B->>API: POST /auth/refresh (refresh_token cookie)
    API->>DB: validate user still active
    API-->>B: new access + refresh cookies
    B->>API: retry original request → 200
```

- `auth/jwt.py` — creates/decodes typed access & refresh tokens (each carries `sub`, `type`, `exp`, `jti`).
- `auth/password.py` — bcrypt hash/verify.
- `auth/dependencies.py` — `get_current_user` (reads the `access_token` cookie, loads the user) and `require_admin` (403 if not admin). Routes declare these as FastAPI dependencies.
- Login is **rate-limited** (per IP + email) to blunt brute-forcing.
- **Cross-site cookies:** when the frontend and backend are on different domains (Vercel + Render), set `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true` — browsers only send `SameSite=None` cookies over HTTPS.

The first admin is created by `scripts/bootstrap_admin.py` from `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` (run automatically by `start.sh`). Additional users are managed in the Admin console.

---

## 10. Environment configuration

### Backend — `backend/.env`

```ini
# CSV data source
CSV_BASE_PATH=../sample-data
CSV_REFRESH_INTERVAL_SECONDS=900

# CORS (comma-separated origins allowed to call the API)
ALLOWED_ORIGINS_STR=http://localhost:5173,http://localhost:3000

# Logging
LOG_LEVEL=INFO

# Database (omit to run CSV-only with auth/admin disabled)
DATABASE_URL=postgresql+asyncpg://cement:cement@localhost:5432/cement_db

# Auth — generate SECRET_KEY with: openssl rand -hex 32
SECRET_KEY=changeme-replace-with-openssl-rand-hex-32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# Auth cookies — local dev keeps these defaults
COOKIE_SAMESITE=lax        # cross-site prod: none
COOKIE_SECURE=false        # cross-site prod: true

# Admin bootstrap (optional; creates/refreshes an admin on startup)
# BOOTSTRAP_ADMIN_EMAIL=admin@example.com
# BOOTSTRAP_ADMIN_PASSWORD=change-me
```

> The app boots **without** `DATABASE_URL` — the CSV dashboards work, but auth, admin, thresholds persistence, and uploads are disabled. In any deployment where `COOKIE_SECURE=true`, a placeholder `SECRET_KEY` will refuse to start.

### Frontend — `frontend/.env.local`

```ini
VITE_API_BASE_URL=http://localhost:8000   # empty string = use Vite proxy
VITE_REFRESH_INTERVAL_MS=300000
VITE_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

An empty `VITE_API_BASE_URL` makes the client use relative URLs, and the Vite dev server proxies `/api/*` to `http://localhost:8000` (works for phones on the same Wi-Fi too).

---

## 11. Running locally

### Option A — Docker Compose (everything at once)

```bash
docker compose up --build
# frontend → http://localhost:5173
# backend  → http://localhost:8000  (Swagger at /docs)
# postgres → localhost:5432
```

This starts Postgres, the backend (with `--reload`), and the frontend dev server, with the CSVs mounted from `sample-data/`.

### Option B — run each service manually

**Backend** (from the project root so `backend` is importable):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # add -r requirements-dev.txt for tests
cp .env.example .env                      # then edit as needed
cd ..
uvicorn backend.main:app --reload --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev        # http://localhost:5173
npm run build      # type-check (tsc -b) + production build → dist/
npm run lint       # oxlint
```

---

## 12. Database & migrations

Schema is managed with **Alembic** (`backend/alembic/`).

```bash
cd backend
alembic upgrade head                       # apply all migrations
alembic revision --autogenerate -m "msg"   # create a new migration
alembic downgrade -1                        # roll back one
```

ORM models live in `backend/db/models/`: `user`, `plant`, `material`, `material_threshold`, `brand_group`, `csv_dataset`, `sharepoint_config`.

On container start, `start.sh` runs (best-effort, never blocking the API):

1. `alembic upgrade head` — apply migrations.
2. `bootstrap_admin.py` — ensure the admin user exists.
3. `seed_reference.py` — populate plants + materials from the CSV (inserts only missing rows; never overwrites admin edits).

> **Render free-tier note:** the managed Postgres is deleted ~30 days after creation. Because migrations + seed run on every boot, the baseline rebuilds automatically — only manual admin edits and non-bootstrap users are lost. Neon or Supabase are recommended if that data loss matters.

---

## 13. SharePoint integration setup

**Current status (be aware):** the SharePoint feature today lets an admin **store** a connection config and **test** it against Microsoft Graph. The scheduled _auto-pull_ of the file into the CSV cache is **not yet wired** — `SharePointService.get_file_bytes()` exists but is not called by the scheduler. So configuring SharePoint validates credentials and saves them; it does not yet replace the bundled CSV automatically. (For live data today, use the Admin **CSV upload** feature instead.)

Setting it up still requires a proper Azure AD app registration, documented here for when the sync is completed.

### Step 1 — Register an app in Azure AD (Entra ID)

1. Azure Portal → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Name it (e.g. `INSEE Dashboard SharePoint Reader`), single-tenant, no redirect URI needed.
3. After creation, copy the **Application (client) ID** and **Directory (tenant) ID**.

### Step 2 — Create a client secret

1. In the app → **Certificates & secrets** → **New client secret**.
2. Copy the secret **value** immediately (shown only once).

### Step 3 — Grant Graph permissions

1. **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions**.
2. Add `Sites.Read.All` (or `Files.Read.All`).
3. Click **Grant admin consent**.

### Step 4 — Identify the site, drive, and file

- **`site_url`** — the Graph site identifier, e.g. `contoso.sharepoint.com,<siteId>,<webId>`.
- **`drive_id`** — the document library's drive ID (`GET /sites/{site}/drives`).
- **`file_path`** — the path to the CSV within that drive, e.g. `Reports/June inventory(Data).csv`.

### Step 5 — Enter it in the Admin console

Log in as an admin → **Admin → SharePoint**, fill in tenant ID, client ID, client secret, site URL, drive ID, and file path, then click **Test connection**. On success the config is saved (`PUT /admin/sharepoint`); the secret is stored server-side and never returned to the browser (the API masks it as `***`).

The config is persisted in the `sharepoint_config` table via `settings_repo`. When auto-sync is finished, the scheduler will call `get_file_bytes()` and `csv_cache.pin_dataframe()` on the configured interval.

---

## 14. Deployment

**Topology:** Vercel (frontend) ↔ Render (backend, Docker) ↔ Render/managed Postgres.

### Backend → Render

1. New **Web Service** → connect the repo → Root Directory: `backend`, Runtime: **Docker** (`backend/Dockerfile`, which runs `start.sh`).
2. Set environment variables:
   ```
   DATABASE_URL=postgresql+asyncpg://…      # Render managed Postgres
   SECRET_KEY=<openssl rand -hex 32>
   ALLOWED_ORIGINS_STR=https://your-frontend.vercel.app
   COOKIE_SAMESITE=none
   COOKIE_SECURE=true
   BOOTSTRAP_ADMIN_EMAIL=…
   BOOTSTRAP_ADMIN_PASSWORD=…
   CSV_BASE_PATH=/data/csv
   ```
3. Mount a volume at `/data/csv` (or rely on the bundled sample data / admin upload).

### Frontend → Vercel

1. Import the repo → Root Directory: `frontend` → framework preset **Vite**.
2. Set `VITE_API_BASE_URL=https://your-backend.onrender.com`.
3. Deploy. `npm run build` runs `tsc -b && vite build`.

### Keep-alive

Render's free tier sleeps when idle (~50s cold start). `layouts/RootLayout.tsx` pings `/api/v1/health` every 14 minutes while the app is open to keep the backend warm during working hours. The axios client's 60s timeout absorbs the occasional cold start.

> A `.github/workflows/deploy-frontend.yml` also exists for a GitHub Pages build path; the Vercel + Render topology above is the current production setup.

---

## 15. Testing

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest tests/            # SQLite-backed smoke suite, ~seconds
```

The suite (`tests/test_smoke.py`, `conftest.py`) spins up the app against an in-memory/SQLite DB (via `aiosqlite`) and exercises the core endpoints — no Postgres required.

Frontend quality gates: `npm run build` (includes `tsc -b` type-check) and `npm run lint` (oxlint).

---

## 16. Extending the system

### Add a new dashboard data feature (frontend)

1. Add the TypeScript interface in `src/types/<domain>.types.ts`.
2. Add a service method in `src/services/<domain>.service.ts`.
3. Add a query key in `src/constants/queryKeys.ts`.
4. Add a `useQuery` hook in `src/features/<domain>/hooks/`.
5. Build the component with loading / empty / error states and wire it into the page.

### Add a new API endpoint (backend)

1. Add a Pydantic schema in `backend/schemas/<domain>.py`.
2. Add a repository method (`repositories/csv/` or `repositories/db/`).
3. Add a service method in `backend/services/<domain>_service.py`.
4. Add the route in `backend/api/v1/<domain>.py` with `response_model=ApiResponse[...]`.
5. Register the sub-router in `backend/api/router.py` (if new).

### Handle an SAP export change

Edit **only** `backend/core/material_ledger_config.py`:

- Column renamed → change its value in `COLUMN_MAP`.
- New column → add a key:value pair (flows through as extra fields).
- New category code → add a row to `CATEGORY_CONFIG`.
- New plant or material → nothing to change (they come from the CSVs automatically).

### Add a database table

Create the ORM model in `backend/db/models/`, import it in `alembic/env.py`, then `alembic revision --autogenerate -m "add X"` and `alembic upgrade head`.

---

## 17. Operational notes & troubleshooting

| Symptom                                    | Likely cause / fix                                                                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboards empty, `/status` shows an error | CSV missing a `REQUIRED_COLUMNS` field, or wrong `CSV_BASE_PATH`. Check the error string in `GET /api/v1/status`.                              |
| Backend refuses to start in prod           | Placeholder `SECRET_KEY` with `COOKIE_SECURE=true`. Set a real key (`openssl rand -hex 32`).                                                   |
| Logged out on every page load              | Cross-site cookies not configured — set `COOKIE_SAMESITE=none` + `COOKIE_SECURE=true`, and `ALLOWED_ORIGINS_STR` to the exact frontend origin. |
| Admin data reset after ~30 days            | Render free Postgres was wiped; baseline auto-rebuilds, manual edits are lost. Move to Neon/Supabase to avoid.                                 |
| Uploaded dataset disappears after restart  | It shouldn't — it's re-pinned from the DB on startup. Confirm `DATABASE_URL` is set and the `csv_datasets` row is `is_active=true`.            |
| First request after idle is slow           | Render free-tier cold start (~50s); the 14-min keep-alive ping and 60s axios timeout mitigate it.                                              |
| CORS errors in the browser                 | Add the frontend origin to `ALLOWED_ORIGINS_STR` (comma-separated, exact scheme+host+port).                                                    |

---

_Built for INSEE Cement — SAP material-ledger analytics. Data is derived entirely from the movement-row model described in [§8](#8-business-logic-explained); when in doubt about a number, trace it back through the service that computes it._
....
