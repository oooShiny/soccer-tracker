import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useSeasons, useGames, usePlayers } from "../hooks/useFirestore";
import { formatDate, isInactiveForGame, isAbsentFromGame } from "../services/utils";
import { Card, Badge } from "../components/SharedUI";
import { useGameEdit } from "../components/GameEditProvider";
import type { Game, GoalEvent, Player } from "../types";

const MEDALS = ["#FFD700", "#C0C0C0", "#CD7F32"];

type Category = "totalGoals" | "goalsPerGame" | "bestGame" | "streak" | "opening" | "winner" | "equalizer" | "keeper";

const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: "totalGoals", label: "Total Goals", icon: "⚽" },
  { id: "goalsPerGame", label: "Goals/Game", icon: "📊" },
  { id: "bestGame", label: "Best Game", icon: "🏆" },
  { id: "streak", label: "Goal Streaks", icon: "🔥" },
  { id: "opening", label: "Opening Goals", icon: "🚀" },
  { id: "winner", label: "Game Winners", icon: "🎯" },
  { id: "equalizer", label: "Equalizers", icon: "⚖️" },
  { id: "keeper", label: "Goalkeepers", icon: "🧤" },
];

// ─── Computation Functions ────────────────────────────────────────
function getPlayerGoalsInGame(game: Game, playerId: string): number {
  const tl = game.goalTimeline || [];
  if (tl.length > 0) return tl.filter(e => e.type === "for" && e.playerId === playerId).length;
  return (game.scorers || []).find(s => s.playerId === playerId)?.goals || 0;
}

function getGamesPlayed(games: Game[], players: Player[]): Record<string, number> {
  const gp: Record<string, number> = {};
  for (const game of games) {
    if (game.ourScore == null) continue;
    for (const p of players) {
      if (p.active === false) continue;
      if (isInactiveForGame(game, p)) continue;
      if (!isAbsentFromGame(game, p)) gp[p.id] = (gp[p.id] || 0) + 1;
    }
  }
  return gp;
}

interface TotalGoalsEntry { playerId: string; name: string; number: number; goals: number; games: number; perGame: number; }
function computeTotalGoals(games: Game[], players: Player[]): TotalGoalsEntry[] {
  const goalMap: Record<string, number> = {};
  const gp = getGamesPlayed(games, players);
  for (const game of games) {
    if (game.ourScore == null) continue;
    const tl = game.goalTimeline || [];
    if (tl.length > 0) { for (const e of tl) { if (e.type === "for" && e.playerId) goalMap[e.playerId] = (goalMap[e.playerId] || 0) + 1; } }
    else { for (const sc of game.scorers) goalMap[sc.playerId] = (goalMap[sc.playerId] || 0) + sc.goals; }
  }
  return Object.entries(goalMap).map(([id, goals]) => {
    const p = players.find(pl => pl.id === id);
    const g = gp[id] || 1;
    return { playerId: id, name: p?.name || "Unknown", number: p?.number || 0, goals, games: g, perGame: goals / g };
  }).sort((a, b) => b.goals - a.goals);
}

interface BestGameEntry { playerId: string; name: string; number: number; goals: number; opponent: string; date: string; score: string; }
function computeBestGames(games: Game[], players: Player[]): BestGameEntry[] {
  const bestMap: Record<string, { goals: number; game: Game }> = {};
  for (const game of games) {
    if (game.ourScore == null) continue;
    // Get all scorers in this game
    const scorerGoals: Record<string, number> = {};
    const tl = game.goalTimeline || [];
    if (tl.length > 0) { for (const e of tl) { if (e.type === "for" && e.playerId) scorerGoals[e.playerId] = (scorerGoals[e.playerId] || 0) + 1; } }
    else { for (const sc of game.scorers) scorerGoals[sc.playerId] = (scorerGoals[sc.playerId] || 0) + sc.goals; }
    for (const [pid, goals] of Object.entries(scorerGoals)) {
      if (!bestMap[pid] || goals > bestMap[pid].goals) bestMap[pid] = { goals, game };
    }
  }
  return Object.entries(bestMap).map(([id, { goals, game }]) => {
    const p = players.find(pl => pl.id === id);
    return { playerId: id, name: p?.name || "Unknown", number: p?.number || 0, goals, opponent: game.opponent, date: game.date, score: `${game.ourScore}–${game.theirScore}` };
  }).sort((a, b) => b.goals - a.goals || a.date.localeCompare(b.date));
}

