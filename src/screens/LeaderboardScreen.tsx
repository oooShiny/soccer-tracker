import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useSeasons, useGames, usePlayers } from "../hooks/useFirestore";
import { Card, Badge } from "../components/SharedUI";
import type { Game, Player } from "../types";

interface LeaderboardEntry {
  playerId: string;
  name: string;
  number: number;
  goals: number;
  games: number;
  perGame: number;
}

function computeGoalLeaderboard(games: Game[], players: Player[]): LeaderboardEntry[] {
  const goalMap: Record<string, number> = {};
  const gamesPlayed: Record<string, number> = {};

  for (const game of games) {
    if (game.ourScore == null) continue;
    const absent = game.absentPlayerIds || [];
    // Count games played for all present players
    for (const player of players) {
      if (player.active === false) continue;
      if (!absent.includes(player.id)) {
        gamesPlayed[player.id] = (gamesPlayed[player.id] || 0) + 1;
      }
    }
    for (const scorer of game.scorers) {
      goalMap[scorer.playerId] = (goalMap[scorer.playerId] || 0) + scorer.goals;
    }
  }

  return Object.entries(goalMap)
    .map(([playerId, goals]) => {
      const player = players.find(p => p.id === playerId);
      const gp = gamesPlayed[playerId] || 1;
      return {
        playerId,
        name: player?.name || "Unknown",
        number: player?.number || 0,
        goals,
        games: gp,
        perGame: goals / gp,
      };
    })
    .sort((a, b) => b.goals - a.goals);
}

function computeAssistLeaderboard(games: Game[], players: Player[]) {
  const map: Record<string, number> = {};
  const gamesPlayed: Record<string, number> = {};

  for (const game of games) {
    if (game.ourScore == null) continue;
    const absent = game.absentPlayerIds || [];
    for (const player of players) {
      if (player.active === false) continue;
      if (!absent.includes(player.id)) {
        gamesPlayed[player.id] = (gamesPlayed[player.id] || 0) + 1;
      }
    }
    for (const a of game.assists) {
      map[a.playerId] = (map[a.playerId] || 0) + a.count;
    }
  }
  return Object.entries(map)
    .map(([playerId, assists]) => {
      const player = players.find(p => p.id === playerId);
      const gp = gamesPlayed[playerId] || 1;
      return { playerId, name: player?.name || "Unknown", number: player?.number || 0, assists, games: gp, perGame: assists / gp };
    })
    .sort((a, b) => b.assists - a.assists);
}

