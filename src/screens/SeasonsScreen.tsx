import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useSeasons, useGames } from "../hooks/useFirestore";
import { createSeason, updateStandings } from "../services/firestore";
import { sortStandings, getOurPosition, positionSuffix, computeSeasonRecord } from "../services/utils";
import { Card, Badge, StatBox, SectionHeader, StandingsTable } from "../components/SharedUI";
import { GameCard } from "../components/GameCard";
import { useGameEdit } from "../components/GameEditProvider";
import { FormModal, FormInput, FormPicker, FormButtons, NumInput } from "../components/FormComponents";
import type { Season, StandingsRow } from "../types";

export function SeasonsScreen() {
  const { teamId, canEdit, isAdmin } = useAuth();
  const { data: seasons } = useSeasons(teamId);
  const { data: games } = useGames(teamId);
  const { newGame } = useGameEdit();
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [editingStandings, setEditingStandings] = useState(false);
  const [standingsForm, setStandingsForm] = useState<StandingsRow[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [saving, setSaving] = useState(false);

  // Add Season form
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [seasonForm, setSeasonForm] = useState({ name: "", teamName: "", division: "", startDate: "", endDate: "", status: "Active" as string });
  const [newLeagueTeams, setNewLeagueTeams] = useState<string[]>([""]);

  const openStandingsEdit = (season: Season) => { setStandingsForm(sortStandings(season.standings)); setEditingStandings(true); };
  const updateRow = (i: number, field: keyof StandingsRow, val: string) => { const u = [...standingsForm]; (u[i] as any)[field] = field === "team" ? val : parseInt(val) || 0; setStandingsForm(u); };

  const handleSaveStandings = async () => {
    if (!teamId || !selectedSeason) return;
    setSaving(true);
    try { await updateStandings(teamId, selectedSeason.id, standingsForm); setSelectedSeason({ ...selectedSeason, standings: standingsForm }); setEditingStandings(false); } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleAddSeason = async () => {
    if (!teamId || !seasonForm.name.trim()) return;
    setSaving(true);
    try {
      const otherTeams = newLeagueTeams.filter(t => t.trim()).map(t => ({ team: t.trim(), w: 0, d: 0, l: 0, gf: 0, ga: 0 }));
      const standings = [{ team: "Our Team", w: 0, d: 0, l: 0, gf: 0, ga: 0 }, ...otherTeams];
      await createSeason(teamId, {
        name: seasonForm.name, teamName: seasonForm.teamName || "Our Team", division: seasonForm.division,
        status: seasonForm.status as any, startDate: seasonForm.startDate, endDate: seasonForm.endDate,
        result: null, standings,
      });
      setShowAddSeason(false);
      setSeasonForm({ name: "", teamName: "", division: "", startDate: "", endDate: "", status: "Active" });
      setNewLeagueTeams([""]);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  // ─── Season Detail ──────────────────────────────────────────────
  if (selectedSeason) {
    const seasonGames = games.filter(g => g.seasonId === selectedSeason.id).sort((a, b) => b.date.localeCompare(a.date));
    const record = computeSeasonRecord(seasonGames);

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

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md }}>
          <SectionHeader>RESULTS</SectionHeader>
          {canEdit && <TouchableOpacity onPress={() => newGame(selectedSeason.id)} style={s.addBtn}><Text style={s.addBtnText}>+ Add Game</Text></TouchableOpacity>}
        </View>
        {seasonGames.map(g => <GameCard key={g.id} game={g} />)}
        {seasonGames.length === 0 && <Card><Text style={{ color: colors.textDim, textAlign: "center" }}>No games recorded yet.</Text></Card>}

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
              <Text style={[s.standingsTeam, { flex: 1, color: row.team === "Our Team" ? colors.accent : colors.text }]}>{row.team === "Our Team" ? selectedSeason.teamName : row.team}</Text>
              <NumInput value={String(row.w)} onChangeText={v => updateRow(i, "w", v)} width={44} />
              <NumInput value={String(row.l)} onChangeText={v => updateRow(i, "l", v)} width={44} />
              <NumInput value={String(row.d)} onChangeText={v => updateRow(i, "d", v)} width={44} />
              <NumInput value={String(row.gf)} onChangeText={v => updateRow(i, "gf", v)} width={44} />
              <NumInput value={String(row.ga)} onChangeText={v => updateRow(i, "ga", v)} width={44} />
              {row.team !== "Our Team" ? <TouchableOpacity onPress={() => setStandingsForm(standingsForm.filter((_, j) => j !== i))}><Text style={{ color: colors.danger, fontSize: 16 }}>✕</Text></TouchableOpacity> : <View style={{ width: 24 }} />}
            </View>
          ))}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" }}>
            <View style={{ flex: 1 }}><FormInput label="" value={newTeamName} onChangeText={setNewTeamName} placeholder="Add a team..." /></View>
            <TouchableOpacity onPress={() => { if (newTeamName.trim()) { setStandingsForm([...standingsForm, { team: newTeamName.trim(), w: 0, d: 0, l: 0, gf: 0, ga: 0 }]); setNewTeamName(""); } }} style={s.editSmallBtn}><Text style={s.editSmallText}>+ Add</Text></TouchableOpacity>
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
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={s.header}>SEASONS</Text>
        {isAdmin && <TouchableOpacity onPress={() => setShowAddSeason(true)} style={s.addBtn}><Text style={s.addBtnText}>+ Add Season</Text></TouchableOpacity>}
      </View>

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
      {seasons.length === 0 && <Card><Text style={{ color: colors.textDim, textAlign: "center" }}>No seasons yet. Tap + to create your first season.</Text></Card>}

      {/* Add Season Modal */}
      <FormModal visible={showAddSeason} title="Add Season" onClose={() => setShowAddSeason(false)}>
        <FormInput label="Season Name" value={seasonForm.name} onChangeText={v => setSeasonForm({ ...seasonForm, name: v })} placeholder="e.g. Spring 2026" />
        <FormInput label="Team Name" value={seasonForm.teamName} onChangeText={v => setSeasonForm({ ...seasonForm, teamName: v })} placeholder="Your team's name this season" />
        <FormInput label="Division" value={seasonForm.division} onChangeText={v => setSeasonForm({ ...seasonForm, division: v })} placeholder="e.g. Division 2 Boarded" />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}><FormInput label="Start Date" value={seasonForm.startDate} onChangeText={v => setSeasonForm({ ...seasonForm, startDate: v })} placeholder="YYYY-MM-DD" /></View>
          <View style={{ flex: 1 }}><FormInput label="End Date" value={seasonForm.endDate} onChangeText={v => setSeasonForm({ ...seasonForm, endDate: v })} placeholder="YYYY-MM-DD" /></View>
        </View>
        <FormPicker label="Status" value={seasonForm.status} onSelect={v => setSeasonForm({ ...seasonForm, status: v })} options={[{ value: "Active", label: "Active" }, { value: "Completed", label: "Completed" }]} />

        <Text style={s.formSection}>OTHER TEAMS IN LEAGUE</Text>
        <Text style={{ fontSize: 12, color: colors.textDim, marginBottom: 8 }}>Add the other teams in your division. Standings start at 0-0-0.</Text>
        {newLeagueTeams.map((t, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 6, alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <FormInput label="" value={t} onChangeText={v => { const u = [...newLeagueTeams]; u[i] = v; setNewLeagueTeams(u); }} placeholder={`Team ${i + 1}`} />
            </View>
            {newLeagueTeams.length > 1 && <TouchableOpacity onPress={() => setNewLeagueTeams(newLeagueTeams.filter((_, j) => j !== i))}><Text style={{ color: colors.danger, fontSize: 18 }}>✕</Text></TouchableOpacity>}
          </View>
        ))}
        <TouchableOpacity onPress={() => setNewLeagueTeams([...newLeagueTeams, ""])} style={s.addRowBtn}><Text style={s.addRowText}>+ Add team</Text></TouchableOpacity>

        <FormButtons onCancel={() => setShowAddSeason(false)} onSave={handleAddSeason} saving={saving} saveLabel="Create Season" />
      </FormModal>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  header: { fontSize: 15, fontWeight: "700", color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.md, marginTop: spacing.md },
  addBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.md },
  addBtnText: { color: colors.bg, fontSize: 13, fontWeight: "700" },
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
  formSection: { fontSize: 11, color: colors.textDim, fontWeight: "600", letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  addRowBtn: { padding: 8, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, borderRadius: 8, alignItems: "center", marginBottom: 8 },
  addRowText: { color: colors.textMuted, fontSize: 12 },
  standingsHeader: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  standingsCol: { fontSize: 11, fontWeight: "600", color: colors.textDim, letterSpacing: 0.5, textAlign: "center" },
  standingsRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  standingsTeam: { fontSize: 13, fontWeight: "500" },
});
