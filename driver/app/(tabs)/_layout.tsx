import { Home } from "@/assets/icons/home";
import { HomeLight } from "@/assets/icons/homeLight";
import { Person } from "@/assets/icons/person";
import { History } from "@/assets/icons/history";
import { Calender } from "@/assets/icons/calender";
import color from "@/themes/app.colors";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { windowHeight } from "@/themes/app.constant";

export default function TabLayout() {
  const getTabLabel = (routeName: string) => {
    switch (routeName) {
      case "home":
        return "Home";
      case "rides/index":
        return "Rides";
      case "trips/index":
        return "Trips";
      case "profile/index":
        return "Profile";
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
            fontSize: 12,
            fontWeight: "500",
            marginTop: -4,
            marginBottom: Platform.OS === "ios" ? 0 : 4,
          },
          tabBarActiveTintColor: color.buttonBg,
          tabBarInactiveTintColor: "#8F8F8F",
          tabBarStyle: {
            height: Platform.OS === "ios" ? windowHeight(85) : windowHeight(60),
            paddingBottom: Platform.OS === "ios" ? windowHeight(20) : windowHeight(5),
            paddingTop: windowHeight(5),
            backgroundColor: "#fff",
            borderTopWidth: 1,
            borderTopColor: color.border,
            elevation: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          },
          tabBarIcon: ({ focused, color: iconColor }) => {
            let iconName;
            if (route.name === "home") {
              if (focused) {
                iconName = (
                  <Home colors={color.buttonBg} width={24} height={24} />
                );
              } else {
                iconName = <HomeLight />;
              }
            } else if (route.name === "rides/index") {
              iconName = (
                <History colors={focused ? color.buttonBg : "#8F8F8F"} />
              );
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
          title: "Home",
        }}
      />
      <Tabs.Screen 
        name="rides/index" 
        options={{
          title: "Rides",
        }}
      />
      <Tabs.Screen 
        name="trips/index" 
        options={{
          title: "Trips",
        }}
      />
      <Tabs.Screen 
        name="profile/index" 
        options={{
          title: "Profile",
        }}
      />
    </Tabs>
  );
}
