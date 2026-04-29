import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useGames, useOpponents, useSeasons } from "../hooks/useFirestore";
import { formatDate, getResult, getResultColor } from "../services/utils";
import { Card, Badge, StatBox } from "../components/SharedUI";
import { GameCard } from "../components/GameCard";
import type { Game, Opponent } from "../types";

interface OpponentRecord {
  opponent: Opponent;
  games: Game[];
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
}

function computeOpponentRecords(opponents: Opponent[], allGames: Game[]): OpponentRecord[] {
  return opponents.map(opp => {
    const games = allGames
      .filter(g => {
        if (g.ourScore == null) return false;
        if (g.opponentId) return g.opponentId === opp.id;
        return g.opponent.toLowerCase() === opp.name.toLowerCase();
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    const w = games.filter(g => g.ourScore! > g.theirScore!).length;
    const d = games.filter(g => g.ourScore! === g.theirScore!).length;
    const l = games.filter(g => g.ourScore! < g.theirScore!).length;
    const gf = games.reduce((s, g) => s + (g.ourScore || 0), 0);
    const ga = games.reduce((s, g) => s + (g.theirScore || 0), 0);

    return { opponent: opp, games, w, d, l, gf, ga };
  })
  .filter(r => r.games.length > 0)
  .sort((a, b) => (b.w + b.d + b.l) - (a.w + a.d + a.l));
}

export function OpponentsScreen() {
  const { teamId } = useAuth();
  const { data: opponents } = useOpponents(teamId);
  const { data: allGames } = useGames(teamId);
  const { data: seasons } = useSeasons(teamId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const records = computeOpponentRecords(opponents, allGames);

  // Also find games with opponents not yet in the opponents collection (legacy)
  const knownIds = new Set(opponents.map(o => o.id));
  const legacyOpponentNames = new Set<string>();
  for (const g of allGames) {
    if (g.ourScore == null) continue;
    if (g.opponentId && knownIds.has(g.opponentId)) continue;
    if (!g.opponentId && opponents.some(o => o.name.toLowerCase() === g.opponent.toLowerCase())) continue;
    if (g.opponent && g.opponent !== "TBD") legacyOpponentNames.add(g.opponent);
  }

  const legacyRecords: OpponentRecord[] = [...legacyOpponentNames].map(name => {
    const games = allGames.filter(g => g.ourScore != null && !g.opponentId && g.opponent === name).sort((a, b) => b.date.localeCompare(a.date));
    const w = games.filter(g => g.ourScore! > g.theirScore!).length;
    const d = games.filter(g => g.ourScore! === g.theirScore!).length;
    const l = games.filter(g => g.ourScore! < g.theirScore!).length;
    const gf = games.reduce((s, g) => s + (g.ourScore || 0), 0);
    const ga = games.reduce((s, g) => s + (g.theirScore || 0), 0);
    return { opponent: { id: `legacy-${name}`, name, createdAt: new Date() }, games, w, d, l, gf, ga };
  }).filter(r => r.games.length > 0);

  const allRecords = [...records, ...legacyRecords].sort((a, b) => {
    const aTotal = a.w + a.d + a.l;
    const bTotal = b.w + b.d + b.l;
    const aPct = aTotal > 0 ? a.w / aTotal : 0;
    const bPct = bTotal > 0 ? b.w / bTotal : 0;
    if (bPct !== aPct) return bPct - aPct;
    return bTotal - aTotal; // tiebreak by games played
  });

  // Totals
  const totalW = allRecords.reduce((s, r) => s + r.w, 0);
  const totalD = allRecords.reduce((s, r) => s + r.d, 0);
  const totalL = allRecords.reduce((s, r) => s + r.l, 0);

  return (
    <ScrollView style={s.container}>
      <Text style={s.header}>OPPONENTS</Text>

      {/* Overall record */}
      {allRecords.length > 0 && (
        <Card>
          <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: "600", letterSpacing: 1, textAlign: "center", marginBottom: 8 }}>ALL-TIME RECORD</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            <StatBox label="W" value={totalW} color={colors.accent} />
            <StatBox label="T" value={totalD} color={colors.warn} />
            <StatBox label="L" value={totalL} color={colors.danger} />
            <StatBox label="Teams" value={allRecords.length} color={colors.text} />
          </View>
        </Card>
      )}

      {/* Opponent list */}
      {allRecords.map(record => {
        const isExpanded = expandedId === record.opponent.id;
        const totalGames = record.w + record.d + record.l;
        const winPct = totalGames > 0 ? Math.round((record.w / totalGames) * 100) : 0;

        // Determine dominant result for border color
        const borderColor = record.w > record.l ? colors.accent : record.l > record.w ? colors.danger : colors.warn;

        return (
          <View key={record.opponent.id}>
            <TouchableOpacity onPress={() => setExpandedId(isExpanded ? null : record.opponent.id)} activeOpacity={0.7}>
              <Card style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.oppName}>{record.opponent.name}</Text>
                    <View style={{ flexDirection: "row", gap: 12, marginTop: 6, alignItems: "center" }}>
                      <Text style={s.statText}><Text style={[s.mono, { color: colors.accent }]}>{record.w}</Text>W</Text>
                      <Text style={s.statText}><Text style={[s.mono, { color: colors.warn }]}>{record.d}</Text>T</Text>
                      <Text style={s.statText}><Text style={[s.mono, { color: colors.danger }]}>{record.l}</Text>L</Text>
                      <Text style={{ color: colors.textDim, fontSize: 12 }}>•</Text>
                      <Text style={{ color: colors.textDim, fontSize: 12 }}>{record.gf}F {record.ga}A</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={[s.mono, { fontSize: 18, fontWeight: "700", color: winPct >= 50 ? colors.accent : winPct > 0 ? colors.warn : colors.danger }]}>{winPct}%</Text>
                    <Text style={{ color: colors.textDim, fontSize: 11 }}>{totalGames} game{totalGames !== 1 ? "s" : ""}</Text>
                  </View>
                  <Text style={[s.chevron, isExpanded && s.chevronOpen]}>▼</Text>
                </View>
              </Card>
            </TouchableOpacity>

            {/* Expanded game list */}
            {isExpanded && (
              <View style={s.expandedSection}>
                {record.games.map(g => {
                  const result = getResult(g);
                  const color = getResultColor(result);
                  const season = seasons.find(ss => ss.id === g.seasonId);
                  return (
                    <View key={g.id} style={[s.gameRow, { borderLeftWidth: 3, borderLeftColor: color }]}>
                      <View style={[s.resultBadge, { backgroundColor: result === "W" ? colors.accentDim : result === "L" ? colors.dangerDim : colors.warnDim }]}>
                        <Text style={[s.resultText, { color }]}>{result === "D" ? "T" : result}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>
                          {g.ourScore} – {g.theirScore}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 1 }}>
                          {formatDate(g.date)}{g.time ? ` • ${g.time}` : ""}{season ? ` • ${season.name}` : ""}
                        </Text>
                        {g.notes ? <Text style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }} numberOfLines={1}>{g.notes}</Text> : null}
                      </View>
                      {/* Scorers mini-list */}
                      {g.scorers && g.scorers.length > 0 && (
                        <View style={{ alignItems: "flex-end" }}>
                          {g.scorers.slice(0, 2).map((sc, i) => (
                            <Text key={i} style={{ color: colors.textDim, fontSize: 10 }}>
                              ⚽ {sc.goals > 1 ? `${sc.goals}× ` : ""}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      {allRecords.length === 0 && (
        <Card><Text style={{ color: colors.textDim, textAlign: "center" }}>No opponent data yet. Play some games!</Text></Card>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  header: { fontSize: 15, fontWeight: "700", color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.md, marginTop: spacing.md },
  oppName: { fontWeight: "700", fontSize: 16, color: colors.text },
  statText: { color: colors.textMuted, fontSize: 13 },
  mono: { fontFamily: "monospace", fontWeight: "600" },
  chevron: { fontSize: 12, color: colors.textDim, marginLeft: 10 },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  expandedSection: { paddingLeft: 12, paddingBottom: 8 },
  gameRow: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 10,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: radii.sm,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: 4,
  },
  resultBadge: { width: 28, height: 28, borderRadius: 7, alignItems: "center" as const, justifyContent: "center" as const },
  resultText: { fontWeight: "700", fontSize: 11, fontFamily: "monospace" },
});
