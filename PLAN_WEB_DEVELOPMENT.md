# Garbo Web Dashboard — Development Plan (Track W)

> **Web developer only.** This document is extracted from the master plan
> (`PLAN_WEB_APP_UPDATE.md`). Do **not** edit Flutter/app code — another developer owns
> `Garbo-flutter/`. When you need backend changes, coordinate with the backend/app developer
> and record the agreed API contract in §8 before building UI against it.

- **Repo:** `Garbo_web_dashboard/`
- **Status:** `[ ]` todo · `[~]` in progress · `[x]` done · `[⏸]` blocked (waiting on backend)
- **Last updated:** 2026-06-08 (W0 ✅ · W1 ✅ · W3 ✅ · W4 ✅ · W4A/W4B planned)

---

## 0. Quick start

1. Run the dashboard: `npm run dev` (default `http://localhost:3000`).
2. Backend must be running (`Garbo_backend`, port `8081`).
3. Test logins (from root `README.md`):
   - Superadmin: `garbosuper@garbo.com` / `garbosuper123`
   - Council admin (Colombo): `admincolombo@garbo.com` / `admin@colombo`
4. Work in **sprint order** (§3). Tick checkboxes as you complete tasks.
5. If a task says **⏸ Backend needed**, ask the other dev to deliver the endpoint first — do not
   guess the response shape.

---

## 1. Your scope (what you own vs what you don't)

### You own (edit freely)

| Area | Path |
|---|---|
| App shell & routing | `src/app/page.tsx`, `src/app/layout.tsx` |
| Sidebar / nav | `src/components/Sidebar.tsx` |
| All feature pages | `src/components/*.tsx` |
| Shared libs (create) | `src/lib/` |
| Styles / theme | `src/app/globals.css`, `tailwind.config.ts` |
| UI primitives | `src/components/ui/` |

### You do NOT touch

| Area | Owner |
|---|---|
| Flutter mobile app | App developer (`Garbo-flutter/`) |
| Spring Boot backend | Shared — request changes, don't implement unless agreed |
| Master plan edits for app track | App developer |

### Web features assigned to you

| ID | Feature | Depends on backend? |
|---|---|---|
| **W0** | Foundation (API client, patterns) | No |
| **W1** | Global council filter + remove Home | Optional `GET /api/councils` |
| **W2** | Remove Bin Collection page | No |
| **W3** | Card click-filtering (Bin + Vehicle) | No |
| **W4** | Map route visibility UX | No |
| **W4A** | Auto multi-route generation + bin-capacity vehicles | Yes — auto endpoint + `maxBins` on Vehicle |
| **W4B** | Route planner right panel (match History UX) | No |
| **W5** | Remove manual zone input | Yes — `zone` optional on `POST /api/bins` |
| **W6** | External Users page (merge Citizen + 3rd Party) | Yes — secured approval endpoints |
| **W7** | Internal Users polish + superadmin create | Yes — superadmin create with council |
| **W8** | Real-time bin updates on dashboard | Yes — STOMP topic `/topic/councils/{council}/bins` |
| **W9** | UI polish + dark theme | No |

---

## 2. Current codebase (web facts you need)

- **Single-page app.** No feature routes — `page.tsx` switches on `PageType` string.
- **Council filter** is global via `CouncilContext` (`src/lib/council-context.tsx`) + top-bar dropdown (W1 ✅).
- **No shared API client** — every component repeats `API_BASE` + `fetch` + auth headers.
- **Auth** in `sessionStorage`: `token`, `role`, `council`, `mustChangePassword`, `userId`.
- **WebSocket** only in `Map.tsx` (route sessions). Bin realtime is **not** wired on web.
- **Dark mode** tokens exist in `globals.css` but are never activated.

### Key files map

| Page / area | Component file |
|---|---|
| Shell + routing | `src/app/page.tsx` |
| Sidebar | `src/components/Sidebar.tsx` |
| Council context (W1) | `src/lib/council-context.tsx` |
| Dashboard | `src/components/Dashboard.tsx` |
| Bin Collection (remove) | `src/components/CollectionSchedule.tsx` |
| Bin Management | `src/components/BinManagement.tsx` |
| Vehicle Management | `src/components/VehicleManagement.tsx` |
| Map | `src/components/Map.tsx` (~2159 lines) |
| Citizen Management (merge → W6) | `src/components/CitizenManagement.tsx` |
| 3rd Party Collectors (merge → W6) | `src/components/ThirdPartyCollectors.tsx` |
| Internal Users | `src/components/InternalUsers.tsx` |
| Login | `src/components/Login.tsx` |

### Known web bugs to fix during your work

