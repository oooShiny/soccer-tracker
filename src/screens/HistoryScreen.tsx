import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useGames, usePlayers } from "../hooks/useFirestore";
import { computeSeasonRecord, getTimeOfDayBucket } from "../services/utils";
import { Card, StatBox, Badge } from "../components/SharedUI";
import { OpponentsSection } from "./OpponentsScreen";
import type { Game, Player } from "../types";

// ─── Team Record: time-of-day breakdown ────────────────────────────
type Bucket = "Morning" | "Afternoon" | "Evening" | "Unknown";
const BUCKET_ORDER: Bucket[] = ["Morning", "Afternoon", "Evening", "Unknown"];

interface TimeBreakdownRow { bucket: Bucket; w: number; d: number; l: number; total: number }

function computeTimeBreakdown(games: Game[]): TimeBreakdownRow[] {
  const played = games.filter(g => g.ourScore != null);
  const map: Record<Bucket, TimeBreakdownRow> = {
    Morning: { bucket: "Morning", w: 0, d: 0, l: 0, total: 0 },
    Afternoon: { bucket: "Afternoon", w: 0, d: 0, l: 0, total: 0 },
    Evening: { bucket: "Evening", w: 0, d: 0, l: 0, total: 0 },
    Unknown: { bucket: "Unknown", w: 0, d: 0, l: 0, total: 0 },
  };
  for (const g of played) {
    const row = map[getTimeOfDayBucket(g.time) as Bucket];
    row.total++;
    if (g.ourScore! > g.theirScore!) row.w++;
    else if (g.ourScore! < g.theirScore!) row.l++;
    else row.d++;
  }
  return BUCKET_ORDER.map(b => map[b]).filter(r => r.total > 0);
}

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

interface ImpactEntry {
  playerId: string; name: string;
  attendedGames: number; winPctAttended: number;
  missedGames: number; winPctMissed: number;
}

function computeAttendanceImpact(games: Game[], players: Player[]): ImpactEntry[] {
  const played = games.filter(g => g.ourScore != null);
  const winPct = (list: Game[]) => list.length > 0 ? list.filter(g => g.ourScore! > g.theirScore!).length / list.length : 0;
  const results: ImpactEntry[] = [];
  for (const p of players) {
    const attendedGames = played.filter(g => !(g.absentPlayerIds || []).includes(p.id));
    const missedGames = played.filter(g => (g.absentPlayerIds || []).includes(p.id));
    if (missedGames.length === 0) continue; // no meaningful comparison without a missed game
    results.push({
      playerId: p.id, name: p.name,
      attendedGames: attendedGames.length, winPctAttended: winPct(attendedGames),
      missedGames: missedGames.length, winPctMissed: winPct(missedGames),
    });
  }
  return results.sort((a, b) => (b.winPctAttended - b.winPctMissed) - (a.winPctAttended - a.winPctMissed));
}

type SortKey = "name" | "attended" | "missed" | "pct" | "longest" | "current";

