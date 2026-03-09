import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useSeasons, useGames } from "../hooks/useFirestore";
import { sortStandings, getOurPosition, positionSuffix, computeSeasonRecord, formatDate, getResult, getResultColor } from "../services/utils";
import { Card, Badge, StatBox, SectionHeader, StandingsTable } from "../components/SharedUI";
import type { Season } from "../types";

export function SeasonsScreen() {
  const { teamId } = useAuth();
  const { data: seasons } = useSeasons(teamId);
  const { data: games } = useGames(teamId);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);

  // ─── Season Detail View ─────────────────────────────────────────
  if (selectedSeason) {
    const seasonGames = games.filter((g) => g.seasonId === selectedSeason.id).sort((a, b) => b.date.localeCompare(a.date));
    const record = computeSeasonRecord(seasonGames);
    const pos = getOurPosition(selectedSeason.standings);

    return (
      <ScrollView style={s.container}>
        <TouchableOpacity onPress={() => setSelectedSeason(null)} style={s.backBtn}>
          <Text style={s.backText}>← All Seasons</Text>
        </TouchableOpacity>

        {/* Season banner */}
        <Card style={{ borderLeftWidth: 3, borderLeftColor: selectedSeason.status === "Active" ? colors.accent : colors.textDim }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Text style={s.detailName}>{selectedSeason.name}</Text>
              <Text style={s.detailSub}>{selectedSeason.teamName} • {selectedSeason.division}</Text>
              <Text style={s.detailSub}>{selectedSeason.startDate} → {selectedSeason.endDate}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <Badge color={selectedSeason.status === "Active" ? colors.accent : colors.textMuted} bg={selectedSeason.status === "Active" ? colors.accentDim : colors.bg}>{selectedSeason.status}</Badge>
              {selectedSeason.result && (
                <Badge
                  color={selectedSeason.result === "Promoted" ? colors.accent : selectedSeason.result === "Relegated" ? colors.danger : colors.warn}
                  bg={selectedSeason.result === "Promoted" ? colors.accentDim : selectedSeason.result === "Relegated" ? colors.dangerDim : colors.warnDim}
                >{selectedSeason.result === "Promoted" ? "↑ Promoted" : selectedSeason.result === "Relegated" ? "↓ Relegated" : "— Stayed"}</Badge>
              )}
            </View>
          </View>
        </Card>

        {/* Record */}
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            <StatBox label="W" value={record.w} color={colors.accent} />
            <StatBox label="T" value={record.d} color={colors.warn} />
            <StatBox label="L" value={record.l} color={colors.danger} />
            <StatBox label="GD" value={`${record.gf - record.ga >= 0 ? "+" : ""}${record.gf - record.ga}`} color={record.gf - record.ga >= 0 ? colors.accent : colors.danger} />
            <StatBox label="Pos" value={`${pos}${positionSuffix(pos)}`} color={colors.text} />
          </View>
        </Card>

        {/* Standings */}
        <SectionHeader>LEAGUE TABLE</SectionHeader>
        <StandingsTable standings={selectedSeason.standings} teamName={selectedSeason.teamName} />
        <View style={s.legendRow}>
          <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: colors.accent }]} /><Text style={s.legendText}>Promotion</Text></View>
          <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: colors.blue }]} /><Text style={s.legendText}>Playoff</Text></View>
          <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: colors.danger }]} /><Text style={s.legendText}>Relegation</Text></View>
        </View>

        {/* Games */}
        <SectionHeader>RESULTS</SectionHeader>
        {seasonGames.map((g) => {
          const result = getResult(g);
          const color = getResultColor(result);
          const played = g.ourScore != null;
          return (
            <Card key={g.id} style={{ borderLeftWidth: 3, borderLeftColor: color }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={[s.resultBadge, { backgroundColor: result === "W" ? colors.accentDim : result === "L" ? colors.dangerDim : result === "D" ? colors.warnDim : colors.blueDim }]}>
                    <Text style={[s.resultText, { color }]}>{result === "Upcoming" ? "—" : result === "D" ? "T" : result}</Text>
                  </View>
                  <View>
                    <Text style={{ fontWeight: "600", fontSize: 15, color: colors.text }}>vs {g.opponent}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{formatDate(g.date)}</Text>
                  </View>
                </View>
                {played ? (
                  <Text style={{ fontFamily: "monospace", fontSize: 22, fontWeight: "700", color }}>{g.ourScore} – {g.theirScore}</Text>
                ) : (
                  <Badge color={colors.blue} bg={colors.blueDim}>Upcoming</Badge>
                )}
              </View>
            </Card>
          );
        })}
        {seasonGames.length === 0 && (
          <Card><Text style={{ color: colors.textDim, textAlign: "center" }}>No games recorded yet.</Text></Card>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ─── Season List View ───────────────────────────────────────────
  return (
    <ScrollView style={s.container}>
      <Text style={s.header}>SEASONS</Text>

      {seasons.map((season) => {
        const sg = games.filter((g) => g.seasonId === season.id);
        const sp = sg.filter((g) => g.ourScore != null);
        const sw = sp.filter((g) => g.ourScore! > g.theirScore!).length;
        const sd = sp.filter((g) => g.ourScore! === g.theirScore!).length;
        const sl = sp.filter((g) => g.ourScore! < g.theirScore!).length;
        const pos = getOurPosition(season.standings);

        return (
          <TouchableOpacity key={season.id} onPress={() => setSelectedSeason(season)} activeOpacity={0.7}>
            <Card style={{ borderLeftWidth: 3, borderLeftColor: season.status === "Active" ? colors.accent : colors.textDim }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.seasonName}>{season.name}</Text>
                  <Text style={s.seasonSub}><Text style={{ color: colors.text, fontWeight: "500" }}>{season.teamName}</Text> • {season.division}</Text>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                    <Text style={s.statText}><Text style={[s.mono, { color: colors.accent }]}>{sw}</Text>W</Text>
                    <Text style={s.statText}><Text style={[s.mono, { color: colors.warn }]}>{sd}</Text>T</Text>
                    <Text style={s.statText}><Text style={[s.mono, { color: colors.danger }]}>{sl}</Text>L</Text>
                    <Text style={s.statText}>•</Text>
                    <Text style={s.statText}><Text style={s.mono}>{pos}{positionSuffix(pos)}</Text> place</Text>
                    <Text style={s.statText}>•</Text>
                    <Text style={s.statText}><Text style={s.mono}>{sg.length}</Text> games</Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Badge color={season.status === "Active" ? colors.accent : colors.textMuted} bg={season.status === "Active" ? colors.accentDim : colors.bg}>{season.status}</Badge>
                  {season.result && (
                    <Badge
                      color={season.result === "Promoted" ? colors.accent : season.result === "Relegated" ? colors.danger : colors.warn}
                      bg={season.result === "Promoted" ? colors.accentDim : season.result === "Relegated" ? colors.dangerDim : colors.warnDim}
                    >{season.result === "Promoted" ? "↑ Promoted" : season.result === "Relegated" ? "↓ Relegated" : "— Stayed"}</Badge>
                  )}
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        );
      })}

      {seasons.length === 0 && (
        <Card><Text style={{ color: colors.textDim, textAlign: "center" }}>No seasons yet.</Text></Card>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  header: { fontSize: 15, fontWeight: "700", color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.md, marginTop: spacing.md },
  backBtn: { paddingVertical: 8, marginBottom: 4 },
  backText: { color: colors.textMuted, fontSize: 13, fontWeight: "500" },
  seasonName: { fontWeight: "700", fontSize: 17, color: colors.text },
  seasonSub: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  statText: { color: colors.textMuted, fontSize: 13 },
  mono: { fontFamily: "monospace", fontWeight: "600" },
  detailName: { fontSize: 22, fontWeight: "700", color: colors.text },
  detailSub: { fontSize: 13, color: colors.textMuted, marginTop: 3 },
  legendRow: { flexDirection: "row", gap: 16, marginTop: 8, marginBottom: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 11, color: colors.textDim },
  resultBadge: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  resultText: { fontWeight: "700", fontSize: 12, fontFamily: "monospace" },
});
