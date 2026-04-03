import { Home } from "@/assets/icons/home";
import { HomeLight } from "@/assets/icons/homeLight";
import { Person } from "@/assets/icons/person";
import { Calender } from "@/assets/icons/calender";
import { Setting } from "@/assets/icons/setting";
import color from "@/themes/app.colors";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { windowHeight } from "@/themes/app.constant";
import { useTranslation } from "react-i18next";

export default function TabLayout() {
  const { t } = useTranslation("tabs");

  const getTabLabel = (routeName: string) => {
    switch (routeName) {
      case "home":
        return t("home");
      case "trips/index":
        return t("trips");
      case "profile/index":
        return t("profile");
      case "settings/index":
        return t("settings");
      default:
        return "";
    }
  };

  return (
    <Tabs
      screenOptions={({ route }) => {
        return {
          headerShown: false,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
            marginTop: -4,
            marginBottom: Platform.OS === "ios" ? 0 : 4,
            textTransform: "uppercase",
            letterSpacing: 0.7,
          },
          tabBarActiveTintColor: color.buttonBg,
          tabBarInactiveTintColor: "#8F8F8F",
          tabBarItemStyle: {
            marginHorizontal: 2,
            borderRadius: 24,
          },
          tabBarActiveBackgroundColor: "rgba(70,72,212,0.08)",
          tabBarStyle: {
            height: Platform.OS === "ios" ? windowHeight(85) : windowHeight(60),
            paddingBottom:
              Platform.OS === "ios" ? windowHeight(20) : windowHeight(5),
            paddingTop: windowHeight(5),
            backgroundColor: "rgba(255,255,255,0.9)",
            borderTopWidth: 0,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            elevation: 8,
            shadowColor: "#4648d4",
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.06,
            shadowRadius: 24,
          },
          tabBarIcon: ({ focused }) => {
            let iconName;
            if (route.name === "home") {
              if (focused) {
                iconName = (
                  <Home colors={color.buttonBg} width={24} height={24} />
                );
              } else {
                iconName = <HomeLight />;
              }
            } else if (route.name === "trips/index") {
              iconName = (
                <Calender colors={focused ? color.buttonBg : "#8F8F8F"} />
              );
            } else if (route.name === "profile/index") {
              if (focused) {
                iconName = <Person fill={color.buttonBg} />;
              } else {
                iconName = <Person fill={"#8F8F8F"} />;
              }
            } else if (route.name === "settings/index") {
              iconName = (
                <Setting colors={focused ? color.buttonBg : "#8F8F8F"} />
              );
            }
            return iconName;
          },
          tabBarLabel: getTabLabel(route.name),
        };
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t("home"),
        }}
      />
      <Tabs.Screen
        name="trips/index"
        options={{
          title: t("trips"),
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: t("profile"),
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: t("settings"),
        }}
      />
    </Tabs>
  );
}
