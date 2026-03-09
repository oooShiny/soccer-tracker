import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useSeasons, useGames, usePlayers } from "../hooks/useFirestore";
import { computeSeasonRecord, getRecentForm, getOurPosition, positionSuffix, formatDate } from "../services/utils";
import { Card, StatBox, SectionHeader, StandingsTable, Badge } from "../components/SharedUI";

export default function DashboardScreen() {
  const { teamId } = useAuth();
  const { data: seasons } = useSeasons(teamId);
  const { data: games } = useGames(teamId);
  const { data: players } = usePlayers(teamId);
  const [standingsOpen, setStandingsOpen] = useState(false);

  const activeSeason = seasons.find((s) => s.status === "Active");
  const seasonGames = games.filter((g) => g.seasonId === activeSeason?.id);
  const record = computeSeasonRecord(seasonGames);
  const form = getRecentForm(seasonGames);
  const position = activeSeason ? getOurPosition(activeSeason.standings) : 0;
  const teamName = activeSeason?.teamName ?? "Our Team";

  const topScorer = [...players].sort((a, b) => b.goals - a.goals)[0];
  const topAssist = [...players].sort((a, b) => b.assists - a.assists)[0];
  const nextGame = seasonGames.find((g) => g.ourScore == null);

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

      {/* Top performers */}
      {(topScorer || topAssist) && (
        <View style={s.twoCol}>
          {topScorer && topScorer.goals > 0 && (
            <Card style={{ flex: 1 }}>
              <Text style={s.miniLabel}>TOP SCORER</Text>
              <Text style={s.playerName}>{topScorer.name}</Text>
              <Text style={[s.bigStat, { color: colors.accent }]}>{topScorer.goals} <Text style={s.bigStatLabel}>goals</Text></Text>
            </Card>
          )}
          {topAssist && topAssist.assists > 0 && (
            <Card style={{ flex: 1 }}>
              <Text style={s.miniLabel}>TOP ASSISTS</Text>
              <Text style={s.playerName}>{topAssist.name}</Text>
              <Text style={[s.bigStat, { color: colors.blue }]}>{topAssist.assists} <Text style={s.bigStatLabel}>assists</Text></Text>
            </Card>
          )}
        </View>
      )}

      {/* Next game */}
      {nextGame && (
        <>
          <SectionHeader>NEXT MATCH</SectionHeader>
          <Card style={{ borderLeftWidth: 3, borderLeftColor: colors.blue }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={s.opponentName}>vs {nextGame.opponent}</Text>
                <Text style={s.dateText}>{formatDate(nextGame.date)}</Text>
              </View>
              <Badge color={colors.blue} bg={colors.blueDim}>Upcoming</Badge>
            </View>
          </Card>
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
});
