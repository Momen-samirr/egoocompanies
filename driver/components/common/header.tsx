import { View, Text, StyleSheet, TouchableOpacity, I18nManager } from "react-native";
import React from "react";
import { useTranslation } from "react-i18next";
import { fontSizes, windowHeight } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import { Notification } from "@/utils/icons";
import { BackArrow } from "@/assets/icons/backArrow";
import { router } from "expo-router";
import KineticStatusChip from "@/components/kinetic/KineticStatusChip";
import { kinetic, spacing } from "@/styles/design-system";

interface HeaderProps {
  isOn?: boolean; // Optional now, kept for backward compatibility
  toggleSwitch?: () => void; // Optional now, kept for backward compatibility
  showBackButton?: boolean;
  title?: string;
  onBackPress?: () => void;
  notificationCount?: number;
  loading?: boolean;
  showOnlineStatus?: boolean;
  showMenuButton?: boolean;
  showNotificationIcon?: boolean;
}

const Header = React.memo(
  function Header({
    isOn,
    toggleSwitch,
    showBackButton = false,
    title,
    onBackPress,
    notificationCount = 0,
    loading = false,
    showOnlineStatus = false,
    showMenuButton = false,
    showNotificationIcon = true,
  }: HeaderProps) {
    const { t } = useTranslation("common");
    // Note: isOn and toggleSwitch are kept for backward compatibility
    // but the toggle switch UI has been removed in favor of DriverStatusCard
    const handleBackPress = () => {
      if (onBackPress) {
        onBackPress();
      } else {
        router.back();
      }
    };

    return (
      <View style={styles.headerMain}>
        <View style={styles.headerMargin}>
          <View
            style={[
              styles.headerAlign,
              {
                alignItems: "center",
                paddingTop: windowHeight(3),
                flexDirection: "row",
              },
            ]}
          >
            <View
              style={[
                styles.headerTitle,
                { flex: 1, flexDirection: "row", alignItems: "center" },
              ]}
            >
              {showBackButton && (
                <TouchableOpacity
                  onPress={handleBackPress}
                  style={styles.backButton}
                  activeOpacity={0.7}
                  accessibilityLabel={t("goBack")}
                  accessibilityRole="button"
                >
                  <View
                    style={{
                      transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }],
                    }}
                  >
                    <BackArrow colors={kinetic.colors.primary} width={20} height={20} />
                  </View>
                </TouchableOpacity>
              )}
              {!showBackButton && showMenuButton && (
                <TouchableOpacity
                  style={styles.menuButton}
                  activeOpacity={0.7}
                  accessibilityLabel={t("openMenu")}
                  accessibilityRole="button"
                >
                  <View style={styles.menuLine} />
                  <View style={styles.menuLine} />
                  <View style={[styles.menuLine, { width: 12 }]} />
                </TouchableOpacity>
              )}
              <Text
                style={[styles.headerTitleText, { marginStart: showBackButton ? 8 : 0 }]}
              >
                {title || t("transportHub")}
              </Text>
            </View>
            <View style={styles.rightWrap}>
              {showOnlineStatus && (
                <KineticStatusChip
                  label={isOn ? t("online") : t("offline")}
                  tone={isOn ? "live" : "neutral"}
                />
              )}
              {showNotificationIcon && (
                <TouchableOpacity
                  style={styles.notificationIcon}
                  activeOpacity={0.7}
                  accessibilityLabel={t("notificationsA11y")}
                  accessibilityRole="button"
                >
                  <Notification color="#4648d4" />
                  {notificationCount > 0 && (
                    <View style={styles.notificationBadge}>
                      <Text style={styles.notificationBadgeText}>
                        {notificationCount > 9 ? "9+" : notificationCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{t("driverInitial")}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if props actually change
    return (
      prevProps.isOn === nextProps.isOn &&
      prevProps.loading === nextProps.loading &&
      prevProps.title === nextProps.title &&
      prevProps.notificationCount === nextProps.notificationCount &&
      prevProps.showBackButton === nextProps.showBackButton &&
      prevProps.showOnlineStatus === nextProps.showOnlineStatus
    );
  }
);

export default Header;

const styles = StyleSheet.create({
  headerMain: {
    backgroundColor: kinetic.colors.surface,
    paddingHorizontal: spacing.sm,
    paddingTop: windowHeight(16),
    width: "100%",
  },
  logoTitle: {
    fontSize: fontSizes.FONT18,
    fontFamily: fonts.bold,
    color: "#191C1D",
  },
  headerMargin: {
    marginHorizontal: spacing.sm,
    marginTop: windowHeight(6),
    marginBottom: spacing.sm,
  },
  headerAlign: {
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    alignItems: "center",
  },
  headerTitleText: {
    fontFamily: fonts.bold,
    fontSize: 30,
    color: kinetic.colors.onSurface,
    textAlign: "start",
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: kinetic.colors.surfaceLowest,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(199,196,215,0.35)",
    marginEnd: 10,
  },
  menuLine: {
    width: 16,
    height: 2,
    borderRadius: 999,
    backgroundColor: kinetic.colors.primary,
    marginVertical: 1.4,
  },
  rightWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: kinetic.colors.surfaceLowest,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(199,196,215,0.35)",
    ...kinetic.shadows.soft,
  },
  notificationIcon: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: kinetic.colors.surfaceLowest,
    position: "relative",
    borderWidth: 1,
    borderColor: "rgba(199,196,215,0.35)",
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#E1E0FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(96,99,238,0.3)",
  },
  avatarInitial: {
    color: kinetic.colors.primary,
    fontWeight: "700",
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    end: -4,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  notificationBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
});
