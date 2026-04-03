import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#4648D4",
        tabBarInactiveTintColor: "#98A2B3",
        tabBarStyle: {
          backgroundColor: "rgba(255,255,255,0.95)",
          borderTopWidth: 0,
          height: Platform.OS === "ios" ? 94 : 70,
          paddingBottom: Platform.OS === "ios" ? 24 : 10,
          paddingTop: 8,
          paddingHorizontal: 10,
          elevation: 0,
          shadowColor: "#4648D4",
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.08,
          shadowRadius: 18,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          position: "absolute",
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 2,
          textTransform: "uppercase",
          letterSpacing: 0.7,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        tabBarItemStyle: {
          borderRadius: 18,
          marginHorizontal: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "home" : "home-outline"} 
              size={20} 
              color={color} 
            />
          ),
          tabBarActiveBackgroundColor: "#EEF0FF",
        }}
      />
      <Tabs.Screen
        name="tracking"
        options={{
          title: "Tracking",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "git-network" : "git-network-outline"}
              size={20}
              color={color}
            />
          ),
          tabBarActiveBackgroundColor: "#EEF0FF",
        }}
      />
      <Tabs.Screen
        name="booking"
        options={{
          title: "Booking",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "calendar" : "calendar-outline"}
              size={20}
              color={color}
            />
          ),
          tabBarActiveBackgroundColor: "#EEF0FF",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              name={focused ? "person" : "person-outline"} 
              size={20} 
              color={color} 
            />
          ),
          tabBarActiveBackgroundColor: "#EEF0FF",
        }}
      />
    </Tabs>
  );
}







