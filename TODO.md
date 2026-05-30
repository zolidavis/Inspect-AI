# Inspect AI — TODO

Snapshot taken 2026-05-29.

## 🔥 Active

_(nothing — last active item, Google OAuth, was verified end-to-end on device 2026-05-29.)_

## ✅ Recently shipped

- [x] **4-Point Citizens overlay (V1)** — commit `bc9f0d0`. `/pdf/:id?type=four_point` now overlays values on the official Citizens Insp4pt 03 25 template (de facto FL carrier standard). V1 fills the page-1 header (insured name, address, year built, date inspected) and page-3 inspector signature line (name + license). Body sections (electrical/HVAC/plumbing/roof) marked TODO(v2) — those need ~50 individually-measured x/y positions, the pdftotext bbox HTML at /tmp/oir/4pt-bbox.html has all label coordinates ready to parse.
- [x] **AcroForm OIR-B1-1802 fill** — carrier-acceptable Wind Mitigation PDF generation. 198 AcroForm fields mapped. Prod verified.
- [x] **`ANTHROPIC_API_KEY` live in prod** — verified end-to-end on deployment `inspect-ai-bfbmn5p5k`. Real Claude vision response on a test photo. Pipeline Mobile→Edge→R2→Claude→response works.
- [x] **Google OAuth on device** — APK `h5VmdNoMH37Atc4458pZxY` (build `82421226-…`, commit `084b62b`). Sign-in works first-shot on Android. Profile screen accessible from header avatar.

## ⏭ Short-term

### 4-Point V2 — body sections

- [ ] **Overlay electrical body section** on Citizens template. Total Amps, Main Panel age/year-updated/brand, Wiring Type checkbox, General condition (Satisfactory/Unsatisfactory) checkbox. Page 1 lower half.
- [ ] **Overlay HVAC section.** Central AC Yes/No, working-order Yes/No, Age of system, Year last updated. Page 2 upper.
- [ ] **Overlay Plumbing section.** TPRV Yes/No, leak indicators, water heater age, supply pipe age + material checkboxes. Page 2 lower.
- [ ] **Overlay Roof section.** Covering material, age, remaining life, overall condition checkbox, visible damage checkboxes. Page 3 upper. Most schema-rich section.
- [ ] **Iterate position measurements** — bbox HTML at /tmp/oir/4pt-bbox.html has every label's exact PDF point. Write a Python helper that auto-emits the TS position table from the bbox + a schema-to-label mapping.


### Vercel env vars

- [x] **`ANTHROPIC_API_KEY`** — set in production + development 2026-05-29 evening. Verified live: `/ai/analyze` returned a real Claude response on a test photo. Headline AI feature is now ACTIVE in prod.
- [ ] **`RENTCAST_API_KEY`** — optional. Currently empty; `/address/lookup` returns mocked owner + year built. App still works without real property data.
- [ ] **`R2_*` + `DATABASE_URL` + `ANTHROPIC_API_KEY` in preview env** — production + development are set, preview is empty. PR previews would fail until populated. Quick `vercel env add NAME preview` × 6.

### Stage 2 step 7 — DONE

- [x] **AcroForm fillable PDFs.** Commit `9b7d910` deployed at `ce0b03b`. `/pdf/:id?type=wind_mitigation` now fills the official Florida OIR-B1-1802 (Rev. 01/12) template — 198 AcroForm fields mapped via `apps/api/src/pdf/wind-mit.ts`. 4-point stays as a generated summary (no official form). `type=both` merges via `copyPages`. Prod verified: 308 KB PDF with all values filled correctly. Sample at /src/samples/inspect-ai-oir-1802-sample.pdf.

### Pinned

- [ ] **Rotate `EXPO_TOKEN`** — pasted in chat earlier (prefix `MTpwJDaM…`). Revoke at https://expo.dev/accounts/zolidavis/settings/access-tokens, generate new, update GH secret on `zolidavis/Inspect-AI`.

## 📋 Backlog (real features, deferred)

- [ ] **Server-side auth.** `Inspection` rows are not yet tied to a user. Google OAuth provides `providerUserId`; server needs to validate the Google id_token, upsert a `users` row, then enforce `WHERE inspector_id = ?` on inspections. Mobile API client needs to attach a bearer token. (~3h)
- [ ] **Offline mode.** No `expo-sqlite` mirror + sync queue yet. Florida inspectors do field work in spotty cell coverage. (~4–6h)
- [ ] **County permit scrapers.** Miami-Dade, Broward, Hillsborough, Orange first. RentCast doesn't return permits reliably. (~1–2h per county)
- [ ] **Mobile API retry/queue.** `apps/mobile/lib/api.ts` is fire-and-forget. Photo uploads especially should retry on transient network failures.
- [ ] **iOS build.** Gated on Apple Developer Program ($99/yr). Touchpoints in CLAUDE.md.
- [ ] **Narrative PDF reports** beyond OIR-B1-1802 — photo grids, inspector signature, conditions summary.

## 🧹 Housekeeping / quality

- [ ] **Tests.** Zero coverage anywhere. A `vitest` smoke suite on the API routes would catch regressions.
- [ ] **Mobile error states.** Most failures bubble up as `Alert.alert("Failed", e.message)` — should be friendlier.
- [ ] **Empty states polish.** Inspection list with zero items is minimal.
- [ ] **Inspect AI app icon + splash.** Currently Expo default. Draft Buddy invested ~1h on PIL + cv2.grabCut to do the floating-mascot pattern.
- [ ] **Play Store listing assets.** Feature graphic, screenshots, description. Required before publishing.

---

## Most-bang-for-buck order for next session

1. Verify OAuth on device (5 min)
2. Add `ANTHROPIC_API_KEY` to Vercel (1 min once key is on hand)
3. End-to-end test: real photo upload from APK → R2 → `/ai/analyze` via Claude → review on suggestions screen
4. Rotate exposed `EXPO_TOKEN`
5. AcroForm PDF template (long-pole, biggest jump in real value)
