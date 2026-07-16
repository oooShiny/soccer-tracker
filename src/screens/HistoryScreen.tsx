import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useGames, usePlayers } from "../hooks/useFirestore";
import { computeSeasonRecord, normalizeTime } from "../services/utils";
import { Card, StatBox, Badge } from "../components/SharedUI";
import { OpponentsSection } from "./OpponentsScreen";
import type { Game, Player } from "../types";

// ─── Team Record: game-time breakdown ──────────────────────────────
interface TimeBreakdownRow { time: string; w: number; d: number; l: number; gf: number; ga: number; total: number; pct: number }

// Minutes-since-midnight for chronological sorting; blank/unparseable times sort last
function timeToMinutes(time: string): number {
  const normalized = normalizeTime(time);
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (!match) return 24 * 60;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  if (match[3] === "AM") { if (h === 12) h = 0; } else { if (h !== 12) h += 12; }
  return h * 60 + m;
}

function computeTimeBreakdown(games: Game[]): TimeBreakdownRow[] {
  const played = games.filter(g => g.ourScore != null);
  const map: Record<string, Omit<TimeBreakdownRow, "pct">> = {};
  for (const g of played) {
    const time = normalizeTime(g.time) || "No time set";
    if (!map[time]) map[time] = { time, w: 0, d: 0, l: 0, gf: 0, ga: 0, total: 0 };
    const row = map[time];
    row.total++;
    row.gf += g.ourScore || 0;
    row.ga += g.theirScore || 0;
    if (g.ourScore! > g.theirScore!) row.w++;
    else if (g.ourScore! < g.theirScore!) row.l++;
    else row.d++;
  }
  return Object.values(map).map(r => ({ ...r, pct: r.total > 0 ? (r.w + 0.5 * r.d) / r.total : 0 }));
}

type GameTimeSortKey = "time" | "w" | "d" | "l" | "gf" | "ga" | "total" | "pct";

// ─── Attendance ─────────────────────────────────────────────────────
interface AttendanceEntry {
  playerId: string; name: string; number: number;
  attended: number; missed: number; pct: number;
  longest: number; current: number;
}

function computeAttendance(games: Game[], players: Player[]): AttendanceEntry[] {
  const played = [...games].filter(g => g.ourScore != null).sort((a, b) => a.date.localeCompare(b.date));
  return players.map(p => {
    let attended = 0, missed = 0, longest = 0, temp = 0;
    for (const g of played) {
      if ((g.absentPlayerIds || []).includes(p.id)) { missed++; temp = 0; }
      else { attended++; temp++; longest = Math.max(longest, temp); }
    }
    let current = 0;
    for (let i = played.length - 1; i >= 0; i--) {
      if ((played[i].absentPlayerIds || []).includes(p.id)) break;
      current++;
    }
    const totalPlayed = attended + missed;
    return {
      playerId: p.id, name: p.name, number: p.number,
      attended, missed, pct: totalPlayed > 0 ? attended / totalPlayed : 0,
      longest, current,
    };
  }).filter(e => e.attended + e.missed > 0);
}

type AttendanceSortKey = "name" | "attended" | "missed" | "pct" | "longest" | "current";

interface SplitRecord { gp: number; w: number; l: number; t: number; winPct: number; gd: number }
interface ImpactEntry { playerId: string; name: string; present: SplitRecord; missed: SplitRecord }

function splitRecord(games: Game[]): SplitRecord {
  const w = games.filter(g => g.ourScore! > g.theirScore!).length;
  const l = games.filter(g => g.ourScore! < g.theirScore!).length;
  const t = games.filter(g => g.ourScore! === g.theirScore!).length;
  const gf = games.reduce((s, g) => s + (g.ourScore || 0), 0);
  const ga = games.reduce((s, g) => s + (g.theirScore || 0), 0);
  const gp = games.length;
  return { gp, w, l, t, winPct: gp > 0 ? (w + 0.5 * t) / gp : 0, gd: gf - ga };
}

