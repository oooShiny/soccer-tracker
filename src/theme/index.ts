// ─── Theme Tokens ─────────────────────────────────────────────────
// Matches the prototype's dark interface design.

export const colors = {
  bg: "#0B1120",
  surface: "#131C31",
  surfaceHover: "#1A2540",
  border: "#1E2D4A",
  borderLight: "#2A3F66",

  text: "#E8ECF4",
  textMuted: "#7B8BA8",
  textDim: "#4A5B78",

  accent: "#22D67A",
  accentDim: "rgba(34,214,122,0.12)",

  warn: "#F5A623",
  warnDim: "rgba(245,166,35,0.12)",

  danger: "#EF4444",
  dangerDim: "rgba(239,68,68,0.12)",

  blue: "#3B82F6",
  blueDim: "rgba(59,130,246,0.12)",

  purple: "#A855F7",
  purpleDim: "rgba(168,85,247,0.12)",
} as const;

export const fonts = {
  regular: "System",
  mono: "monospace",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;
