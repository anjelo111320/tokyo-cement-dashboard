# Tokyo Cement Analytics Dashboard

A production-grade analytics dashboard for Tokyo Cement's Sri Lanka operations. Management uses it to monitor material inventory, plant performance, fleet, and delivery operations across 30 plant locations. Data is sourced from SAP CSV exports that update every 15 minutes.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript 5, Vite, Tailwind CSS, ShadCN UI, React Query 5, Recharts |
| Backend | FastAPI, Pandas, Pydantic v2, APScheduler |
| Map | React Leaflet, CartoDB tile layers |
| Deployment | GitHub Pages (frontend) + Render / Railway (backend) |

---

## Project Structure

```
dashboard-project/
├── frontend/               — React SPA
│   └── src/
│       ├── features/       — Page-level feature modules
│       │   ├── home/       — Operations Overview dashboard
│       │   ├── map/        — Interactive plant network map
│       │   └── material_ledger/ — SAP ledger analysis
│       ├── components/     — Shared UI components
│       ├── hooks/          — Shared React hooks
│       ├── layouts/        — App shell (Sidebar, TopBar, BottomNav)
│       ├── services/       — Axios API client and service functions
│       ├── types/          — TypeScript types mirroring backend schemas
│       └── utils/          — Pure utility functions (formatters, dates)
├── backend/                — FastAPI Python API
│   ├── api/v1/             — HTTP route handlers (thin layer)
│   ├── core/               — Config, logging, scheduler, middleware
│   ├── models/             — Domain dataclasses
│   ├── repositories/csv/   — CSV data access layer
│   ├── schemas/            — Pydantic response schemas
│   └── services/           — Business logic
└── sample-data/            — Development CSV files
    ├── material_ledger.csv — SAP material ledger export
    └── plant_names.csv     — Plant master data with GPS coordinates
```

---

## Running Locally

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..   # run from project root so `backend` is importable
uvicorn backend.main:app --reload --port 8000
# API available at http://localhost:8000
# Swagger UI at http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build        # production build → dist/
npm run type-check   # TypeScript check
npm run lint         # ESLint
```

---

## Data Architecture

### CSV data flow

```
SAP system (every 15 min)
    ↓ exports
sample-data/ (or Google Drive / S3 in production)
    ↓ loaded at startup + every 15 min by APScheduler
CsvCache (in-memory DataFrames, thread-safe)
    ↓
Repositories → Services → API → React Query → UI
```

### CSV files

| File | Entity | Key Columns |
|---|---|---|
| `material_ledger.csv` | SAP movement records | Plant, Material, Obj Type (CA/BV/VM), Category (AB/ZU/KB/VN/EB), Quantity, Price |
| `plant_names.csv` | Plant master data | Plant, Name 1, City, Postal Code, latitude / longitude, Customer Number of Plant |

### SAP category codes

| Code | Name | Role |
|---|---|---|
| AB | Beginning Inventory | Opening stock balance |
| ZU | Receipts | Stock inflows (production + transfers) |
| KB | Cumulative Inventory | AB + ZU running total |
| VN | Consumption | Stock outflows (sales + internal use) |
| EB | Ending Inventory | Closing stock balance |

**Important:** All KPI totals use `Obj Type = CA` (accounting summary rows) only. Using all obj types causes triple-counting (CA + BV + VM each carry the same quantity).

---

## API Endpoints

Base path: `/api/v1`

| Endpoint | Description |
|---|---|
| `GET /health` | Liveness check (used by Render/Railway) |
| `GET /status` | CSV file load status and row counts |
| `GET /material-ledger/kpis` | Opening, receipts, consumption, closing totals |
| `GET /material-ledger/inventory-flow` | AB→ZU→KB→VN→EB waterfall data |
| `GET /material-ledger/consumption` | Consumption breakdown by procurement category |
| `GET /material-ledger/plant-comparison` | Per-plant KPI comparison (CA rows only) |
| `GET /material-ledger/stock-transfers` | Inter-plant transfer notes (from VM+VN rows) |
| `GET /material-ledger/movements` | Paginated raw movement table |
| `GET /material-ledger/materials` | Distinct materials for filter dropdown |
| `GET /material-ledger/plants` | All plants with GPS coordinates |
| `POST /settings/ingestion/trigger` | Force immediate CSV reload |

All responses: `{ success: bool, data: T, meta: { timestamp } }`

---

## Key Design Decisions

### Config-driven categories
`backend/core/material_ledger_config.py` is the single source of truth for SAP codes. Adding a new category code, object type label, or procurement category requires editing only this file — the service, API, and frontend charts pick it up automatically.

### GPS from CSV
Plant coordinates are read from the `latitude / longitude` column in `plant_names.csv` (format: `"7.3323° N, 80.5756° E"`). No coordinates are hardcoded in the backend — adding a new plant to the CSV automatically places its pin on the map.

### Utilization rate
```
Utilization = Consumption ÷ (Opening Stock + Receipts) × 100
```
Capped at 100%. Returns 0 when no stock was available (division by zero guard).
Color zones: ≥ 80% green, 50–79% amber, < 50% red.

---

## Plant Classification (Map)

| Type | Icon | Colour | Plant IDs |
|---|---|---|---|
| Cement Factory | Factory | Amber | 2140, 2141, 2143, 2144 |
| Port / Terminal | Anchor | Red | 2120–2125, 2127, 2128, 2142, 2145, 2146 |
| HQ / Admin | Building2 | Green | 2100, 2126, 2129, 2130, 2131 |
| Distribution Depot | Warehouse | Blue | 2110–2119 (all others) |

---

## Deployment

### Frontend → GitHub Pages

1. Set GitHub Actions variables in your repo:
   - `VITE_BASE_PATH` = `/your-repo-name/`
   - `VITE_API_BASE_URL` = your backend URL
2. Push to `main` — `.github/workflows/deploy-frontend.yml` builds and deploys automatically.

### Backend → Render (free tier)

1. New Web Service → connect GitHub repo → Root Directory: `backend`
2. Runtime: **Docker** (uses `backend/Dockerfile`)
3. Environment variables:
   ```
   ALLOWED_ORIGINS=["https://YOUR-ORG.github.io"]
   CSV_BASE_PATH=/data/csv
   LOG_LEVEL=INFO
   ```
4. Add a Volume mounted at `/data/csv` containing the CSV files.

The frontend pings `/health` every 14 minutes (via `RootLayout.tsx`) to prevent the Render free tier from sleeping during working hours.

---

## Development Notes

### Adding a new dashboard feature

1. Define types in `src/types/<domain>.types.ts`
2. Add API method in `src/services/<domain>.service.ts`
3. Add query key in `src/constants/queryKeys.ts`
4. Create hook in `src/features/<domain>/hooks/use<Feature>.ts`
5. Build component with loading / error / empty states
6. Wire into page component

### Adding a new API endpoint

1. Add Pydantic schema in `backend/schemas/<domain>.py`
2. Add repository method in `backend/repositories/csv/<domain>_csv_repo.py`
3. Add service method in `backend/services/<domain>_service.py`
4. Add route in `backend/api/v1/<domain>.py`
5. Register in `backend/api/router.py`

### Adding a new SAP category

Edit only `backend/core/material_ledger_config.py` — no other files need changing.
