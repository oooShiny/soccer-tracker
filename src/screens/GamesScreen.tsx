import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useSeasons, useGames, usePlayers } from "../hooks/useFirestore";
import { formatDate, getResult, getResultColor } from "../services/utils";
import { Card, Badge } from "../components/SharedUI";
import type { Game } from "../types";

export function GamesScreen() {
  const { teamId } = useAuth();
  const { data: seasons } = useSeasons(teamId);
  const { data: games } = useGames(teamId);
  const { data: players } = usePlayers(teamId);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const activeSeason = seasons.find((s) => s.status === "Active");
  const currentSeasonId = selectedSeasonId || activeSeason?.id;
  const filtered = games.filter((g) => g.seasonId === currentSeasonId).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <ScrollView style={s.container}>
      <Text style={s.header}>MATCH RESULTS</Text>

      {/* Season filter */}
      {seasons.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {seasons.map((season) => (
              <TouchableOpacity
                key={season.id}
                onPress={() => setSelectedSeasonId(season.id)}
                style={[s.filterPill, currentSeasonId === season.id && s.filterPillActive]}
              >
                <Text style={[s.filterText, currentSeasonId === season.id && s.filterTextActive]}>{season.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Games list */}
      {filtered.map((g) => {
        const result = getResult(g);
        const color = getResultColor(result);
        const played = g.ourScore != null;
        const multiKeeper = (g.keeperAppearances?.length || 0) > 1;
        return (
          <TouchableOpacity key={g.id} onPress={() => played && setSelectedGame(g)} activeOpacity={played ? 0.7 : 1}>
            <Card style={{ borderLeftWidth: 3, borderLeftColor: color }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={[s.resultBadge, { backgroundColor: result === "W" ? colors.accentDim : result === "L" ? colors.dangerDim : result === "D" ? colors.warnDim : colors.blueDim }]}>
                    <Text style={[s.resultText, { color }]}>{result === "Upcoming" ? "—" : result === "D" ? "T" : result}</Text>
                  </View>
                  <View>
                    <Text style={s.opponent}>vs {g.opponent}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <Text style={s.dateText}>{formatDate(g.date)}</Text>
                      {multiKeeper && <Badge color={colors.purple} bg={colors.purpleDim}>Split GK</Badge>}
                    </View>
                  </View>
                </View>
                {played ? (
                  <Text style={[s.score, { color }]}>{g.ourScore} – {g.theirScore}</Text>
                ) : (
                  <Badge color={colors.blue} bg={colors.blueDim}>Upcoming</Badge>
                )}
              </View>
            </Card>
          </TouchableOpacity>
        );
      })}

      {filtered.length === 0 && (
        <Card><Text style={{ color: colors.textDim, textAlign: "center" }}>No games for this season yet.</Text></Card>
      )}

      {/* Game Detail Modal */}
      {selectedGame && (
        <View style={s.modalOverlay}>
          <TouchableOpacity style={s.modalBackdrop} onPress={() => setSelectedGame(null)} />
          <View style={s.modal}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={s.modalTitle}>vs {selectedGame.opponent}</Text>
              <TouchableOpacity onPress={() => setSelectedGame(null)}><Text style={{ color: colors.textMuted, fontSize: 22 }}>✕</Text></TouchableOpacity>
            </View>
            <Text style={{ textAlign: "center", color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>{formatDate(selectedGame.date)}</Text>
            <Text style={[s.modalScore, { color: getResultColor(getResult(selectedGame)) }]}>{selectedGame.ourScore} – {selectedGame.theirScore}</Text>

            {selectedGame.scorers.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={s.modalLabel}>GOALS</Text>
                <Text style={{ color: colors.text, fontSize: 14 }}>
                  ⚽ {selectedGame.scorers.map(sc => { const p = players.find(pl => pl.id === sc.playerId); return `${p?.name || "Unknown"} ${sc.goals > 1 ? `(${sc.goals})` : ""}`; }).join(", ")}
                </Text>
              </View>
            )}
            {selectedGame.assists.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={s.modalLabel}>ASSISTS</Text>
                <Text style={{ color: colors.text, fontSize: 14 }}>
                  👟 {selectedGame.assists.map(a => { const p = players.find(pl => pl.id === a.playerId); return `${p?.name || "Unknown"} ${a.count > 1 ? `(${a.count})` : ""}`; }).join(", ")}
                </Text>
              </View>
            )}
            {selectedGame.keeperAppearances.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={s.modalLabel}>GOALKEEPER{selectedGame.keeperAppearances.length > 1 ? "S" : ""}</Text>
                {selectedGame.keeperAppearances.map((ka, i) => {
                  const k = players.find(p => p.id === ka.playerId);
                  return (
                    <View key={i} style={s.keeperRow}>
                      <Text style={{ color: colors.text, fontSize: 14 }}>🧤 {k?.name || "Unknown"} <Text style={{ color: colors.textMuted }}>{ka.minutes}'</Text></Text>
                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <Text style={{ color: colors.danger, fontSize: 12 }}>{ka.goalsAgainst} GA</Text>
                        <Text style={{ color: colors.accent, fontSize: 12 }}>{ka.saves} Svs</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  header: { fontSize: 15, fontWeight: "700", color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.md, marginTop: spacing.md },
  filterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterPillActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  filterText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  filterTextActive: { color: colors.accent },
  resultBadge: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  resultText: { fontWeight: "700", fontSize: 12, fontFamily: "monospace" },
  opponent: { fontWeight: "600", fontSize: 15, color: colors.text },
  dateText: { color: colors.textMuted, fontSize: 12 },
  score: { fontFamily: "monospace", fontSize: 22, fontWeight: "700" },
  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", zIndex: 100 },
  modalBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)" },
  modal: { backgroundColor: colors.surface, borderRadius: 18, padding: 28, width: "90%", maxWidth: 460, borderWidth: 1, borderColor: colors.border, zIndex: 101 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  modalScore: { fontSize: 42, fontWeight: "800", fontFamily: "monospace", textAlign: "center" },
  modalLabel: { fontSize: 11, color: colors.textDim, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  keeperRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 10, borderRadius: 10, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
});