- [x] `BinManagement.tsx` summary cards count `critical/warning/normal` but bins use `full/half/empty` → **fixed in W3**.
- [ ] `Dashboard.tsx` `onNavigate` prop never passed from `page.tsx` → KPI drill-down broken.
- [ ] `VehicleManagement.tsx` has `DriversListModal` but no button opens it (fix or remove dead code).
- [x] Hardcoded `COUNCILS` — centralized in `council-context.tsx` (W1). Replace with API when `GET /api/councils` ready.

---

## 3. Recommended sprint order

Work top-to-bottom. Do not start W9 until W1–W8 are functionally complete.

| Sprint | Focus | Goal |
|---|---|---|
| **Sprint 1** | W0 + W1 + W3 | Foundation, council context, card filtering |
| **Sprint 2** | W4 + W8 | Map route UX + realtime bins (coordinate backend early) |
| **Sprint 3** | W6 + W7 | External Users page + Internal Users polish |
| **Sprint 4** | W5 + W2 | Remove zone input (after backend) + remove Bin Collection |
| **Sprint 5** | W4B + W4A | Route planner right panel + auto multi-route (backend `maxBins` + auto-preview) |
| **Sprint 6** | W9 | UI consistency + dark theme (last) |

---

## 4. Feature checklists

---

### W0 — Foundation (do first in Sprint 1)

**Why:** Reduces duplication before you touch many files.

**Create shared API layer**

- [x] Create `src/lib/api.ts`:
  - [x] `getApiBase()` from `process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8081'`
  - [x] `getAuthHeaders()` reading `sessionStorage.token`
  - [x] `apiFetch(path, options)` wrapper with JSON parse + basic error handling
- [x] Create `src/lib/auth.ts` helpers: `getRole()`, `getCouncil()`, `isSuperadmin()`
- [x] Migrate **one** component first (`InternalUsers.tsx`) to prove the pattern
- [x] Also migrated `BinManagement.tsx` + `VehicleManagement.tsx` (touched in W3)

**Optional but helpful**

- [x] Create `src/lib/types.ts` for shared types (`Council`, `Bin`, `Vehicle`, `UserRole`)
- [x] Document env var in `Garbo_web_dashboard/README.md`: `NEXT_PUBLIC_API_BASE`

**Acceptance:** New code uses `apiFetch`; no new copy-paste of `API_BASE` + auth headers.

---

### W1 — Global council filter + remove Home (Sprint 1)

**Goal:** One council dropdown for superadmin on every page. Remove Home page. Council-admins locked to their council.

**Files to edit**

- `src/lib/council-context.tsx` *(new)*
- `src/app/page.tsx`
- `src/components/Sidebar.tsx`
- `src/components/Map.tsx`
- `src/components/SuperadminCouncilSelect.tsx` *(delete or retire)*

**Checklist**

- [x] Create `src/lib/council-context.tsx`:
  - [x] `CouncilProvider` with state: `selectedCouncil`, `setSelectedCouncil`, `councils`, `isSuperadmin`, `lockedCouncil`
  - [x] `useCouncil()` hook
  - [x] Persist `selectedCouncil` to `sessionStorage` key e.g. `globalCouncilFilter`
  - [x] On load: restore from sessionStorage; council-admin always uses `sessionStorage.council`
- [x] Wrap authenticated layout in `CouncilProvider` inside `page.tsx`
- [x] Replace `tabCouncilFilters` + `getActiveCouncil()` with `useCouncil()` everywhere
- [x] Top bar: single `<select>` with "All Councils" + council list — **superadmin only**
- [x] Council-admin: hide dropdown; show read-only council name chip
- [x] Remove `home` from `PageType` in `page.tsx`
- [x] Remove Home item from `Sidebar.tsx` (currently superadmin-only nav item)
- [x] Remove `SuperadminCouncilSelect` from `renderPage()`; default landing stays `dashboard`
- [x] Delete or archive `SuperadminCouncilSelect.tsx` if unused
- [x] `Map.tsx`: remove private council `<select>`; sync from global context via prop
- [x] Pass `council` from context to all child pages (replace `getActiveCouncil()` prop)

**Backend coordination (optional)**

- [ ] ⏸ If backend adds `GET /api/councils`, fetch councils in provider instead of hardcoded list
- [x] Until then, keep hardcoded `COUNCILS` in context provider only (one place)

**Test checklist**

- [x] Login as superadmin → no Home in sidebar; lands on Dashboard
- [x] Select "Colombo" in dropdown → Bin Management, Map, Vehicles all show Colombo data
- [x] Select "All Councils" → pages show all-councils behaviour
- [x] Switch pages → council selection persists
- [x] Refresh browser → council selection restored
- [x] Login as council admin → no dropdown; fixed council shown; data scoped correctly
- [x] Map page uses same council as other pages (no separate selector)

**Acceptance:** Single global council control; Home gone; Map aligned with rest of app.

