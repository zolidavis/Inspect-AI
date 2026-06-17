/**
 * Inspect AI design system — "Dark navy · cyan · Inter".
 *
 * Modern, techy, AI-forward. The dark navy background hides glare/dirt on a
 * phone in the field and reads well in bright sun; cyan is reserved for
 * primary actions + AI affordances so they pop. Inter is the typeface.
 *
 * Use these tokens instead of hard-coded hex/fontWeight so the whole app
 * stays cohesive. `font.*` are the loaded Inter family names — prefer them
 * over `fontWeight` (a custom font only renders the weight you name).
 */

export const colors = {
  // Surfaces (darkest → lightest)
  bg: "#0a1626",        // app background — deep navy
  card: "#0f1f33",      // card / panel surface
  row: "#15273e",       // inputs, list rows, elevated fills
  rowAlt: "#1a2f49",    // pressed / selected fill
  border: "#21364f",    // hairline borders & dividers

  // Brand
  accent: "#22d3ee",    // cyan — primary actions, AI, focus
  accentDim: "#0e7490", // cyan pressed / muted
  accentSoft: "#0b2b38",// cyan-tinted fill behind AI elements
  onAccent: "#04222c",  // text/icon ON a cyan button (dark for contrast)

  // Text
  text: "#eaf1f9",      // primary near-white
  textDim: "#92a5bd",   // secondary
  textFaint: "#5a6d85", // tertiary / placeholders

  // Semantic
  yes: "#34d399",       // Yes / satisfactory (emerald)
  no: "#64748b",        // No (slate)
  danger: "#f87171",    // delete / hazard text + icons
  dangerOn: "#dc2626",  // danger button fill
  dangerFill: "#2a1620",// danger-tinted background
  warn: "#fbbf24",      // caution
} as const;

export const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
} as const;

/** Radii + spacing scale for consistent cards/buttons. */
export const radius = { sm: 8, md: 10, lg: 14, pill: 999 } as const;

/**
 * Shared navigation header style — dark navy bar, cyan back arrow,
 * near-white Inter title. Spread into a screen's `options` or the Stack's
 * `screenOptions`.
 */
export const navHeader = {
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
  headerTintColor: colors.accent,
  headerTitleStyle: { color: colors.text, fontFamily: font.semibold },
  contentStyle: { backgroundColor: colors.bg },
} as const;
