import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import { colors } from "../theme";

import DashboardScreen from "../screens/DashboardScreen";
import { GamesScreen } from "../screens/GamesScreen";
import { PlayersScreen } from "../screens/PlayersScreen";
import { LeaderboardScreen } from "../screens/LeaderboardScreen";
import { SeasonsScreen } from "../screens/SeasonsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";

const Tab = createBottomTabNavigator();

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
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.2,
        },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarIcon: tabIcon("⚡"), tabBarLabel: "Home" }} />
      <Tab.Screen name="Games" component={GamesScreen} options={{ tabBarIcon: tabIcon("⚽"), tabBarLabel: "Games" }} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} options={{ tabBarIcon: tabIcon("🏅"), tabBarLabel: "Leaders" }} />
      <Tab.Screen name="Seasons" component={SeasonsScreen} options={{ tabBarIcon: tabIcon("🏆"), tabBarLabel: "Seasons" }} />
      <Tab.Screen name="More" component={MoreNavigator} options={{ tabBarIcon: tabIcon("•••"), tabBarLabel: "More" }} />
    </Tab.Navigator>
  );
}

// "More" tab houses Players and Settings
function MoreNavigator() {
  const [screen, setScreen] = React.useState<"menu" | "players" | "settings">("menu");
  const { View, TouchableOpacity, Text: RNText, StyleSheet } = require("react-native");

  if (screen === "players") return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity onPress={() => setScreen("menu")} style={{ padding: 16, paddingBottom: 4 }}>
        <RNText style={{ color: colors.textMuted, fontSize: 13 }}>← Back</RNText>
      </TouchableOpacity>
      <PlayersScreen />
    </View>
  );
  if (screen === "settings") return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity onPress={() => setScreen("menu")} style={{ padding: 16, paddingBottom: 4 }}>
        <RNText style={{ color: colors.textMuted, fontSize: 13 }}>← Back</RNText>
      </TouchableOpacity>
      <SettingsScreen />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, paddingTop: 24 }}>
      <RNText style={{ fontSize: 15, fontWeight: "700", color: colors.textMuted, letterSpacing: 1.5, marginBottom: 16 }}>MORE</RNText>
      {[
        { key: "players", icon: "👥", label: "Players", sub: "Roster & player stats" },
        { key: "settings", icon: "⚙️", label: "Settings", sub: "Team, members & account" },
      ].map(item => (
        <TouchableOpacity key={item.key} onPress={() => setScreen(item.key as any)}
          style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 18, borderWidth: 1, borderColor: colors.border, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <RNText style={{ fontSize: 24 }}>{item.icon}</RNText>
          <View>
            <RNText style={{ fontWeight: "600", fontSize: 16, color: colors.text }}>{item.label}</RNText>
            <RNText style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{item.sub}</RNText>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}