---

### W2 — Remove Bin Collection page (Sprint 4)

**Goal:** Delete mock Bin Collection page. Move collector-labour CRUD to Vehicle Management.

**Why removed:** Schedules and stat cards are hardcoded mock data. Only real feature = collector-labour API.

**Files to edit**

- `src/components/CollectionSchedule.tsx` *(delete after migration)*
- `src/components/VehicleManagement.tsx` *(add labour section)*
- `src/app/page.tsx`
- `src/components/Sidebar.tsx`

**Checklist — migrate collector-labour**

- [ ] Copy labour CRUD UI from `CollectionSchedule.tsx`:
  - `GET /api/collector-labours`
  - `POST /api/collector-labours`
  - `DELETE /api/collector-labours/{id}`
- [ ] Add section to `VehicleManagement.tsx` e.g. "Route Crew / Collector Labour"
  - [ ] Input + Add button for labour name
  - [ ] List with Delete per row
- [ ] Style to match Vehicle Management cards

**Checklist — remove page**

- [ ] Remove `schedule` from `PageType` in `page.tsx`
- [ ] Remove `CollectionSchedule` import and `renderPage()` case
- [ ] Remove "Bin Collection" from `Sidebar.tsx`
- [ ] Delete `CollectionSchedule.tsx`

**Do NOT migrate**

- Event suggestions approve/reject → already planned for W6 External Users (Citizens tab)
- Dead `/api/users` + `/api/vehicles` fetches from CollectionSchedule

**Test checklist**

- [ ] Sidebar has no "Bin Collection"
- [ ] Collector labour add/list/delete works in Vehicle Management
- [ ] No broken imports or `PageType` references to `schedule`

**Acceptance:** Bin Collection page gone; labour management lives in Vehicle Management.

---

### W3 — Card click-filtering: Bin + Vehicle Management (Sprint 1)

**Goal:** Clicking a summary card filters the grid below. Fix wrong bin status counts.

**Files to edit**

- `src/components/BinManagement.tsx`
- `src/components/VehicleManagement.tsx`

#### Bin Management checklist

- [x] Decide vocabulary: use `full | half | empty | not_checked` (matches API/bin cards)
- [x] Update summary cards to count correct statuses:
  - [x] Total → `bins.length`
  - [x] Full → `status === 'full'`
  - [x] Half → `status === 'half'`
  - [x] Empty → `status === 'empty'`
  - (Or map to severity labels if product prefers Critical/Warning/Normal — but counts must match data)
- [x] Add `activeFilter: string | null` state
- [x] Card `onClick`: set filter; clicking same card again clears filter
- [x] Active card: visible selected style (border, bg, ring)
- [x] Filter grid: `bins.filter(b => !activeFilter || b.status === activeFilter)`
- [x] Combine with existing search input (search AND status filter)
- [x] Total card clears filter

#### Vehicle Management checklist

- [x] Add `activeFilter` for `available | on_route | maintenance | null`
- [x] Same click-to-toggle + selected style pattern
- [x] Filter vehicle grid by `status`
- [x] Total card clears filter

**Test checklist**

- [x] Bin card counts match actual bin data (not all zeros)
- [x] Click "Full" → only full bins shown; click again → all shown
- [x] Search + card filter work together
- [x] Same behaviour on Vehicle Management

**Acceptance:** Interactive filtering on both pages; accurate counts.

---

### W4 — Map route visibility UX (Sprint 2)

**Goal:** Stop showing all routes at once (overlap). Default = latest route only. Toggle per route + show all.

**File:** `src/components/Map.tsx`

**Current problem:** `loadActiveSession()` draws all non-completed sessions on mount.

**Checklist**

- [x] On load: fetch active sessions but render **only the latest** (sort by `createdAt` desc)
- [x] Refactor route layers: `Map<sessionId, L.FeatureGroup>` per session
- [x] Assign distinct color per route (ROUTE_COLORS per session)
- [x] Route visibility integrated into **History** panel (no separate Routes tab):
  - [x] Per-session checkbox + color swatch on each history card
  - [x] "Show all" / "Hide all" in History panel header area
- [x] Toggling off removes only that session's layer (no full map redraw)
- [x] Route History panel: hover preview restores visibility model on mouse leave
- [x] Default state: only latest route visible; others in list but hidden

**Test checklist**

- [x] Open Map with multiple active routes → only one line drawn initially
- [x] Toggle route B on → B appears without breaking A
- [x] Show all → all routes visible with distinct colors
- [x] Hide all → no route lines (bins still visible)
- [x] Council filter from W1 still scopes routes correctly

**Acceptance:** Readable map by default; user controls which routes are visible.

**Legend (aligned with map):** `[x]` Updated — bin statuses, selection badges, multi-route colours, History visibility, depot & council boundary.

