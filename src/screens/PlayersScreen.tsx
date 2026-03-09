import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { usePlayers } from "../hooks/useFirestore";
import { Card, Badge, StatBox } from "../components/SharedUI";
import type { Player } from "../types";

export function PlayersScreen() {
  const { teamId } = useAuth();
  const { data: players } = usePlayers(teamId);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const fieldOnly = players.filter((p) => !p.keeperStats);
  const keepers = players.filter((p) => p.keeperStats);

  return (
    <ScrollView style={s.container}>
      <Text style={s.header}>FIELD PLAYERS</Text>

      {/* Column headers */}
      <View style={s.colHeader}>
        <Text style={[s.colText, { width: 36 }]}>#</Text>
        <Text style={[s.colText, { flex: 1 }]}>Player</Text>
        <Text style={[s.colText, s.numCol]}>Pos</Text>
        <Text style={[s.colText, s.numCol]}>G</Text>
        <Text style={[s.colText, s.numCol]}>A</Text>
        <Text style={[s.colText, s.numCol]}>GP</Text>
      </View>

      {[...fieldOnly].sort((a, b) => b.goals - a.goals).map((p) => (
        <TouchableOpacity key={p.id} onPress={() => setSelectedPlayer(p)} activeOpacity={0.7}>
          <Card style={{ padding: 12, paddingHorizontal: 16 }}>
            <View style={s.playerRow}>
              <Text style={[s.mono, { width: 36, color: colors.textMuted }]}>{p.number}</Text>
              <Text style={[s.playerName, { flex: 1 }]}>{p.name}</Text>
              <View style={s.numCol}><Badge color={colors.textMuted} bg={colors.bg}>{p.positions[0]?.slice(0, 3) || "—"}</Badge></View>
              <Text style={[s.mono, s.numCol, { color: colors.accent, fontWeight: "700" }]}>{p.goals}</Text>
              <Text style={[s.mono, s.numCol, { color: colors.blue, fontWeight: "700" }]}>{p.assists}</Text>
              <Text style={[s.mono, s.numCol, { color: colors.textMuted }]}>{p.gamesPlayed}</Text>
            </View>
          </Card>
        </TouchableOpacity>
      ))}

      {fieldOnly.length === 0 && (
        <Card><Text style={{ color: colors.textDim, textAlign: "center" }}>No players added yet.</Text></Card>
      )}

      {/* Keepers */}
      {keepers.length > 0 && (
        <>
          <Text style={[s.header, { marginTop: spacing.lg }]}>GOALKEEPERS</Text>
          <Text style={s.subText}>Players who have kept goal. Tap for full stats.</Text>

          <View style={s.colHeader}>
            <Text style={[s.colText, { width: 36 }]}>#</Text>
            <Text style={[s.colText, { flex: 1 }]}>Player</Text>
            <Text style={[s.colText, s.numCol]}>GA</Text>
            <Text style={[s.colText, s.numCol]}>Svs</Text>
            <Text style={[s.colText, s.numCol]}>CS</Text>
            <Text style={[s.colText, s.numCol]}>GP</Text>
          </View>

          {keepers.sort((a, b) => (b.keeperStats?.appearances || 0) - (a.keeperStats?.appearances || 0)).map((p) => (
            <TouchableOpacity key={p.id} onPress={() => setSelectedPlayer(p)} activeOpacity={0.7}>
              <Card style={{ padding: 12, paddingHorizontal: 16 }}>
                <View style={s.playerRow}>
                  <Text style={[s.mono, { width: 36, color: colors.textMuted }]}>{p.number}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.playerName}>{p.name}</Text>
                    {(p.goals > 0 || p.assists > 0) && (
                      <Text style={s.dualNote}>Also: {p.goals > 0 ? `${p.goals}G` : ""}{p.goals > 0 && p.assists > 0 ? " " : ""}{p.assists > 0 ? `${p.assists}A` : ""} in field</Text>
                    )}
                  </View>
                  <Text style={[s.mono, s.numCol, { color: colors.danger, fontWeight: "700" }]}>{p.keeperStats!.goalsAgainst}</Text>
                  <Text style={[s.mono, s.numCol, { color: colors.accent, fontWeight: "700" }]}>{p.keeperStats!.saves}</Text>
                  <Text style={[s.mono, s.numCol, { color: colors.purple, fontWeight: "700" }]}>{p.keeperStats!.cleanSheets}</Text>
                  <Text style={[s.mono, s.numCol, { color: colors.textMuted }]}>{p.keeperStats!.appearances}</Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <View style={s.modalOverlay}>
          <TouchableOpacity style={s.modalBackdrop} onPress={() => setSelectedPlayer(null)} />
          <View style={s.modal}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={s.modalTitle}>#{selectedPlayer.number} {selectedPlayer.name}</Text>
              <TouchableOpacity onPress={() => setSelectedPlayer(null)}><Text style={{ color: colors.textMuted, fontSize: 22 }}>✕</Text></TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {selectedPlayer.positions.map((pos) => <Badge key={pos} color={colors.textMuted} bg={colors.bg}>{pos}</Badge>)}
              {selectedPlayer.canPlayKeeper && !selectedPlayer.positions.includes("Goalkeeper") && <Badge color={colors.purple} bg={colors.purpleDim}>Can keep</Badge>}
              {selectedPlayer.keeperStats && (selectedPlayer.goals > 0 || selectedPlayer.assists > 0) && <Badge color={colors.warn} bg={colors.warnDim}>Dual role</Badge>}
            </View>

            {/* Field stats */}
            {(selectedPlayer.goals > 0 || selectedPlayer.assists > 0 || !selectedPlayer.keeperStats) && (
              <View style={{ marginBottom: selectedPlayer.keeperStats ? 20 : 0 }}>
                {selectedPlayer.keeperStats && <Text style={s.modalLabel}>FIELD STATS</Text>}
                <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 8 }}>
                  <StatBox label="Goals" value={selectedPlayer.goals} color={colors.accent} />
                  <StatBox label="Assists" value={selectedPlayer.assists} color={colors.blue} />
                  <StatBox label="G+A" value={selectedPlayer.goals + selectedPlayer.assists} color={colors.purple} />
                </View>
              </View>
            )}

            {/* Keeper stats */}
            {selectedPlayer.keeperStats && (
              <View>
                {(selectedPlayer.goals > 0 || selectedPlayer.assists > 0) && <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 16 }} />}
                <Text style={s.modalLabel}>KEEPER STATS</Text>
                <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 8 }}>
                  <StatBox label="GA" value={selectedPlayer.keeperStats.goalsAgainst} color={colors.danger} />
                  <StatBox label="Saves" value={selectedPlayer.keeperStats.saves} color={colors.accent} />
                  <StatBox label="CS" value={selectedPlayer.keeperStats.cleanSheets} color={colors.purple} />
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 8 }}>
                  <StatBox label="Apps" value={selectedPlayer.keeperStats.appearances} color={colors.text} />
                  <StatBox label="Min" value={`${selectedPlayer.keeperStats.minutesPlayed}'`} color={colors.text} />
                  <StatBox label="GA/90" value={selectedPlayer.keeperStats.minutesPlayed > 0 ? (selectedPlayer.keeperStats.goalsAgainst / (selectedPlayer.keeperStats.minutesPlayed / 90)).toFixed(2) : "–"} color={colors.warn} />
                </View>
              </View>
            )}

            <Text style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: colors.textMuted }}>{selectedPlayer.gamesPlayed} total appearances</Text>
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  header: { fontSize: 15, fontWeight: "700", color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.sm, marginTop: spacing.md },
  subText: { fontSize: 12, color: colors.textDim, marginBottom: spacing.sm },
  colHeader: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, alignItems: "center" },
  colText: { fontSize: 11, fontWeight: "600", color: colors.textDim, letterSpacing: 1, textTransform: "uppercase" },
  numCol: { width: 44, textAlign: "center" },
  playerRow: { flexDirection: "row", alignItems: "center" },
  playerName: { fontWeight: "600", fontSize: 14, color: colors.text },
  mono: { fontFamily: "monospace", fontSize: 13 },
  dualNote: { fontSize: 11, color: colors.textDim, marginTop: 1 },
  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", zIndex: 100 },
  modalBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)" },
  modal: { backgroundColor: colors.surface, borderRadius: 18, padding: 28, width: "90%", maxWidth: 460, borderWidth: 1, borderColor: colors.border, zIndex: 101 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  modalLabel: { fontSize: 11, color: colors.textDim, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
});
