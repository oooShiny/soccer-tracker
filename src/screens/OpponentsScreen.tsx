import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useGames, useOpponents, useSeasons } from "../hooks/useFirestore";
import { formatDate, getResult, getResultColor } from "../services/utils";
import { Card } from "../components/SharedUI";
import type { Game, Opponent } from "../types";

interface OpponentRecord {
  id: string;
  name: string;
  games: Game[];
  w: number; d: number; l: number;
  gf: number; ga: number; gd: number;
  total: number;
  winPct: number;
}

function computeRecords(opponents: Opponent[], allGames: Game[]): OpponentRecord[] {
  const records: OpponentRecord[] = [];
  const seen = new Set<string>();

  // From opponents collection
  for (const opp of opponents) {
    const games = allGames.filter(g => {
      if (g.ourScore == null) return false;
      if (g.opponentId) return g.opponentId === opp.id;
      return g.opponent.toLowerCase() === opp.name.toLowerCase();
    }).sort((a, b) => b.date.localeCompare(a.date));
    if (games.length === 0) continue;
    seen.add(opp.name.toLowerCase());
    const w = games.filter(g => g.ourScore! > g.theirScore!).length;
    const d = games.filter(g => g.ourScore! === g.theirScore!).length;
    const l = games.filter(g => g.ourScore! < g.theirScore!).length;
    const gf = games.reduce((s, g) => s + (g.ourScore || 0), 0);
    const ga = games.reduce((s, g) => s + (g.theirScore || 0), 0);
    const total = w + d + l;
    records.push({ id: opp.id, name: opp.name, games, w, d, l, gf, ga, gd: gf - ga, total, winPct: total > 0 ? (w + 0.5 * d) / total : 0 });
  }

  // Legacy (not in opponents collection)
  const legacyNames = new Set<string>();
  for (const g of allGames) {
    if (g.ourScore == null || !g.opponent || g.opponent === "TBD") continue;
    if (g.opponentId && opponents.some(o => o.id === g.opponentId)) continue;
    if (seen.has(g.opponent.toLowerCase())) continue;
    legacyNames.add(g.opponent);
  }
  for (const name of legacyNames) {
    const games = allGames.filter(g => g.ourScore != null && !g.opponentId && g.opponent === name).sort((a, b) => b.date.localeCompare(a.date));
    if (games.length === 0) continue;
    const w = games.filter(g => g.ourScore! > g.theirScore!).length;
    const d = games.filter(g => g.ourScore! === g.theirScore!).length;
    const l = games.filter(g => g.ourScore! < g.theirScore!).length;
    const gf = games.reduce((s, g) => s + (g.ourScore || 0), 0);
    const ga = games.reduce((s, g) => s + (g.theirScore || 0), 0);
    const total = w + d + l;
    records.push({ id: `legacy-${name}`, name, games, w, d, l, gf, ga, gd: gf - ga, total, winPct: total > 0 ? (w + 0.5 * d) / total : 0 });
  }

  return records;
}

type SortKey = "name" | "w" | "l" | "d" | "gf" | "ga" | "gd" | "total" | "winPct";