---

### W4A — Auto multi-route generation + vehicle bin capacity (planned — feasibility ✅)

**Goal:** Add **Auto Generate Routes** alongside the existing manual **Route** flow. Manual flow is **unchanged**. Auto flow creates **one or many routes** (not one giant route), then admin assigns **driver + vehicle** per route.

**Legend UI:** `[x]` Glass panel aligned with History (`bg-white/70 backdrop-blur-md`, right side).

#### Current manual flow (keep — do not remove)
1. Admin clicks **Route** → selects bins on map (green badge)
2. Chooses vehicle + driver in planner
3. Backend `POST /api/route-sessions` → OR-Tools + OSRM optimizes stop order

#### Proposed auto flow (add)
1. Admin clicks **Auto Route** (new toolbar button, beside **Route**)
2. System analyses council bins needing collection:
   - **Priority:** `full` first, then `half`; skip `empty` / `not_checked` (configurable threshold)
   - **Scope:** bins inside council boundary; split by zone cluster when W5/F5 zones exist
3. System **splits work into multiple routes** instead of one route for all bins:
   - Count available vehicles + each vehicle **max bin capacity**
   - Cluster bins geographically (K-means per zone or council — **no ML**)
   - Run multi-vehicle CVRP **or** one session per vehicle/cluster
   - Output: **N route drafts** (e.g. Route 1: 42 bins, Route 2: 38 bins, Route 3: 25 bins)
4. Admin reviews drafts in **Route Planner panel (W4B)** — assigns **driver + vehicle** per route
5. On confirm → same `optimizeAndBroadcast` + WebSocket READY flow as manual (one session per assignment)

#### Why multiple routes (not one route for all bins)
| Problem with single mega-route | Multi-route approach |
|---|---|
| One collector cannot visit 200+ bins in one shift | Split by vehicle count & bin capacity |
| OR-Tools may fail or produce unrealistic paths | Smaller CVRP instances solve reliably |
| No parallel collection | Multiple collectors work simultaneously |

#### Vehicle capacity — bin count (not tons)

**Today:** `Vehicle.capacity` is stored/displayed as **tons**; optimizer already treats capacity as **integer bin count** in `vehicleCapacities[]`.

**Change (agreed direction):**
- Add **`maxBins`** (integer) on Vehicle entity — max bins one trip can collect
- Keep `capacity` (tons) optional for analytics/reporting, or migrate UI to show only `maxBins`
- Vehicle Management form: **Max bins per trip** instead of tons
- Route planner dropdown rules:
  - Show only vehicles where `maxBins >= routeBinCount` **enabled**
  - Vehicles with insufficient capacity: **disabled + dimmed**; `title`/tooltip: *"Not enough capacity (needs X bins, max Y)"*
  - If **total fleet maxBins** < bins to collect → warn admin: *"Need more vehicles"*; allow partial auto-routes for feasible subset

**Example:** 105 bins need collection; vehicles A=50, B=100, C=30 → auto creates 2–3 routes; only B eligible for 50-bin route; A/C eligible for smaller routes.

#### Is ML required?

| Step | Method | ML? |
|---|---|---|
| Pick bins by fill status | SQL filter + sort by priority | ❌ No |
| Split bins into groups | K-means / zone clustering (W5) | ❌ No — classical clustering |
| Optimize stop order per route | OR-Tools CVRP + OSRM | ❌ No |
| Assign driver to route | **Admin manual** (system suggests available drivers) | ❌ No |
| Predict future fill levels | Optional future enhancement | ⚠️ ML only if you want forecasting — **not required for v1** |

**Verdict: Worth building without any ML model.**

#### Background processing
- **Zone clustering (W5/F5):** runs when bins are created/updated — improves geographic splits
- **Auto-route generation:** on-demand when admin clicks **Auto Route** (not silent background job in v1)
- Optional later: scheduled nightly draft routes for next-day review

#### API contract (draft — agree with backend before build)

`POST /api/route-sessions/auto-preview`
```json
{
  "council": "Moratuwa",
  "minFillStatus": ["full", "half"],
  "useZones": true
}
```
Response:
```json
{
  "totalBinsNeedingCollection": 105,
  "fleetSummary": { "availableVehicles": 4, "totalMaxBins": 180 },
  "draftRoutes": [
    { "draftId": "d1", "binIds": [1,2,3], "binCount": 42, "suggestedZone": 2 },
    { "draftId": "d2", "binIds": [4,5], "binCount": 38, "suggestedZone": 1 }
  ],
  "warnings": ["3 bins skipped — no vehicle capacity remaining"]
}
```

`POST /api/route-sessions` (existing) — called **once per confirmed draft** with `selectedBinIds`, `vehicleId`, `driverId`, `vehicleCapacities: [vehicle.maxBins]`.

