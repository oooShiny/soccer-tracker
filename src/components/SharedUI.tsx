import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { sortStandings, calcPoints } from "../services/utils";
import type { StandingsRow } from "../types";

// ─── Badge ────────────────────────────────────────────────────────
export function Badge({ children, color, bg }: { children: string; color?: string; bg?: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg || colors.accentDim }]}>
      <Text style={[styles.badgeText, { color: color || colors.accent }]}>{children}</Text>
    </View>
  );
}

// ─── StatBox ──────────────────────────────────────────────────────
export function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Card ─────────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ─── Section Header ───────────────────────────────────────────────
export function SectionHeader({ children }: { children: string }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

// ─── Standings Table ──────────────────────────────────────────────
export function StandingsTable({ standings, teamName }: { standings: StandingsRow[]; teamName: string }) {
  const sorted = sortStandings(standings);
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { width: 28 }]}></Text>
        <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Team</Text>
        <Text style={[styles.tableHeaderCell, styles.numCol]}>W</Text>
        <Text style={[styles.tableHeaderCell, styles.numCol]}>L</Text>
        <Text style={[styles.tableHeaderCell, styles.numCol]}>T</Text>
        <Text style={[styles.tableHeaderCell, styles.numCol]}>GF</Text>
        <Text style={[styles.tableHeaderCell, styles.numCol]}>GA</Text>
        <Text style={[styles.tableHeaderCell, styles.numCol, { textAlign: "right" }]}>Pts</Text>
      </View>
      {sorted.map((row, i) => {
        const isUs = row.team === "Our Team";
        const pts = calcPoints(row);
        return (
          <View
            key={row.team}
            style={[
              styles.tableRow,
              isUs && { backgroundColor: colors.accentDim },
              i < sorted.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              { borderLeftWidth: 3, borderLeftColor: i === 0 ? colors.accent : i <= 1 ? colors.blue : i >= sorted.length - 1 ? colors.danger : "transparent" },
            ]}
          >
            <Text style={[styles.tableCell, { width: 28, fontFamily: "monospace", fontWeight: "600", color: colors.textMuted }]}>{i + 1}</Text>
            <Text style={[styles.tableCell, { flex: 1, fontWeight: isUs ? "700" : "500", color: isUs ? colors.accent : colors.text }]}>
              {isUs ? `⚡ ${teamName}` : row.team}
            </Text>
            <Text style={[styles.tableCell, styles.numCol, styles.mono]}>{row.w}</Text>
            <Text style={[styles.tableCell, styles.numCol, styles.mono]}>{row.l}</Text>
            <Text style={[styles.tableCell, styles.numCol, styles.mono]}>{row.d}</Text>
            <Text style={[styles.tableCell, styles.numCol, styles.mono]}>{row.gf}</Text>
            <Text style={[styles.tableCell, styles.numCol, styles.mono]}>{row.ga}</Text>
            <Text style={[styles.tableCell, styles.numCol, styles.mono, { textAlign: "right", fontWeight: "700", color: isUs ? colors.accent : colors.text }]}>{pts}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: "600", letterSpacing: 0.3 },
  statValue: { fontSize: 28, fontWeight: "700", fontFamily: "monospace" },
  statLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    fontSize: 15, fontWeight: "700", color: colors.textMuted,
    letterSpacing: 1.5, marginBottom: spacing.sm, marginTop: spacing.sm,
  },
  table: { borderRadius: radii.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tableHeader: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableHeaderCell: { fontSize: 11, fontWeight: "600", color: colors.textDim, letterSpacing: 0.8, textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12, alignItems: "center" },
  tableCell: { fontSize: 13, color: colors.text },
  numCol: { width: 36, textAlign: "center" },
  mono: { fontFamily: "monospace" },
});