// ─── Clutch goals (derived from goalTimeline) ─────────────────────
// Only games whose timeline matches the final score are used, so a partial
// timeline can't attribute a goal to the wrong player.
type ClutchKind = "opening" | "winner" | "equalizer";

function getCompleteTimeline(game: Game): GoalEvent[] | null {
  if (game.ourScore == null || game.theirScore == null) return null;
  const tl = [...(game.goalTimeline || [])].sort((a, b) => a.order - b.order);
  if (tl.length === 0) return null;
  const forCount = tl.filter(e => e.type === "for").length;
  if (forCount !== game.ourScore || tl.length - forCount !== game.theirScore) return null;
  return tl;
}

// Returns the player ids credited with a clutch goal in this game
function getClutchScorers(game: Game, kind: ClutchKind): string[] {
  const tl = getCompleteTimeline(game);
  if (!tl) return [];
  const ids: string[] = [];
  if (kind === "opening") {
    if (tl[0].type === "for" && tl[0].playerId) ids.push(tl[0].playerId);
  } else if (kind === "winner") {
    // The goal that put us one ahead of the opponent's final tally
    if (game.ourScore! > game.theirScore!) {
      let ours = 0;
      for (const e of tl) {
        if (e.type !== "for") continue;
        ours++;
        if (ours === game.theirScore! + 1) { if (e.playerId) ids.push(e.playerId); break; }
      }
    }
  } else {
    // Any goal of ours that levelled the score
    let ours = 0, theirs = 0;
    for (const e of tl) {
      if (e.type === "for") ours++; else theirs++;
      if (e.type === "for" && ours === theirs && e.playerId) ids.push(e.playerId);
    }
  }
  return ids;
}

interface ClutchEntry { playerId: string; name: string; number: number; count: number; goals: number; }
function computeClutchGoals(games: Game[], players: Player[], kind: ClutchKind, totalGoals: TotalGoalsEntry[]): ClutchEntry[] {
  const counts: Record<string, number> = {};
  for (const game of games) {
    for (const id of getClutchScorers(game, kind)) counts[id] = (counts[id] || 0) + 1;
  }
  return Object.entries(counts).map(([id, count]) => {
    const p = players.find(pl => pl.id === id);
    return { playerId: id, name: p?.name || "Unknown", number: p?.number || 0, count, goals: totalGoals.find(e => e.playerId === id)?.goals || count };
  }).sort((a, b) => b.count - a.count || b.goals - a.goals);
}

interface StreakEntry { playerId: string; name: string; number: number; longest: number; current: number; }
function computeStreaks(games: Game[], players: Player[]): StreakEntry[] {
  const sorted = [...games].filter(g => g.ourScore != null).sort((a, b) => a.date.localeCompare(b.date));
  const streakMap: Record<string, { longest: number; current: number; temp: number }> = {};

  for (const game of sorted) {
    const scoredSet = new Set<string>();
    const tl = game.goalTimeline || [];
    if (tl.length > 0) { for (const e of tl) { if (e.type === "for" && e.playerId) scoredSet.add(e.playerId); } }
    else { for (const sc of game.scorers) scoredSet.add(sc.playerId); }

    for (const p of players) {
      if (p.active === false) continue;
      if (isAbsentFromGame(game, p) || isInactiveForGame(game, p)) continue; // skip absent/inactive players
      if (!streakMap[p.id]) streakMap[p.id] = { longest: 0, current: 0, temp: 0 };
      if (scoredSet.has(p.id)) {
        streakMap[p.id].temp++;
        streakMap[p.id].longest = Math.max(streakMap[p.id].longest, streakMap[p.id].temp);
      } else {
        streakMap[p.id].temp = 0;
      }
    }
  }

  // Compute current streak (from most recent game backwards)
  const reverseSorted = [...sorted].reverse();
  for (const p of players) {
    if (!streakMap[p.id]) continue;
    let current = 0;
    for (const game of reverseSorted) {
      if (isAbsentFromGame(game, p) || isInactiveForGame(game, p)) continue;
      const scoredSet = new Set<string>();
      const tl = game.goalTimeline || [];
      if (tl.length > 0) { for (const e of tl) { if (e.type === "for" && e.playerId) scoredSet.add(e.playerId); } }
      else { for (const sc of game.scorers) scoredSet.add(sc.playerId); }
      if (scoredSet.has(p.id)) current++; else break;
    }
    streakMap[p.id].current = current;
  }

  return Object.entries(streakMap)
    .filter(([_, d]) => d.longest > 0)
    .map(([id, d]) => {
      const p = players.find(pl => pl.id === id);
      return { playerId: id, name: p?.name || "Unknown", number: p?.number || 0, longest: d.longest, current: d.current };
    })
    .sort((a, b) => b.longest - a.longest || b.current - a.current);
}

