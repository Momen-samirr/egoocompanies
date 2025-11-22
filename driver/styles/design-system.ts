import { windowHeight, windowWidth } from "@/themes/app.constant";

/**
 * Design System Tokens
 * Provides consistent spacing, sizing, and design values across the app
 */

// Spacing Scale (based on 4px grid)
export const spacing = {
  xs: windowWidth(4),    // 4px
  sm: windowWidth(8),    // 8px
  md: windowWidth(12),   // 12px
  lg: windowWidth(16),   // 16px
  xl: windowWidth(20),   // 20px
  xxl: windowWidth(24),  // 24px
  xxxl: windowWidth(32), // 32px
};

// Border Radius Scale
export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
};

// Shadow Presets
export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
};

// Touch Target Sizes (minimum 44x44pt for accessibility)
export const touchTargets = {
  min: windowHeight(44),
  sm: windowHeight(48),
  md: windowHeight(52),
  lg: windowHeight(56),
};

// Icon Sizes
export const iconSizes = {
  xs: windowWidth(16),
  sm: windowWidth(20),
  md: windowWidth(24),
  lg: windowWidth(32),
  xl: windowWidth(40),
};

// Card Padding
export const cardPadding = {
  sm: spacing.sm,
  md: spacing.lg,
  lg: spacing.xl,
};

// Screen Padding
export const screenPadding = {
  horizontal: spacing.lg,
  vertical: spacing.lg,
};

// Component Heights
export const componentHeights = {
  button: {
    sm: windowHeight(36),
    md: windowHeight(44),
    lg: windowHeight(52),
  },
  input: {
    sm: windowHeight(40),
    md: windowHeight(48),
    lg: windowHeight(56),
  },
  header: windowHeight(115),
  tabBar: windowHeight(60),
};

// Z-Index Scale
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
};

// Animation Durations (ms)
export const animation = {
  fast: 150,
  normal: 250,
  slow: 350,
  slower: 500,
};

// Opacity Values
export const opacity = {
  disabled: 0.5,
  hover: 0.8,
  pressed: 0.6,
  overlay: 0.5,
  subtle: 0.1,
};

export default {
  spacing,
  borderRadius,
  shadows,
  touchTargets,
  iconSizes,
  cardPadding,
  screenPadding,
  componentHeights,
  zIndex,
  animation,
  opacity,
};

