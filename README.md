# Nonmove KPI App — Haier Thailand Sell-out Department

Full-stack web application for tracking **Nonmove Stock KPI** at Global House stores.

## Tech Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **API**: Cloudflare Pages Functions (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **Photos**: Cloudflare R2
- **Deploy**: Cloudflare Pages via GitHub Actions

---

## Quick Start (Local Development)

### 1. Create Cloudflare Resources

```bash
# Create D1 database
npx wrangler d1 create nonmove-kpi-db
# Copy the "database_id" from the output into wrangler.toml

# Create R2 bucket
npx wrangler r2 bucket create nonmove-kpi-photos
```

### 2. Update wrangler.toml

Replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` with the actual database ID from step 1.

### 3. Set JWT Secret

Edit `.dev.vars` and replace the placeholder:
```
JWT_SECRET=your-long-random-secret-here
```

### 4. Apply DB Migrations (local)

```bash
npm run db:migrate:local
```

### 5. Import Initial Excel Data

```bash
node scripts/import-xlsx.mjs "path/to/Stock Daily GH for Nonmove KPI.xlsx"
```

### 6. Build & Run

```bash
npm install
npm run build     # Build frontend
npm run dev       # Start local wrangler dev server at http://localhost:8788
```

---

## Default Admin Login
- **Username**: `admin`
- **Password**: `admin1234`

> ⚠️ **Change this immediately** after first login via Admin → Settings.

---

## Deploy to Cloudflare Pages

```bash
# Apply migrations to remote D1
npm run db:migrate:remote

# Deploy (or push to GitHub — set up Cloudflare Pages to auto-deploy from main branch)
npx wrangler pages deploy dist
```

Set `JWT_SECRET` as an environment variable in the Cloudflare Pages dashboard (Settings → Environment variables).

---

## Export with Photo Thumbnails

The in-app CSV export includes photo links but not embedded thumbnails.
For the full Excel export with embedded photos:

```bash
node scripts/export-requests.mjs
# Output: requests-export-YYYY-MM-DD.xlsx
```

Requires `APP_URL` env var if using remote data:
```bash
APP_URL=https://your-app.pages.dev node scripts/export-requests.mjs --remote
```

---

## Project Structure

```
nonmove-kpi-app/
├── src/                    # React frontend
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   ├── store/          # PC mobile flow
│   │   └── admin/          # Admin desktop flow
│   ├── components/
│   └── lib/
│       ├── api.ts          # Typed fetch wrappers
│       └── kpi.ts          # KPI helpers + constants
├── functions/api/          # Cloudflare Pages Functions
│   ├── _middleware.ts      # CORS + JWT utilities
│   ├── _kpi_calc.ts        # Core KPI algorithm
│   └── admin/              # Admin endpoints
├── migrations/             # D1 SQL migrations
│   ├── 0001_init.sql
│   └── 0002_seed.sql
├── scripts/                # Local Node.js utilities
│   ├── import-xlsx.mjs     # Bulk Excel → D1
│   └── export-requests.mjs # Excel export with thumbnails
└── wrangler.toml
```
