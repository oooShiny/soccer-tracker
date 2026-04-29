import React, { createContext, useContext, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useGames, usePlayers, useSeasons, useOpponents } from "../hooks/useFirestore";
import { createGame, updateGame, deleteGame, findOrCreateOpponent } from "../services/firestore";
import { formatDate, getResult, getResultColor, normalizeTime } from "../services/utils";
import { Badge, StatBox } from "../components/SharedUI";
import { FormModal, FormInput, FormDateInput, FormTimeInput, FormButtons, NumInput } from "../components/FormComponents";
import type { Game, GoalEvent, GameScorer, Opponent } from "../types";

// ─── Form Types ───────────────────────────────────────────────────
interface KAForm { playerId: string; minutes: string; saves: string; }
interface GameForm {
  date: string; time: string; opponent: string; notes: string;
  goalTimeline: GoalEvent[];
  keeperAppearances: KAForm[];
  absentPlayerIds: string[];
}

const emptyForm = (): GameForm => ({ date: "", time: "", opponent: "", notes: "", goalTimeline: [], keeperAppearances: [], absentPlayerIds: [] });

const gameToForm = (g: Game): GameForm => ({
  date: g.date, time: g.time || "", opponent: g.opponent, notes: g.notes || "",
  goalTimeline: g.goalTimeline || migrateToTimeline(g),
  keeperAppearances: g.keeperAppearances.map(ka => ({ playerId: ka.playerId, minutes: String(ka.minutes), saves: String(ka.saves) })),
  absentPlayerIds: g.absentPlayerIds || [],
});

// Migrate old scorer-based data to timeline format
function migrateToTimeline(g: Game): GoalEvent[] {
  const events: GoalEvent[] = [];
  let order = 1;
  // Interleave our goals and their goals roughly
  const ourGoals: GoalEvent[] = [];
  for (const sc of (g.scorers || [])) {
    for (let i = 0; i < sc.goals; i++) {
      ourGoals.push({ type: "for", playerId: sc.playerId, order: 0 });
    }
  }
  const theirCount = g.theirScore || 0;
  const theirGoals: GoalEvent[] = [];
  const firstKeeper = g.keeperAppearances?.[0]?.playerId;
  for (let i = 0; i < theirCount; i++) {
    theirGoals.push({ type: "against", keeperId: firstKeeper, order: 0 });
  }
  // Simple interleave
  const maxLen = Math.max(ourGoals.length, theirGoals.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < ourGoals.length) { ourGoals[i].order = order++; events.push(ourGoals[i]); }
    if (i < theirGoals.length) { theirGoals[i].order = order++; events.push(theirGoals[i]); }
  }
  return events;
}

// Compute scores and scorers from timeline
function timelineToScorers(timeline: GoalEvent[]): GameScorer[] {
  const map: Record<string, number> = {};
  for (const e of timeline) {
    if (e.type === "for" && e.playerId) {
      map[e.playerId] = (map[e.playerId] || 0) + 1;
    }
  }
  return Object.entries(map).map(([playerId, goals]) => ({ playerId, goals }));
}

function timelineScores(timeline: GoalEvent[]) {
  const ourScore = timeline.filter(e => e.type === "for").length;
  const theirScore = timeline.filter(e => e.type === "against").length;
  return { ourScore, theirScore };
}

function timelineKeeperGA(timeline: GoalEvent[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const e of timeline) {
    if (e.type === "against" && e.keeperId) {
      map[e.keeperId] = (map[e.keeperId] || 0) + 1;
    }
  }
  return map;
}

// ─── Context ──────────────────────────────────────────────────────
interface GameEditContextType {
  viewGame: (game: Game) => void;
  editGame: (game: Game) => void;
  newGame: (seasonId: string) => void;
  viewPlayer: (playerId: string) => void;
}

const GameEditContext = createContext<GameEditContextType>({
  viewGame: () => {}, editGame: () => {}, newGame: () => {}, viewPlayer: () => {},
});

export const useGameEdit = () => useContext(GameEditContext);