interface KeeperEntry { playerId: string; name: string; number: number; apps: number; ga: number; gaPerApp: number; saves: number; cleanSheets: number; }
function computeKeeperLeaderboard(games: Game[], players: Player[]): KeeperEntry[] {
  const keeperMap: Record<string, { apps: number; ga: number; saves: number; pctTotal: number; cleanSheets: number }> = {};

  for (const game of games) {
    if (game.ourScore == null) continue;
    for (const ka of game.keeperAppearances) {
      if (!keeperMap[ka.playerId]) keeperMap[ka.playerId] = { apps: 0, ga: 0, saves: 0, pctTotal: 0, cleanSheets: 0 };
      keeperMap[ka.playerId].apps++;
      keeperMap[ka.playerId].ga += ka.goalsAgainst;
      keeperMap[ka.playerId].saves += ka.saves;
      // Use pct if available, fall back to minutes/90 for legacy data
      const pct = ka.pct != null ? ka.pct : (ka.minutes ? Math.round((ka.minutes / 90) * 100) : 100);
      keeperMap[ka.playerId].pctTotal += pct;
      if (ka.goalsAgainst === 0 && pct >= 45) keeperMap[ka.playerId].cleanSheets++;
    }
  }

  return Object.entries(keeperMap).map(([id, d]) => {
    const p = players.find(pl => pl.id === id);
    return {
      playerId: id, name: p?.name || "Unknown", number: p?.number || 0,
      apps: d.apps, ga: d.ga,
      gaPerApp: d.apps > 0 ? d.ga / d.apps : 0,
      saves: d.saves, cleanSheets: d.cleanSheets,
    };
  }).sort((a, b) => b.cleanSheets - a.cleanSheets || a.gaPerApp - b.gaPerApp);
}

