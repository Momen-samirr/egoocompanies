export type Color = {
  lightGray: string;
  regularText: string;
  primaryText: string;
  linearBorder: string;
  subtitle: string;
  lightGreen: string;
  whiteColor: string;
  blackColor: string;
  primaryGray: string;
  buttonBg: string;
  iconBg: string;
  modelBg: string;
  darkHeader: string;
  bgDark: string;
  darkPrimary: string;
  greenColor: string;
  sliderColor: string;
  notificationColor: string;
  border: string;
  readyText: string;
  categoryTitle: string;
  activeColor: string;
  completeColor: string;
  price: string;
  alertRed: string;
  alertBg: string;
  iconRed: string;
  darkBorder: string;
  selectPrimary: string;
  secondaryFont: string;
  red: string;
  primary: string;
  subPrimary: string;
  // Semantic colors
  semantic: {
    success: string;
    successLight: string;
    warning: string;
    warningLight: string;
    error: string;
    errorLight: string;
    info: string;
    infoLight: string;
  };
  // Status colors
  status: {
    online: string;
    offline: string;
    scheduled: string;
    active: string;
    completed: string;
    cancelled: string;
    failed: string;
    forceClosed: string;
  };
  // Background colors
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    card: string;
    modal: string;
  };
  // Text colors
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    inverse: string;
  };
};

const color: Color = {
  primary: "#665CFF",
  subPrimary: "#C9E2DB",
  lightGray: "#F5F5F5",
  regularText: "#8F8F8F",
  primaryText: "#1F1F1F",
  linearBorder: "rgba(149, 143, 159, 0.00)",
  secondaryFont: "#8F8F8F",
  red: "#FF4B4B",
  subtitle: "#9BA6B8",
  lightGreen: "#E8F4F1",
  whiteColor: "#fff",
  blackColor: "#000",
  primaryGray: "#E9E9E9",
  buttonBg: "#665CFF",
  iconBg: "#32A284",
  modelBg: "rgba(0, 0, 0, 0.5)",
  darkHeader: "#272727",
  bgDark: "#1F1F1F",
  darkPrimary: "#343434",
  greenColor: "#313E3B",
  sliderColor: "#005841",
  readyText: "#065C46",
  notificationColor: "#F2F2F2",
  border: "#E9E9E9",
  categoryTitle: "#8CCBBA",
  activeColor: "#3F8FDA",
  completeColor: "#FFB400",
  price: "#20B149",
  alertRed: "#F33737",
  alertBg: "#F7E4E4",
  iconRed: "#FEEBEB",
  darkBorder: "#474747",
  selectPrimary: "#E8F4F1",
  // Semantic colors
  semantic: {
    success: "#10b981",
    successLight: "#d1fae5",
    warning: "#f59e0b",
    warningLight: "#fef3c7",
    error: "#ef4444",
    errorLight: "#fee2e2",
    info: "#3b82f6",
    infoLight: "#dbeafe",
  },
  // Status colors
  status: {
    online: "#10b981",
    offline: "#9ca3af",
    scheduled: "#fbbf24",
    active: "#3b82f6",
    completed: "#10b981",
    cancelled: "#ef4444",
    failed: "#dc2626",
    forceClosed: "#e11d48", // rose-600 for force closed
  },
  // Background colors
  background: {
    primary: "#ffffff",
    secondary: "#F5F5F5",
    tertiary: "#F9FAFB",
    card: "#ffffff",
    modal: "rgba(0, 0, 0, 0.5)",
  },
  // Text colors
  text: {
    primary: "#1F1F1F",
    secondary: "#8F8F8F",
    tertiary: "#9BA6B8",
    disabled: "#D1D5DB",
    inverse: "#ffffff",
  },
};

export default color;