export function LeaderboardScreen() {
  const { teamId } = useAuth();
  const { data: seasons } = useSeasons(teamId);
  const { data: allGames } = useGames(teamId);
  const { data: players } = usePlayers(teamId);
  const [scope, setScope] = useState<"season" | "alltime">("season");
  const [tab, setTab] = useState<"goals" | "assists">("goals");

  const activeSeason = seasons.find(s => s.status === "Active");
  const scopeGames = scope === "season" ? allGames.filter(g => g.seasonId === activeSeason?.id) : allGames;

  const goalLeaders = computeGoalLeaderboard(scopeGames, players);
  const assistLeaders = computeAssistLeaderboard(scopeGames, players);

  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];

  return (
    <ScrollView style={s.container}>
      <Text style={s.header}>LEADERBOARD</Text>

      {/* Scope toggle */}
      <View style={s.toggleRow}>
        <TouchableOpacity onPress={() => setScope("season")} style={[s.toggleBtn, scope === "season" && s.toggleActive]}>
          <Text style={[s.toggleText, scope === "season" && s.toggleTextActive]}>This Season</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setScope("alltime")} style={[s.toggleBtn, scope === "alltime" && s.toggleActive]}>
          <Text style={[s.toggleText, scope === "alltime" && s.toggleTextActive]}>All Time</Text>
        </TouchableOpacity>
      </View>

      {/* Stat toggle */}
      <View style={[s.toggleRow, { marginBottom: spacing.md }]}>
        <TouchableOpacity onPress={() => setTab("goals")} style={[s.toggleBtn, tab === "goals" && s.toggleActive]}>
          <Text style={[s.toggleText, tab === "goals" && s.toggleTextActive]}>⚽ Goals</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab("assists")} style={[s.toggleBtn, tab === "assists" && s.toggleActive]}>
          <Text style={[s.toggleText, tab === "assists" && s.toggleTextActive]}>👟 Assists</Text>
        </TouchableOpacity>
      </View>

      {tab === "goals" ? (
        <>
          {/* Top 3 podium */}
          {goalLeaders.length >= 1 && (
            <View style={s.podium}>
              {goalLeaders.slice(0, 3).map((entry, i) => (
                <View key={entry.playerId} style={[s.podiumItem, i === 0 && s.podiumFirst]}>
                  <Text style={[s.medal, { color: medalColors[i] }]}>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</Text>
                  <Text style={s.podiumGoals}>{entry.goals}</Text>
                  <Text style={s.podiumName} numberOfLines={1}>{entry.name.split(" ")[0]}</Text>
                  <Text style={s.podiumSub}>{entry.perGame.toFixed(1)}/game</Text>
                </View>
              ))}
            </View>
          )}

          {/* Full table */}
          <View style={s.tableHeader}>
            <Text style={[s.tableCol, { width: 32 }]}>#</Text>
            <Text style={[s.tableCol, { flex: 1 }]}>Player</Text>
            <Text style={[s.tableCol, s.numCol]}>G</Text>
            <Text style={[s.tableCol, s.numCol]}>GP</Text>
            <Text style={[s.tableCol, s.numCol]}>G/GP</Text>
          </View>
          {goalLeaders.map((entry, i) => (
            <Card key={entry.playerId} style={{ padding: 12, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={[s.mono, { width: 32, color: i < 3 ? medalColors[i] : colors.textMuted, fontWeight: "700" }]}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.entryName}>{entry.name}</Text>
                  <Text style={s.entryNum}>#{entry.number}</Text>
                </View>
                <Text style={[s.mono, s.numCol, { color: colors.accent, fontWeight: "700" }]}>{entry.goals}</Text>
                <Text style={[s.mono, s.numCol, { color: colors.textMuted }]}>{entry.games}</Text>
                <Text style={[s.mono, s.numCol, { color: colors.textDim }]}>{entry.perGame.toFixed(1)}</Text>
              </View>
            </Card>
          ))}
          {goalLeaders.length === 0 && <Card><Text style={{ color: colors.textDim, textAlign: "center" }}>No goals recorded yet.</Text></Card>}
        </>
      ) : (
        <>
          {/* Top 3 podium */}
          {assistLeaders.length >= 1 && (
            <View style={s.podium}>
              {assistLeaders.slice(0, 3).map((entry, i) => (
                <View key={entry.playerId} style={[s.podiumItem, i === 0 && s.podiumFirst]}>
                  <Text style={[s.medal, { color: medalColors[i] }]}>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</Text>
                  <Text style={s.podiumGoals}>{entry.assists}</Text>
                  <Text style={s.podiumName} numberOfLines={1}>{entry.name.split(" ")[0]}</Text>
                  <Text style={s.podiumSub}>{entry.perGame.toFixed(1)}/game</Text>
                </View>
              ))}
            </View>
          )}

          <View style={s.tableHeader}>
            <Text style={[s.tableCol, { width: 32 }]}>#</Text>
            <Text style={[s.tableCol, { flex: 1 }]}>Player</Text>
            <Text style={[s.tableCol, s.numCol]}>A</Text>
            <Text style={[s.tableCol, s.numCol]}>GP</Text>
            <Text style={[s.tableCol, s.numCol]}>A/GP</Text>
          </View>
          {assistLeaders.map((entry, i) => (
            <Card key={entry.playerId} style={{ padding: 12, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={[s.mono, { width: 32, color: i < 3 ? medalColors[i] : colors.textMuted, fontWeight: "700" }]}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.entryName}>{entry.name}</Text>
                  <Text style={s.entryNum}>#{entry.number}</Text>
                </View>
                <Text style={[s.mono, s.numCol, { color: colors.blue, fontWeight: "700" }]}>{entry.assists}</Text>
                <Text style={[s.mono, s.numCol, { color: colors.textMuted }]}>{entry.games}</Text>
                <Text style={[s.mono, s.numCol, { color: colors.textDim }]}>{entry.perGame.toFixed(1)}</Text>
              </View>
            </Card>
          ))}
          {assistLeaders.length === 0 && <Card><Text style={{ color: colors.textDim, textAlign: "center" }}>No assists recorded yet.</Text></Card>}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  header: { fontSize: 15, fontWeight: "700", color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.md, marginTop: spacing.md },
  toggleRow: { flexDirection: "row", gap: 2, backgroundColor: colors.surface, borderRadius: radii.md, padding: 3, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: radii.sm, alignItems: "center" },
  toggleActive: { backgroundColor: colors.accentDim },
  toggleText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  toggleTextActive: { color: colors.accent },
  podium: { flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: spacing.lg, marginTop: spacing.sm },
  podiumItem: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, width: 100 },
  podiumFirst: { transform: [{ scale: 1.05 }], borderColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.15, shadowRadius: 12 },
  medal: { fontSize: 24, marginBottom: 4 },
  podiumGoals: { fontSize: 28, fontWeight: "800", color: colors.text, fontFamily: "monospace" },
  podiumName: { fontSize: 13, fontWeight: "600", color: colors.textMuted, marginTop: 4 },
  podiumSub: { fontSize: 11, color: colors.textDim, marginTop: 2 },
  tableHeader: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8 },
  tableCol: { fontSize: 11, fontWeight: "600", color: colors.textDim, letterSpacing: 1 },
  numCol: { width: 48, textAlign: "center" },
  mono: { fontFamily: "monospace", fontSize: 13 },
  entryName: { fontWeight: "600", fontSize: 14, color: colors.text },
  entryNum: { fontSize: 11, color: colors.textDim },
});