// For each player, splits the team's record into games they were present for vs. games they missed
function computeAttendanceImpact(games: Game[], players: Player[]): ImpactEntry[] {
  const played = games.filter(g => g.ourScore != null);
  const results: ImpactEntry[] = [];
  for (const p of players) {
    const presentGames = played.filter(g => !(g.absentPlayerIds || []).includes(p.id));
    const missedGames = played.filter(g => (g.absentPlayerIds || []).includes(p.id));
    if (presentGames.length + missedGames.length === 0) continue;
    results.push({ playerId: p.id, name: p.name, present: splitRecord(presentGames), missed: splitRecord(missedGames) });
  }
  return results;
}

type ImpactSortKey = "name" | "presentGp" | "presentW" | "presentL" | "presentT" | "presentPct" | "presentGd" | "missedGp" | "missedW" | "missedL" | "missedT" | "missedPct" | "missedGd";

function impactValue(e: ImpactEntry, key: ImpactSortKey): number | string {
  switch (key) {
    case "name": return e.name;
    case "presentGp": return e.present.gp;
    case "presentW": return e.present.w;
    case "presentL": return e.present.l;
    case "presentT": return e.present.t;
    case "presentPct": return e.present.winPct;
    case "presentGd": return e.present.gd;
    case "missedGp": return e.missed.gp;
    case "missedW": return e.missed.w;
    case "missedL": return e.missed.l;
    case "missedT": return e.missed.t;
    case "missedPct": return e.missed.winPct;
    case "missedGd": return e.missed.gd;
  }
}

// Shared header cell — sortable when given onPress, otherwise a plain label.
// Keeps every table's header row using the same padding so they all line up.
function HeaderCell({ label, width, flex, align, divider, onPress, active, asc }: {
  label: string; width?: number; flex?: number; align?: "left" | "center"; divider?: boolean;
  onPress?: () => void; active?: boolean; asc?: boolean;
}) {
  const cellStyle = [st.headerCell, divider && st.impactDivider, width ? { width } : {}, flex ? { flex } : {}];
  const text = (
    <Text style={[st.headerText, align === "left" && { textAlign: "left" }, active && { color: colors.accent }]}>
      {label}{active ? (asc ? " ↑" : " ↓") : ""}
    </Text>
  );
  if (!onPress) return <View style={cellStyle}>{text}</View>;
  return <TouchableOpacity onPress={onPress} style={cellStyle} activeOpacity={0.6}>{text}</TouchableOpacity>;
}