**Status:** `[~]` in progress — auto-preview + web UI shipped; tune clustering in W5

**Web tasks**
- [x] **Auto Route** toolbar button
- [x] Preview draft routes (bin count per route)
- [x] Per-draft **vehicle** dropdown (capacity-filtered, disabled when too small)
- [x] Per-draft **driver** dropdown
- [x] Fleet capacity summary + warnings
- [x] Confirm all assignments → create sessions sequentially; show in History
- [ ] Map highlight per draft route (optional polish)

**Backend tasks**
- [x] `Vehicle.maxBins` column + entity
- [x] `AutoRouteService` — filter bins, split into drafts
- [x] `POST /api/route-sessions/auto-preview` endpoint
- [x] Confirmed routes use existing `optimizeAndBroadcast`

**Vehicle Management**
- [x] **Max bins per trip** in `VehicleManagement.tsx`
- [x] Display `maxBins` on vehicle cards

---

### W4B — Route planner right panel (planned)

**Goal:** Move route creation UI from **bottom drawer** to **right-side glass panel** — same layout language as **History** and **Legend**.

**Current (change):**
- Route Planner = collapsible bottom overlay (`selectionMode`)
- Active session status = bottom-left floating card

**Target:**
- **Route Planner panel** — `absolute right-4 top-20 bottom-4`, `bg-white/70 backdrop-blur-md border border-white/30 rounded-2xl`
- Opens when **Route** or **Auto Route** is active
- **Mutual exclusion:** only one right panel at a time (Route Planner | History | Legend)
- Sections inside panel:
  1. Header: mode (Manual / Auto), bin count, Cancel
  2. Selected bins chips (manual) or draft route cards (auto)
  3. Vehicle + driver per route (capacity rules from W4A)
  4. Generate / Confirm button
  5. Active session status in panel footer (replaces bottom-left card)

**Manual delete bins:** keep bottom drawer for now OR move to second tab in same panel (decide in implementation).

**Checklist**
- [x] Extract shared `MapSidePanel` (`src/components/map/MapSidePanel.tsx`)
- [x] Move route planner content from bottom drawer to right panel
- [x] Mutual exclusion: Route Planner | History | Legend (same slide animation)
- [x] Move active session status into route planner panel footer
- [ ] Responsive: full-width panel on mobile

**Status:** `[~]` in progress — manual + auto planner on right panel; delete bins still bottom drawer

---

### W5 — Remove manual zone input (Sprint 4)

**Goal:** Admin no longer fills zone when adding a bin. Backend assigns zone automatically.

**Backend:** `ZoneClusteringService` — K-means on coordinates per council (no ML).

**Checklist**

- [x] `POST /api/bins` — `zone` optional; server assigns via `ZoneClusteringService`
- [x] `Map.tsx`: remove zone input from Add Bin dialog; toast shows assigned zone
- [x] `BinManagement.tsx`: remove zone field from create form
- [x] Map context menu: zone read-only (system-assigned)
- [ ] (Optional) `GET /api/zones?council=` for map zone visualization

**Test checklist**

- [ ] Add bin on map without entering zone → succeeds; zone appears in response
- [ ] Add bin from Bin Management without zone → succeeds
- [ ] Route optimization still works with auto-assigned zones

**Acceptance:** No manual zone input; bins get server-assigned zones.

---

### W6 — External Users page (Sprint 3)

**Goal:** Merge Citizen Management + 3rd Party Collectors into one page with two sub-tabs.

**⏸ Backend needed:**

- Secured endpoints (JWT + admin role) for 3rd-party approval — prefer:
  - `GET /api/admin/thirdparty/registrations/pending`
  - `POST /api/admin/thirdparty/registrations/{empId}/approve`
  - `POST /api/admin/thirdparty/registrations/{empId}/reject`
- Until secured endpoints exist, you may temporarily use existing public endpoints for UI dev only
- `GET /api/complaints/{id}` must return image URL + all fields for detail view

**Files to create/edit**

- `src/components/ExternalUsers.tsx` *(new)*
- `src/app/page.tsx`
- `src/components/Sidebar.tsx`
- Reference (migrate logic from):
  - `src/components/CitizenManagement.tsx`
  - `src/components/ThirdPartyCollectors.tsx`

**Checklist — page structure**

- [ ] Create `ExternalUsers.tsx` with tab UI: **Citizens** | **Third-Party Collectors**
- [ ] Add `external-users` to `PageType`
- [ ] Replace two sidebar items with one "External Users"
- [ ] Remove `citizen-management` and `third-party-collectors` from sidebar + `renderPage()`
- [ ] Delete or archive old components after migration

#### Citizens sub-tab

