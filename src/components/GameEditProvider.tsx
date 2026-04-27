import React, { createContext, useContext, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useGames, usePlayers, useSeasons } from "../hooks/useFirestore";
import { createGame, updateGame, deleteGame } from "../services/firestore";
import { formatDate, getResult, getResultColor } from "../services/utils";
import { Badge, StatBox } from "../components/SharedUI";
import { FormModal, FormInput, FormDateInput, FormTimeInput, FormButtons, NumInput } from "../components/FormComponents";
import type { Game } from "../types";

// ─── Form Types ───────────────────────────────────────────────────
interface GameForm {
  date: string; time: string; opponent: string; ourScore: string; theirScore: string; notes: string;
  keeperAppearances: { playerId: string; minutes: string; goalsAgainst: string; saves: string }[];
  scorers: { playerId: string; goals: string }[];
  absentPlayerIds: string[];
}

const emptyForm = (): GameForm => ({ date: "", time: "", opponent: "", ourScore: "", theirScore: "", notes: "", keeperAppearances: [], scorers: [], absentPlayerIds: [] });

const gameToForm = (g: Game): GameForm => ({
  date: g.date, time: g.time || "", opponent: g.opponent, notes: g.notes || "",
  ourScore: g.ourScore != null ? String(g.ourScore) : "", theirScore: g.theirScore != null ? String(g.theirScore) : "",
  keeperAppearances: g.keeperAppearances.map(ka => ({ playerId: ka.playerId, minutes: String(ka.minutes), goalsAgainst: String(ka.goalsAgainst), saves: String(ka.saves) })),
  scorers: g.scorers.map(s => ({ playerId: s.playerId, goals: String(s.goals) })),
  absentPlayerIds: g.absentPlayerIds || [],
});

// ─── Context ──────────────────────────────────────────────────────
interface GameEditContextType {
  viewGame: (game: Game) => void;
  editGame: (game: Game) => void;
  newGame: (seasonId: string) => void;
}

const GameEditContext = createContext<GameEditContextType>({
  viewGame: () => {}, editGame: () => {}, newGame: () => {},
});

export const useGameEdit = () => useContext(GameEditContext);

