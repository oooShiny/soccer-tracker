import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { usePlayers, useSeasons, useGames } from "../hooks/useFirestore";
import { computeKeeperLeaderboard, computeCareerStats, formatKeeperGames } from "../services/utils";
import { createPlayer, updatePlayer } from "../services/firestore";
import { Card, Badge, StatBox } from "../components/SharedUI";
import { useGameEdit } from "../components/GameEditProvider";
import { FormModal, FormInput, FormPicker, FormCheckbox, FormButtons } from "../components/FormComponents";
import type { Player } from "../types";

interface PlayerForm { name: string; number: string; position: string; canPlayKeeper: boolean; }
const emptyForm = (): PlayerForm => ({ name: "", number: "", position: "Midfielder", canPlayKeeper: false });
const playerToForm = (p: Player): PlayerForm => ({ name: p.name, number: String(p.number), position: p.positions[0] || "Midfielder", canPlayKeeper: p.canPlayKeeper });

const isInactiveForSeason = (p: Player, seasonId?: string): boolean => {
  if (!seasonId) return false;
  return (p.inactiveSeasonIds || []).includes(seasonId);
};

export function PlayersScreen() {
  const { teamId, canEdit } = useAuth();
  const { data: players } = usePlayers(teamId);
  const { data: seasons } = useSeasons(teamId);
  const { data: games } = useGames(teamId);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PlayerForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const { viewPlayer } = useGameEdit();

  const activeSeason = seasons.find(s => s.status === "Active");
  // Goalkeepers section: anyone whose position is Goalkeeper or who can play keeper
  const isKeeper = (p: Player) => p.canPlayKeeper || p.positions.includes("Goalkeeper");
  const fieldOnly = players.filter(p => p.active !== false && !isKeeper(p) && !isInactiveForSeason(p, activeSeason?.id));
  const keepers = players.filter(p => p.active !== false && isKeeper(p) && !isInactiveForSeason(p, activeSeason?.id));
  const inactivePlayers = players.filter(p => p.active !== false && isInactiveForSeason(p, activeSeason?.id));
  const deactivatedPlayers = players.filter(p => p.active === false);

  // Career keeper stats computed from game results (GP is fractional by % of game played)
  const keeperStatsById = useMemo(() => {
    const map: Record<string, { apps: number; ga: number; cleanSheets: number }> = {};
    for (const e of computeKeeperLeaderboard(games, players)) map[e.playerId] = e;
    return map;
  }, [games, players]);
  const kStats = (id: string) => keeperStatsById[id] || { apps: 0, ga: 0, cleanSheets: 0 };
  // Career goals / games played computed from game results (the stored player fields are never updated)
  const careerById = useMemo(() => computeCareerStats(games, players), [games, players]);
  const career = (id: string) => careerById[id] || { goals: 0, gp: 0 };

  const openNew = () => { setEditingPlayer(null); setForm(emptyForm()); setShowForm(true); };
  const openEdit = (p: Player) => { setEditingPlayer(p); setForm(playerToForm(p)); setShowForm(true); setSelectedPlayer(null); };

  const handleSave = async () => {
    if (!teamId) return;
    setSaving(true);
    try {
      const positions = [form.position];
      if (form.canPlayKeeper && form.position !== "Goalkeeper") positions.push("Goalkeeper");
      const data = {
        name: form.name,
        number: parseInt(form.number) || 0,
        positions,
        canPlayKeeper: form.canPlayKeeper || form.position === "Goalkeeper",
        goals: editingPlayer?.goals ?? 0,
        assists: editingPlayer?.assists ?? 0,
        gamesPlayed: editingPlayer?.gamesPlayed ?? 0,
        keeperStats: editingPlayer?.keeperStats ?? null,
        active: editingPlayer?.active ?? true,
        deactivatedAt: editingPlayer?.deactivatedAt ?? null,
        // New players are inactive for every season except the active one(s)
        inactiveSeasonIds: editingPlayer
          ? editingPlayer.inactiveSeasonIds ?? []
          : seasons.filter(s => s.status !== "Active").map(s => s.id),
      };
      if (editingPlayer) {
        await updatePlayer(teamId, editingPlayer.id, data);
      } else {
        await createPlayer(teamId, data);
      }
      setShowForm(false);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  return (
    <ScrollView style={s.container}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={s.header}>FIELD PLAYERS</Text>
        {canEdit && <TouchableOpacity onPress={openNew} style={s.addBtn}><Text style={s.addBtnText}>+ Add Player</Text></TouchableOpacity>}
      </View>

      <View style={s.colHeader}>
        <Text style={[s.colText, { width: 36 }]}>#</Text>
        <Text style={[s.colText, { flex: 1 }]}>Player</Text>
        <Text style={[s.colText, s.numCol]}>Pos</Text>
        <Text style={[s.colText, s.numCol]}>G</Text>
        <Text style={[s.colText, s.numCol]}>GP</Text>
      </View>

      {[...fieldOnly].sort((a, b) => career(b.id).goals - career(a.id).goals || career(b.id).gp - career(a.id).gp).map(p => (
        <TouchableOpacity key={p.id} onPress={() => setSelectedPlayer(p)} activeOpacity={0.7}>
          <Card style={{ padding: 12, paddingHorizontal: 16 }}>
            <View style={s.playerRow}>
              <Text style={[s.mono, { width: 36, color: colors.textMuted }]}>{p.number}</Text>
              <Text style={[s.playerName, { flex: 1 }]}>{p.name}</Text>
              <View style={s.numCol}><Badge color={colors.textMuted} bg={colors.bg}>{p.positions[0]?.slice(0, 3) || "—"}</Badge></View>
              <Text style={[s.mono, s.numCol, { color: colors.accent, fontWeight: "700" }]}>{career(p.id).goals}</Text>
              <Text style={[s.mono, s.numCol, { color: colors.textMuted }]}>{career(p.id).gp}</Text>
            </View>
          </Card>
        </TouchableOpacity>
      ))}
      {fieldOnly.length === 0 && <Card><Text style={{ color: colors.textDim, textAlign: "center" }}>No players added yet. Tap + to add your roster.</Text></Card>}

      {keepers.length > 0 && (
        <>
          <Text style={[s.header, { marginTop: spacing.lg }]}>GOALKEEPERS</Text>
          <View style={s.colHeader}>
            <Text style={[s.colText, { width: 36 }]}>#</Text>
            <Text style={[s.colText, { flex: 1 }]}>Player</Text>
            <Text style={[s.colText, s.numCol]}>GA</Text>
            <Text style={[s.colText, s.numCol]}>CS</Text>
            <Text style={[s.colText, s.numCol]}>GP</Text>
          </View>
          {keepers.sort((a, b) => kStats(b.id).apps - kStats(a.id).apps).map(p => (
            <TouchableOpacity key={p.id} onPress={() => setSelectedPlayer(p)} activeOpacity={0.7}>
              <Card style={{ padding: 12, paddingHorizontal: 16 }}>
                <View style={s.playerRow}>
                  <Text style={[s.mono, { width: 36, color: colors.textMuted }]}>{p.number}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.playerName}>{p.name}</Text>
                    {career(p.id).goals > 0 && <Text style={s.dualNote}>Also: {career(p.id).goals}G in field</Text>}
                  </View>
                  <Text style={[s.mono, s.numCol, { color: colors.danger, fontWeight: "700" }]}>{kStats(p.id).ga}</Text>
                  <Text style={[s.mono, s.numCol, { color: colors.purple, fontWeight: "700" }]}>{kStats(p.id).cleanSheets}</Text>
                  <Text style={[s.mono, s.numCol, { color: colors.textMuted }]}>{formatKeeperGames(kStats(p.id).apps)}</Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Inactive for this season */}
      {inactivePlayers.length > 0 && (
        <>
          <Text style={[s.header, { marginTop: spacing.lg }]}>INACTIVE THIS SEASON</Text>
          {inactivePlayers.map(p => (
            <TouchableOpacity key={p.id} onPress={() => setSelectedPlayer(p)} activeOpacity={0.7}>
              <Card style={{ padding: 12, paddingHorizontal: 16, opacity: 0.6 }}>
                <View style={s.playerRow}>
                  <Text style={[s.mono, { width: 36, color: colors.textDim }]}>{p.number}</Text>
                  <Text style={{ flex: 1, fontWeight: "600", fontSize: 14, color: colors.textDim }}>{p.name}</Text>
                  <Badge color={colors.danger} bg={colors.dangerDim}>Inactive</Badge>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Deactivated (permanently off the team) */}
      {deactivatedPlayers.length > 0 && (
        <>
          <Text style={[s.header, { marginTop: spacing.lg }]}>DEACTIVATED</Text>
          {deactivatedPlayers.map(p => (
            <TouchableOpacity key={p.id} onPress={() => setSelectedPlayer(p)} activeOpacity={0.7}>
              <Card style={{ padding: 12, paddingHorizontal: 16, opacity: 0.6 }}>
                <View style={s.playerRow}>
                  <Text style={[s.mono, { width: 36, color: colors.textDim }]}>{p.number}</Text>
                  <Text style={{ flex: 1, fontWeight: "600", fontSize: 14, color: colors.textDim }}>{p.name}</Text>
                  <Badge color={colors.textDim} bg={colors.bg}>Deactivated</Badge>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Player Detail Modal */}
      {selectedPlayer && (
        <FormModal visible={true} title={`#${selectedPlayer.number} ${selectedPlayer.name}`} onClose={() => setSelectedPlayer(null)}>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {selectedPlayer.positions.map(pos => <Badge key={pos} color={colors.textMuted} bg={colors.bg}>{pos}</Badge>)}
            {selectedPlayer.canPlayKeeper && !selectedPlayer.positions.includes("Goalkeeper") && <Badge color={colors.purple} bg={colors.purpleDim}>Can keep</Badge>}
          </View>
          {(career(selectedPlayer.id).goals > 0 || !isKeeper(selectedPlayer)) && (
            <View style={{ marginBottom: isKeeper(selectedPlayer) ? 20 : 0 }}>
              {isKeeper(selectedPlayer) && <Text style={s.modalLabel}>FIELD STATS</Text>}
              <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 8 }}>
                <StatBox label="Goals" value={career(selectedPlayer.id).goals} color={colors.accent} />
              </View>
            </View>
          )}
          {isKeeper(selectedPlayer) && (
            <View>
              {career(selectedPlayer.id).goals > 0 && <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 16 }} />}
              <Text style={s.modalLabel}>KEEPER STATS</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 8 }}>
                <StatBox label="GP" value={formatKeeperGames(kStats(selectedPlayer.id).apps)} color={colors.text} />
                <StatBox label="GA" value={kStats(selectedPlayer.id).ga} color={colors.danger} />
                <StatBox label="CS" value={kStats(selectedPlayer.id).cleanSheets} color={colors.purple} />
              </View>
            </View>
          )}
          <Text style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: colors.textMuted }}>{career(selectedPlayer.id).gp} total appearances</Text>

          {/* Per-season activity toggles */}
          {canEdit && seasons.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={s.modalLabel}>SEASONS</Text>
              {seasons.map(season => {
                const inactive = isInactiveForSeason(selectedPlayer, season.id);
                return (
                  <TouchableOpacity
                    key={season.id}
                    onPress={async () => {
                      if (!teamId) return;
                      const current = selectedPlayer.inactiveSeasonIds || [];
                      const updated = inactive
                        ? current.filter(id => id !== season.id)
                        : [...current, season.id];
                      await updatePlayer(teamId, selectedPlayer.id, { inactiveSeasonIds: updated } as any);
                      setSelectedPlayer({ ...selectedPlayer, inactiveSeasonIds: updated });
                    }}
                    style={[s.statusToggle, inactive ? s.statusInactive : s.statusActive, { marginBottom: 8 }]}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: inactive ? colors.danger : colors.accent, fontWeight: "600", fontSize: 14 }}>
                      {inactive ? "❌ Inactive for " : "✅ Active for "}{season.name}{season.status === "Active" ? " (current)" : ""}
                    </Text>
                    <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>
                      Tap to {inactive ? "mark active" : "mark inactive"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Permanent team status toggle */}
          {canEdit && (
            <View style={{ marginTop: 16 }}>
              <Text style={s.modalLabel}>TEAM STATUS</Text>
              {(() => {
                const deactivated = selectedPlayer.active === false;
                return (
                  <TouchableOpacity
                    onPress={async () => {
                      if (!teamId) return;
                      const updates = deactivated
                        ? { active: true, deactivatedAt: null }
                        : { active: false, deactivatedAt: new Date().toISOString().slice(0, 10) };
                      await updatePlayer(teamId, selectedPlayer.id, updates as any);
                      setSelectedPlayer({ ...selectedPlayer, ...updates });
                    }}
                    style={[s.statusToggle, deactivated ? s.statusInactive : s.statusActive]}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: deactivated ? colors.danger : colors.accent, fontWeight: "600", fontSize: 14 }}>
                      {deactivated ? "🚫 Deactivated" : "✅ Active"}
                    </Text>
                    <Text style={{ color: colors.textDim, fontSize: 12, marginTop: 2 }}>
                      Tap to {deactivated ? "reactivate" : "deactivate"} — hides from game rosters going forward
                    </Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
          )}

          <TouchableOpacity onPress={() => { setSelectedPlayer(null); viewPlayer(selectedPlayer.id); }} style={s.statsBtn}>
            <Text style={s.statsBtnText}>📊 View Full Stats</Text>
          </TouchableOpacity>
          {canEdit && (
            <TouchableOpacity onPress={() => openEdit(selectedPlayer)} style={s.editBtn}><Text style={s.editBtnText}>✏️ Edit Player</Text></TouchableOpacity>
          )}
        </FormModal>
      )}

      {/* Add/Edit Player Form */}
      <FormModal visible={showForm} title={editingPlayer ? "Edit Player" : "Add Player"} onClose={() => setShowForm(false)}>
        <FormInput label="Name" value={form.name} onChangeText={v => setForm({ ...form, name: v })} placeholder="Full name" />
        <FormInput label="Jersey Number" value={form.number} onChangeText={v => setForm({ ...form, number: v })} placeholder="#" keyboardType="numeric" />
        <FormPicker label="Primary Position" value={form.position} onSelect={v => setForm({ ...form, position: v })} options={[
          { value: "Forward", label: "Forward" }, { value: "Midfielder", label: "Midfielder" },
          { value: "Defender", label: "Defender" }, { value: "Goalkeeper", label: "Goalkeeper" },
        ]} />
        <FormCheckbox label="Can play goalkeeper" subtitle="Enable if this player can fill in as keeper" value={form.canPlayKeeper} onToggle={() => setForm({ ...form, canPlayKeeper: !form.canPlayKeeper })} />
        <FormButtons onCancel={() => setShowForm(false)} onSave={handleSave} saving={saving} saveLabel={editingPlayer ? "Update" : "Add Player"} />
      </FormModal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  header: { fontSize: 15, fontWeight: "700", color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.sm, marginTop: spacing.md },
  addBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.md },
  addBtnText: { color: colors.bg, fontSize: 13, fontWeight: "700" },
  colHeader: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8 },
  colText: { fontSize: 11, fontWeight: "600", color: colors.textDim, letterSpacing: 1 },
  numCol: { width: 44, textAlign: "center" },
  playerRow: { flexDirection: "row", alignItems: "center" },
  playerName: { fontWeight: "600", fontSize: 14, color: colors.text },
  mono: { fontFamily: "monospace", fontSize: 13 },
  dualNote: { fontSize: 11, color: colors.textDim, marginTop: 1 },
  modalLabel: { fontSize: 11, color: colors.textDim, fontWeight: "600", letterSpacing: 1, marginBottom: 10 },
  editBtn: { backgroundColor: colors.blueDim, padding: 12, borderRadius: radii.md, alignItems: "center" as const, marginTop: 8 },
  editBtnText: { color: colors.blue, fontWeight: "600", fontSize: 14 },
  statsBtn: { backgroundColor: colors.purpleDim, padding: 12, borderRadius: radii.md, alignItems: "center" as const, marginTop: 16 },
  statsBtnText: { color: colors.purple, fontWeight: "600", fontSize: 14 },
  statusToggle: { padding: 14, borderRadius: radii.md, alignItems: "center" as const, borderWidth: 1 },
  statusActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  statusInactive: { backgroundColor: colors.dangerDim, borderColor: colors.danger },
});