- [ ] **Complaints list** — `GET /api/complaints`
  - [ ] Council-scoped via W1 context
  - [ ] Row: citizen, category, status, date
  - [ ] Click row → detail drawer/modal
- [ ] **Complaint detail**
  - [ ] Show description, image (`GET /api/complaints/{id}` or from list payload)
  - [ ] Response textarea for `resolutionNotes`
  - [ ] Approve / Reject (or status dropdown: APPROVED, REJECTED, RESOLVED)
  - [ ] Submit → `PATCH /api/complaints/{id}/status` with `{ status, resolutionNotes }`
- [ ] **Event suggestions** (migrate from CitizenManagement)
  - [ ] `GET /api/events/suggestions`
  - [ ] Approve → `PATCH /api/events/{id}/approve`
  - [ ] Reject → `PATCH /api/events/{id}/reject`
- [ ] **Create event form** (new)
  - [ ] Fields: title, description, date, location, council (from context)
  - [ ] Submit → `POST /api/events`

#### Third-Party Collectors sub-tab

- [ ] **Pending registrations queue**
  - [ ] `GET` pending endpoint (secured when available)
  - [ ] Row: name, email, NIC, submitted date, status PENDING
- [ ] **Application detail drawer**
  - [ ] Full name, email, phone, NIC number, DOB, address
  - [ ] Company, contract details if present
  - [ ] Requested councils
  - [ ] **NIC photo front** (image from `nicPhotoUrl`)
  - [ ] **NIC photo back** if available
- [ ] **Approve** → `POST .../approve`
- [ ] **Reject** → `POST .../reject` (optional reason field)
- [ ] **Active collectors list** (migrate from ThirdPartyCollectors)
  - [ ] `GET /api/users` filtered by THIRD_PARTY role
  - [ ] Remove raw analytics JSON dump or move to Analytics section

**Test checklist**

- [ ] Single "External Users" nav item
- [ ] Citizens tab: view complaint, add response, change status
- [ ] Citizens tab: create event successfully
- [ ] Citizens tab: approve/reject event suggestions
- [ ] Collectors tab: pending queue loads
- [ ] Collectors tab: NIC photo displays in detail
- [ ] Collectors tab: approve/reject updates status
- [ ] Superadmin council filter scopes complaints/events

**Acceptance:** One unified External Users page with full citizen + collector admin workflows.

---

### W7 — Internal Users polish + superadmin create (Sprint 3)

**Goal:** Verify create flow works. Let superadmin create users for a chosen council. Better success UX.

**⏸ Backend needed:**

- `POST /api/admins/staff/field-mentors` and `bin-collectors` must accept optional `council`
  param when caller is superadmin

**File:** `src/components/InternalUsers.tsx`

**Checklist**

- [ ] Verify existing create flow for council admin:
  - [ ] `POST /api/admins/staff/field-mentors` with `{ fullName, email, contactNumber? }`
  - [ ] `POST /api/admins/staff/bin-collectors` with same shape
  - [ ] Role select: FIELD_MENTOR | BIN_COLLECTOR
- [ ] Superadmin create form (DECIDED: yes):
  - [ ] Show create form for superadmin (currently hidden)
  - [ ] Add **council picker** dropdown (required for superadmin)
  - [ ] Send `council` in request body
- [ ] Success message: "User created. Temporary password sent to {email}."
- [ ] List view: superadmin sees staff for selected council (`GET /api/admins/staff?council=`)
- [ ] List view: council admin sees own council only
- [ ] Do NOT show password in UI (backend emails it)

**Test checklist**

- [ ] Council admin creates field mentor → appears in list → user can login on app (ask app dev to verify)
- [ ] Superadmin selects Kaduwela → creates bin collector → user assigned to Kaduwela
- [ ] Success toast/message mentions emailed password
- [ ] No password field in create form

**Acceptance:** Both admin types can create internal users; superadmin picks council; clear success UX.

---

### W8 — Real-time bin updates on dashboard (Sprint 2)

**Goal:** When field staff reports a bin or collector completes collection, Bin Management + Map update live.

**⏸ Backend needed:**

- STOMP topic: `/topic/councils/{council}/bins` (or `all` for superadmin)
- Message types: `BIN_STATUS_UPDATED`, `BIN_COLLECTED`
- Payload: `{ binId, status, fillLevel, council, ... }`

**Files to create/edit**

- `src/lib/realtime.ts` or `src/hooks/useBinRealtime.ts` *(new)*
- `src/app/page.tsx` (provider-level subscribe optional)
- `src/components/BinManagement.tsx`
- `src/components/Map.tsx`

**Checklist — shared realtime client**

