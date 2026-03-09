import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useSeasons, useGames, usePlayers } from "../hooks/useFirestore";
import { createGame, updateGame, deleteGame } from "../services/firestore";
import { formatDate, getResult, getResultColor } from "../services/utils";
import { Card, Badge } from "../components/SharedUI";
import { FormModal, FormInput, FormButtons, NumInput } from "../components/FormComponents";
import type { Game, KeeperAppearance, GameScorer, GameAssist } from "../types";

interface GameForm {
  date: string;
  opponent: string;
  ourScore: string;
  theirScore: string;
  keeperAppearances: { playerId: string; minutes: string; goalsAgainst: string; saves: string }[];
  scorers: { playerId: string; goals: string }[];
  assists: { playerId: string; count: string }[];
}

const emptyForm = (): GameForm => ({
  date: "", opponent: "", ourScore: "", theirScore: "",
  keeperAppearances: [], scorers: [], assists: [],
});

const gameToForm = (g: Game): GameForm => ({
  date: g.date, opponent: g.opponent,
  ourScore: g.ourScore != null ? String(g.ourScore) : "",
  theirScore: g.theirScore != null ? String(g.theirScore) : "",
  keeperAppearances: g.keeperAppearances.map(ka => ({ playerId: ka.playerId, minutes: String(ka.minutes), goalsAgainst: String(ka.goalsAgainst), saves: String(ka.saves) })),
  scorers: g.scorers.map(s => ({ playerId: s.playerId, goals: String(s.goals) })),
  assists: g.assists.map(a => ({ playerId: a.playerId, count: String(a.count) })),
});

