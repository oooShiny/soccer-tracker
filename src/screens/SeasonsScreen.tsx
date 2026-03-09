import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useSeasons, useGames } from "../hooks/useFirestore";
import { updateStandings } from "../services/firestore";
import { sortStandings, getOurPosition, positionSuffix, computeSeasonRecord, formatDate, getResult, getResultColor, calcPoints } from "../services/utils";
import { Card, Badge, StatBox, SectionHeader, StandingsTable } from "../components/SharedUI";
import { FormModal, FormInput, FormButtons, NumInput } from "../components/FormComponents";
import type { Season, StandingsRow } from "../types";

export function SeasonsScreen() {
  const { teamId, canEdit, isAdmin } = useAuth();
  const { data: seasons } = useSeasons(teamId);
  const { data: games } = useGames(teamId);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [editingStandings, setEditingStandings] = useState(false);
  const [standingsForm, setStandingsForm] = useState<StandingsRow[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [saving, setSaving] = useState(false);

  const openStandingsEdit = (season: Season) => {
    setStandingsForm(sortStandings(season.standings));
    setEditingStandings(true);
  };

  const updateRow = (i: number, field: keyof StandingsRow, val: string) => {
    const u = [...standingsForm];
    (u[i] as any)[field] = field === "team" ? val : parseInt(val) || 0;
    setStandingsForm(u);
  };

  const handleSaveStandings = async () => {
    if (!teamId || !selectedSeason) return;
    setSaving(true);
    try {
      await updateStandings(teamId, selectedSeason.id, standingsForm);
      setSelectedSeason({ ...selectedSeason, standings: standingsForm });
      setEditingStandings(false);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  // ─── Season Detail ──────────────────────────────────────────────
  if (selectedSeason) {
    const seasonGames = games.filter(g => g.seasonId === selectedSeason.id).sort((a, b) => b.date.localeCompare(a.date));
    const record = computeSeasonRecord(seasonGames);
    const pos = getOurPosition(selectedSeason.standings);

    return (
      <ScrollView style={s.container}>
        <TouchableOpacity onPress={() => setSelectedSeason(null)} style={s.backBtn}><Text style={s.backText}>← All Seasons</Text></TouchableOpacity>

        <Card style={{ borderLeftWidth: 3, borderLeftColor: selectedSeason.status === "Active" ? colors.accent : colors.textDim }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Text style={s.detailName}>{selectedSeason.name}</Text>
              <Text style={s.detailSub}>{selectedSeason.teamName} • {selectedSeason.division}</Text>
            </View>
            <Badge color={selectedSeason.status === "Active" ? colors.accent : colors.textMuted} bg={selectedSeason.status === "Active" ? colors.accentDim : colors.bg}>{selectedSeason.status}</Badge>
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
            <StatBox label="W" value={record.w} color={colors.accent} />
            <StatBox label="T" value={record.d} color={colors.warn} />
            <StatBox label="L" value={record.l} color={colors.danger} />
            <StatBox label="GD" value={`${record.gf - record.ga >= 0 ? "+" : ""}${record.gf - record.ga}`} color={record.gf - record.ga >= 0 ? colors.accent : colors.danger} />
          </View>
        </Card>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <SectionHeader>LEAGUE TABLE</SectionHeader>
          {canEdit && <TouchableOpacity onPress={() => openStandingsEdit(selectedSeason)} style={s.editSmallBtn}><Text style={s.editSmallText}>Edit Table</Text></TouchableOpacity>}
        </View>
        <StandingsTable standings={selectedSeason.standings} teamName={selectedSeason.teamName} />

        <SectionHeader>RESULTS</SectionHeader>
        {seasonGames.map(g => {
          const result = getResult(g); const color = getResultColor(result); const played = g.ourScore != null;
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
                {played ? <Text style={{ fontFamily: "monospace", fontSize: 22, fontWeight: "700", color }}>{g.ourScore} – {g.theirScore}</Text>
                  : <Badge color={colors.blue} bg={colors.blueDim}>Upcoming</Badge>}
              </View>
            </Card>
          );
        })}

        {/* Edit Standings Modal */}
        <FormModal visible={editingStandings} title="Edit Standings" onClose={() => setEditingStandings(false)}>
          <View style={s.standingsHeader}>
            <Text style={[s.standingsCol, { flex: 1 }]}>Team</Text>
            <Text style={[s.standingsCol, { width: 44 }]}>W</Text>
            <Text style={[s.standingsCol, { width: 44 }]}>L</Text>
            <Text style={[s.standingsCol, { width: 44 }]}>T</Text>
            <Text style={[s.standingsCol, { width: 44 }]}>GF</Text>
            <Text style={[s.standingsCol, { width: 44 }]}>GA</Text>
            <Text style={{ width: 24 }}></Text>
          </View>
          {standingsForm.map((row, i) => (
            <View key={i} style={s.standingsRow}>
              <Text style={[s.standingsTeam, { flex: 1, color: row.team === "Our Team" ? colors.accent : colors.text }]}>
                {row.team === "Our Team" ? selectedSeason.teamName : row.team}
              </Text>
              <NumInput value={String(row.w)} onChangeText={v => updateRow(i, "w", v)} width={44} />
              <NumInput value={String(row.l)} onChangeText={v => updateRow(i, "l", v)} width={44} />
              <NumInput value={String(row.d)} onChangeText={v => updateRow(i, "d", v)} width={44} />
              <NumInput value={String(row.gf)} onChangeText={v => updateRow(i, "gf", v)} width={44} />
              <NumInput value={String(row.ga)} onChangeText={v => updateRow(i, "ga", v)} width={44} />
              {row.team !== "Our Team" ? (
                <TouchableOpacity onPress={() => setStandingsForm(standingsForm.filter((_, j) => j !== i))}><Text style={{ color: colors.danger, fontSize: 16 }}>✕</Text></TouchableOpacity>
              ) : <View style={{ width: 24 }} />}
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <FormInput label="" value={newTeamName} onChangeText={setNewTeamName} placeholder="Add a team..." />
            </View>
            <TouchableOpacity onPress={() => { if (newTeamName.trim()) { setStandingsForm([...standingsForm, { team: newTeamName.trim(), w: 0, d: 0, l: 0, gf: 0, ga: 0 }]); setNewTeamName(""); } }}
              style={s.editSmallBtn}><Text style={s.editSmallText}>+ Add</Text></TouchableOpacity>
          </View>
          <FormButtons onCancel={() => setEditingStandings(false)} onSave={handleSaveStandings} saving={saving} saveLabel="Save Standings" />
        </FormModal>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ─── Season List ────────────────────────────────────────────────
  return (
    <ScrollView style={s.container}>
      <Text style={s.header}>SEASONS</Text>
      {seasons.map(season => {
        const sg = games.filter(g => g.seasonId === season.id);
        const sp = sg.filter(g => g.ourScore != null);
        const sw = sp.filter(g => g.ourScore! > g.theirScore!).length;
        const sd = sp.filter(g => g.ourScore! === g.theirScore!).length;
        const sl = sp.filter(g => g.ourScore! < g.theirScore!).length;
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
                  </View>
                </View>
                <Badge color={season.status === "Active" ? colors.accent : colors.textMuted} bg={season.status === "Active" ? colors.accentDim : colors.bg}>{season.status}</Badge>
              </View>
            </Card>
          </TouchableOpacity>
        );
      })}
      {seasons.length === 0 && <Card><Text style={{ color: colors.textDim, textAlign: "center" }}>No seasons yet.</Text></Card>}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  header: { fontSize: 15, fontWeight: "700", color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.md, marginTop: spacing.md },
  backBtn: { paddingVertical: 8, marginBottom: 4 },
  backText: { color: colors.textMuted, fontSize: 13, fontWeight: "500" },
  detailName: { fontSize: 22, fontWeight: "700", color: colors.text },
  detailSub: { fontSize: 13, color: colors.textMuted, marginTop: 3 },
  seasonName: { fontWeight: "700", fontSize: 17, color: colors.text },
  seasonSub: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  statText: { color: colors.textMuted, fontSize: 13 },
  mono: { fontFamily: "monospace", fontWeight: "600" },
  editSmallBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  editSmallText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  resultBadge: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  resultText: { fontWeight: "700", fontSize: 12, fontFamily: "monospace" },
  standingsHeader: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  standingsCol: { fontSize: 11, fontWeight: "600", color: colors.textDim, letterSpacing: 0.5, textAlign: "center" },
  standingsRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  standingsTeam: { fontSize: 13, fontWeight: "500" },
});