- [ ] Create hook `useBinRealtime({ council, onBinUpdate })`
- [ ] Reuse `@stomp/stompjs` + `sockjs-client` (already in `package.json`)
- [ ] Connect to `${API_ORIGIN}/ws` (same pattern as `Map.tsx` route socket)
- [ ] Subscribe to `/topic/councils/{council}/bins` (or multiple subscriptions for "All Councils")
- [ ] Parse incoming messages; call `onBinUpdate(payload)`
- [ ] Disconnect on unmount / council change

**Checklist — Bin Management**

- [ ] On `BIN_STATUS_UPDATED` / `BIN_COLLECTED`: update bin in local state
- [ ] Recalculate summary card counts
- [ ] If bin not in list and matches council filter → optionally refetch or append
- [ ] (Optional) Sonner toast: "Bin {code} reported as {status}"

**Checklist — Map**

- [ ] On bin event: update marker icon/color for that binId
- [ ] Respect W1 council filter (ignore events for other councils unless "All Councils")

**Test checklist (coordinate with app dev)**

- [ ] Open Bin Management → field staff reports bin on app → card updates within ~2s
- [ ] Open Map → same report updates marker
- [ ] Collector completes bin → dashboard reflects completion
- [ ] Superadmin "All Councils" receives events from all councils
- [ ] Council admin only receives own council events

**Acceptance:** Live bin status on Bin Management and Map without manual refresh.

---

### W9 — UI polish + dark theme (Sprint 5 — do last)

**Goal:** Consistent cards/typography without changing light-theme colors. Add green-friendly dark theme.

**Files**

- `src/app/globals.css`
- `tailwind.config.ts`
- `src/app/layout.tsx`
- `src/components/ui/card.tsx` (and new shared components)
- All major pages (refactor as you go)

**Checklist — shared components**

- [ ] Create `src/components/layout/PageHeader.tsx` (title + subtitle + actions slot)
- [ ] Create `src/components/layout/StatCard.tsx` (clickable summary card for W3 pattern)
- [ ] Create `src/components/layout/SectionCard.tsx` (bordered content section)
- [ ] Define typographic scale in `globals.css` or Tailwind extend (page title, section title, body, caption)
- [ ] Refactor to use shared components:
  - [ ] `Dashboard.tsx`
  - [ ] `BinManagement.tsx`
  - [ ] `VehicleManagement.tsx`
  - [ ] `ExternalUsers.tsx`
  - [ ] `InternalUsers.tsx`

**Checklist — dark theme**

- [ ] Tokenize brand green as CSS variables (light values unchanged)
- [ ] Fill `.dark` token block in `globals.css`:
  - [ ] Background: slate/near-black (`#0f172a` or similar)
  - [ ] Card surface: slightly lighter (`#1e293b`)
  - [ ] Text: high-contrast off-white
  - [ ] Green accents: keep brand green, ensure WCAG contrast on dark bg
- [ ] Create `src/lib/theme.ts` + `useTheme()` hook
- [ ] Add theme toggle in sidebar footer or top bar
- [ ] Persist preference to `localStorage`
- [ ] Apply `class="dark"` on `<html>` in `layout.tsx` based on preference
- [ ] Fix dark mode for:
  - [ ] Charts (Recharts stroke/fill colors)
  - [ ] Leaflet map tiles or overlay contrast
  - [ ] Status badges (full/half/empty, vehicle status)
  - [ ] Sidebar active state
  - [ ] Sonner toasts

**Test checklist**

- [ ] Light theme looks the same as before (no accidental color changes)
- [ ] Dark theme readable on all main pages
- [ ] Toggle persists across reload
- [ ] Map legend and route colors visible in dark mode

**Acceptance:** Polished consistent UI; working dark theme with green brand; light theme preserved.

---

## 5. Backend coordination sheet (for you — request, don't implement)

When you need backend work, send this table row to the other developer. Wait for ✅ before building UI.

| Your feature | What you need | Status |
|---|---|---|
| W1 | `GET /api/councils` → `[{id,name,district,isActive}]` | `[ ]` requested `[ ]` ready |
| W5 | `POST /api/bins` — `zone` optional; response includes assigned zone | `[ ]` requested `[ ]` ready |
| W5 | (Optional) `GET /api/zones?council=` | `[ ]` requested `[ ]` ready |
| W6 | Secured `GET /api/admin/thirdparty/registrations/pending` | `[ ]` requested `[ ]` ready |
| W6 | Secured `POST .../approve` and `.../reject` | `[ ]` requested `[ ]` ready |
| W6 | `GET /api/complaints/{id}` returns image + full detail | `[ ]` requested `[ ]` ready |
| W7 | Superadmin create staff with `council` in body | `[ ]` requested `[ ]` ready |
| W8 | STOMP `/topic/councils/{council}/bins` with `BIN_STATUS_UPDATED` / `BIN_COLLECTED` | `[ ]` requested `[ ]` ready |

