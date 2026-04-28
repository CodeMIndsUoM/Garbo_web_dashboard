# Garbo Web Dashboard (`Garbo_web_dashboard`)

Admin dashboard UI for the Garbo Smart Waste Management System, built with **Next.js**.

## Prerequisites

- **Node.js** (recommended: latest LTS)
- **npm**

## Ports and connectivity

- **Frontend dev server**: Next.js defaults to **`3000`**
  - If `3000` is busy, Next will use another port (commonly `3001`).
- **Backend API**: `http://localhost:8080`

The frontend uses:

- `NEXT_PUBLIC_API_BASE` to target the backend directly (defaulted to `http://localhost:8080`)
- a **dev rewrite** in `next.config.mjs`:
  - `/api/*` → `http://localhost:8080/api/*` (development only)

## Environment variables

Create or update `.env` (already present in this repo):

```env
NEXT_PUBLIC_API_BASE=http://localhost:8080
```

After changing env vars, restart the dev server.

## Install dependencies

From `Garbo_web_dashboard/`:

```bash
npm install
```

## Run (development)

```bash
npm run dev
```

Open:

- `http://localhost:3000` (or the port printed by Next.js)

## Build and run (production-like)

```bash
npm run build
npm run start
```

## Common troubleshooting

### “CORS blocked” / preflight error on login

If the browser shows a CORS error when calling:

`POST http://localhost:8080/api/auth/login`

Make sure:

- Backend is running on `8080`
- Backend CORS allows your frontend origin (`http://localhost:3000` / `http://localhost:3001`)

### API calls hitting wrong port

Ensure `NEXT_PUBLIC_API_BASE` matches your backend port. If you run backend on `8081`, set:

```env
NEXT_PUBLIC_API_BASE=http://localhost:8081
```

Then restart `npm run dev`.

## Security / dependency notes

If `npm install` reports vulnerabilities:

```bash
npm audit
npm audit fix
```

Avoid `npm audit fix --force` unless you’re ready to test breaking changes.