// ─── Component ────────────────────────────────────────────────────
export function HistoryScreen() {
  const { teamId } = useAuth();
  const { data: allGames } = useGames(teamId);
  const { data: players } = usePlayers(teamId);
  const [sortKey, setSortKey] = useState<SortKey>("attended");
  const [sortAsc, setSortAsc] = useState(false);

  const record = computeSeasonRecord(allGames);
  const winPct = record.played > 0 ? (record.w + 0.5 * record.d) / record.played : 0;
  const timeBreakdown = computeTimeBreakdown(allGames);
  const attendance = computeAttendance(allGames, players);
  const impact = computeAttendanceImpact(allGames, players);

  const sortedAttendance = [...attendance].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name") cmp = a.name.localeCompare(b.name);
    else cmp = (a[sortKey] as number) - (b[sortKey] as number);
    if (!sortAsc) cmp = -cmp;
    if (cmp === 0) cmp = b.attended - a.attended;
    return cmp;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === "name"); }
  };

  const isDeactivated = (playerId: string) => players.find(p => p.id === playerId)?.active === false;

  const SortHeader = ({ label, k, width, flex }: { label: string; k: SortKey; width?: number; flex?: number }) => (
    <TouchableOpacity onPress={() => handleSort(k)} style={[st.headerCell, width ? { width } : {}, flex ? { flex } : {}]} activeOpacity={0.6}>
      <Text style={[st.headerText, sortKey === k && { color: colors.accent }]}>
        {label}{sortKey === k ? (sortAsc ? " ↑" : " ↓") : ""}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={st.container}>
      <Text style={st.header}>HISTORY</Text>

      {/* ─── Team Record ─────────────────────────────────────── */}
      <Text style={st.sectionHeader}>TEAM RECORD</Text>
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

      {timeBreakdown.length > 0 && (
        <View style={st.table}>
          <View style={st.headerRow}>
            <Text style={[st.headerText, { flex: 1, textAlign: "left" }]}>Time of Day</Text>
            <Text style={[st.headerText, st.numCol]}>W</Text>
            <Text style={[st.headerText, st.numCol]}>D</Text>
            <Text style={[st.headerText, st.numCol]}>L</Text>
            <Text style={[st.headerText, st.numCol]}>GP</Text>
            <Text style={[st.headerText, { width: 52 }]}>PCT</Text>
          </View>
          {timeBreakdown.map((row, i) => {
            const pct = row.total > 0 ? (row.w + 0.5 * row.d) / row.total : 0;
            return (
              <View key={row.bucket} style={[st.row, i % 2 === 1 && { backgroundColor: "rgba(255,255,255,0.015)" }]}>
                <Text style={[st.nameText, { flex: 1 }]}>{row.bucket}</Text>
                <Text style={[st.numCell, st.numCol, { color: colors.accent }]}>{row.w}</Text>
                <Text style={[st.numCell, st.numCol, { color: colors.warn }]}>{row.d}</Text>
                <Text style={[st.numCell, st.numCol, { color: colors.danger }]}>{row.l}</Text>
                <Text style={[st.numCell, st.numCol, { color: colors.textMuted }]}>{row.total}</Text>
                <Text style={[st.numCell, { width: 52, fontWeight: "700" }]}>{pct.toFixed(3)}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* ─── Attendance ───────────────────────────────────────── */}
      <Text style={[st.sectionHeader, { marginTop: spacing.lg }]}>ATTENDANCE</Text>
      <View style={st.table}>
        <View style={st.headerRow}>
          <SortHeader label="Player" k="name" flex={1} />
          <SortHeader label="GP" k="attended" width={40} />
          <SortHeader label="Miss" k="missed" width={44} />
          <SortHeader label="PCT" k="pct" width={52} />
          <SortHeader label="Best" k="longest" width={44} />
          <SortHeader label="Now" k="current" width={44} />
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

      {impact.length > 0 && (
        <>
          <Text style={[st.sectionHeader, { marginTop: spacing.lg }]}>ATTENDANCE VS WIN %</Text>
          <View style={st.table}>
            <View style={st.headerRow}>
              <Text style={[st.headerText, { flex: 1, textAlign: "left" }]}>Player</Text>
              <Text style={[st.headerText, { width: 100, textAlign: "center" }]}>Win% (In)</Text>
              <Text style={[st.headerText, { width: 100, textAlign: "center" }]}>Win% (Out)</Text>
            </View>
            {impact.map((e, i) => (
              <View key={e.playerId} style={[st.row, i % 2 === 1 && { backgroundColor: "rgba(255,255,255,0.015)" }]}>
                <Text style={[st.nameText, { flex: 1 }]} numberOfLines={1}>{e.name}</Text>
                <Text style={[st.numCell, { width: 100 }]}>{(e.winPctAttended * 100).toFixed(0)}% ({e.attendedGames})</Text>
                <Text style={[st.numCell, { width: 100 }]}>{(e.winPctMissed * 100).toFixed(0)}% ({e.missedGames})</Text>
              </View>
            ))}
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
  sectionHeader: { fontSize: 12, fontWeight: "700", color: colors.textDim, letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.sm },
  table: { borderRadius: radii.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.md },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg },
  headerCell: { paddingVertical: 10, paddingHorizontal: 6, justifyContent: "center" },
  headerText: { fontSize: 11, fontWeight: "700", color: colors.textDim, letterSpacing: 0.5, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10, paddingHorizontal: 6 },
  nameText: { fontSize: 13, fontWeight: "600", color: colors.text },
  numCell: { fontFamily: "monospace", fontSize: 13, fontWeight: "600", textAlign: "center", color: colors.text },
  numCol: { width: 36 },
  empty: { color: colors.textDim, textAlign: "center" },
});
