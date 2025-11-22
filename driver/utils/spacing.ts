import { windowHeight, windowWidth } from "@/themes/app.constant";

/**
 * Spacing Utilities
 * Provides consistent spacing values based on design system
 */

// Base spacing scale (4px grid)
const BASE_UNIT = 4;

export const spacing = {
  // Extra small spacing
  xs: windowWidth(BASE_UNIT),           // 4px
  sm: windowWidth(BASE_UNIT * 2),      // 8px
  md: windowWidth(BASE_UNIT * 3),      // 12px
  lg: windowWidth(BASE_UNIT * 4),     // 16px
  xl: windowWidth(BASE_UNIT * 5),      // 20px
  xxl: windowWidth(BASE_UNIT * 6),     // 24px
  xxxl: windowWidth(BASE_UNIT * 8),     // 32px
  huge: windowWidth(BASE_UNIT * 12),   // 48px
};

// Vertical spacing (for margins/padding)
export const verticalSpacing = {
  xs: windowHeight(BASE_UNIT),
  sm: windowHeight(BASE_UNIT * 2),
  md: windowHeight(BASE_UNIT * 3),
  lg: windowHeight(BASE_UNIT * 4),
  xl: windowHeight(BASE_UNIT * 5),
  xxl: windowHeight(BASE_UNIT * 6),
  xxxl: windowHeight(BASE_UNIT * 8),
  huge: windowHeight(BASE_UNIT * 12),
};

// Horizontal spacing (for margins/padding)
export const horizontalSpacing = {
  xs: windowWidth(BASE_UNIT),
  sm: windowWidth(BASE_UNIT * 2),
  md: windowWidth(BASE_UNIT * 3),
  lg: windowWidth(BASE_UNIT * 4),
  xl: windowWidth(BASE_UNIT * 5),
  xxl: windowWidth(BASE_UNIT * 6),
  xxxl: windowWidth(BASE_UNIT * 8),
  huge: windowWidth(BASE_UNIT * 12),
};

// Common spacing combinations
export const spacingPresets = {
  // Card padding
  card: {
    padding: spacing.lg,
    margin: spacing.md,
  },
  // Screen padding
  screen: {
    horizontal: spacing.lg,
    vertical: spacing.lg,
  },
  // Section spacing
  section: {
    marginVertical: verticalSpacing.xl,
    marginHorizontal: horizontalSpacing.lg,
  },
  // Component spacing
  component: {
    gap: spacing.md,
    margin: spacing.sm,
  },
};

export default spacing;