// ─── Component ────────────────────────────────────────────────────
export function LeaderboardScreen() {
  const { teamId } = useAuth();
  const { data: seasons } = useSeasons(teamId);
  const { data: allGames } = useGames(teamId);
  const { data: players } = usePlayers(teamId);
  const { viewPlayer } = useGameEdit();
  const [scope, setScope] = useState<"season" | "alltime">("season");
  const [category, setCategory] = useState<Category>("totalGoals");

  const activeSeason = seasons.find(s => s.status === "Active");
  const scopeGames = scope === "season" ? allGames.filter(g => g.seasonId === activeSeason?.id) : allGames;

  const totalGoals = useMemo(() => computeTotalGoals(scopeGames, players), [scopeGames, players]);
  const bestGames = useMemo(() => computeBestGames(scopeGames, players), [scopeGames, players]);
  const streaks = useMemo(() => computeStreaks(scopeGames, players), [scopeGames, players]);
  const opening = useMemo(() => computeClutchGoals(scopeGames, players, "opening", totalGoals), [scopeGames, players, totalGoals]);
  const winners = useMemo(() => computeClutchGoals(scopeGames, players, "winner", totalGoals), [scopeGames, players, totalGoals]);
  const equalizers = useMemo(() => computeClutchGoals(scopeGames, players, "equalizer", totalGoals), [scopeGames, players, totalGoals]);
  const keepers = useMemo(() => computeKeeperLeaderboard(scopeGames, players), [scopeGames, players]);

  const isDeactivated = (playerId: string) => scope === "alltime" && players.find(p => p.id === playerId)?.active === false;

  const Podium = ({ entries, valueKey, valueSuffix }: { entries: { playerId: string; name: string; [k: string]: any }[]; valueKey: string; valueSuffix?: string }) => (
    entries.length > 0 ? (
      <View style={st.podium}>
        {entries.slice(0, 3).map((e, i) => (
          <TouchableOpacity key={e.playerId} onPress={() => viewPlayer(e.playerId)} activeOpacity={0.7} style={[st.podiumItem, i === 0 && st.podiumFirst]}>
            <Text style={[st.medal, { color: MEDALS[i] }]}>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</Text>
            <Text style={st.podiumValue}>{typeof e[valueKey] === "number" && e[valueKey] % 1 !== 0 ? e[valueKey].toFixed(2) : e[valueKey]}</Text>
            <Text style={st.podiumName} numberOfLines={1}>{e.name.split(" ")[0]}</Text>
            {valueSuffix && <Text style={st.podiumSub}>{valueSuffix}</Text>}
            {isDeactivated(e.playerId) && <View style={{ marginTop: 4 }}><Badge color={colors.textDim} bg={colors.bg}>Deactivated</Badge></View>}
          </TouchableOpacity>
        ))}
      </View>
    ) : null
  );

  const Row = ({ entry, i, children }: { entry: { playerId: string; name: string; number: number }; i: number; children: React.ReactNode }) => (
    <TouchableOpacity onPress={() => viewPlayer(entry.playerId)} activeOpacity={0.7}>
      <Card style={{ padding: 12, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={[st.mono, { width: 28, color: i < 3 ? MEDALS[i] : colors.textDim, fontWeight: "700" }]}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontWeight: "600", fontSize: 14, color: colors.blue }}>{entry.name}</Text>
              {isDeactivated(entry.playerId) && <Badge color={colors.textDim} bg={colors.bg}>Deactivated</Badge>}
            </View>
            <Text style={{ fontSize: 11, color: colors.textDim }}>#{entry.number}</Text>
          </View>
          {children}
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={st.container}>
      <Text style={st.header}>LEADERBOARD</Text>

      {/* Scope */}
      <View style={st.toggleRow}>
        <TouchableOpacity onPress={() => setScope("season")} style={[st.toggleBtn, scope === "season" && st.toggleActive]}>
          <Text style={[st.toggleText, scope === "season" && st.toggleTextActive]}>This Season</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setScope("alltime")} style={[st.toggleBtn, scope === "alltime" && st.toggleActive]}>
          <Text style={[st.toggleText, scope === "alltime" && st.toggleTextActive]}>All Time</Text>
        </TouchableOpacity>
      </View>

      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c.id} onPress={() => setCategory(c.id)} style={[st.catPill, category === c.id && st.catPillActive]}>
              <Text style={[st.catText, category === c.id && st.catTextActive]}>{c.icon} {c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* ─── Total Goals ─────────────────────────────────────── */}
      {category === "totalGoals" && (
        <>
          <Podium entries={totalGoals} valueKey="goals" valueSuffix="goals" />
          <View style={st.tableHeader}>
            <Text style={[st.tableCol, { width: 28 }]}>#</Text>
            <Text style={[st.tableCol, { flex: 1 }]}>Player</Text>
            <Text style={[st.tableCol, st.numCol]}>G</Text>
            <Text style={[st.tableCol, st.numCol]}>GP</Text>
            <Text style={[st.tableCol, st.numCol]}>G/GP</Text>
          </View>
          {totalGoals.map((e, i) => (
            <Row key={e.playerId} entry={e} i={i}>
              <Text style={[st.mono, st.numCol, { color: colors.accent, fontWeight: "700" }]}>{e.goals}</Text>
              <Text style={[st.mono, st.numCol, { color: colors.textMuted }]}>{e.games}</Text>
              <Text style={[st.mono, st.numCol, { color: colors.textDim }]}>{e.perGame.toFixed(1)}</Text>
            </Row>
          ))}
          {totalGoals.length === 0 && <Card><Text style={st.empty}>No goals recorded yet.</Text></Card>}
        </>
      )}

      {/* ─── Goals Per Game ───────────────────────────────────── */}
      {category === "goalsPerGame" && (
        <>
          {(() => {
            const sorted = [...totalGoals].filter(e => e.games >= 2).sort((a, b) => b.perGame - a.perGame);
            return (
              <>
                <Podium entries={sorted} valueKey="perGame" valueSuffix="per game" />
                <View style={st.tableHeader}>
                  <Text style={[st.tableCol, { width: 28 }]}>#</Text>
                  <Text style={[st.tableCol, { flex: 1 }]}>Player</Text>
                  <Text style={[st.tableCol, st.numCol]}>G/GP</Text>
                  <Text style={[st.tableCol, st.numCol]}>G</Text>
                  <Text style={[st.tableCol, st.numCol]}>GP</Text>
                </View>
                {sorted.map((e, i) => (
                  <Row key={e.playerId} entry={e} i={i}>
                    <Text style={[st.mono, st.numCol, { color: colors.accent, fontWeight: "700" }]}>{e.perGame.toFixed(2)}</Text>
                    <Text style={[st.mono, st.numCol, { color: colors.textMuted }]}>{e.goals}</Text>
                    <Text style={[st.mono, st.numCol, { color: colors.textDim }]}>{e.games}</Text>
                  </Row>
                ))}
                {sorted.length === 0 && <Card><Text style={st.empty}>Need at least 2 games played to qualify.</Text></Card>}
              </>
            );
          })()}
        </>
      )}

      {/* ─── Best Single Game ─────────────────────────────────── */}
      {category === "bestGame" && (
        <>
          <Podium entries={bestGames} valueKey="goals" valueSuffix="in a game" />
          <View style={st.tableHeader}>
            <Text style={[st.tableCol, { width: 28 }]}>#</Text>
            <Text style={[st.tableCol, { flex: 1 }]}>Player</Text>
            <Text style={[st.tableCol, { width: 80 }]}>Opponent</Text>
            <Text style={[st.tableCol, st.numCol]}>G</Text>
          </View>
          {bestGames.map((e, i) => (
            <Row key={e.playerId} entry={e} i={i}>
              <View style={{ width: 80 }}>
                <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>{e.opponent}</Text>
                <Text style={{ color: colors.textDim, fontSize: 10 }}>{formatDate(e.date)}</Text>
              </View>
              <Text style={[st.mono, st.numCol, { color: colors.accent, fontWeight: "700", fontSize: 16 }]}>{e.goals}</Text>
            </Row>
          ))}
          {bestGames.length === 0 && <Card><Text style={st.empty}>No goals recorded yet.</Text></Card>}
        </>
      )}

      {/* ─── Goal Streaks ─────────────────────────────────────── */}
      {category === "streak" && (
        <>
          <Podium entries={streaks} valueKey="longest" valueSuffix="game streak" />
          <View style={st.tableHeader}>
            <Text style={[st.tableCol, { width: 28 }]}>#</Text>
            <Text style={[st.tableCol, { flex: 1 }]}>Player</Text>
            <Text style={[st.tableCol, st.numCol]}>Best</Text>
            <Text style={[st.tableCol, st.numCol]}>Current</Text>
          </View>
          {streaks.map((e, i) => (
            <Row key={e.playerId} entry={e} i={i}>
              <Text style={[st.mono, st.numCol, { color: colors.accent, fontWeight: "700" }]}>{e.longest}</Text>
              <View style={[st.numCol, { alignItems: "center" }]}>
                <Text style={[st.mono, { color: e.current > 0 ? colors.warn : colors.textDim, fontWeight: "700" }]}>{e.current}</Text>
                {e.current > 0 && e.current === e.longest && <Text style={{ fontSize: 8, color: colors.warn }}>🔥</Text>}
              </View>
            </Row>
          ))}
          {streaks.length === 0 && <Card><Text style={st.empty}>No scoring streaks yet.</Text></Card>}
        </>
      )}

      {/* ─── Clutch goals ─────────────────────────────────────── */}
      {(category === "opening" || category === "winner" || category === "equalizer") && (() => {
        const cfg = {
          opening: { entries: opening, suffix: "opening goals", blurb: "First goal of the game.", empty: "No opening goals recorded yet." },
          winner: { entries: winners, suffix: "game winners", blurb: "The goal that put us ahead for good in a win.", empty: "No game-winning goals recorded yet." },
          equalizer: { entries: equalizers, suffix: "equalizers", blurb: "Goals that tied the game after we were trailing.", empty: "No equalizers recorded yet." },
        }[category];
        return (
          <>
            <Podium entries={cfg.entries} valueKey="count" valueSuffix={cfg.suffix} />
            <Text style={st.blurb}>{cfg.blurb} Only games with a complete goal timeline are counted.</Text>
            <View style={st.tableHeader}>
              <Text style={[st.tableCol, { width: 28 }]}>#</Text>
              <Text style={[st.tableCol, { flex: 1 }]}>Player</Text>
              <Text style={[st.tableCol, st.numCol]}>Count</Text>
              <Text style={[st.tableCol, st.numCol]}>G</Text>
            </View>
            {cfg.entries.map((e, i) => (
              <Row key={e.playerId} entry={e} i={i}>
                <Text style={[st.mono, st.numCol, { color: colors.accent, fontWeight: "700" }]}>{e.count}</Text>
                <Text style={[st.mono, st.numCol, { color: colors.textMuted }]}>{e.goals}</Text>
              </Row>
            ))}
            {cfg.entries.length === 0 && <Card><Text style={st.empty}>{cfg.empty}</Text></Card>}
          </>
        );
      })()}

      {/* ─── Goalkeepers ──────────────────────────────────────── */}
      {category === "keeper" && (
        <>
          <Podium entries={keepers.map(e => ({ ...e, cleanSheetDisplay: e.cleanSheets }))} valueKey="cleanSheets" valueSuffix="clean sheets" />
          <View style={st.tableHeader}>
            <Text style={[st.tableCol, { width: 28 }]}>#</Text>
            <Text style={[st.tableCol, { flex: 1 }]}>Player</Text>
            <Text style={[st.tableCol, st.numCol]}>CS</Text>
            <Text style={[st.tableCol, st.numCol]}>GA</Text>
            <Text style={[st.tableCol, st.numCol]}>GA/G</Text>
            <Text style={[st.tableCol, st.numCol]}>Svs</Text>
          </View>
          {keepers.map((e, i) => (
            <Row key={e.playerId} entry={e} i={i}>
              <Text style={[st.mono, st.numCol, { color: colors.purple, fontWeight: "700" }]}>{e.cleanSheets}</Text>
              <Text style={[st.mono, st.numCol, { color: colors.danger }]}>{e.ga}</Text>
              <Text style={[st.mono, st.numCol, { color: e.gaPerApp <= 1 ? colors.accent : e.gaPerApp <= 2 ? colors.warn : colors.danger }]}>{e.gaPerApp.toFixed(1)}</Text>
              <Text style={[st.mono, st.numCol, { color: colors.accent }]}>{e.saves}</Text>
            </Row>
          ))}
          {keepers.length === 0 && <Card><Text style={st.empty}>No goalkeeper data yet.</Text></Card>}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  header: { fontSize: 15, fontWeight: "700", color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.md, marginTop: spacing.md },
  toggleRow: { flexDirection: "row", gap: 2, backgroundColor: colors.surface, borderRadius: radii.md, padding: 3, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: radii.sm, alignItems: "center" },
  toggleActive: { backgroundColor: colors.accentDim },
  toggleText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  toggleTextActive: { color: colors.accent },
  catPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  catPillActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  catText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  catTextActive: { color: colors.accent },
  podium: { flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: spacing.lg, marginTop: spacing.sm },
  podiumItem: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, width: 100 },
  podiumFirst: { transform: [{ scale: 1.05 }], borderColor: colors.accent },
  medal: { fontSize: 24, marginBottom: 4 },
  podiumValue: { fontSize: 28, fontWeight: "800", color: colors.text, fontFamily: "monospace" },
  podiumName: { fontSize: 13, fontWeight: "600", color: colors.textMuted, marginTop: 4 },
  podiumSub: { fontSize: 11, color: colors.textDim, marginTop: 2 },
  tableHeader: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8 },
  tableCol: { fontSize: 11, fontWeight: "600", color: colors.textDim, letterSpacing: 1 },
  numCol: { width: 48, textAlign: "center" },
  mono: { fontFamily: "monospace", fontSize: 13 },
  blurb: { fontSize: 11, color: colors.textDim, textAlign: "center", marginBottom: spacing.sm },
  empty: { color: colors.textDim, textAlign: "center" },
});
