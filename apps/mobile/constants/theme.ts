// Threely theme — light & dark

export const lightColors = {
  bg: "#F6F9FC",
  bgElevated: "#FFFFFF",
  card: "#FFFFFF",
  cardPressed: "#F0F4F8",
  primary: "#635BFF",
  primaryHover: "#5144E8",
  primaryLight: "#EEF0FF",
  primaryText: "#FFFFFF",
  text: "#0A2540",
  textSecondary: "#425466",
  textTertiary: "#8898AA",
  textInverse: "#FFFFFF",
  border: "#E3E8EF",
  borderFocus: "#635BFF",
  success: "#3ECF8E",
  successLight: "#EDFAF4",
  warning: "#F59E0B",
  warningLight: "#FFFBEB",
  danger: "#FF4D4F",
  dangerLight: "#FFF1F0",
  overlay: "rgba(10, 37, 64, 0.5)",
  shadow: "rgba(10, 37, 64, 0.08)",
} as const;

export const darkColors = {
  bg: "#0D1117",
  bgElevated: "#161B22",
  card: "#1C2333",
  cardPressed: "#252D40",
  primary: "#7B74FF",
  primaryHover: "#635BFF",
  primaryLight: "#1A1A3E",
  primaryText: "#FFFFFF",
  text: "#E6EDF3",
  textSecondary: "#8B949E",
  textTertiary: "#484F58",
  textInverse: "#0D1117",
  border: "#30363D",
  borderFocus: "#7B74FF",
  success: "#3ECF8E",
  successLight: "#0A1F17",
  warning: "#D29922",
  warningLight: "#1E1610",
  danger: "#F85149",
  dangerLight: "#1F0A0A",
  overlay: "rgba(0, 0, 0, 0.7)",
  shadow: "rgba(0, 0, 0, 0.25)",
} as const;

// Backwards-compatible default export (light)
export const colors = lightColors;

export type Colors = typeof lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  xxxl: 38,
  regular: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
} as const;

export const shadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;
