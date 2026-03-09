import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import { colors } from "../theme";

import DashboardScreen from "../screens/DashboardScreen";
import {
  GamesScreen,
  PlayersScreen,
  SeasonsScreen,
  SettingsScreen,
} from "../screens/PlaceholderScreens";

const Tab = createBottomTabNavigator();

// Simple emoji icons (replace with proper icon library later)
const tabIcon = (emoji: string) => () => <Text style={{ fontSize: 20 }}>{emoji}</Text>;

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: 6,
          height: 60,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.3,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: tabIcon("⚡"), tabBarLabel: "Dashboard" }}
      />
      <Tab.Screen
        name="Games"
        component={GamesScreen}
        options={{ tabBarIcon: tabIcon("⚽"), tabBarLabel: "Games" }}
      />
      <Tab.Screen
        name="Players"
        component={PlayersScreen}
        options={{ tabBarIcon: tabIcon("👥"), tabBarLabel: "Players" }}
      />
      <Tab.Screen
        name="Seasons"
        component={SeasonsScreen}
        options={{ tabBarIcon: tabIcon("🏆"), tabBarLabel: "Seasons" }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarIcon: tabIcon("⚙️"), tabBarLabel: "Settings" }}
      />
    </Tab.Navigator>
  );
}
