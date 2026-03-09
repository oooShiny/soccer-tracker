import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { usePlayers } from "../hooks/useFirestore";
import { createPlayer, updatePlayer } from "../services/firestore";
import { Card, Badge, StatBox } from "../components/SharedUI";
import { FormModal, FormInput, FormPicker, FormCheckbox, FormButtons } from "../components/FormComponents";
import type { Player } from "../types";

interface PlayerForm { name: string; number: string; position: string; canPlayKeeper: boolean; }
const emptyForm = (): PlayerForm => ({ name: "", number: "", position: "Midfielder", canPlayKeeper: false });
const playerToForm = (p: Player): PlayerForm => ({ name: p.name, number: String(p.number), position: p.positions[0] || "Midfielder", canPlayKeeper: p.canPlayKeeper });

export function PlayersScreen() {
  const { teamId, canEdit } = useAuth();
  const { data: players } = usePlayers(teamId);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PlayerForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const fieldOnly = players.filter(p => !p.keeperStats);
  const keepers = players.filter(p => p.keeperStats);

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
        active: true,
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
        <Text style={[s.colText, s.numCol]}>A</Text>
        <Text style={[s.colText, s.numCol]}>GP</Text>
      </View>

      {[...fieldOnly].sort((a, b) => b.goals - a.goals).map(p => (
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
      {fieldOnly.length === 0 && <Card><Text style={{ color: colors.textDim, textAlign: "center" }}>No players added yet. Tap + to add your roster.</Text></Card>}

      {keepers.length > 0 && (
        <>
          <Text style={[s.header, { marginTop: spacing.lg }]}>GOALKEEPERS</Text>
          <View style={s.colHeader}>
            <Text style={[s.colText, { width: 36 }]}>#</Text>
            <Text style={[s.colText, { flex: 1 }]}>Player</Text>
            <Text style={[s.colText, s.numCol]}>GA</Text>
            <Text style={[s.colText, s.numCol]}>Svs</Text>
            <Text style={[s.colText, s.numCol]}>CS</Text>
            <Text style={[s.colText, s.numCol]}>GP</Text>
          </View>
          {keepers.sort((a, b) => (b.keeperStats?.appearances || 0) - (a.keeperStats?.appearances || 0)).map(p => (
            <TouchableOpacity key={p.id} onPress={() => setSelectedPlayer(p)} activeOpacity={0.7}>
              <Card style={{ padding: 12, paddingHorizontal: 16 }}>
                <View style={s.playerRow}>
                  <Text style={[s.mono, { width: 36, color: colors.textMuted }]}>{p.number}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.playerName}>{p.name}</Text>
                    {(p.goals > 0 || p.assists > 0) && <Text style={s.dualNote}>Also: {p.goals > 0 ? `${p.goals}G` : ""}{p.goals > 0 && p.assists > 0 ? " " : ""}{p.assists > 0 ? `${p.assists}A` : ""} in field</Text>}
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
        <FormModal visible={true} title={`#${selectedPlayer.number} ${selectedPlayer.name}`} onClose={() => setSelectedPlayer(null)}>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {selectedPlayer.positions.map(pos => <Badge key={pos} color={colors.textMuted} bg={colors.bg}>{pos}</Badge>)}
            {selectedPlayer.canPlayKeeper && !selectedPlayer.positions.includes("Goalkeeper") && <Badge color={colors.purple} bg={colors.purpleDim}>Can keep</Badge>}
          </View>
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
          {selectedPlayer.keeperStats && (
            <View>
              {(selectedPlayer.goals > 0 || selectedPlayer.assists > 0) && <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 16 }} />}
              <Text style={s.modalLabel}>KEEPER STATS</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 8 }}>
                <StatBox label="GA" value={selectedPlayer.keeperStats.goalsAgainst} color={colors.danger} />
                <StatBox label="Saves" value={selectedPlayer.keeperStats.saves} color={colors.accent} />
                <StatBox label="CS" value={selectedPlayer.keeperStats.cleanSheets} color={colors.purple} />
              </View>
            </View>
          )}
          <Text style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: colors.textMuted }}>{selectedPlayer.gamesPlayed} total appearances</Text>
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
  editBtn: { backgroundColor: colors.blueDim, padding: 12, borderRadius: radii.md, alignItems: "center", marginTop: 16 },
  editBtnText: { color: colors.blue, fontWeight: "600", fontSize: 14 },
});