export function OpponentsSection() {
  const { teamId } = useAuth();
  const { data: opponents } = useOpponents(teamId);
  const { data: allGames } = useGames(teamId);
  const { data: seasons } = useSeasons(teamId);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("winPct");
  const [sortAsc, setSortAsc] = useState(false);

  const records = computeRecords(opponents, allGames);

  const sorted = [...records].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name") cmp = a.name.localeCompare(b.name);
    else cmp = (a[sortKey] as number) - (b[sortKey] as number);
    if (!sortAsc) cmp = -cmp;
    if (cmp === 0) cmp = (b.gd) - (a.gd); // tiebreak by goal differential
    if (cmp === 0) cmp = b.total - a.total; // then by games played
    return cmp;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === "name"); }
  };

  const SortHeader = ({ label, k, width, flex }: { label: string; k: SortKey; width?: number; flex?: number }) => (
    <TouchableOpacity onPress={() => handleSort(k)} style={[st.headerCell, width ? { width } : {}, flex ? { flex } : {}]} activeOpacity={0.6}>
      <Text style={[st.headerText, sortKey === k && { color: colors.accent }]}>
        {label}{sortKey === k ? (sortAsc ? " ↑" : " ↓") : ""}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={st.container}>
      <Text style={st.header}>OPPONENTS</Text>

      {/* Table */}
      <View style={st.table}>
        {/* Header row */}
        <View style={st.headerRow}>
          <SortHeader label="Team" k="name" flex={1} />
          <SortHeader label="W" k="w" width={36} />
          <SortHeader label="L" k="l" width={36} />
          <SortHeader label="T" k="d" width={36} />
          <SortHeader label="GF" k="gf" width={36} />
          <SortHeader label="GA" k="ga" width={36} />
          <SortHeader label="GD" k="gd" width={36} />
          <SortHeader label="GP" k="total" width={36} />
          <SortHeader label="PCT" k="winPct" width={48} />
        </View>

        {/* Data rows */}
        {sorted.map((r, i) => {
          const isExpanded = expandedId === r.id;
          const pctColor = r.winPct >= 0.600 ? colors.accent : r.winPct >= 0.400 ? colors.warn : colors.danger;
          return (
            <View key={r.id}>
              <TouchableOpacity
                onPress={() => setExpandedId(isExpanded ? null : r.id)}
                activeOpacity={0.7}
                style={[st.row, i % 2 === 1 && { backgroundColor: "rgba(255,255,255,0.015)" }, isExpanded && { backgroundColor: colors.accentDim }]}
              >
                <View style={[st.cell, { flex: 1 }]}>
                  <Text style={st.nameText} numberOfLines={1}>{r.name}</Text>
                </View>
                <Text style={[st.cell, st.numCell, { width: 36, color: colors.accent }]}>{r.w}</Text>
                <Text style={[st.cell, st.numCell, { width: 36, color: colors.danger }]}>{r.l}</Text>
                <Text style={[st.cell, st.numCell, { width: 36, color: colors.warn }]}>{r.d}</Text>
                <Text style={[st.cell, st.numCell, { width: 36 }]}>{r.gf}</Text>
                <Text style={[st.cell, st.numCell, { width: 36 }]}>{r.ga}</Text>
                <Text style={[st.cell, st.numCell, { width: 36, color: r.gd > 0 ? colors.accent : r.gd < 0 ? colors.danger : colors.textMuted }]}>{r.gd > 0 ? `+${r.gd}` : r.gd}</Text>
                <Text style={[st.cell, st.numCell, { width: 36, color: colors.textMuted }]}>{r.total}</Text>
                <Text style={[st.cell, st.numCell, { width: 48, color: pctColor, fontWeight: "700" }]}>{r.winPct.toFixed(3)}</Text>
              </TouchableOpacity>

              {/* Expanded game list */}
              {isExpanded && (
                <View style={st.expandedSection}>
                  {r.games.map(g => {
                    const result = getResult(g);
                    const color = getResultColor(result);
                    const season = seasons.find(ss => ss.id === g.seasonId);
                    return (
                      <View key={g.id} style={[st.gameRow, { borderLeftColor: color }]}>
                        <View style={[st.resultBadge, { backgroundColor: result === "W" ? colors.accentDim : result === "L" ? colors.dangerDim : colors.warnDim }]}>
                          <Text style={[st.resultText, { color }]}>{result === "D" ? "T" : result}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>{g.ourScore} – {g.theirScore}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>
                            {formatDate(g.date)}{g.time ? ` • ${g.time}` : ""}{season ? ` • ${season.name}` : ""}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {records.length === 0 && (
        <Card><Text style={{ color: colors.textDim, textAlign: "center" }}>No opponent data yet. Play some games!</Text></Card>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: {},
  header: { fontSize: 15, fontWeight: "700", color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.md, marginTop: spacing.lg },
  table: { borderRadius: radii.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.md },
  headerRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg },
  headerCell: { paddingVertical: 10, paddingHorizontal: 6, justifyContent: "center" },
  headerText: { fontSize: 11, fontWeight: "700", color: colors.textDim, letterSpacing: 0.5, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10, paddingHorizontal: 6 },
  cell: { paddingHorizontal: 2 },
  numCell: { fontFamily: "monospace", fontSize: 13, fontWeight: "600", textAlign: "center", color: colors.text },
  nameText: { fontSize: 13, fontWeight: "600", color: colors.text },
  expandedSection: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.border },
  gameRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderLeftWidth: 3, borderRadius: radii.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 4 },
  resultBadge: { width: 26, height: 26, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  resultText: { fontWeight: "700", fontSize: 11, fontFamily: "monospace" },
});
