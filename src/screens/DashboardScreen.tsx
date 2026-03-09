import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useSeasons, useGames, usePlayers } from "../hooks/useFirestore";
import {
  computeSeasonRecord,
  getRecentForm,
  getOurPosition,
  positionSuffix,
  formatDate,
} from "../services/utils";

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
  const position = activeSeason
    ? getOurPosition(activeSeason.standings)
    : 0;
  const teamName = activeSeason?.teamName ?? "Our Team";

  const topScorer = [...players].sort((a, b) => b.goals - a.goals)[0];
  const topAssist = [...players].sort((a, b) => b.assists - a.assists)[0];
  const nextGame = seasonGames.find((g) => g.ourScore == null);

  return (
    <ScrollView style={styles.container}>
      {/* Season Banner - expandable */}
      <TouchableOpacity
        onPress={() => setStandingsOpen(!standingsOpen)}
        activeOpacity={0.8}
        style={styles.seasonBanner}
      >
        <View style={styles.bannerRow}>
          <View>
            <Text style={styles.teamNameSmall}>{teamName}</Text>
            <Text style={styles.seasonName}>{activeSeason?.name ?? "No Active Season"}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.labelSmall}>Standings</Text>
            <Text style={styles.positionBig}>
              {position}{positionSuffix(position)}
            </Text>
          </View>
        </View>
        {/* TODO: Render StandingsTable component when expanded */}
        {standingsOpen && (
          <View style={styles.expandedStandings}>
            <Text style={styles.placeholderText}>
              Standings table will render here
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Record */}
      <View style={styles.card}>
        <View style={styles.statRow}>
          <StatBox label="W" value={record.w} color={colors.accent} />
          <StatBox label="D" value={record.d} color={colors.warn} />
          <StatBox label="L" value={record.l} color={colors.danger} />
          <StatBox
            label="GD"
            value={`${record.gf - record.ga >= 0 ? "+" : ""}${record.gf - record.ga}`}
            color={record.gf - record.ga >= 0 ? colors.accent : colors.danger}
          />
        </View>
      </View>

      {/* Form */}
      <Text style={styles.sectionHeader}>RECENT FORM</Text>
      <View style={styles.formRow}>
        {form.map((r, i) => (
          <View
            key={i}
            style={[
              styles.formPill,
              {
                backgroundColor:
                  r === "W" ? colors.accentDim :
                  r === "L" ? colors.dangerDim : colors.warnDim,
              },
            ]}
          >
            <Text
              style={[
                styles.formText,
                {
                  color:
                    r === "W" ? colors.accent :
                    r === "L" ? colors.danger : colors.warn,
                },
              ]}
            >
              {r}
            </Text>
          </View>
        ))}
      </View>

      {/* Top performers */}
      <View style={styles.twoCol}>
        {topScorer && (
          <View style={styles.card}>
            <Text style={styles.miniLabel}>TOP SCORER</Text>
            <Text style={styles.playerName}>{topScorer.name}</Text>
            <Text style={[styles.bigStat, { color: colors.accent }]}>
              {topScorer.goals}
            </Text>
          </View>
        )}
        {topAssist && (
          <View style={styles.card}>
            <Text style={styles.miniLabel}>TOP ASSISTS</Text>
            <Text style={styles.playerName}>{topAssist.name}</Text>
            <Text style={[styles.bigStat, { color: colors.blue }]}>
              {topAssist.assists}
            </Text>
          </View>
        )}
      </View>

      {/* Next game */}
      {nextGame && (
        <>
          <Text style={styles.sectionHeader}>NEXT MATCH</Text>
          <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: colors.blue }]}>
            <Text style={styles.opponentName}>vs {nextGame.opponent}</Text>
            <Text style={styles.dateText}>{formatDate(nextGame.date)}</Text>
          </View>
        </>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── StatBox Component ────────────────────────────────────────────
function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  seasonBanner: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  bannerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  teamNameSmall: { fontSize: 13, color: colors.textMuted, fontWeight: "500" },
  seasonName: { fontSize: 22, fontWeight: "700", color: colors.text, marginTop: 4 },
  labelSmall: { fontSize: 13, color: colors.textMuted },
  positionBig: { fontSize: 28, fontWeight: "800", color: colors.accent, fontFamily: "monospace" },
  expandedStandings: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  placeholderText: { color: colors.textDim, fontSize: 13, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  statRow: { flexDirection: "row", justifyContent: "space-around" },
  statValue: { fontSize: 28, fontWeight: "700", fontFamily: "monospace" },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  formRow: { flexDirection: "row", gap: 6, marginBottom: spacing.md },
  formPill: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  formText: { fontWeight: "700", fontSize: 14, fontFamily: "monospace" },
  twoCol: { flexDirection: "row", gap: spacing.sm },
  miniLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  playerName: { fontSize: 16, fontWeight: "600", color: colors.text },
  bigStat: { fontSize: 24, fontWeight: "800", fontFamily: "monospace", marginTop: 4 },
  opponentName: { fontSize: 16, fontWeight: "600", color: colors.text },
  dateText: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