// ─── Provider ─────────────────────────────────────────────────────
export function GameEditProvider({ children }: { children: React.ReactNode }) {
  const { teamId, canEdit, user } = useAuth();
  const { data: allGames } = useGames(teamId);
  const { data: players } = usePlayers(teamId);
  const { data: seasons } = useSeasons(teamId);

  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<GameForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [opponentHistory, setOpponentHistory] = useState<string | null>(null);
  const [formSeasonId, setFormSeasonId] = useState<string | null>(null);

  const activeSeason = seasons.find(s => s.status === "Active");
  const keeperEligible = players.filter(p => p.canPlayKeeper);

  const viewGame = (game: Game) => setSelectedGame(game);
  const editGame = (game: Game) => { setEditingGame(game); setForm(gameToForm(game)); setFormSeasonId(game.seasonId); setShowForm(true); setSelectedGame(null); };
  const newGame = (seasonId: string) => { setEditingGame(null); setForm(emptyForm()); setFormSeasonId(seasonId); setShowForm(true); };

  // Opponent history
  const getOpponentGames = (opponent: string) =>
    allGames.filter(g => g.opponent.toLowerCase() === opponent.toLowerCase() && g.ourScore != null)
      .sort((a, b) => b.date.localeCompare(a.date));
  const opponentGames = opponentHistory ? getOpponentGames(opponentHistory) : [];
  const opponentRecord = opponentGames.reduce((acc, g) => {
    if (g.ourScore! > g.theirScore!) acc.w++;
    else if (g.ourScore! < g.theirScore!) acc.l++;
    else acc.d++;
    acc.gf += g.ourScore!; acc.ga += g.theirScore!;
    return acc;
  }, { w: 0, d: 0, l: 0, gf: 0, ga: 0 });

  const handleSave = async () => {
    if (!teamId || !user || !formSeasonId) return;
    setSaving(true);
    try {
      const data = {
        seasonId: formSeasonId, date: form.date, time: form.time, opponent: form.opponent, notes: form.notes,
        ourScore: form.ourScore !== "" ? parseInt(form.ourScore) : null,
        theirScore: form.theirScore !== "" ? parseInt(form.theirScore) : null,
        scorers: form.scorers.filter(s => s.playerId).map(s => ({ playerId: s.playerId, goals: parseInt(s.goals) || 1 })),
        keeperAppearances: form.keeperAppearances.filter(k => k.playerId).map(k => ({ playerId: k.playerId, minutes: parseInt(k.minutes) || 0, goalsAgainst: parseInt(k.goalsAgainst) || 0, saves: parseInt(k.saves) || 0 })),
        absentPlayerIds: form.absentPlayerIds,
      };
      if (editingGame) await updateGame(teamId, editingGame.id, data, user.uid);
      else await createGame(teamId, data as any, user.uid);
      setShowForm(false);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!teamId || !editingGame) return;
    setSaving(true);
    try { await deleteGame(teamId, editingGame.id); setShowForm(false); } catch (err) { console.error(err); }
    setSaving(false);
  };

  const st = styles;

  return (
    <GameEditContext.Provider value={{ viewGame, editGame, newGame }}>
      {children}

      {/* ─── Game Detail Modal ────────────────────────────────── */}
      {selectedGame && (
        <FormModal visible={true} title={`vs ${selectedGame.opponent}`} onClose={() => setSelectedGame(null)}>
          <Text style={{ textAlign: "center", color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>
            {formatDate(selectedGame.date)}{selectedGame.time ? ` • ${selectedGame.time}` : ""}
          </Text>
          {selectedGame.ourScore != null && (
            <Text style={[st.modalScore, { color: getResultColor(getResult(selectedGame)) }]}>{selectedGame.ourScore} – {selectedGame.theirScore}</Text>
          )}

          {selectedGame.scorers.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={st.modalLabel}>GOALS</Text>
              <Text style={{ color: colors.text, fontSize: 14 }}>⚽ {selectedGame.scorers.map(sc => { const p = players.find(pl => pl.id === sc.playerId); return `${p?.name || "Unknown"}${sc.goals > 1 ? ` (${sc.goals})` : ""}`; }).join(", ")}</Text>
            </View>
          )}
          {selectedGame.keeperAppearances.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={st.modalLabel}>GOALKEEPER{selectedGame.keeperAppearances.length > 1 ? "S" : ""}</Text>
              {selectedGame.keeperAppearances.map((ka, i) => {
                const k = players.find(p => p.id === ka.playerId);
                return (<View key={i} style={st.keeperRow}><Text style={{ color: colors.text, fontSize: 14 }}>🧤 {k?.name || "Unknown"} <Text style={{ color: colors.textMuted }}>{ka.minutes}'</Text></Text><View style={{ flexDirection: "row", gap: 12 }}><Text style={{ color: colors.danger, fontSize: 12 }}>{ka.goalsAgainst} GA</Text><Text style={{ color: colors.accent, fontSize: 12 }}>{ka.saves} Svs</Text></View></View>);
              })}
            </View>
          )}
          {selectedGame.absentPlayerIds?.length > 0 && (
            <View style={{ marginTop: 16 }}>
              <Text style={st.modalLabel}>ABSENT</Text>
              <Text style={{ color: colors.textDim, fontSize: 14 }}>{selectedGame.absentPlayerIds.map(id => { const p = players.find(pl => pl.id === id); return p?.name || "Unknown"; }).join(", ")}</Text>
            </View>
          )}
          {selectedGame.notes ? (
            <View style={{ marginTop: 16 }}>
              <Text style={st.modalLabel}>NOTES</Text>
              <View style={{ backgroundColor: colors.bg, borderRadius: radii.sm, padding: 12, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{selectedGame.notes}</Text>
              </View>
            </View>
          ) : null}
          <TouchableOpacity onPress={() => { setSelectedGame(null); setOpponentHistory(selectedGame.opponent); }} style={st.historyBtn}>
            <Text style={st.historyBtnText}>📊 History vs {selectedGame.opponent}</Text>
          </TouchableOpacity>
          {canEdit && (
            <TouchableOpacity onPress={() => editGame(selectedGame)} style={st.editBtn}><Text style={st.editBtnText}>✏️ Edit Game</Text></TouchableOpacity>
          )}
        </FormModal>
      )}

      {/* ─── Opponent History Modal ───────────────────────────── */}
      {opponentHistory && (
        <FormModal visible={true} title={`vs ${opponentHistory}`} onClose={() => setOpponentHistory(null)}>
          {opponentGames.length > 0 ? (
            <>
              <Text style={{ textAlign: "center", color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>All-time record across all seasons</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 16 }}>
                <StatBox label="W" value={opponentRecord.w} color={colors.accent} />
                <StatBox label="T" value={opponentRecord.d} color={colors.warn} />
                <StatBox label="L" value={opponentRecord.l} color={colors.danger} />
                <StatBox label="GF" value={opponentRecord.gf} color={colors.text} />
                <StatBox label="GA" value={opponentRecord.ga} color={colors.text} />
              </View>
              {opponentGames.map(g => {
                const result = getResult(g); const color = getResultColor(result);
                const season = seasons.find(s => s.id === g.seasonId);
                return (
                  <View key={g.id} style={[st.historyRow, { borderLeftWidth: 3, borderLeftColor: color }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>{g.ourScore} – {g.theirScore}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{formatDate(g.date)}{g.time ? ` • ${g.time}` : ""}{season ? ` • ${season.name}` : ""}</Text>
                    </View>
                    <View style={[st.resultBadge, { backgroundColor: result === "W" ? colors.accentDim : result === "L" ? colors.dangerDim : colors.warnDim }]}>
                      <Text style={[st.resultText, { color }]}>{result === "D" ? "T" : result}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          ) : <Text style={{ color: colors.textDim, textAlign: "center", padding: 20 }}>No completed games against {opponentHistory} yet.</Text>}
        </FormModal>
      )}

      {/* ─── Add/Edit Game Form ───────────────────────────────── */}
      <FormModal visible={showForm} title={editingGame ? "Edit Game" : "Add Game"} onClose={() => setShowForm(false)}>
        <FormDateInput label="Date" value={form.date} onChangeText={v => setForm({ ...form, date: v })} />
        <FormTimeInput label="Time" value={form.time} onChangeText={v => setForm({ ...form, time: v })} />
        <FormInput label="Opponent" value={form.opponent} onChangeText={v => setForm({ ...form, opponent: v })} placeholder="e.g. Ballhogs" />
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}><FormInput label="Our Score" value={form.ourScore} onChangeText={v => setForm({ ...form, ourScore: v })} placeholder="—" keyboardType="numeric" /></View>
          <View style={{ flex: 1 }}><FormInput label="Their Score" value={form.theirScore} onChangeText={v => setForm({ ...form, theirScore: v })} placeholder="—" keyboardType="numeric" /></View>
        </View>

        {/* Goal Scorers Grid */}
        <Text style={st.formSection}>GOAL SCORERS</Text>
        <Text style={{ fontSize: 12, color: colors.textDim, marginBottom: 10 }}>Tap a player to add a goal. Score updates automatically.</Text>
        {form.scorers.length > 0 && (
          <View style={{ marginBottom: 10 }}>
            {form.scorers.map((sc, i) => {
              const p = players.find(pl => pl.id === sc.playerId);
              return (
                <View key={i} style={st.scorerSummaryRow}>
                  <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>⚽ {p?.name || "Unknown"} <Text style={{ color: colors.accent, fontWeight: "700", fontFamily: "monospace" }}>×{sc.goals}</Text></Text>
                  <TouchableOpacity onPress={() => { const ns = form.scorers.filter((_, j) => j !== i); setForm({ ...form, scorers: ns, ourScore: String(ns.reduce((s, x) => s + (parseInt(x.goals) || 0), 0)) }); }} style={{ padding: 4 }}><Text style={{ color: colors.danger, fontSize: 16 }}>✕</Text></TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
        <View style={st.playerGrid}>
          {players.filter(p => p.active !== false).map(p => {
            const existing = form.scorers.find(sc => sc.playerId === p.id);
            const gc = existing ? parseInt(existing.goals) || 0 : 0;
            return (
              <TouchableOpacity key={p.id} onPress={() => {
                let ns; if (existing) ns = form.scorers.map(sc => sc.playerId === p.id ? { ...sc, goals: String((parseInt(sc.goals) || 0) + 1) } : sc); else ns = [...form.scorers, { playerId: p.id, goals: "1" }];
                setForm({ ...form, scorers: ns, ourScore: String(ns.reduce((s, x) => s + (parseInt(x.goals) || 0), 0)) });
              }} style={[st.gridBtn, gc > 0 && st.gridBtnActive]} activeOpacity={0.6}>
                <Text style={[st.gridBtnNumber, gc > 0 && st.gridBtnNumberActive]}>{p.number}</Text>
                <Text style={[st.gridBtnName, gc > 0 && st.gridBtnNameActive]} numberOfLines={1}>{p.name.split(" ")[0]}</Text>
                {gc > 0 && <View style={st.goalBadge}><Text style={st.goalBadgeText}>{gc}</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Keepers */}
        <Text style={st.formSection}>KEEPER APPEARANCES</Text>
        <Text style={{ fontSize: 12, color: colors.textDim, marginBottom: 8 }}>GA updates "Their Score" automatically.</Text>
        {form.keeperAppearances.map((ka, i) => (
          <View key={i} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    {keeperEligible.map(p => (
                      <TouchableOpacity key={p.id} onPress={() => { const u = [...form.keeperAppearances]; u[i].playerId = p.id; setForm({ ...form, keeperAppearances: u }); }}
                        style={[st.playerChip, ka.playerId === p.id && st.playerChipActive]}>
                        <Text style={[st.playerChipText, ka.playerId === p.id && st.playerChipTextActive]}>{p.name.split(" ")[0]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <TouchableOpacity onPress={() => { const nk = form.keeperAppearances.filter((_, j) => j !== i); setForm({ ...form, keeperAppearances: nk, theirScore: String(nk.reduce((s, k) => s + (parseInt(k.goalsAgainst) || 0), 0)) }); }}><Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text></TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              <View style={{ alignItems: "center" }}><Text style={st.tinyLabel}>Min</Text><NumInput value={ka.minutes} onChangeText={v => { const u = [...form.keeperAppearances]; u[i].minutes = v; setForm({ ...form, keeperAppearances: u }); }} /></View>
              <View style={{ alignItems: "center" }}><Text style={st.tinyLabel}>GA</Text><NumInput value={ka.goalsAgainst} onChangeText={v => { const u = [...form.keeperAppearances]; u[i].goalsAgainst = v; const nk = [...form.keeperAppearances]; nk[i].goalsAgainst = v; setForm({ ...form, keeperAppearances: nk, theirScore: String(nk.reduce((s, k) => s + (parseInt(k.goalsAgainst) || 0), 0)) }); }} /></View>
              <View style={{ alignItems: "center" }}><Text style={st.tinyLabel}>Saves</Text><NumInput value={ka.saves} onChangeText={v => { const u = [...form.keeperAppearances]; u[i].saves = v; setForm({ ...form, keeperAppearances: u }); }} /></View>
            </View>
          </View>
        ))}
        <TouchableOpacity onPress={() => setForm({ ...form, keeperAppearances: [...form.keeperAppearances, { playerId: "", minutes: "90", goalsAgainst: "0", saves: "0" }] })} style={st.addRow}><Text style={st.addRowText}>+ Add keeper</Text></TouchableOpacity>

        {/* Absent */}
        <Text style={st.formSection}>WHO'S MISSING?</Text>
        <Text style={{ fontSize: 12, color: colors.textDim, marginBottom: 10 }}>Tap players who aren't at this game.</Text>
        <View style={st.playerGrid}>
          {players.filter(p => p.active !== false).map(p => {
            const isAbsent = form.absentPlayerIds.includes(p.id);
            return (
              <TouchableOpacity key={p.id} onPress={() => setForm({ ...form, absentPlayerIds: isAbsent ? form.absentPlayerIds.filter(id => id !== p.id) : [...form.absentPlayerIds, p.id] })}
                style={[st.gridBtn, isAbsent && st.gridBtnAbsent]} activeOpacity={0.6}>
                <Text style={[st.gridBtnNumber, isAbsent && { color: colors.danger }]}>{p.number}</Text>
                <Text style={[st.gridBtnName, isAbsent && { color: colors.danger }]} numberOfLines={1}>{p.name.split(" ")[0]}</Text>
                {isAbsent && <View style={st.absentBadge}><Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>OUT</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        <FormInput label="Notes" value={form.notes} onChangeText={v => setForm({ ...form, notes: v })} placeholder="How did the game go?" multiline />
        {editingGame && canEdit && <TouchableOpacity onPress={handleDelete} style={st.deleteBtn}><Text style={st.deleteBtnText}>Delete Game</Text></TouchableOpacity>}
        <FormButtons onCancel={() => setShowForm(false)} onSave={handleSave} saving={saving} saveLabel={editingGame ? "Update" : "Add Game"} />
      </FormModal>
    </GameEditContext.Provider>
  );
}

const styles = StyleSheet.create({
  modalScore: { fontSize: 42, fontWeight: "800", fontFamily: "monospace", textAlign: "center", marginBottom: 8 },
  modalLabel: { fontSize: 11, color: colors.textDim, fontWeight: "600", letterSpacing: 1, marginBottom: 6 },
  keeperRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 10, borderRadius: 10, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  historyBtn: { backgroundColor: colors.purpleDim, padding: 12, borderRadius: radii.md, alignItems: "center", marginTop: 16 },
  historyBtnText: { color: colors.purple, fontWeight: "600", fontSize: 14 },
  editBtn: { backgroundColor: colors.blueDim, padding: 12, borderRadius: radii.md, alignItems: "center", marginTop: 8 },
  editBtnText: { color: colors.blue, fontWeight: "600", fontSize: 14 },
  historyRow: { backgroundColor: colors.bg, borderRadius: radii.sm, padding: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  resultBadge: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  resultText: { fontWeight: "700", fontSize: 12, fontFamily: "monospace" },
  formSection: { fontSize: 11, color: colors.textDim, fontWeight: "600", letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  addRow: { padding: 8, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: 8, alignItems: "center", marginBottom: 8 },
  addRowText: { color: colors.textMuted, fontSize: 12 },
  playerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  gridBtn: { width: 72, height: 64, borderRadius: radii.sm, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", position: "relative" as const },
  gridBtnActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  gridBtnAssistActive: { backgroundColor: colors.blueDim, borderColor: colors.blue },
  gridBtnAbsent: { backgroundColor: colors.dangerDim, borderColor: colors.danger, opacity: 0.85 },
  gridBtnNumber: { fontSize: 16, fontWeight: "700", fontFamily: "monospace", color: colors.textDim },
  gridBtnNumberActive: { color: colors.accent },
  gridBtnName: { fontSize: 10, color: colors.textDim, marginTop: 1 },
  gridBtnNameActive: { color: colors.accent },
  goalBadge: { position: "absolute" as const, top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: "center" as const, justifyContent: "center" as const },
  goalBadgeText: { color: colors.bg, fontSize: 11, fontWeight: "800" },
  absentBadge: { position: "absolute" as const, top: -4, right: -4, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6, backgroundColor: colors.danger },
  scorerSummaryRow: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, marginBottom: 4 },
  playerChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  playerChipActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  playerChipText: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  playerChipTextActive: { color: colors.accent },
  tinyLabel: { fontSize: 10, color: colors.textDim, marginBottom: 2 },
  deleteBtn: { padding: 12, borderRadius: radii.md, backgroundColor: colors.dangerDim, alignItems: "center", marginTop: 12 },
  deleteBtnText: { color: colors.danger, fontWeight: "600", fontSize: 14 },
});
