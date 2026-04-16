import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useSeasons, useGames } from "../hooks/useFirestore";
import { Card } from "../components/SharedUI";
import { GameCard } from "../components/GameCard";
import { useGameEdit } from "../components/GameEditProvider";

export function GamesScreen() {
  const { canEdit } = useAuth();
  const { teamId } = useAuth();
  const { data: seasons } = useSeasons(teamId);
  const { data: games } = useGames(teamId);
  const { newGame } = useGameEdit();
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

  const activeSeason = seasons.find(s => s.status === "Active");
  const currentSeasonId = selectedSeasonId || activeSeason?.id;
  const filtered = games.filter(g => g.seasonId === currentSeasonId).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <ScrollView style={s.container}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={s.header}>MATCH RESULTS</Text>
        {canEdit && currentSeasonId && (
          <TouchableOpacity onPress={() => newGame(currentSeasonId)} style={s.addBtn}><Text style={s.addBtnText}>+ Add Game</Text></TouchableOpacity>
        )}
      </View>

      {seasons.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {seasons.map(season => (
              <TouchableOpacity key={season.id} onPress={() => setSelectedSeasonId(season.id)} style={[s.filterPill, currentSeasonId === season.id && s.filterPillActive]}>
                <Text style={[s.filterText, currentSeasonId === season.id && s.filterTextActive]}>{season.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {filtered.map(g => <GameCard key={g.id} game={g} />)}
      {filtered.length === 0 && <Card><Text style={{ color: colors.textDim, textAlign: "center" }}>No games for this season yet.</Text></Card>}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  header: { fontSize: 15, fontWeight: "700", color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.md, marginTop: spacing.md },
  addBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.md },
  addBtnText: { color: colors.bg, fontSize: 13, fontWeight: "700" },
  filterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterPillActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  filterText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  filterTextActive: { color: colors.accent },
});
