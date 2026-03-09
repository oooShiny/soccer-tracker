import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useSeasons, useMembers } from "../hooks/useFirestore";
import { Card, Badge, SectionHeader } from "../components/SharedUI";

export function SettingsScreen() {
  const { user, role, signOut, isAdmin } = useAuth();
  const { teamId } = useAuth();
  const { data: seasons } = useSeasons(teamId);
  const { data: members } = useMembers(teamId);

  const roleBadge = (r: string) => {
    const cfg = {
      admin: { color: colors.accent, bg: colors.accentDim, label: "🔑 Admin" },
      editor: { color: colors.blue, bg: colors.blueDim, label: "✏️ Editor" },
      viewer: { color: colors.textMuted, bg: colors.bg, label: "👁 Viewer" },
    }[r] || { color: colors.textMuted, bg: colors.bg, label: r };
    return <Badge color={cfg.color} bg={cfg.bg}>{cfg.label}</Badge>;
  };

  return (
    <ScrollView style={s.container}>
      {/* Current user */}
      <SectionHeader>YOUR ACCOUNT</SectionHeader>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={s.userName}>{user?.email || "Unknown"}</Text>
            <View style={{ marginTop: 6 }}>{roleBadge(role || "viewer")}</View>
          </View>
          <TouchableOpacity onPress={signOut} style={s.signOutBtn} activeOpacity={0.7}>
            <Text style={s.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Team name per season */}
      <SectionHeader>TEAM NAME PER SEASON</SectionHeader>
      <Text style={s.subText}>Your team name can change between seasons.</Text>
      {seasons.map((season) => (
        <Card key={season.id} style={{ padding: 14, paddingHorizontal: 20 }}>
          <Text style={s.seasonLabel}>{season.name} <Text style={{ color: colors.textDim }}>• {season.division}</Text></Text>
          <Text style={s.teamName}>{season.teamName}</Text>
        </Card>
      ))}

      {/* Members */}
      <SectionHeader>TEAM MEMBERS</SectionHeader>
      {members.map((m) => (
        <Card key={m.uid} style={{ padding: 14, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={s.memberName}>{m.displayName}</Text>
              <Text style={s.memberEmail}>{m.email}</Text>
            </View>
            <Badge
              color={m.role === "admin" ? colors.accent : m.role === "editor" ? colors.blue : colors.textMuted}
              bg={m.role === "admin" ? colors.accentDim : m.role === "editor" ? colors.blueDim : colors.bg}
            >{m.role}</Badge>
          </View>
        </Card>
      ))}

      {members.length === 0 && (
        <Card><Text style={{ color: colors.textDim, textAlign: "center" }}>No members found.</Text></Card>
      )}

      {/* App info */}
      <View style={s.footer}>
        <Text style={s.footerText}>TeamTracker v1.0</Text>
        <Text style={s.footerText}>Logged in as {user?.email}</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  userName: { fontSize: 16, fontWeight: "600", color: colors.text },
  signOutBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.md, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.dangerDim },
  signOutText: { color: colors.danger, fontSize: 14, fontWeight: "600" },
  subText: { fontSize: 12, color: colors.textDim, marginBottom: spacing.sm },
  seasonLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "500" },
  teamName: { fontSize: 16, fontWeight: "600", color: colors.text, marginTop: 2 },
  memberName: { fontWeight: "600", color: colors.text },
  memberEmail: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  footer: { marginTop: 32, alignItems: "center", gap: 4 },
  footerText: { fontSize: 12, color: colors.textDim },
});
