import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useSeasons, useGames, usePlayers, useOpponents } from "../hooks/useFirestore";
import { computeSeasonRecord, getRecentForm, getOurPosition, positionSuffix, formatDate } from "../services/utils";
import { Card, StatBox, SectionHeader, StandingsTable, Badge } from "../components/SharedUI";
import { GameCard } from "../components/GameCard";
import { useGameEdit } from "../components/GameEditProvider";

export default function DashboardScreen() {
  const { teamId } = useAuth();
  const { viewPlayer } = useGameEdit();
  const { data: seasons } = useSeasons(teamId);
  const { data: games } = useGames(teamId);
  const { data: players } = usePlayers(teamId);
  const { data: opponents } = useOpponents(teamId);
  const [standingsOpen, setStandingsOpen] = useState(false);

  const activeSeason = seasons.find((s) => s.status === "Active");
  const seasonGames = games.filter((g) => g.seasonId === activeSeason?.id);
  const record = computeSeasonRecord(seasonGames);
  const form = getRecentForm(seasonGames);
  const position = activeSeason ? getOurPosition(activeSeason.standings) : 0;
  const teamName = activeSeason?.teamName ?? "Our Team";

  const upcomingGames = [...seasonGames]
    .filter((g) => g.ourScore == null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextMatchDate = upcomingGames[0]?.date;
  const nextGames = upcomingGames.filter((g) => g.date === nextMatchDate);

  return (
    <ScrollView style={s.container}>
      {/* Season Banner - expandable */}
      <TouchableOpacity onPress={() => setStandingsOpen(!standingsOpen)} activeOpacity={0.8} style={s.banner}>
        <View style={s.bannerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.teamNameSmall}>{teamName}</Text>
            <Text style={s.seasonName}>{activeSeason?.name ?? "No Active Season"}</Text>
            {activeSeason && <Text style={s.divisionText}>{activeSeason.division}</Text>}
          </View>
          <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 12 }}>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.labelSmall}>Standings</Text>
              <Text style={s.positionBig}>{position}{positionSuffix(position)}</Text>
            </View>
            <Text style={[s.chevron, standingsOpen && s.chevronOpen]}>▼</Text>
          </View>
        </View>
        {standingsOpen && activeSeason && (
          <View style={s.expandedStandings}>
            <StandingsTable standings={activeSeason.standings} teamName={teamName} />
            <View style={s.legendRow}>
              <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: colors.accent }]} /><Text style={s.legendText}>Promotion</Text></View>
              <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: colors.blue }]} /><Text style={s.legendText}>Playoff</Text></View>
              <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: colors.danger }]} /><Text style={s.legendText}>Relegation</Text></View>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Record */}
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          <StatBox label="W" value={record.w} color={colors.accent} />
          <StatBox label="T" value={record.d} color={colors.warn} />
          <StatBox label="L" value={record.l} color={colors.danger} />
          <StatBox label="GD" value={`${record.gf - record.ga >= 0 ? "+" : ""}${record.gf - record.ga}`} color={record.gf - record.ga >= 0 ? colors.accent : colors.danger} />
        </View>
      </Card>

      {/* Form */}
      {form.length > 0 && (
        <>
          <SectionHeader>RECENT FORM</SectionHeader>
          <View style={s.formRow}>
            {form.map((r, i) => (
              <View key={i} style={[s.formPill, { backgroundColor: r === "W" ? colors.accentDim : r === "L" ? colors.dangerDim : colors.warnDim }]}>
                <Text style={[s.formText, { color: r === "W" ? colors.accent : r === "L" ? colors.danger : colors.warn }]}>{r === "D" ? "T" : r}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Top Scorers - season leaderboard */}
      {(() => {
        const goalMap: Record<string, number> = {};
        for (const g of seasonGames) {
          if (g.ourScore == null) continue;
          for (const sc of g.scorers) { goalMap[sc.playerId] = (goalMap[sc.playerId] || 0) + sc.goals; }
        }
        const topScorers = Object.entries(goalMap)
          .map(([id, goals]) => ({ id, goals, name: players.find(p => p.id === id)?.name || "Unknown" }))
          .sort((a, b) => b.goals - a.goals)
          .slice(0, 5);
        if (topScorers.length === 0) return null;
        return (
          <>
            <SectionHeader>TOP SCORERS</SectionHeader>
            <Card>
              {topScorers.map((entry, i) => (
                <TouchableOpacity key={entry.id} onPress={() => viewPlayer(entry.id)} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: i < topScorers.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                  <Text style={{ width: 28, fontFamily: "monospace", fontWeight: "700", fontSize: 14, color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : colors.textDim }}>{i + 1}</Text>
                  <Text style={{ flex: 1, fontWeight: "600", fontSize: 14, color: colors.blue }}>{entry.name}</Text>
                  <Text style={{ fontFamily: "monospace", fontWeight: "700", fontSize: 16, color: colors.accent }}>{entry.goals}</Text>
                </TouchableOpacity>
              ))}
            </Card>
          </>
        );
      })()}

      {/* Next match(es) with scouting report */}
      {nextGames.length > 0 && (
        <>
          <SectionHeader>{nextGames.length > 1 ? "NEXT MATCHES" : "NEXT MATCH"}</SectionHeader>
          {nextGames.map((game) => {
            const oppName = game.opponent;
            const oppId = game.opponentId;
            const historyGames = games.filter(g => {
              if (g.ourScore == null) return false;
              if (oppId && g.opponentId) return g.opponentId === oppId;
              return g.opponent.toLowerCase() === oppName.toLowerCase();
            }).sort((a, b) => b.date.localeCompare(a.date));

            const hasHistory = historyGames.length > 0 && oppName !== "TBD";

            if (!hasHistory) return <GameCard key={game.id} game={game} />;

            const hw = historyGames.filter(g => g.ourScore! > g.theirScore!).length;
            const hd = historyGames.filter(g => g.ourScore! === g.theirScore!).length;
            const hl = historyGames.filter(g => g.ourScore! < g.theirScore!).length;
            const hgf = historyGames.reduce((sum, g) => sum + (g.ourScore || 0), 0);
            const hga = historyGames.reduce((sum, g) => sum + (g.theirScore || 0), 0);
            const hTotal = hw + hd + hl;
            const hPct = hTotal > 0 ? (hw + 0.5 * hd) / hTotal : 0;

            // Top scorers vs
            const scorerMap: Record<string, number> = {};
            for (const g of historyGames) {
              const tl = g.goalTimeline || [];
              if (tl.length > 0) { for (const e of tl) { if (e.type === "for" && e.playerId) scorerMap[e.playerId] = (scorerMap[e.playerId] || 0) + 1; } }
              else { for (const sc of (g.scorers || [])) { scorerMap[sc.playerId] = (scorerMap[sc.playerId] || 0) + sc.goals; } }
            }
            const topVs = Object.entries(scorerMap).map(([id, goals]) => ({ id, goals, name: players.find(p => p.id === id)?.name || "Unknown" })).sort((a, b) => b.goals - a.goals).slice(0, 3);

            // Performance by time
            const timePerf: Record<string, { w: number; d: number; l: number }> = {};
            for (const g of historyGames) {
              if (!g.time) continue;
              if (!timePerf[g.time]) timePerf[g.time] = { w: 0, d: 0, l: 0 };
              if (g.ourScore! > g.theirScore!) timePerf[g.time].w++; else if (g.ourScore! < g.theirScore!) timePerf[g.time].l++; else timePerf[g.time].d++;
            }

            const lastGame = historyGames[0];
            const lastResult = lastGame.ourScore! > lastGame.theirScore! ? "W" : lastGame.ourScore! < lastGame.theirScore! ? "L" : "T";
            const lastColor = lastResult === "W" ? colors.accent : lastResult === "L" ? colors.danger : colors.warn;
            const recentNotes = historyGames.filter(g => g.notes).slice(0, 2);

            return (
              <View key={game.id}>
                <GameCard game={game} />
                <Card style={{ marginTop: -8, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderLeftWidth: 3, borderLeftColor: colors.purple }}>
                  <Text style={s.scoutTitle}>📊 vs {oppName}</Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-around", marginVertical: 10 }}>
                    <View style={{ alignItems: "center" }}><Text style={[s.scoutNum, { color: colors.accent }]}>{hw}</Text><Text style={s.scoutLabel}>W</Text></View>
                    <View style={{ alignItems: "center" }}><Text style={[s.scoutNum, { color: colors.warn }]}>{hd}</Text><Text style={s.scoutLabel}>T</Text></View>
                    <View style={{ alignItems: "center" }}><Text style={[s.scoutNum, { color: colors.danger }]}>{hl}</Text><Text style={s.scoutLabel}>L</Text></View>
                    <View style={{ alignItems: "center" }}><Text style={[s.scoutNum, { color: hPct >= 0.5 ? colors.accent : colors.danger }]}>{hPct.toFixed(3)}</Text><Text style={s.scoutLabel}>PCT</Text></View>
                    <View style={{ alignItems: "center" }}><Text style={[s.scoutNum, { color: hgf - hga > 0 ? colors.accent : hgf - hga < 0 ? colors.danger : colors.textMuted }]}>{hgf - hga > 0 ? "+" : ""}{hgf - hga}</Text><Text style={s.scoutLabel}>GD</Text></View>
                  </View>

                  <View style={s.scoutRow}>
                    <Text style={s.scoutRowLabel}>Last meeting</Text>
                    <Text style={{ color: lastColor, fontFamily: "monospace", fontWeight: "700", fontSize: 13 }}>{lastResult} {lastGame.ourScore}–{lastGame.theirScore}</Text>
                    <Text style={{ color: colors.textDim, fontSize: 11, marginLeft: 6 }}>{formatDate(lastGame.date)}</Text>
                  </View>

                  {topVs.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={s.scoutMiniLabel}>TOP SCORERS VS {oppName.toUpperCase()}</Text>
                      {topVs.map((entry, i) => (
                        <TouchableOpacity key={entry.id} onPress={() => viewPlayer(entry.id)} activeOpacity={0.7} style={s.scoutRow}>
                          <Text style={{ color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : "#CD7F32", fontFamily: "monospace", fontWeight: "700", width: 20 }}>{i + 1}</Text>
                          <Text style={{ color: colors.blue, fontSize: 13, flex: 1 }}>{entry.name}</Text>
                          <Text style={{ color: colors.accent, fontFamily: "monospace", fontWeight: "700" }}>{entry.goals}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {Object.keys(timePerf).length > 1 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={s.scoutMiniLabel}>BY TIME SLOT</Text>
                      {Object.entries(timePerf).map(([time, rec]) => {
                        const tot = rec.w + rec.d + rec.l;
                        const pct = tot > 0 ? (rec.w + 0.5 * rec.d) / tot : 0;
                        return (
                          <View key={time} style={s.scoutRow}>
                            <Text style={{ color: colors.textMuted, fontSize: 12, width: 70 }}>{time}</Text>
                            <Text style={{ color: colors.accent, fontFamily: "monospace", fontSize: 12, width: 20 }}>{rec.w}W</Text>
                            <Text style={{ color: colors.warn, fontFamily: "monospace", fontSize: 12, width: 20 }}>{rec.d}T</Text>
                            <Text style={{ color: colors.danger, fontFamily: "monospace", fontSize: 12, width: 20 }}>{rec.l}L</Text>
                            <Text style={{ color: pct >= 0.5 ? colors.accent : colors.danger, fontFamily: "monospace", fontSize: 12, fontWeight: "600", flex: 1, textAlign: "right" }}>{pct.toFixed(3)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {recentNotes.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={s.scoutMiniLabel}>RECENT NOTES</Text>
                      {recentNotes.map(g => (
                        <View key={g.id} style={s.noteRow}>
                          <Text style={{ color: colors.textDim, fontSize: 11 }}>{formatDate(g.date)}</Text>
                          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 17 }} numberOfLines={3}>{g.notes}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
              </View>
            );
          })}
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  banner: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  bannerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  teamNameSmall: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  seasonName: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 4 },
  divisionText: { fontSize: 13, color: colors.textDim, marginTop: 2 },
  labelSmall: { fontSize: 13, color: colors.textMuted },
  positionBig: { fontSize: 28, fontWeight: "800", color: colors.accent, fontFamily: "monospace" },
  chevron: { fontSize: 14, color: colors.textDim, marginTop: 8 },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  expandedStandings: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  legendRow: { flexDirection: "row", gap: 16, marginTop: 8 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 11, color: colors.textDim },
  formRow: { flexDirection: "row", gap: 6, marginBottom: spacing.md },
  formPill: { width: 40, height: 40, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  formText: { fontWeight: "700", fontSize: 14, fontFamily: "monospace" },
  twoCol: { flexDirection: "row", gap: spacing.sm },
  miniLabel: { fontSize: 11, fontWeight: "600", color: colors.textMuted, letterSpacing: 1, marginBottom: spacing.sm },
  playerName: { fontSize: 16, fontWeight: "600", color: colors.text },
  bigStat: { fontSize: 24, fontWeight: "800", fontFamily: "monospace", marginTop: 4 },
  bigStatLabel: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  opponentName: { fontSize: 16, fontWeight: "600", color: colors.text },
  dateText: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  // Scouting report
  scoutTitle: { fontSize: 14, fontWeight: "700", color: colors.purple, letterSpacing: 0.3 },
  scoutNum: { fontSize: 20, fontWeight: "800", fontFamily: "monospace" },
  scoutLabel: { fontSize: 10, color: colors.textDim, fontWeight: "600", marginTop: 1 },
  scoutRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, paddingVertical: 4 },
  scoutRowLabel: { fontSize: 12, color: colors.textMuted, marginRight: 4 },
  scoutMiniLabel: { fontSize: 10, color: colors.textDim, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  noteRow: { backgroundColor: colors.bg, borderRadius: radii.sm, padding: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 4 },
});
