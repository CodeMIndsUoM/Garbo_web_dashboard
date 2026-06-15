# Garbo Web Dashboard (`Garbo_web_dashboard`)

Admin dashboard UI for the Garbo Smart Waste Management System, built with **Next.js**.

> CD: push to `devops/platform` deploys to AWS EC2 via GitHub Actions.

## Production

- **Live URL**: http://13.233.77.40/
- **API base** (baked at build time): `http://13.233.77.40` — do not add `/api` suffix
- **Deploy branch**: `devops/platform` (CI tests, CD deploys frontend only)

## Prerequisites

- **Node.js** (recommended: latest LTS)
- **npm**

## Ports and connectivity

- **Frontend dev server**: Next.js defaults to **`3000`**
  - If `3000` is busy, Next will use another port (commonly `3001`).
- **Backend API**: `http://localhost:8081` (or `8080` depending on your local setup)

The frontend uses:

- `NEXT_PUBLIC_API_BASE` to target the backend directly (default: `http://localhost:8081`)
- Shared API client: `src/lib/api.ts` (`apiFetch`, `getApiBase`, `getAuthHeaders`)
- a **dev rewrite** in `next.config.mjs`:
  - `/api/*` → `http://localhost:8080/api/*` (development only)

## Role and council behavior

Dashboard is role-aware:

- **superadmin**
  - global council dropdown in the top bar (applies to all pages)
  - can choose council from dropdowns in relevant create/edit flows
- **admin**
  - does not get council switching
  - only sees/manages own council data context
  - council is auto-enforced in admin create flows (for example bins/vehicles)

Supported council list in current UI:

- `Colombo`
- `Galle`
- `Kandy`
- `Gampaha`
- `Matara`

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

### `401 Unauthorized` on dashboard actions

Many create/update/delete endpoints require JWT auth headers. If you see 401:

- log in again and confirm `token` exists in browser local storage
- ensure requests include `Authorization: Bearer <token>`
- verify backend security permits the endpoint for your role

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
