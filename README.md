# Inspect AI (Florida)

A mobile app for professional home inspectors performing **Florida 4-Point** and
**Wind Mitigation (OIR-B1-1802)** inspections. Captures photos, runs AI analysis
on each photo, looks up property data by address, and generates a PDF report.

## Stack

- **Mobile** — Expo (React Native) + Expo Router + expo-camera
- **Backend** — Hono on Node, in-memory store for v1 (swap for Postgres/Drizzle)
- **AI** — Anthropic Claude Sonnet (vision) for photo analysis
- **Address data** — RentCast Property Records API
- **PDF** — `pdf-lib`, server-side rendering

```
inspect-ai/
├── apps/
│   ├── api/      # Hono backend (@inspect-ai/api)
│   └── mobile/   # Expo app   (@inspect-ai/mobile)
└── packages/
    └── shared/   # Types + 4-point and wind mit Zod schemas (@inspect-ai/shared)
```

## Run it

Requires Node 22 and pnpm 11.

```bash
cd /src/home-inspection-app   # repo dir, package name is inspect-ai
pnpm install

# Backend (port 8787)
cp apps/api/.env.example apps/api/.env
#   set RENTCAST_API_KEY and ANTHROPIC_API_KEY if you have them
pnpm api

# Mobile (separate terminal)
pnpm mobile
#   then press i (iOS sim), a (Android), or scan the QR with Expo Go
```

If your phone can't reach `localhost:8787`, edit
`apps/mobile/app.json` → `expo.extra.apiBaseUrl` to your machine's LAN IP
(e.g. `http://192.168.1.42:8787`).

## What works in v1

- Create inspections (4-point, wind mit, or both)
- Address auto-fills owner + year built via RentCast (mocked if no key)
- Tagged photo capture for each form section
- Per-photo AI analysis (Claude Sonnet vision) constrained to exact form paths
- **AI suggestions review screen** — accept/reject each finding before it
  populates the form; auto-checks high-confidence non-conflicting items
- Inspection detail screen shows current 4-point / wind-mit form values
- **Manual edit screens** for both forms — enum chips, switches, number
  inputs — for everything the AI can't infer
- **Mark complete** action validates the full form schema and surfaces
  missing/invalid fields inline before status flips to `complete`
- Server-rendered PDF report for either form (or combined)

## Known stubs / follow-ups

1. **Permits lookup is stubbed.** RentCast doesn't reliably include permits.
   Plan: per-county scrapers (Miami-Dade, Broward, Hillsborough, Orange first).
2. **PDF is not pixel-exact OIR-B1-1802.** It's a layout-faithful summary.
   For carrier acceptance, swap in the official fillable PDF and use
   `pdf-lib`'s AcroForm field setters.
3. **No auth.** Add Clerk/Auth.js + inspector accounts.
4. **In-memory storage.** Move to Postgres + Drizzle and S3/R2 for photos.
5. **Offline mode.** Not yet — add SQLite (expo-sqlite) + sync queue.

## Environment variables (apps/api/.env)

| Var                    | Purpose                                  |
| ---------------------- | ---------------------------------------- |
| `PORT`                 | API port (default 8787)                  |
| `RENTCAST_API_KEY`     | Property data lookup                     |
| `ANTHROPIC_API_KEY`    | Claude vision for photo analysis         |
| `ANTHROPIC_MODEL`      | Defaults to `claude-sonnet-4-5`          |
| `UPLOAD_DIR`           | Local photo storage path (default `./uploads`) |

## API surface

```
GET    /inspections
POST   /inspections                 { type, address, inspectorName?, inspectorLicense? }
GET    /inspections/:id
PATCH  /inspections/:id
DELETE /inspections/:id
POST   /inspections/:id/complete    -> Inspection | 400 { error, fourPoint, windMit }

POST   /address/lookup              { line1, city, state, zip } -> PropertyLookup

POST   /photos                      multipart: inspectionId, tag, file
GET    /photos/inspection/:id

POST   /ai/analyze                  { photoId } -> { summary, findings[] }

GET    /inspections/:id/suggestions -> { suggestions: Suggestion[] }
POST   /inspections/:id/apply       { applied: [{ form, path, value }] }

GET    /pdf/:inspectionId?type=four_point|wind_mitigation|both
```

### How AI → form works

1. Each photo tag has a fixed list of allowed form paths (e.g.
   `electrical.panelBrand`, `roofToWallAttachment`) baked into the
   per-tag prompt in `apps/api/src/routes/ai.ts`.
2. Claude returns `findings: [{field, value, confidence}]`. The server
   filters to known paths only — hallucinated fields are dropped.
3. `/inspections/:id/suggestions` aggregates across all photos, picks
   the highest-confidence value per (form, path), and flags conflicts
   with values already on the inspection.
4. The mobile Suggestions screen lets the inspector accept/reject each
   one. `/inspections/:id/apply` validates the merged payload against
   the Zod form schemas before saving.

## Next steps (suggested order)

1. `pnpm install` and confirm it runs end-to-end with mock data.
2. Add a RentCast key and verify a real lookup.
3. Add an Anthropic key and capture a photo of an electrical panel — confirm
   Claude returns sensible findings.
4. Wire AI findings into the form (so a panel photo auto-populates
   `electrical.panelBrand`/`panelAmps`).
5. Swap the in-memory store for Postgres (Drizzle migrations included as a
   follow-up).
6. Add the first county permit scraper (Miami-Dade is a good starting point).