export function GamesScreen() {
  const { teamId, canEdit, user } = useAuth();
  const { data: seasons } = useSeasons(teamId);
  const { data: games } = useGames(teamId);
  const { data: players } = usePlayers(teamId);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [editingGame, setEditingGame] = useState<Game | null>(null); // null = new game
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<GameForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  const activeSeason = seasons.find(s => s.status === "Active");
  const currentSeasonId = selectedSeasonId || activeSeason?.id;
  const filtered = games.filter(g => g.seasonId === currentSeasonId).sort((a, b) => b.date.localeCompare(a.date));
  const keeperEligible = players.filter(p => p.canPlayKeeper);

  const openNew = () => { setEditingGame(null); setForm(emptyForm()); setShowForm(true); };
  const openEdit = (g: Game) => { setEditingGame(g); setForm(gameToForm(g)); setShowForm(true); setSelectedGame(null); };

  const handleSave = async () => {
    if (!teamId || !user) return;
    setSaving(true);
    try {
      const data = {
        seasonId: currentSeasonId!,
        date: form.date,
        opponent: form.opponent,
        ourScore: form.ourScore !== "" ? parseInt(form.ourScore) : null,
        theirScore: form.theirScore !== "" ? parseInt(form.theirScore) : null,
        scorers: form.scorers.filter(s => s.playerId).map(s => ({ playerId: s.playerId, goals: parseInt(s.goals) || 1 })),
        assists: form.assists.filter(a => a.playerId).map(a => ({ playerId: a.playerId, count: parseInt(a.count) || 1 })),
        keeperAppearances: form.keeperAppearances.filter(k => k.playerId).map(k => ({
          playerId: k.playerId, minutes: parseInt(k.minutes) || 0,
          goalsAgainst: parseInt(k.goalsAgainst) || 0, saves: parseInt(k.saves) || 0,
        })),
      };
      if (editingGame) {
        await updateGame(teamId, editingGame.id, data, user.uid);
      } else {
        await createGame(teamId, data as any, user.uid);
      }
      setShowForm(false);
    } catch (err: any) {
      console.error("Save failed:", err);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!teamId || !editingGame) return;
    setSaving(true);
    try {
      await deleteGame(teamId, editingGame.id);
      setShowForm(false);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  // Player picker helper
  const PlayerSelect = ({ value, onSelect, label }: { value: string; onSelect: (id: string) => void; label: string }) => (
    <View style={s.playerSelect}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {players.map(p => (
            <TouchableOpacity key={p.id} onPress={() => onSelect(p.id)}
              style={[s.playerChip, value === p.id && s.playerChipActive]}>
              <Text style={[s.playerChipText, value === p.id && s.playerChipTextActive]}>
                {p.number} {p.name.split(" ")[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <ScrollView style={s.container}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={s.header}>MATCH RESULTS</Text>
        {canEdit && (
          <TouchableOpacity onPress={openNew} style={s.addBtn}><Text style={s.addBtnText}>+ Add Game</Text></TouchableOpacity>
        )}
      </View>

      {/* Season filter */}
      {seasons.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {seasons.map(season => (
              <TouchableOpacity key={season.id} onPress={() => setSelectedSeasonId(season.id)}
                style={[s.filterPill, currentSeasonId === season.id && s.filterPillActive]}>
                <Text style={[s.filterText, currentSeasonId === season.id && s.filterTextActive]}>{season.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Games list */}
      {filtered.map(g => {
        const result = getResult(g); const color = getResultColor(result);
        const played = g.ourScore != null; const multi = (g.keeperAppearances?.length || 0) > 1;
        return (
          <TouchableOpacity key={g.id} onPress={() => played ? setSelectedGame(g) : canEdit ? openEdit(g) : null} activeOpacity={0.7}>
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
                      {multi && <Badge color={colors.purple} bg={colors.purpleDim}>Split GK</Badge>}
                    </View>
                  </View>
                </View>
                {played ? (
                  <Text style={[s.score, { color }]}>{g.ourScore} – {g.theirScore}</Text>
                ) : <Badge color={colors.blue} bg={colors.blueDim}>Upcoming</Badge>}
              </View>
            </Card>
          </TouchableOpacity>
        );
      })}
      {filtered.length === 0 && <Card><Text style={{ color: colors.textDim, textAlign: "center" }}>No games for this season yet.</Text></Card>}

      {/* Game Detail Modal (read-only with edit button) */}
      {selectedGame && (
        <FormModal visible={true} title={`vs ${selectedGame.opponent}`} onClose={() => setSelectedGame(null)}>
          <Text style={{ textAlign: "center", color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>{formatDate(selectedGame.date)}</Text>
          <Text style={[s.modalScore, { color: getResultColor(getResult(selectedGame)) }]}>{selectedGame.ourScore} – {selectedGame.theirScore}</Text>

          {selectedGame.scorers.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={s.modalLabel}>GOALS</Text>
              <Text style={{ color: colors.text, fontSize: 14 }}>⚽ {selectedGame.scorers.map(sc => { const p = players.find(pl => pl.id === sc.playerId); return `${p?.name || "Unknown"}${sc.goals > 1 ? ` (${sc.goals})` : ""}`; }).join(", ")}</Text>
            </View>
          )}
          {selectedGame.assists.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={s.modalLabel}>ASSISTS</Text>
              <Text style={{ color: colors.text, fontSize: 14 }}>👟 {selectedGame.assists.map(a => { const p = players.find(pl => pl.id === a.playerId); return `${p?.name || "Unknown"}${a.count > 1 ? ` (${a.count})` : ""}`; }).join(", ")}</Text>
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
          {canEdit && (
            <View style={{ marginTop: 16 }}>
              <TouchableOpacity onPress={() => openEdit(selectedGame)} style={s.editBtn}>
                <Text style={s.editBtnText}>✏️ Edit Game</Text>
              </TouchableOpacity>
            </View>
          )}
        </FormModal>
      )}

      {/* Add/Edit Game Form */}
      <FormModal visible={showForm} title={editingGame ? "Edit Game" : "Add Game"} onClose={() => setShowForm(false)}>
        <FormInput label="Date" value={form.date} onChangeText={v => setForm({ ...form, date: v })} placeholder="YYYY-MM-DD" />
        <FormInput label="Opponent" value={form.opponent} onChangeText={v => setForm({ ...form, opponent: v })} placeholder="e.g. Ballhogs" />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}><FormInput label="Our Score" value={form.ourScore} onChangeText={v => setForm({ ...form, ourScore: v })} placeholder="—" keyboardType="numeric" /></View>
          <View style={{ flex: 1 }}><FormInput label="Their Score" value={form.theirScore} onChangeText={v => setForm({ ...form, theirScore: v })} placeholder="—" keyboardType="numeric" /></View>
        </View>

        {/* Scorers */}
        <Text style={s.formSection}>GOAL SCORERS</Text>
        {form.scorers.map((sc, i) => (
          <View key={i} style={s.rowWithRemove}>
            <View style={{ flex: 1 }}>
              <PlayerSelect value={sc.playerId} onSelect={id => { const u = [...form.scorers]; u[i].playerId = id; setForm({ ...form, scorers: u }); }} label="Player" />
            </View>
            <NumInput value={sc.goals} onChangeText={v => { const u = [...form.scorers]; u[i].goals = v; setForm({ ...form, scorers: u }); }} placeholder="G" width={44} />
            <TouchableOpacity onPress={() => setForm({ ...form, scorers: form.scorers.filter((_, j) => j !== i) })}><Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text></TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={() => setForm({ ...form, scorers: [...form.scorers, { playerId: "", goals: "1" }] })} style={s.addRow}>
          <Text style={s.addRowText}>+ Add scorer</Text>
        </TouchableOpacity>

        {/* Assists */}
        <Text style={s.formSection}>ASSISTS</Text>
        {form.assists.map((a, i) => (
          <View key={i} style={s.rowWithRemove}>
            <View style={{ flex: 1 }}>
              <PlayerSelect value={a.playerId} onSelect={id => { const u = [...form.assists]; u[i].playerId = id; setForm({ ...form, assists: u }); }} label="Player" />
            </View>
            <NumInput value={a.count} onChangeText={v => { const u = [...form.assists]; u[i].count = v; setForm({ ...form, assists: u }); }} placeholder="A" width={44} />
            <TouchableOpacity onPress={() => setForm({ ...form, assists: form.assists.filter((_, j) => j !== i) })}><Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text></TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={() => setForm({ ...form, assists: [...form.assists, { playerId: "", count: "1" }] })} style={s.addRow}>
          <Text style={s.addRowText}>+ Add assist</Text>
        </TouchableOpacity>

        {/* Keepers */}
        <Text style={s.formSection}>KEEPER APPEARANCES</Text>
        <Text style={{ fontSize: 12, color: colors.textDim, marginBottom: 8 }}>Add one or more keepers with minutes played.</Text>
        {form.keeperAppearances.map((ka, i) => (
          <View key={i} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    {keeperEligible.map(p => (
                      <TouchableOpacity key={p.id} onPress={() => { const u = [...form.keeperAppearances]; u[i].playerId = p.id; setForm({ ...form, keeperAppearances: u }); }}
                        style={[s.playerChip, ka.playerId === p.id && s.playerChipActive]}>
                        <Text style={[s.playerChipText, ka.playerId === p.id && s.playerChipTextActive]}>{p.name.split(" ")[0]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <TouchableOpacity onPress={() => setForm({ ...form, keeperAppearances: form.keeperAppearances.filter((_, j) => j !== i) })}><Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text></TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              <View style={{ alignItems: "center" }}><Text style={s.tinyLabel}>Min</Text><NumInput value={ka.minutes} onChangeText={v => { const u = [...form.keeperAppearances]; u[i].minutes = v; setForm({ ...form, keeperAppearances: u }); }} /></View>
              <View style={{ alignItems: "center" }}><Text style={s.tinyLabel}>GA</Text><NumInput value={ka.goalsAgainst} onChangeText={v => { const u = [...form.keeperAppearances]; u[i].goalsAgainst = v; setForm({ ...form, keeperAppearances: u }); }} /></View>
              <View style={{ alignItems: "center" }}><Text style={s.tinyLabel}>Saves</Text><NumInput value={ka.saves} onChangeText={v => { const u = [...form.keeperAppearances]; u[i].saves = v; setForm({ ...form, keeperAppearances: u }); }} /></View>
            </View>
          </View>
        ))}
        <TouchableOpacity onPress={() => setForm({ ...form, keeperAppearances: [...form.keeperAppearances, { playerId: "", minutes: "90", goalsAgainst: "0", saves: "0" }] })} style={s.addRow}>
          <Text style={s.addRowText}>+ Add keeper</Text>
        </TouchableOpacity>

        {editingGame && canEdit && (
          <TouchableOpacity onPress={handleDelete} style={s.deleteBtn}><Text style={s.deleteBtnText}>Delete Game</Text></TouchableOpacity>
        )}
        <FormButtons onCancel={() => setShowForm(false)} onSave={handleSave} saving={saving} saveLabel={editingGame ? "Update" : "Add Game"} />
      </FormModal>

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
  resultBadge: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  resultText: { fontWeight: "700", fontSize: 12, fontFamily: "monospace" },
  opponent: { fontWeight: "600", fontSize: 15, color: colors.text },
  dateText: { color: colors.textMuted, fontSize: 12 },
  score: { fontFamily: "monospace", fontSize: 22, fontWeight: "700" },
  modalScore: { fontSize: 42, fontWeight: "800", fontFamily: "monospace", textAlign: "center", marginBottom: 8 },
  modalLabel: { fontSize: 11, color: colors.textDim, fontWeight: "600", letterSpacing: 1, marginBottom: 6 },
  keeperRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 10, borderRadius: 10, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  editBtn: { backgroundColor: colors.blueDim, padding: 12, borderRadius: radii.md, alignItems: "center" },
  editBtnText: { color: colors.blue, fontWeight: "600", fontSize: 14 },
  formSection: { fontSize: 11, color: colors.textDim, fontWeight: "600", letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  rowWithRemove: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  addRow: { padding: 8, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: 8, alignItems: "center", marginBottom: 8 },
  addRowText: { color: colors.textMuted, fontSize: 12 },
  playerSelect: { marginBottom: 4 },
  playerChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  playerChipActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  playerChipText: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  playerChipTextActive: { color: colors.accent },
  tinyLabel: { fontSize: 10, color: colors.textDim, marginBottom: 2 },
  deleteBtn: { padding: 12, borderRadius: radii.md, backgroundColor: colors.dangerDim, alignItems: "center", marginTop: 12 },
  deleteBtnText: { color: colors.danger, fontWeight: "600", fontSize: 14 },
});
