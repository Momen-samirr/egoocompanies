import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import React from "react";
import { fontSizes, windowHeight, windowWidth } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import { Notification } from "@/utils/icons";
import { BackArrow } from "@/assets/icons/backArrow";
import { router } from "expo-router";

interface HeaderProps {
  isOn?: boolean; // Optional now, kept for backward compatibility
  toggleSwitch?: () => void; // Optional now, kept for backward compatibility
  showBackButton?: boolean;
  title?: string;
  onBackPress?: () => void;
  notificationCount?: number;
  loading?: boolean;
  showOnlineStatus?: boolean;
}

const Header = React.memo(function Header({
  isOn,
  toggleSwitch,
  showBackButton = false,
  title,
  onBackPress,
  notificationCount = 0,
  loading = false,
  showOnlineStatus = false,
}: HeaderProps) {
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
                accessibilityLabel="Go back"
                accessibilityRole="button"
              >
                <BackArrow colors={color.whiteColor} width={20} height={20} />
              </TouchableOpacity>
            )}
            <Text
              style={[
                styles.headerTitleText,
                { marginLeft: showBackButton ? windowWidth(10) : 0 },
              ]}
            >
              {title || "Egoo"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.notificationIcon}
            activeOpacity={0.5}
            accessibilityLabel="Notifications"
            accessibilityRole="button"
          >
            <Notification color={color.whiteColor} />
            {notificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {notificationCount > 9 ? "9+" : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Only re-render if props actually change
  return (
    prevProps.isOn === nextProps.isOn &&
    prevProps.loading === nextProps.loading &&
    prevProps.title === nextProps.title &&
    prevProps.notificationCount === nextProps.notificationCount &&
    prevProps.showBackButton === nextProps.showBackButton &&
    prevProps.showOnlineStatus === nextProps.showOnlineStatus
  );
});

export default Header;

const styles = StyleSheet.create({
  headerMain: {
    backgroundColor: color.primary,
    paddingHorizontal: windowWidth(10),
    paddingTop: windowHeight(25),
    paddingBottom: windowWidth(12), // Add bottom padding for proper spacing
    width: "100%",
    minHeight: windowHeight(115), // Change from fixed height to minHeight
  },
  logoTitle: {
    fontSize: fontSizes.FONT18,
    fontFamily: fonts.bold,
    color: color.whiteColor,
  },
  headerMargin: {
    marginHorizontal: windowWidth(10),
    marginTop: windowHeight(10),
  },
  headerAlign: {
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    alignItems: "center",
  },
  headerTitleText: {
    fontFamily: "TT-Octosquares-Medium",
    fontSize: windowHeight(22),
    color: "#fff",
    textAlign: "left",
  },
  backButton: {
    padding: windowWidth(5),
    marginLeft: -windowWidth(5),
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  notificationIcon: {
    height: windowHeight(40),
    width: windowWidth(40),
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#675fd800",
    borderColor: color.buttonBg,
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: color.primary,
  },
  notificationBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
});
