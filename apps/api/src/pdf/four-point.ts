/**
 * Fill the Citizens Property Insurance 4-Point Inspection Form
 * (Insp4pt 03 25) by OVERLAYING text on the flat PDF template.
 *
 * Citizens' form is not an AcroForm (zero fillable fields) but is the
 * de-facto carrier-accepted 4-Point in Florida. We bundle the official
 * template and use pdf-lib's drawText() to put values at hard-coded
 * positions next to the printed labels.
 *
 * Form layout (PDF top-down coords; baselines = yMax - 2 of label bbox):
 *   Page 1: Insured/Address header + Electrical System
 *   Page 2: HVAC System + Plumbing System
 *   Page 3: Roof (Predominant + Secondary columns) + Inspector signature
 *   Page 4: Disclosures (we leave blank)
 *
 * Positions extracted from pdftotext bbox dump at /tmp/oir/4pt-bbox.html.
 *
 * Coordinate system: PDF points, bottom-left origin. US Letter = 612×792.
 */
import {
  PDFDocument,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { Inspection } from "@inspect-ai/shared";
import { CITIZENS_4PT_BASE64 } from "./citizens-4pt.base64.js";

const PAGE_H = 792;

/** Map pdftotext bbox (top-down) y → pdf-lib baseline y. */
const yFromTop = (yMaxTopDown: number) => PAGE_H - yMaxTopDown;

// Cache the decoded template bytes per warm-isolate.
let cachedBytes: Uint8Array | null = null;
function templateBytes(): Uint8Array {
  if (cachedBytes) return cachedBytes;
  const bin = atob(CITIZENS_4PT_BASE64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  cachedBytes = out;
  return out;
}

interface FieldDraw {
  page: 0 | 1 | 2;
  x: number;
  y: number;
  size?: number;
  value: unknown;
  bold?: boolean;
}

/**
 * Helper: drop an "X" centered inside a checkbox at top-down (xBox, yBox).
 * Same +12 baseline offset as the wind-mit form (see PDF tuning notes in
 * CLAUDE.md — bbox boxes ~14pt tall, baseline at yBox+12 visually centers
 * the size-10 bold "X" character).
 */
function checkBox(
  out: FieldDraw[],
  page: 0 | 1 | 2,
  xBox: number,
  yBox: number,
) {
  out.push({
    page,
    x: xBox + 1,
    y: yFromTop(yBox + 12),
    size: 10,
    value: "X",
    bold: true,
  });
}

/** Pretty label for the inspector's "I hold a license as a:" category. */
function licenseTypeLabel(v: string | undefined): string {
  switch (v) {
    case "home_inspector": return "Home Inspector";
    case "building_code_inspector": return "Building Code Inspector";
    case "contractor": return "Contractor";
    case "engineer": return "Professional Engineer";
    case "architect": return "Professional Architect";
    case "other_authorized": return "Other Authorized";
    default: return "";
  }
}

function fieldsFor(inspection: Inspection): FieldDraw[] {
  const property: any = inspection.property ?? {};
  const fp: any = inspection.fourPoint ?? {};
  const electrical: any = fp.electrical ?? {};
  const hvac: any = fp.hvac ?? {};
  const plumbing: any = fp.plumbing ?? {};
  const roof: any = fp.roof ?? {};
  const predominant: any = roof.predominant ?? {};
  const secondary: any = roof.secondary ?? {};
  const addr = inspection.address;
  const out: FieldDraw[] = [];

  const push = (f: FieldDraw) => {
    if (f.value === undefined || f.value === null || f.value === "") return;
    out.push({ size: 10, ...f });
  };

  // ── PAGE 1 — Header ───────────────────────────────────────────────────
  // (verified pixel-correct in V1)
  push({ page: 0, x: 134, y: yFromTop(73), value: property.ownerName });
  const fullAddr = `${addr.line1}, ${addr.city}, ${addr.state} ${addr.zip}`;
  push({ page: 0, x: 116, y: yFromTop(91), value: fullAddr });
  push({ page: 0, x: 108, y: yFromTop(112), value: property.yearBuilt });
  push({
    page: 0,
    x: 379,
    y: yFromTop(112),
    value: inspection.inspectedOn?.slice(0, 10),
  });

  // ── PAGE 1 — Minimum Photo Requirements ───────────────────────────────
  // 6 inspector-confirmation checkboxes. Positions from pdftotext bbox:
  //   y=142: "Dwelling:" word x=64 → ☐ x≈53 | "Roof:" x=154 → ☐ x≈143 |
  //          "Plumbing:" x=235 → ☐ x≈224
  //   y=154: "Main" x=64 → ☐ x≈53 (Main electrical service panel)
  //   y=166: "Electrical" x=64 → ☐ x≈53 (Electrical box with panel off)
  //   y=178: "All" x=64 → ☐ x≈53 (All hazards or deficiencies)
  const pr: any = inspection.photoRequirements ?? {};
  if (pr.dwellingEachSide)          checkBox(out, 0,  53, 142);
  if (pr.roofEachSlope)             checkBox(out, 0, 143, 142);
  if (pr.plumbingWaterHeater)       checkBox(out, 0, 224, 142);
  if (pr.electricalServicePanel)    checkBox(out, 0,  53, 154);
  if (pr.electricalBoxWithPanelOff) checkBox(out, 0,  53, 166);
  if (pr.hazardsOrDeficiencies)     checkBox(out, 0,  53, 178);

  // ── PAGE 1 — Electrical System ────────────────────────────────────────
  // Every ckbx ☐ glyph is ~10pt wide and sits to the LEFT of its label
  // word: ckbx_x ≈ (label_word_xMin - 11). The checkBox helper adds +12
  // to the top-down y for X baseline centering inside ~14pt-tall boxes.
  const mainPanel: any = electrical.mainPanel ?? {};
  const secondPanel: any = electrical.secondPanel ?? {};
  const presence: any = electrical.presence ?? {};
  const hazards: any = electrical.hazards ?? {};
  const wiringTypes: any = electrical.wiringTypes ?? {};

  // ── Main Panel (left column, x≈42-260) ───────────────────────────────
  // y=319: Type: Circuit breaker / Fuse — ckbx at x=65 (Circuit) / x=133 (Fuse)
  if (mainPanel.type === "circuit_breaker") checkBox(out, 0, 65, 319);
  if (mainPanel.type === "fuse")            checkBox(out, 0, 133, 319);
  // y=334: Total Amps: ___ — value at x≈88 (after "Total Amps:" xMax≈85)
  push({ page: 0, x: 88, y: yFromTop(341), value: mainPanel.totalAmps });
  // y=347: amperage sufficient? Yes ckbx x=190 | No ckbx x=218
  if (mainPanel.amperageSufficient === true)  checkBox(out, 0, 190, 347);
  if (mainPanel.amperageSufficient === false) checkBox(out, 0, 218, 347);

  // ── Second Panel (right column, x≈312-580) ───────────────────────────
  // y=319: Circuit breaker x=335, Fuse x=401
  if (secondPanel.type === "circuit_breaker") checkBox(out, 0, 335, 319);
  if (secondPanel.type === "fuse")            checkBox(out, 0, 401, 319);
  // y=334: Total Amps x≈358 (after "Total Amps:" xMax≈355)
  push({ page: 0, x: 358, y: yFromTop(341), value: secondPanel.totalAmps });
  // y=347: Yes x=460, No x=488
  if (secondPanel.amperageSufficient === true)  checkBox(out, 0, 460, 347);
  if (secondPanel.amperageSufficient === false) checkBox(out, 0, 488, 347);

  // ── Indicate presence of any of the following (y=379 header) ─────────
  // Left-col ckbx at x=51 for each row.
  if (presence.clothWiring)                     checkBox(out, 0, 51, 395);
  if (presence.activeKnobAndTube)               checkBox(out, 0, 51, 410);
  if (presence.branchCircuitAluminumWiring)     checkBox(out, 0, 51, 425);
  if (presence.connectionsRepairedCopalumCrimp) checkBox(out, 0, 51, 455);
  if (presence.connectionsRepairedAlumiConn)    checkBox(out, 0, 51, 470);
  // Aluminum wiring description — inline at end of y=425 label
  push({ page: 0, x: 380, y: yFromTop(432), value: presence.aluminumWiringDescription, size: 8 });

  // ── Hazards Present (y=492 header) ───────────────────────────────────
  // Left column (ckbx at x=51) — Blowing fuses y=507, Tripping breakers y=523, etc.
  // Right column (ckbx at x=321) — Double taps y=492, Exposed wiring y=507, etc.
  if (hazards.blowingFuses)        checkBox(out, 0, 51, 507);
  if (hazards.trippingBreakers)    checkBox(out, 0, 51, 523);
  if (hazards.emptySockets)        checkBox(out, 0, 51, 538);
  if (hazards.looseWiring)         checkBox(out, 0, 51, 553);
  if (hazards.improperGrounding)   checkBox(out, 0, 51, 568);
  if (hazards.corrosion)           checkBox(out, 0, 51, 583);
  if (hazards.overFusing)          checkBox(out, 0, 51, 598);
  if (hazards.doubleTaps)          checkBox(out, 0, 321, 492);
  if (hazards.exposedWiring)       checkBox(out, 0, 321, 507);
  if (hazards.unsafeWiring)        checkBox(out, 0, 321, 523);
  if (hazards.improperBreakerSize) checkBox(out, 0, 321, 538);
  if (hazards.scorching)           checkBox(out, 0, 321, 553);
  if (hazards.other)               checkBox(out, 0, 321, 568);
  // "Other (explain)" — inline note next to the label
  push({ page: 0, x: 410, y: yFromTop(575), value: hazards.otherExplain, size: 8 });

  // ── General condition (y=620) ────────────────────────────────────────
  // "Satisfactory" x=222 → ☐ x≈211. "Unsatisfactory" x=284 → ☐ x≈273.
  if (electrical.generalCondition === "satisfactory") {
    checkBox(out, 0, 211, 620);
  } else if (electrical.generalCondition === "unsatisfactory") {
    checkBox(out, 0, 273, 620);
  }
  // Inline explanation
  push({ page: 0, x: 405, y: yFromTop(627), value: electrical.generalConditionExplain, size: 8 });

  // ── Supplemental Information (y=657 header) ──────────────────────────
  // y=691: Main "Panel age:" xMax≈86 → value x≈92; Second xMax≈219 → value x≈225
  push({ page: 0, x:  92, y: yFromTop(698), value: mainPanel.panelAge });
  push({ page: 0, x: 225, y: yFromTop(698), value: secondPanel.panelAge });
  // y=704: "Year last updated:" — Main xMax≈122, Second xMax≈252 → values at x≈128/258
  push({ page: 0, x: 128, y: yFromTop(711), value: mainPanel.yearLastUpdated });
  push({ page: 0, x: 258, y: yFromTop(711), value: secondPanel.yearLastUpdated });
  // y=721 (Main) / y=718 (Second): "Brand/Model:" — Main xMax≈90 → value x≈96; Second xMax≈222 → value x≈228
  push({ page: 0, x:  96, y: yFromTop(728), value: mainPanel.brandModel,   size: 9 });
  push({ page: 0, x: 228, y: yFromTop(725), value: secondPanel.brandModel, size: 9 });

  // ── Wiring Type(s) Supplemental — page 1 bottom right ────────────────
  //   y=691: Copper x=309 | Copper Clad AL x=400 | NM, BX or Conduit x=496
  //   y=704: Single Strand AL x=309 | Cloth (Knob & Tube) x=401 | Other x=495
  //   y=718: Multistrand AL x=309 | Cloth Jacket Rubber Insulated x=401
  if (wiringTypes.copper)                     checkBox(out, 0, 309, 691);
  if (wiringTypes.copperCladAl)               checkBox(out, 0, 400, 691);
  if (wiringTypes.nmBxOrConduit)              checkBox(out, 0, 496, 691);
  if (wiringTypes.singleStrandAl)             checkBox(out, 0, 309, 704);
  if (wiringTypes.clothKnobAndTube)           checkBox(out, 0, 401, 704);
  if (wiringTypes.other)                      checkBox(out, 0, 495, 704);
  if (wiringTypes.multistrandAl)              checkBox(out, 0, 309, 718);
  if (wiringTypes.clothJacketRubberInsulated) checkBox(out, 0, 401, 718);

  // ── PAGE 2 — HVAC System (V3, 1-for-1 with Citizens form) ─────────────
  // Yes/No ckbx pattern: ckbx_x = label_word.xMin - 11.
  const hvacHazards: any = hvac.hazards ?? {};
  const yn = (
    page: 0 | 1 | 2,
    v: boolean | undefined,
    yesX: number,
    noX: number,
    y: number,
  ) => {
    if (v === true) checkBox(out, page, yesX, y);
    else if (v === false) checkBox(out, page, noX, y);
  };

  // Central AC — y=108. Yes word x=108→☐97 | No word x=144→☐133.
  yn(1, hvac.centralAc, 97, 133, 108);
  // Central heat — y=123. Same columns.
  yn(1, hvac.centralHeat, 97, 133, 123);
  // "If not central heat, indicate primary heat source and fuel type:" y=138,
  // label ends x=262 → value at x=266 (baseline yMax-2 = 145).
  push({ page: 1, x: 266, y: yFromTop(145), value: hvac.primaryHeatSource, size: 8 });
  // "Are the HVAC systems in good working order?" y=154. Yes x=342→☐331 | No x=374→☐363.
  yn(1, hvac.inGoodWorkingOrder, 331, 363, 154);
  // "(explain)" sits at x=386-417 → put the note after it.
  push({ page: 1, x: 420, y: yFromTop(161), value: hvac.inGoodWorkingOrderExplain, size: 7 });
  // "Date of last HVAC servicing/inspection:" y=169, label ends x=181 → value x=186.
  push({ page: 1, x: 186, y: yFromTop(176), value: hvac.lastServiceDate, size: 9 });

  // ── Hazards Present ──────────────────────────────────────────────────
  // Wood-burning stove/gas fireplace present? y=208. Yes x=257→☐246 | No x=291→☐280.
  yn(1, hvacHazards.woodStoveOrGasFireplacePresent, 246, 280, 208);
  // Professionally installed? y=208. Yes x=437→☐426 | No x=472→☐461.
  yn(1, hvacHazards.woodStoveProfessionallyInstalled, 426, 461, 208);
  // Space heater used as primary heat source? y=223. Yes x=216→☐205 | No x=247→☐236.
  yn(1, hvacHazards.spaceHeaterPrimarySource, 205, 236, 223);
  // Is the source portable? y=238. Yes x=142→☐131 | No x=174→☐163.
  yn(1, hvacHazards.spaceHeaterPortable, 131, 163, 238);
  // Air handler/condensate/drain pan blockage or leakage? y=262 (2nd line). Yes x=53→☐42 | No x=90→☐79.
  yn(1, hvacHazards.airHandlerBlockageOrLeakage, 42, 79, 262);

  // Supplemental Information — Age of system y=303 → value x=100 (yMax-2=310);
  // Year last updated y=318 → value x=112 (yMax-2=325).
  push({ page: 1, x: 100, y: yFromTop(310), value: hvac.ageYears });
  push({ page: 1, x: 112, y: yFromTop(325), value: hvac.yearLastUpdated });

  // ── PAGE 2 — Plumbing System (V3, 1-for-1 with Citizens form) ─────────
  // TPRV on water heater? y=391. Yes x=288→☐277 | No x=320→☐309.
  yn(1, plumbing.tprvPresent, 277, 309, 391);
  // Active leak? y=403. Yes x=202→☐191 | No x=234→☐223.
  yn(1, plumbing.activeLeak, 191, 223, 403);
  // Prior leak? y=415. Yes x=193→☐182 | No x=225→☐214.
  yn(1, plumbing.priorLeak, 182, 214, 415);
  // Water heater location: y=427, label ends x=120 → value x=125 (yMax-2=434).
  push({ page: 1, x: 125, y: yFromTop(434), value: plumbing.waterHeaterLocation, size: 9 });

  // ── Fixtures condition grid (Sat / Unsat / N/A) ──────────────────────
  // Two side-by-side blocks. Column centers from the header bbox; X is drawn
  // directly (these are grid rectangles, not ☐ glyphs) at the row baseline.
  const FIX_COL: Record<string, { left: number; right: number }> = {
    satisfactory:   { left: 133, right: 402 },
    unsatisfactory: { left: 191, right: 460 },
    na:             { left: 243, right: 513 },
  };
  const fixtures: any = plumbing.fixtures ?? {};
  const fixtureCell = (cond: unknown, side: "left" | "right", yTop: number) => {
    const col = FIX_COL[cond as string];
    if (!col) return;
    out.push({ page: 1, x: col[side], y: yFromTop(yTop + 7), size: 10, value: "X", bold: true });
  };
  fixtureCell(fixtures.dishwasher,       "left",  473);
  fixtureCell(fixtures.refrigerator,     "left",  485);
  fixtureCell(fixtures.washingMachine,   "left",  497);
  fixtureCell(fixtures.waterHeater,      "left",  510);
  fixtureCell(fixtures.showersTubs,      "left",  522);
  fixtureCell(fixtures.toilets,          "right", 473);
  fixtureCell(fixtures.sinks,            "right", 485);
  fixtureCell(fixtures.sumpPump,         "right", 497);
  fixtureCell(fixtures.mainShutOffValve, "right", 510);
  fixtureCell(fixtures.allOtherVisible,  "right", 522);
  // "If unsatisfactory..." comments box — first line at y≈555.
  push({ page: 1, x: 44, y: yFromTop(562), value: plumbing.unsatisfactoryComments, size: 8 });

  // ── Supplemental Information ─────────────────────────────────────────
  // Age of Piping — Supply (ckbx x=65) and Drain (ckbx x=236) columns.
  //   Original to home y=631 | Completely re-piped y=646 | Partially re-piped y=661
  const PIPING_AGE_Y: Record<string, number> = {
    original: 631,
    completely_repiped: 646,
    partially_repiped: 661,
  };
  const supplyY = PIPING_AGE_Y[plumbing.supplyPipingAge];
  if (supplyY) checkBox(out, 1, 65, supplyY);
  const drainY = PIPING_AGE_Y[plumbing.drainPipingAge];
  if (drainY) checkBox(out, 1, 236, drainY);

  // Type of pipes (check all that apply). Left sub-col x=351, right sub-col x=448.
  const pipeTypes: any = plumbing.pipeTypes ?? {};
  if (pipeTypes.copper)       checkBox(out, 1, 351, 631); // Copper
  if (pipeTypes.pvcCpvc)      checkBox(out, 1, 351, 646); // PVC/CPVC
  if (pipeTypes.galvanized)   checkBox(out, 1, 350, 661); // Galvanized
  if (pipeTypes.castIron)     checkBox(out, 1, 350, 680); // Cast Iron
  if (pipeTypes.polybutylene) checkBox(out, 1, 351, 695); // Polybutylene
  if (pipeTypes.abs)          checkBox(out, 1, 351, 709); // ABS
  if (pipeTypes.pex)          checkBox(out, 1, 448, 631); // PEX
  if (pipeTypes.other)        checkBox(out, 1, 448, 646); // Other (specify)
  // "Year Installed:" x=501-532 y=631 → value x=537 (yMax-2=638).
  push({ page: 1, x: 537, y: yFromTop(638), value: pipeTypes.yearInstalled, size: 8 });

  // Age of water heater y=676, blank at x≈116 (yMax-2=683).
  push({ page: 1, x: 116, y: yFromTop(683), value: plumbing.waterHeaterAgeYears });

  // ── PAGE 3 — Roof (Predominant + Secondary columns) ───────────────────
  // Two parallel columns: predominant labels at x≈42, secondary at x≈313.
  // Blank inputs start ~5pt after each label's xMax.
  //
  // Row baselines (all yMax - 2):
  //   y=117  Covering material:        blank x predom=100 | sec=371
  //   y=132  Roof age (years):         blank x predom=115 | sec=385
  //   y=148  Remaining useful life:    blank x predom=160 | sec=430
  //   y=163  Date of last roofing permit:  blank x predom=140 | sec=410
  //   y=178  Date of last update:      blank x predom=115 | sec=385
  //
  // Checkboxes:
  //   y=200  Full replacement ☐   x predom=55  | sec=322
  //   y=215  Partial replacement ☐ x predom=55  | sec=322
  //   y=230  % of replacement:    blank x predom=130 | sec=400
  //   y=260  Satisfactory ☐       x predom=55  | sec=322
  //   y=275  Unsatisfactory ☐     x predom=55  | sec=322
  //
  //   y=422  Any visible signs of leaks? Yes ☐ | No ☐  (predom Y x≈153, N x≈190 | sec Y x≈424, N x≈460)

  const COVERING_LABEL: Record<string, string> = {
    asphalt_shingle: "Asphalt shingle",
    metal:           "Metal",
    tile:            "Tile",
    built_up:        "Built-up",
    membrane:        "Membrane",
    wood_shake:      "Wood shake",
    other:           "Other",
  };

  // Helper that fills one roof column (predominant or secondary).
  // xOffset: 0 for predominant column, 271 for secondary.
  // Each value is placed ~5pt after its label's xMax:
  //   "Covering material:" xMax=107 → value at x≈112
  //   "Roof age (years):" xMax=104 → value at x≈109
  //   "Remaining useful life (years):" xMax=146 → value at x≈151
  //   "Date of last roofing permit:" xMax=136 → value at x≈141
  //   "Date of last update:" xMax=112 → value at x≈117
  const fillRoofColumn = (col: any, xOffset: number) => {
    push({
      page: 2,
      x: 112 + xOffset,
      y: yFromTop(117),
      value: col.coveringMaterial ? COVERING_LABEL[col.coveringMaterial] : undefined,
      size: 9,
    });
    push({ page: 2, x: 109 + xOffset, y: yFromTop(132), value: col.ageYears });
    push({ page: 2, x: 151 + xOffset, y: yFromTop(148), value: col.remainingLifeYears });
    push({ page: 2, x: 141 + xOffset, y: yFromTop(163), value: col.lastPermitDate, size: 9 });
    push({ page: 2, x: 117 + xOffset, y: yFromTop(178), value: col.lastUpdateDate, size: 9 });
    // Full replacement ckbx: "Full" word x=62 (predom) → ☐ x≈51. Secondary x=329 → x≈318.
    if (col.updateExtent === "full_replacement") {
      checkBox(out, 2, 51 + xOffset, 200);
    } else if (col.updateExtent === "partial_replacement") {
      checkBox(out, 2, 51 + xOffset, 215);
      push({
        page: 2,
        x: 130 + xOffset,
        y: yFromTop(237),
        value: col.updatePercent != null ? `${col.updatePercent}%` : undefined,
        size: 9,
      });
    }
    if (col.condition === "satisfactory") {
      checkBox(out, 2, 51 + xOffset, 260);
    } else if (col.condition === "unsatisfactory") {
      checkBox(out, 2, 51 + xOffset, 275);
    }
    // "Any visible signs of leaks?" Yes/No at y=422.
    // Predom: "Yes" x=163 → ☐ x≈152, "No" x=195 → ☐ x≈184.
    // Secondary: "Yes" x=434 → ☐ x≈423 (consistent with xOffset=271→ 152+271=423 ✓).
    if (col.visibleLeaks === true) {
      checkBox(out, 2, 152 + xOffset, 422);
    } else if (col.visibleLeaks === false) {
      checkBox(out, 2, 184 + xOffset, 422);
    }
    // ── "Any visible signs of damage / deterioration?" check-all ────────
    // Predominant ckbx x=51, secondary x=322 (xOffset 271). Row baselines:
    const dmg: any = col.damage ?? {};
    const DAMAGE_Y: Array<[string, number]> = [
      ["cracking", 321],
      ["cuppingCurling", 334],
      ["excessiveGranuleLoss", 346],
      ["exposedAsphalt", 358],
      ["exposedFelt", 370],
      ["missingLooseCrackedTabs", 381],
      ["softSpotsInDecking", 395],
      ["visibleHailDamage", 407],
    ];
    for (const [k, y] of DAMAGE_Y) {
      if (dmg[k]) checkBox(out, 2, 51 + xOffset, y);
    }
    // Attic/underside of decking — visible leaks? y=434. Yes x=152→☐141 | No x=184→☐173.
    if (col.leakAtticUnderside === true) checkBox(out, 2, 141 + xOffset, 434);
    else if (col.leakAtticUnderside === false) checkBox(out, 2, 173 + xOffset, 434);
    // Interior ceilings — visible leaks? y=446. Yes x=114→☐103 | No x=146→☐135.
    if (col.leakInteriorCeilings === true) checkBox(out, 2, 103 + xOffset, 446);
    else if (col.leakInteriorCeilings === false) checkBox(out, 2, 135 + xOffset, 446);
  };

  if (predominant && Object.keys(predominant).length > 0) {
    fillRoofColumn(predominant, 0);
  }
  if (secondary && Object.keys(secondary).length > 0) {
    // Secondary column "Full" word starts at x=329, predominant at x=62 → 267pt offset.
    // But the leaks "Yes" gap is 434−163=271. The label/blank inputs use 271 offset
    // (e.g. "Covering material:" predom x=42 vs secondary x=313 = 271). The Full/Partial
    // ckbx column has a slightly different offset (267) due to layout drift. Splitting
    // the difference at 269 keeps both rows on-cell within the ~14pt-wide checkboxes.
    fillRoofColumn(secondary, 271);
  }

  // ── PAGE 3 — Inspector certification block (7 fields) ─────────────────
  // Two rows of labels; values sit on the signature lines ABOVE each label.
  //   Row 1 labels y=653: Inspector Signature [43] | Title [190] | License Number [314] | Date [456]
  //   Row 2 labels y=692: Company Name [43] | License Type [190] | Work Phone [314]
  const licType = licenseTypeLabel(inspection.inspectorLicenseType);
  // Row 1 (baseline yMax-2 = 647 → sits on the line above the label).
  push({ page: 2, x: 46,  y: yFromTop(647), value: inspection.inspectorName });
  push({ page: 2, x: 190, y: yFromTop(647), value: licType, size: 9 });
  push({ page: 2, x: 316, y: yFromTop(647), value: inspection.inspectorLicense });
  push({ page: 2, x: 456, y: yFromTop(647), value: inspection.inspectedOn?.slice(0, 10) });
  // Row 2 (baseline 686).
  push({ page: 2, x: 46,  y: yFromTop(686), value: inspection.inspectorCompany, size: 9 });
  push({ page: 2, x: 190, y: yFromTop(686), value: licType, size: 9 });
  push({ page: 2, x: 316, y: yFromTop(686), value: inspection.inspectorPhone });

  return out;
}

function drawAll(
  pages: PDFPage[],
  font: PDFFont,
  fontBold: PDFFont,
  fields: FieldDraw[],
) {
  for (const f of fields) {
    const page = pages[f.page];
    if (!page) continue;
    page.drawText(String(f.value), {
      x: f.x,
      y: f.y,
      size: f.size ?? 10,
      font: f.bold ? fontBold : font,
    });
  }
}

export async function fillFourPoint(inspection: Inspection): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes());
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pages = doc.getPages();
  const fields = fieldsFor(inspection);
  drawAll(pages, font, fontBold, fields);

  return await doc.save();
}