// ─── Provider ─────────────────────────────────────────────────────
export function GameEditProvider({ children }: { children: React.ReactNode }) {
  const { teamId, canEdit, user } = useAuth();
  const { data: allGames } = useGames(teamId);
  const { data: players } = usePlayers(teamId);
  const { data: seasons } = useSeasons(teamId);
  const { data: opponents } = useOpponents(teamId);

  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<GameForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [opponentHistory, setOpponentHistory] = useState<string | null>(null);
  const [formSeasonId, setFormSeasonId] = useState<string | null>(null);
  const [playerProfileId, setPlayerProfileId] = useState<string | null>(null);

  const keeperEligible = players.filter(p => p.canPlayKeeper);

  const viewGame = (game: Game) => setSelectedGame(game);
  const editGame = (game: Game) => { setEditingGame(game); setForm(gameToForm(game)); setFormSeasonId(game.seasonId); setShowForm(true); setSelectedGame(null); };
  const newGame = (seasonId: string) => { setEditingGame(null); setForm(emptyForm()); setFormSeasonId(seasonId); setShowForm(true); };
  const viewPlayer = (playerId: string) => { setPlayerProfileId(playerId); setSelectedGame(null); };

  // Current keeper from appearances (first one for simplicity, or could track active)
  const currentKeeperId = form.keeperAppearances.length > 0 ? form.keeperAppearances[0].playerId : null;

  // Opponent history — match by opponentId if available, fall back to name
  const [historyOpponentId, setHistoryOpponentId] = useState<string | null>(null);
  const getOpponentGames = (oppName: string, oppId?: string) => {
    return allGames.filter(g => {
      if (g.ourScore == null) return false;
      if (oppId && g.opponentId) return g.opponentId === oppId;
      return g.opponent.toLowerCase() === oppName.toLowerCase();
    }).sort((a, b) => b.date.localeCompare(a.date));
  };
  const opponentGames = opponentHistory ? getOpponentGames(opponentHistory, historyOpponentId || undefined) : [];
  const opponentRecord = opponentGames.reduce((a, g) => { if (g.ourScore! > g.theirScore!) a.w++; else if (g.ourScore! < g.theirScore!) a.l++; else a.d++; a.gf += g.ourScore!; a.ga += g.theirScore!; return a; }, { w: 0, d: 0, l: 0, gf: 0, ga: 0 });

  // Timeline helpers
  const addGoalFor = (playerId: string) => {
    const newTimeline = [...form.goalTimeline, { type: "for" as const, playerId, order: form.goalTimeline.length + 1 }];
    setForm({ ...form, goalTimeline: newTimeline });
  };
  const addGoalAgainst = () => {
    const keeperId = currentKeeperId || undefined;
    const newTimeline = [...form.goalTimeline, { type: "against" as const, keeperId, order: form.goalTimeline.length + 1 }];
    setForm({ ...form, goalTimeline: newTimeline });
  };
  const removeTimelineEvent = (index: number) => {
    const newTimeline = form.goalTimeline.filter((_, i) => i !== index).map((e, i) => ({ ...e, order: i + 1 }));
    setForm({ ...form, goalTimeline: newTimeline });
  };

  const scores = timelineScores(form.goalTimeline);

  const handleSave = async () => {
    if (!teamId || !user || !formSeasonId) return;
    setSaving(true);
    try {
      const gaMap = timelineKeeperGA(form.goalTimeline);
      const normalizedTime = normalizeTime(form.time);
      const opponentId = form.opponent.trim() ? await findOrCreateOpponent(teamId, form.opponent) : undefined;
      const data = {
        seasonId: formSeasonId, date: form.date, time: normalizedTime, opponent: form.opponent.trim(), opponentId, notes: form.notes,
        ourScore: scores.ourScore || null, theirScore: scores.theirScore || null,
        goalTimeline: form.goalTimeline,
        scorers: timelineToScorers(form.goalTimeline),
        assists: [],
        keeperAppearances: form.keeperAppearances.filter(k => k.playerId).map(k => ({
          playerId: k.playerId, minutes: parseInt(k.minutes) || 0,
          goalsAgainst: gaMap[k.playerId] || 0, saves: parseInt(k.saves) || 0,
        })),
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

  // ─── Player Profile Stats ──────────────────────────────────────
  const renderPlayerProfile = () => {
    if (!playerProfileId) return null;
    const player = players.find(p => p.id === playerProfileId);
    if (!player) return null;

    const playedGames = allGames.filter(g => g.ourScore != null && !(g.absentPlayerIds || []).includes(playerProfileId));

    // Goals per game
    const goalsByGame = playedGames.map(g => {
      const timeline = g.goalTimeline || [];
      const goalsInGame = timeline.filter(e => e.type === "for" && e.playerId === playerProfileId).length;
      // Fallback to scorers if no timeline
      const legacyGoals = (g.scorers || []).find(s => s.playerId === playerProfileId)?.goals || 0;
      return { game: g, goals: timeline.length > 0 ? goalsInGame : legacyGoals };
    });

    const totalGoals = goalsByGame.reduce((s, g) => s + g.goals, 0);
    const gamesWithGoals = goalsByGame.filter(g => g.goals > 0);
    const highestScoringGame = [...goalsByGame].sort((a, b) => b.goals - a.goals)[0];

    // Goal streak
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    const sortedGames = [...goalsByGame].sort((a, b) => a.game.date.localeCompare(b.game.date));
    for (const g of sortedGames) {
      if (g.goals > 0) { tempStreak++; longestStreak = Math.max(longestStreak, tempStreak); }
      else { tempStreak = 0; }
    }
    // Current streak from most recent
    for (let i = sortedGames.length - 1; i >= 0; i--) {
      if (sortedGames[i].goals > 0) currentStreak++;
      else break;
    }

    // Goals by opponent
    const goalsByOpponent: Record<string, { goals: number; games: number }> = {};
    for (const g of goalsByGame) {
      if (!goalsByOpponent[g.game.opponent]) goalsByOpponent[g.game.opponent] = { goals: 0, games: 0 };
      goalsByOpponent[g.game.opponent].goals += g.goals;
      goalsByOpponent[g.game.opponent].games++;
    }
    const oppEntries = Object.entries(goalsByOpponent).sort((a, b) => b[1].goals - a[1].goals);

    // Goals by time slot
    const goalsByTime: Record<string, number> = {};
    for (const g of goalsByGame) {
      if (g.goals > 0 && g.game.time) {
        goalsByTime[g.game.time] = (goalsByTime[g.game.time] || 0) + g.goals;
      }
    }

    const season = seasons.find(s => s.status === "Active");

    return (
      <FormModal visible={true} title={`#${player.number} ${player.name}`} onClose={() => setPlayerProfileId(null)}>
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {player.positions.map(pos => <Badge key={pos} color={colors.textMuted} bg={colors.bg}>{pos}</Badge>)}
        </View>

        {/* Summary stats */}
        <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 16 }}>
          <StatBox label="Goals" value={totalGoals} color={colors.accent} />
          <StatBox label="Games" value={playedGames.length} color={colors.text} />
          <StatBox label="G/GP" value={playedGames.length > 0 ? (totalGoals / playedGames.length).toFixed(2) : "–"} color={colors.warn} />
        </View>

        {/* Highlights */}
        <Text style={st.profileLabel}>HIGHLIGHTS</Text>
        <View style={{ gap: 8, marginBottom: 16 }}>
          {highestScoringGame && highestScoringGame.goals > 0 && (
            <View style={st.highlightRow}>
              <Text style={st.highlightIcon}>🏆</Text>
              <View>
                <Text style={st.highlightTitle}>Best Game: {highestScoringGame.goals} goal{highestScoringGame.goals > 1 ? "s" : ""}</Text>
                <Text style={st.highlightSub}>vs {highestScoringGame.game.opponent} ({formatDate(highestScoringGame.game.date)})</Text>
              </View>
            </View>
          )}
          {longestStreak > 0 && (
            <View style={st.highlightRow}>
              <Text style={st.highlightIcon}>🔥</Text>
              <View>
                <Text style={st.highlightTitle}>Longest Scoring Streak: {longestStreak} game{longestStreak > 1 ? "s" : ""}</Text>
                {currentStreak > 0 && currentStreak === longestStreak && <Text style={st.highlightSub}>Currently active!</Text>}
              </View>
            </View>
          )}
          {currentStreak > 0 && currentStreak !== longestStreak && (
            <View style={st.highlightRow}>
              <Text style={st.highlightIcon}>⚡</Text>
              <View><Text style={st.highlightTitle}>Current Streak: {currentStreak} game{currentStreak > 1 ? "s" : ""}</Text></View>
            </View>
          )}
          {gamesWithGoals.length > 0 && (
            <View style={st.highlightRow}>
              <Text style={st.highlightIcon}>🎯</Text>
              <View><Text style={st.highlightTitle}>Scored in {gamesWithGoals.length} of {playedGames.length} games ({Math.round(gamesWithGoals.length / playedGames.length * 100)}%)</Text></View>
            </View>
          )}
        </View>

        {/* Goals by opponent */}
        {oppEntries.length > 0 && (
          <>
            <Text style={st.profileLabel}>GOALS BY OPPONENT</Text>
            {oppEntries.filter(([_, d]) => d.goals > 0).map(([opp, data]) => (
              <View key={opp} style={st.oppRow}>
                <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>{opp}</Text>
                <Text style={{ fontFamily: "monospace", fontWeight: "700", color: colors.accent, fontSize: 14 }}>{data.goals}</Text>
                <Text style={{ color: colors.textDim, fontSize: 11, width: 50, textAlign: "right" }}>in {data.games}gp</Text>
              </View>
            ))}
          </>
        )}

        {/* Goals by time */}
        {Object.keys(goalsByTime).length > 1 && (
          <>
            <Text style={[st.profileLabel, { marginTop: 16 }]}>GOALS BY TIME SLOT</Text>
            {Object.entries(goalsByTime).sort((a, b) => b[1] - a[1]).map(([time, goals]) => (
              <View key={time} style={st.oppRow}>
                <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>{time}</Text>
                <Text style={{ fontFamily: "monospace", fontWeight: "700", color: colors.accent }}>{goals}</Text>
              </View>
            ))}
          </>
        )}

        {/* Recent games */}
        <Text style={[st.profileLabel, { marginTop: 16 }]}>RECENT GAMES</Text>
        {[...goalsByGame].sort((a, b) => b.game.date.localeCompare(a.game.date)).slice(0, 5).map(({ game: g, goals }) => {
          const result = getResult(g); const color = getResultColor(result);
          return (
            <View key={g.id} style={[st.recentRow, { borderLeftWidth: 3, borderLeftColor: color }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>vs {g.opponent}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>{formatDate(g.date)} • {g.ourScore}–{g.theirScore}</Text>
              </View>
              {goals > 0 ? (
                <Text style={{ fontFamily: "monospace", fontWeight: "700", color: colors.accent, fontSize: 16 }}>⚽ {goals}</Text>
              ) : (
                <Text style={{ color: colors.textDim, fontSize: 12 }}>—</Text>
              )}
            </View>
          );
        })}
      </FormModal>
    );
  };

  const st = styles;

  return (
    <GameEditContext.Provider value={{ viewGame, editGame, newGame, viewPlayer }}>
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

          {/* Goal Timeline */}
          {(() => {
            const timeline = selectedGame.goalTimeline || migrateToTimeline(selectedGame);
            if (timeline.length === 0) return null;
            return (
              <View style={{ marginTop: 12 }}>
                <Text style={st.modalLabel}>GOAL TIMELINE</Text>
                {timeline.map((e, i) => {
                  const p = e.type === "for" ? players.find(pl => pl.id === e.playerId) : null;
                  const k = e.type === "against" ? players.find(pl => pl.id === e.keeperId) : null;
                  return (
                    <View key={i} style={[st.timelineRow, { borderLeftColor: e.type === "for" ? colors.accent : colors.danger }]}>
                      <Text style={{ color: e.type === "for" ? colors.accent : colors.danger, fontWeight: "700", fontFamily: "monospace", width: 24 }}>{e.order}</Text>
                      <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>
                        {e.type === "for" ? `⚽ ${p?.name || "Unknown"}` : `❌ Goal against`}
                        {e.type === "against" && k ? <Text style={{ color: colors.textDim }}> ({k.name})</Text> : null}
                      </Text>
                      {e.type === "for" && p && (
                        <TouchableOpacity onPress={() => { setSelectedGame(null); viewPlayer(p.id); }}>
                          <Text style={{ color: colors.blue, fontSize: 12 }}>Profile →</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })()}

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
              <Text style={{ color: colors.textDim, fontSize: 14 }}>{selectedGame.absentPlayerIds.map(id => players.find(pl => pl.id === id)?.name || "Unknown").join(", ")}</Text>
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
          <TouchableOpacity onPress={() => { setSelectedGame(null); setHistoryOpponentId(selectedGame.opponentId || null); setOpponentHistory(selectedGame.opponent); }} style={st.historyBtn}>
            <Text style={st.historyBtnText}>📊 History vs {selectedGame.opponent}</Text>
          </TouchableOpacity>
          {canEdit && <TouchableOpacity onPress={() => editGame(selectedGame)} style={st.editBtn}><Text style={st.editBtnText}>✏️ Edit Game</Text></TouchableOpacity>}
        </FormModal>
      )}

      {/* ─── Opponent History ─────────────────────────────────── */}
      {opponentHistory && (
        <FormModal visible={true} title={`vs ${opponentHistory}`} onClose={() => setOpponentHistory(null)}>
          {opponentGames.length > 0 ? (
            <>
              <Text style={{ textAlign: "center", color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>All-time record</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 16 }}>
                <StatBox label="W" value={opponentRecord.w} color={colors.accent} />
                <StatBox label="T" value={opponentRecord.d} color={colors.warn} />
                <StatBox label="L" value={opponentRecord.l} color={colors.danger} />
              </View>
              {opponentGames.map(g => {
                const result = getResult(g); const color = getResultColor(result);
                return (
                  <View key={g.id} style={[st.historyRow, { borderLeftWidth: 3, borderLeftColor: color }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>{g.ourScore} – {g.theirScore}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{formatDate(g.date)}</Text>
                    </View>
                    <View style={[st.resultBadge, { backgroundColor: result === "W" ? colors.accentDim : result === "L" ? colors.dangerDim : colors.warnDim }]}>
                      <Text style={[st.resultText, { color }]}>{result === "D" ? "T" : result}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          ) : <Text style={{ color: colors.textDim, textAlign: "center", padding: 20 }}>No completed games yet.</Text>}
        </FormModal>
      )}

      {/* ─── Player Profile ───────────────────────────────────── */}
      {renderPlayerProfile()}

      {/* ─── Game Edit Form ───────────────────────────────────── */}
      <FormModal visible={showForm} title={editingGame ? "Edit Game" : "Add Game"} onClose={() => setShowForm(false)}>
        <FormDateInput label="Date" value={form.date} onChangeText={v => setForm({ ...form, date: v })} />
        <FormTimeInput label="Time" value={form.time} onChangeText={v => setForm({ ...form, time: v })} />
        <FormInput label="Opponent" value={form.opponent} onChangeText={v => setForm({ ...form, opponent: v })} placeholder="e.g. Ballhogs" />
        {/* Quick-select from known opponents */}
        {opponents.length > 0 && (
          <View style={{ marginTop: -8, marginBottom: 14 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 4 }}>
                {opponents.filter(o => !form.opponent || o.name.toLowerCase().includes(form.opponent.toLowerCase())).map(o => (
                  <TouchableOpacity key={o.id} onPress={() => setForm({ ...form, opponent: o.name })}
                    style={[st.playerChip, form.opponent === o.name && st.playerChipActive]}>
                    <Text style={[st.playerChipText, form.opponent === o.name && st.playerChipTextActive]}>{o.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Keepers (set up first so goals against can be attributed) */}
        <Text style={st.formSection}>KEEPERS</Text>
        <Text style={{ fontSize: 12, color: colors.textDim, marginBottom: 8 }}>Set keepers first so goals against are attributed correctly.</Text>
        {form.keeperAppearances.map((ka, i) => (
          <View key={i} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {keeperEligible.map(p => (
                    <TouchableOpacity key={p.id} onPress={() => { const u = [...form.keeperAppearances]; u[i].playerId = p.id; setForm({ ...form, keeperAppearances: u }); }}
                      style={[st.playerChip, ka.playerId === p.id && st.playerChipActive]}>
                      <Text style={[st.playerChipText, ka.playerId === p.id && st.playerChipTextActive]}>{p.name.split(" ")[0]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <TouchableOpacity onPress={() => setForm({ ...form, keeperAppearances: form.keeperAppearances.filter((_, j) => j !== i) })}><Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text></TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              <View style={{ alignItems: "center" }}><Text style={st.tinyLabel}>Min</Text><NumInput value={ka.minutes} onChangeText={v => { const u = [...form.keeperAppearances]; u[i].minutes = v; setForm({ ...form, keeperAppearances: u }); }} /></View>
              <View style={{ alignItems: "center" }}><Text style={st.tinyLabel}>Saves</Text><NumInput value={ka.saves} onChangeText={v => { const u = [...form.keeperAppearances]; u[i].saves = v; setForm({ ...form, keeperAppearances: u }); }} /></View>
            </View>
          </View>
        ))}
        <TouchableOpacity onPress={() => setForm({ ...form, keeperAppearances: [...form.keeperAppearances, { playerId: "", minutes: "90", saves: "0" }] })} style={st.addRow}><Text style={st.addRowText}>+ Add keeper</Text></TouchableOpacity>

        {/* ─── Goal Timeline ──────────────────────────────────── */}
        <Text style={st.formSection}>GOAL TIMELINE</Text>
        <Text style={{ fontSize: 12, color: colors.textDim, marginBottom: 4 }}>Tap a player to add a goal for your team. Use the "Goal Against" button for opponent goals.</Text>

        {/* Live score */}
        <View style={st.liveScore}>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "600" }}>US</Text>
            <Text style={[st.liveScoreNum, { color: colors.accent }]}>{scores.ourScore}</Text>
          </View>
          <Text style={{ color: colors.textDim, fontSize: 20, fontWeight: "300" }}>–</Text>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: "600" }}>THEM</Text>
            <Text style={[st.liveScoreNum, { color: colors.danger }]}>{scores.theirScore}</Text>
          </View>
        </View>

        {/* Timeline display */}
        {form.goalTimeline.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            {form.goalTimeline.map((e, i) => {
              const p = e.type === "for" ? players.find(pl => pl.id === e.playerId) : null;
              const k = e.type === "against" ? players.find(pl => pl.id === e.keeperId) : null;
              return (
                <View key={i} style={[st.timelineRow, { borderLeftColor: e.type === "for" ? colors.accent : colors.danger }]}>
                  <Text style={{ color: e.type === "for" ? colors.accent : colors.danger, fontWeight: "700", fontFamily: "monospace", width: 24 }}>{e.order}</Text>
                  <Text style={{ color: colors.text, fontSize: 14, flex: 1 }}>
                    {e.type === "for" ? `⚽ ${p?.name || "?"}` : `❌ Goal against`}
                    {e.type === "against" && k ? <Text style={{ color: colors.textDim }}> ({k.name.split(" ")[0]})</Text> : null}
                  </Text>
                  <TouchableOpacity onPress={() => removeTimelineEvent(i)} style={{ padding: 4 }}><Text style={{ color: colors.danger, fontSize: 14 }}>✕</Text></TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Goal Against button */}
        <TouchableOpacity onPress={addGoalAgainst} style={st.goalAgainstBtn} activeOpacity={0.7}>
          <Text style={st.goalAgainstText}>❌ Goal Against{currentKeeperId ? ` (${players.find(p => p.id === currentKeeperId)?.name.split(" ")[0]})` : ""}</Text>
        </TouchableOpacity>

        {/* Player grid for goals for */}
        <Text style={{ fontSize: 12, color: colors.textDim, marginTop: 8, marginBottom: 8 }}>Tap a player for a goal scored:</Text>
        <View style={st.playerGrid}>
          {players.filter(p => p.active !== false).map(p => {
            const gc = form.goalTimeline.filter(e => e.type === "for" && e.playerId === p.id).length;
            return (
              <TouchableOpacity key={p.id} onPress={() => addGoalFor(p.id)} style={[st.gridBtn, gc > 0 && st.gridBtnActive]} activeOpacity={0.6}>
                <Text style={[st.gridBtnNumber, gc > 0 && st.gridBtnNumberActive]}>{p.number}</Text>
                <Text style={[st.gridBtnName, gc > 0 && st.gridBtnNameActive]} numberOfLines={1}>{p.name.split(" ")[0]}</Text>
                {gc > 0 && <View style={st.goalBadge}><Text style={st.goalBadgeText}>{gc}</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Absent */}
        <Text style={st.formSection}>WHO'S MISSING?</Text>
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
  gridBtnAbsent: { backgroundColor: colors.dangerDim, borderColor: colors.danger, opacity: 0.85 },
  gridBtnNumber: { fontSize: 16, fontWeight: "700", fontFamily: "monospace", color: colors.textDim },
  gridBtnNumberActive: { color: colors.accent },
  gridBtnName: { fontSize: 10, color: colors.textDim, marginTop: 1 },
  gridBtnNameActive: { color: colors.accent },
  goalBadge: { position: "absolute" as const, top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: "center" as const, justifyContent: "center" as const },
  goalBadgeText: { color: colors.bg, fontSize: 11, fontWeight: "800" },
  absentBadge: { position: "absolute" as const, top: -4, right: -4, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 6, backgroundColor: colors.danger },
  playerChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  playerChipActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  playerChipText: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  playerChipTextActive: { color: colors.accent },
  tinyLabel: { fontSize: 10, color: colors.textDim, marginBottom: 2 },
  deleteBtn: { padding: 12, borderRadius: radii.md, backgroundColor: colors.dangerDim, alignItems: "center", marginTop: 12 },
  deleteBtnText: { color: colors.danger, fontWeight: "600", fontSize: 14 },
  // Timeline
  timelineRow: { flexDirection: "row" as const, alignItems: "center" as const, paddingVertical: 8, paddingHorizontal: 10, borderLeftWidth: 3, borderRadius: 6, backgroundColor: colors.bg, marginBottom: 4, gap: 8 },
  liveScore: { flexDirection: "row" as const, justifyContent: "center" as const, alignItems: "center" as const, gap: 24, paddingVertical: 12, marginBottom: 8, backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  liveScoreNum: { fontSize: 32, fontWeight: "800", fontFamily: "monospace" },
  goalAgainstBtn: { backgroundColor: colors.dangerDim, padding: 14, borderRadius: radii.md, alignItems: "center" as const, borderWidth: 1, borderColor: colors.danger, marginBottom: 4 },
  goalAgainstText: { color: colors.danger, fontWeight: "700", fontSize: 15 },
  // Player Profile
  profileLabel: { fontSize: 11, color: colors.textDim, fontWeight: "600", letterSpacing: 1, marginBottom: 8 },
  highlightRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: colors.bg, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  highlightIcon: { fontSize: 18 },
  highlightTitle: { color: colors.text, fontSize: 13, fontWeight: "600" },
  highlightSub: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  oppRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8, paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  recentRow: { backgroundColor: colors.bg, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 4, flexDirection: "row" as const, alignItems: "center" as const },
});