---

## 6. Manual test matrix (before calling a sprint done)

| Scenario | Role | Pages to check |
|---|---|---|
| Login + council filter | Superadmin | All pages |
| Locked council | Council admin | All pages |
| Bin card filter | Both | Bin Management |
| Vehicle card filter | Both | Vehicle Management |
| Map single route default | Both | Map |
| Map route toggles | Both | Map |
| Add bin without zone | Both | Map, Bin Management |
| Complaint response | Both | External Users → Citizens |
| Collector approval + NIC view | Both | External Users → Collectors |
| Create internal user | Admin + Superadmin | Internal Users |
| Realtime bin update | Both | Bin Management + Map (needs app dev) |
| Dark theme toggle | Both | All pages |

---

## 7. Web definition of done

- [x] **W0** Shared API client in use for new/edited code
- [x] **W1** Home removed; global council dropdown for superadmin
- [ ] **W2** Bin Collection page removed; labour in Vehicle Management
- [x] **W3** Click-to-filter on Bin + Vehicle cards; correct bin counts
- [x] **W4** Map shows latest route by default; per-route toggles work
- [ ] **W5** No manual zone input on bin create
- [ ] **W6** External Users page with Citizens + Collectors sub-tabs
- [ ] **W7** Internal user create works; superadmin council picker; success message
- [ ] **W8** Realtime bin updates on Bin Management + Map
- [ ] **W9** Consistent UI components; dark theme toggle works
- [ ] No regressions on Login, Analytics, Admin assignment flows
- [ ] `npm run build` passes with no TypeScript errors

---

## 8. API reference (read-only — for web integration)

Use these existing endpoints today. New/secured endpoints — confirm with backend dev first.

### Auth
| Method | Path | Used in |
|---|---|---|
| POST | `/api/auth/login` | `Login.tsx` |
| POST | `/api/auth/change-password` | `AdminEditPassword.tsx` |

### Bins
| Method | Path | Used in |
|---|---|---|
| GET | `/api/bins?council=` | `BinManagement.tsx`, `Map.tsx` |
| POST | `/api/bins` | `BinManagement.tsx`, `Map.tsx` |
| DELETE | `/api/bins/{id}` | `BinManagement.tsx`, `Map.tsx` |
| PUT | `/api/bins/{id}/zone` | `Map.tsx` |

### Vehicles & labour
| Method | Path | Used in |
|---|---|---|
| GET | `/api/vehicles?council=` | `VehicleManagement.tsx` |
| POST/PUT/DELETE | `/api/vehicles/...` | `VehicleManagement.tsx` |
| GET/POST/DELETE | `/api/collector-labours` | `CollectionSchedule.tsx` → move to W2 |

### Staff
| Method | Path | Used in |
|---|---|---|
| GET | `/api/admins/staff?council=` | `InternalUsers.tsx` |
| POST | `/api/admins/staff/field-mentors` | `InternalUsers.tsx` |
| POST | `/api/admins/staff/bin-collectors` | `InternalUsers.tsx` |
| DELETE | `/api/admins/staff/{id}` | `InternalUsers.tsx` |

### External users (existing)
| Method | Path | Used in |
|---|---|---|
| GET | `/api/complaints` | `CitizenManagement.tsx` |
| PATCH | `/api/complaints/{id}/status` | `CitizenManagement.tsx` |
| GET | `/api/events/suggestions` | `CitizenManagement.tsx` |
| PATCH | `/api/events/{id}/approve\|reject` | `CitizenManagement.tsx` |
| POST | `/api/events` | W6 (new) |
| GET | `/api/auth/thirdparty-register/pending` | W6 (until secured endpoint) |
| POST | `/api/auth/thirdparty-register/{empId}/approve\|reject` | W6 |

### Routes / map
| Method | Path | Used in |
|---|---|---|
| POST | `/api/route-sessions` | `Map.tsx` |
| GET | `/api/route-sessions/user/{userId}/active` | `Map.tsx` |
| GET | `/api/route-sessions/{sessionId}/routes` | `Map.tsx` |
| WS STOMP | `/ws` → `/topic/route-sessions/{id}` | `Map.tsx` |

### Proposed (coordinate before use)
| Method | Path | Feature |
|---|---|---|
| GET | `/api/councils` | W1 |
| GET | `/api/zones?council=` | W5 |
| GET | `/api/admin/thirdparty/registrations/pending` | W6 |
| WS STOMP | `/topic/councils/{council}/bins` | W8 |

---

## 9. Notes & log (add your own entries)

| Date | Feature | Note |
|---|---|---|
| | | |

---

*Master plan reference: `PLAN_WEB_APP_UPDATE.md` (workspace root or `Garbo_backend/`)*
