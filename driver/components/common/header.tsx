import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import React from "react";
import { fontSizes, windowHeight, windowWidth } from "@/themes/app.constant";
import color from "@/themes/app.colors";
import fonts from "@/themes/app.fonts";
import SwitchToggle from "react-native-switch-toggle";
import { Notification } from "@/utils/icons";
import { BackArrow } from "@/assets/icons/backArrow";
import { router } from "expo-router";

interface HeaderProps {
  isOn: boolean;
  toggleSwitch: () => void;
  showBackButton?: boolean;
  title?: string;
  onBackPress?: () => void;
  notificationCount?: number;
}

export default function Header({ 
  isOn, 
  toggleSwitch, 
  showBackButton = false,
  title,
  onBackPress,
  notificationCount = 0,
}: HeaderProps) {
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
          <View style={[styles.headerTitle, { flex: 1, flexDirection: "row", alignItems: "center" }]}>
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
                { marginLeft: showBackButton ? windowWidth(10) : 0 }
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
        <View
          style={[
            styles.switchContainer,
            { backgroundColor: color.whiteColor, flexDirection: "row" },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: windowWidth(2),
              flex: 1,
            }}
          >
            <View style={[styles.statusIndicator, { backgroundColor: isOn ? "#10b981" : "#9ca3af" }]} />
            <Text
              style={[
                styles.valueTitle, 
                { 
                  color: isOn ? "#10b981" : "#6b7280",
                  fontWeight: "600",
                }
              ]}
            >
              {isOn ? "Online" : "Offline"}
            </Text>
            <Text style={styles.statusSubtext}>
              {isOn ? "Available for rides" : "Not available"}
            </Text>
          </View>
          <View style={styles.switchBorder}>
            <SwitchToggle
              switchOn={isOn}
              onPress={toggleSwitch}
              containerStyle={styles.switchView}
              circleStyle={styles.switchCircle}
              backgroundColorOff={color.lightGray}
              backgroundColorOn={color.lightGray}
              circleColorOn={color.primary}
              circleColorOff={color.blackColor}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerMain: {
    backgroundColor: color.primary,
    paddingHorizontal: windowWidth(10),
    paddingTop: windowHeight(25),
    width: "100%",
    height: windowHeight(115),
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
  switchContainer: {
    height: windowHeight(28),
    width: "100%",
    marginVertical: windowHeight(5),
    borderRadius: 25,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: windowWidth(10),
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: windowWidth(3),
  },
  valueTitle: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.FONT14,
  },
  statusSubtext: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.FONT12,
    color: color.secondaryFont,
    marginLeft: windowWidth(3),
  },
  switchBorder: {
    height: windowHeight(20),
    width: windowHeight(45),
    borderWidth: 2,
    borderRadius: 25,
    borderColor: color.linearBorder,
  },
  switchView: {
    height: windowHeight(20),
    width: windowWidth(55),
    borderRadius: 25,
    padding: windowWidth(8),
    borderColor: color.buttonBg,
  },
  switchCircle: {
    height: windowHeight(15),
    width: windowWidth(25),
    borderRadius: 20,
  },
});
