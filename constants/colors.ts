const colors = {
  light: {
    text: "#FFFFFF",
    tint: "#FF6B35",
    background: "#0D0D14",
    foreground: "#FFFFFF",
    card: "#1A1A2E",
    cardForeground: "#FFFFFF",
    primary: "#FF6B35",
    primaryForeground: "#FFFFFF",
    secondary: "#22223A",
    secondaryForeground: "#FFFFFF",
    muted: "#22223A",
    mutedForeground: "#8A8AB0",
    accent: "#FF6B35",
    accentForeground: "#FFFFFF",
    destructive: "#FF3B30",
    destructiveForeground: "#FFFFFF",
    border: "#2D2D4A",
    input: "#2D2D4A",
  },
  radius: 12,
};

export const ALERT_TYPE_CONFIG = {
  police: { label: "Police", icon: "shield" as const, color: "#FF3B30" },
  accident: { label: "Accident", icon: "alert-triangle" as const, color: "#FF9500" },
  hazard: { label: "Hazard", icon: "alert-circle" as const, color: "#FFD60A" },
  speedcam: { label: "Speed Camera", icon: "camera" as const, color: "#30C4E8" },
  roadwork: { label: "Road Work", icon: "tool" as const, color: "#BF5AF2" },
} as const;

export type AlertType = keyof typeof ALERT_TYPE_CONFIG;

export default colors;