// ─── Component ────────────────────────────────────────────────────
export function HistoryScreen() {
  const { teamId } = useAuth();
  const { data: allGames } = useGames(teamId);
  const { data: players } = usePlayers(teamId);

  const [gtSortKey, setGtSortKey] = useState<GameTimeSortKey>("time");
  const [gtSortAsc, setGtSortAsc] = useState(true);
  const [attSortKey, setAttSortKey] = useState<AttendanceSortKey>("attended");
  const [attSortAsc, setAttSortAsc] = useState(false);
  const [impSortKey, setImpSortKey] = useState<ImpactSortKey>("presentGp");
  const [impSortAsc, setImpSortAsc] = useState(false);

  const record = computeSeasonRecord(allGames);
  const winPct = record.played > 0 ? (record.w + 0.5 * record.d) / record.played : 0;
  const timeBreakdown = computeTimeBreakdown(allGames);
  const attendance = computeAttendance(allGames, players);
  const impact = computeAttendanceImpact(allGames, players);

  const handleGtSort = (key: GameTimeSortKey) => {
    if (gtSortKey === key) setGtSortAsc(!gtSortAsc);
    else { setGtSortKey(key); setGtSortAsc(key === "time"); }
  };
  const sortedTimeBreakdown = [...timeBreakdown].sort((a, b) => {
    let cmp = gtSortKey === "time" ? timeToMinutes(a.time) - timeToMinutes(b.time) : (a[gtSortKey] as number) - (b[gtSortKey] as number);
    if (!gtSortAsc) cmp = -cmp;
    return cmp;
  });

  const handleAttSort = (key: AttendanceSortKey) => {
    if (attSortKey === key) setAttSortAsc(!attSortAsc);
    else { setAttSortKey(key); setAttSortAsc(key === "name"); }
  };
  const sortedAttendance = [...attendance].sort((a, b) => {
    let cmp = 0;
    if (attSortKey === "name") cmp = a.name.localeCompare(b.name);
    else cmp = (a[attSortKey] as number) - (b[attSortKey] as number);
    if (!attSortAsc) cmp = -cmp;
    if (cmp === 0) cmp = b.attended - a.attended;
    return cmp;
  });

  const handleImpSort = (key: ImpactSortKey) => {
    if (impSortKey === key) setImpSortAsc(!impSortAsc);
    else { setImpSortKey(key); setImpSortAsc(key === "name"); }
  };
  const sortedImpact = [...impact].sort((a, b) => {
    const av = impactValue(a, impSortKey), bv = impactValue(b, impSortKey);
    let cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    if (!impSortAsc) cmp = -cmp;
    return cmp;
  });

  const isDeactivated = (playerId: string) => players.find(p => p.id === playerId)?.active === false;

  return (
    <ScrollView style={st.container}>
      <Text style={st.header}>HISTORY</Text>

      {/* ─── Time ─────────────────────────────────────────────── */}
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          <StatBox label="W" value={record.w} color={colors.accent} />
          <StatBox label="T" value={record.d} color={colors.warn} />
          <StatBox label="L" value={record.l} color={colors.danger} />
          <StatBox label="GF" value={record.gf} color={colors.text} />
          <StatBox label="GA" value={record.ga} color={colors.text} />
        </View>
        <Text style={{ textAlign: "center", marginTop: 10, color: colors.textMuted, fontSize: 12 }}>
          {record.played} games played • {(winPct * 100).toFixed(1)}% win rate
        </Text>
      </Card>

      <Text style={st.majorHeader}>TIME</Text>

      {sortedTimeBreakdown.length > 0 && (
        <>
          <Text style={st.sectionHeader}>Game Time</Text>
          <View style={st.table}>
            <View style={st.headerRow}>
              <HeaderCell label="Game Time" flex={1} align="left" onPress={() => handleGtSort("time")} active={gtSortKey === "time"} asc={gtSortAsc} />
              <HeaderCell label="GP" width={36} onPress={() => handleGtSort("total")} active={gtSortKey === "total"} asc={gtSortAsc} />
              <HeaderCell label="W" width={32} onPress={() => handleGtSort("w")} active={gtSortKey === "w"} asc={gtSortAsc} />
              <HeaderCell label="D" width={32} onPress={() => handleGtSort("d")} active={gtSortKey === "d"} asc={gtSortAsc} />
              <HeaderCell label="L" width={32} onPress={() => handleGtSort("l")} active={gtSortKey === "l"} asc={gtSortAsc} />
              <HeaderCell label="GF" width={36} onPress={() => handleGtSort("gf")} active={gtSortKey === "gf"} asc={gtSortAsc} />
              <HeaderCell label="GA" width={36} onPress={() => handleGtSort("ga")} active={gtSortKey === "ga"} asc={gtSortAsc} />
              <HeaderCell label="PCT" width={52} onPress={() => handleGtSort("pct")} active={gtSortKey === "pct"} asc={gtSortAsc} />
            </View>
            {sortedTimeBreakdown.map((row, i) => (
              <View key={row.time} style={[st.row, i % 2 === 1 && { backgroundColor: "rgba(255,255,255,0.015)" }]}>
                <Text style={[st.nameText, { flex: 1 }]}>{row.time}</Text>
                <Text style={[st.numCell, { width: 36, color: colors.textMuted }]}>{row.total}</Text>
                <Text style={[st.numCell, { width: 32, color: colors.accent }]}>{row.w}</Text>
                <Text style={[st.numCell, { width: 32, color: colors.warn }]}>{row.d}</Text>
                <Text style={[st.numCell, { width: 32, color: colors.danger }]}>{row.l}</Text>
                <Text style={[st.numCell, { width: 36 }]}>{row.gf}</Text>
                <Text style={[st.numCell, { width: 36 }]}>{row.ga}</Text>
                <Text style={[st.numCell, { width: 52, fontWeight: "700" }]}>{row.pct.toFixed(3)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* ─── Players ──────────────────────────────────────────── */}
      <Text style={st.majorHeader}>PLAYERS</Text>
      <Text style={st.sectionHeader}>Attendance</Text>
      <View style={st.table}>
        <View style={st.headerRow}>
          <HeaderCell label="Player" flex={1} align="left" onPress={() => handleAttSort("name")} active={attSortKey === "name"} asc={attSortAsc} />
          <HeaderCell label="GP" width={40} onPress={() => handleAttSort("attended")} active={attSortKey === "attended"} asc={attSortAsc} />
          <HeaderCell label="Miss" width={44} onPress={() => handleAttSort("missed")} active={attSortKey === "missed"} asc={attSortAsc} />
          <HeaderCell label="PCT" width={52} onPress={() => handleAttSort("pct")} active={attSortKey === "pct"} asc={attSortAsc} />
          <HeaderCell label="Best" width={44} onPress={() => handleAttSort("longest")} active={attSortKey === "longest"} asc={attSortAsc} />
          <HeaderCell label="Now" width={44} onPress={() => handleAttSort("current")} active={attSortKey === "current"} asc={attSortAsc} />
        </View>
        {sortedAttendance.map((e, i) => (
          <View key={e.playerId} style={[st.row, i % 2 === 1 && { backgroundColor: "rgba(255,255,255,0.015)" }]}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={st.nameText} numberOfLines={1}>{e.name}</Text>
              {isDeactivated(e.playerId) && <Badge color={colors.textDim} bg={colors.bg}>Deactivated</Badge>}
            </View>
            <Text style={[st.numCell, { width: 40 }]}>{e.attended}</Text>
            <Text style={[st.numCell, { width: 44, color: colors.danger }]}>{e.missed}</Text>
            <Text style={[st.numCell, { width: 52, fontWeight: "700" }]}>{(e.pct * 100).toFixed(0)}%</Text>
            <Text style={[st.numCell, { width: 44, color: colors.accent }]}>{e.longest}</Text>
            <Text style={[st.numCell, { width: 44, color: e.current > 0 ? colors.warn : colors.textDim }]}>{e.current}</Text>
          </View>
        ))}
        {sortedAttendance.length === 0 && <Card><Text style={st.empty}>No attendance data yet.</Text></Card>}
      </View>

      {sortedImpact.length > 0 && (
        <>
          <Text style={[st.sectionHeader, { marginTop: spacing.lg }]}>Attendance vs Win %</Text>
          <Text style={{ fontSize: 11, color: colors.textDim, marginBottom: spacing.sm }}>How the team performs with vs. without each player.</Text>
          <View style={st.table}>
            <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexGrow: 1 }}>
              <View style={{ flex: 1 }}>
                <View style={st.headerRow}>
                  <HeaderCell label="Player" width={120} align="left" onPress={() => handleImpSort("name")} active={impSortKey === "name"} asc={impSortAsc} />
                  <HeaderCell label="GP" width={36} onPress={() => handleImpSort("presentGp")} active={impSortKey === "presentGp"} asc={impSortAsc} />
                  <HeaderCell label="W" width={30} onPress={() => handleImpSort("presentW")} active={impSortKey === "presentW"} asc={impSortAsc} />
                  <HeaderCell label="L" width={30} onPress={() => handleImpSort("presentL")} active={impSortKey === "presentL"} asc={impSortAsc} />
                  <HeaderCell label="T" width={30} onPress={() => handleImpSort("presentT")} active={impSortKey === "presentT"} asc={impSortAsc} />
                  <HeaderCell label="PCT" width={52} onPress={() => handleImpSort("presentPct")} active={impSortKey === "presentPct"} asc={impSortAsc} />
                  <HeaderCell label="GD" width={46} onPress={() => handleImpSort("presentGd")} active={impSortKey === "presentGd"} asc={impSortAsc} />
                  <HeaderCell label="Missed" width={60} divider onPress={() => handleImpSort("missedGp")} active={impSortKey === "missedGp"} asc={impSortAsc} />
                  <HeaderCell label="W" width={30} onPress={() => handleImpSort("missedW")} active={impSortKey === "missedW"} asc={impSortAsc} />
                  <HeaderCell label="L" width={30} onPress={() => handleImpSort("missedL")} active={impSortKey === "missedL"} asc={impSortAsc} />
                  <HeaderCell label="T" width={30} onPress={() => handleImpSort("missedT")} active={impSortKey === "missedT"} asc={impSortAsc} />
                  <HeaderCell label="PCT" width={52} onPress={() => handleImpSort("missedPct")} active={impSortKey === "missedPct"} asc={impSortAsc} />
                  <HeaderCell label="GD" width={46} onPress={() => handleImpSort("missedGd")} active={impSortKey === "missedGd"} asc={impSortAsc} />
                </View>
                {sortedImpact.map((e, i) => (
                  <View key={e.playerId} style={[st.row, i % 2 === 1 && { backgroundColor: "rgba(255,255,255,0.015)" }]}>
                    <Text style={[st.nameText, { width: 120 }]} numberOfLines={1}>{e.name}</Text>
                    <Text style={[st.numCell, { width: 36, color: colors.textMuted }]}>{e.present.gp}</Text>
                    <Text style={[st.numCell, st.impactCol, { color: colors.accent }]}>{e.present.w}</Text>
                    <Text style={[st.numCell, st.impactCol, { color: colors.danger }]}>{e.present.l}</Text>
                    <Text style={[st.numCell, st.impactCol, { color: colors.warn }]}>{e.present.t}</Text>
                    <Text style={[st.numCell, { width: 52, fontWeight: "700" }]}>{e.present.winPct.toFixed(3)}</Text>
                    <Text style={[st.numCell, { width: 46, color: e.present.gd > 0 ? colors.accent : e.present.gd < 0 ? colors.danger : colors.textMuted }]}>{e.present.gd > 0 ? `+${e.present.gd}` : e.present.gd}</Text>
                    <Text style={[st.numCell, st.impactDivider, { width: 60, color: colors.textMuted }]}>{e.missed.gp}</Text>
                    <Text style={[st.numCell, st.impactCol, { color: colors.accent }]}>{e.missed.w}</Text>
                    <Text style={[st.numCell, st.impactCol, { color: colors.danger }]}>{e.missed.l}</Text>
                    <Text style={[st.numCell, st.impactCol, { color: colors.warn }]}>{e.missed.t}</Text>
                    <Text style={[st.numCell, { width: 52, fontWeight: "700" }]}>{e.missed.gp > 0 ? e.missed.winPct.toFixed(3) : "–"}</Text>
                    <Text style={[st.numCell, { width: 46, color: e.missed.gd > 0 ? colors.accent : e.missed.gd < 0 ? colors.danger : colors.textMuted }]}>{e.missed.gp > 0 ? (e.missed.gd > 0 ? `+${e.missed.gd}` : e.missed.gd) : "–"}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </>
      )}

      {/* ─── Opponents ────────────────────────────────────────── */}
      <OpponentsSection />

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  header: { fontSize: 15, fontWeight: "700", color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.md, marginTop: spacing.md },
  majorHeader: { fontSize: 15, fontWeight: "700", color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.md, marginTop: spacing.lg },
  sectionHeader: { fontSize: 12, fontWeight: "700", color: colors.textDim, letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.sm },
  table: { borderRadius: radii.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.md },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg },
  headerCell: { paddingVertical: 10, paddingHorizontal: 6, justifyContent: "center" },
  headerText: { fontSize: 11, fontWeight: "700", color: colors.textDim, letterSpacing: 0.5, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10, paddingHorizontal: 6 },
  nameText: { fontSize: 13, fontWeight: "600", color: colors.text },
  numCell: { fontFamily: "monospace", fontSize: 13, fontWeight: "600", textAlign: "center", color: colors.text },
  impactCol: { width: 30 },
  impactDivider: { borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 8 },
  empty: { color: colors.textDim, textAlign: "center" },
});
