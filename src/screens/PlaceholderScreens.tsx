import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { colors, spacing } from "../theme";

// ─── Games Screen ─────────────────────────────────────────────────
export function GamesScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>MATCH RESULTS</Text>
      <Text style={styles.placeholder}>
        Game list with season filter, game cards with result badges,
        and game detail modals. Wire to useGames() hook.
      </Text>
    </ScrollView>
  );
}

// ─── Players Screen ───────────────────────────────────────────────
export function PlayersScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>FIELD PLAYERS</Text>
      <Text style={styles.placeholder}>
        Player list sorted by goals, keeper section with GA/saves/CS,
        player detail modals with dual-role stats. Wire to usePlayers() hook.
      </Text>
    </ScrollView>
  );
}

// ─── Seasons Screen ───────────────────────────────────────────────
export function SeasonsScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>SEASONS</Text>
      <Text style={styles.placeholder}>
        Season cards with W/D/L summaries, clickable for detail view
        with standings table and game list. Wire to useSeasons() hook.
      </Text>
    </ScrollView>
  );
}

// ─── Settings Screen ──────────────────────────────────────────────
export function SettingsScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>SETTINGS</Text>
      <Text style={styles.placeholder}>
        Team name per season, member management with role badges,
        invite flow. Wire to useMembers() hook + useAuth() for role checks.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  header: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  placeholder: {
    fontSize: 14,
    color: colors.textDim,
    lineHeight: 22,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
