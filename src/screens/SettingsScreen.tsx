import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";
import { useSeasons, useMembers } from "../hooks/useFirestore";
import { createInvite, deleteInvite, updateMemberRole, removeMember, subscribeToInvites, type Invite } from "../services/firestore";
import { Card, Badge, SectionHeader } from "../components/SharedUI";
import { FormModal, FormInput, FormPicker, FormButtons } from "../components/FormComponents";
import type { UserRole } from "../types";

export function SettingsScreen() {
  const { user, role, signOut, isAdmin, teamId } = useAuth();
  const { data: seasons } = useSeasons(teamId);
  const { data: members } = useMembers(teamId);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("editor");
  const [saving, setSaving] = useState(false);
  const [editingMember, setEditingMember] = useState<{ uid: string; role: UserRole } | null>(null);

  useEffect(() => {
    if (!teamId) return;
    const unsub = subscribeToInvites(teamId, setInvites);
    return unsub;
  }, [teamId]);

  const handleInvite = async () => {
    if (!teamId || !user || !inviteEmail.trim()) return;
    setSaving(true);
    try {
      await createInvite(teamId, inviteEmail, inviteRole, user.uid);
      setShowInviteForm(false);
      setInviteEmail("");
      setInviteRole("editor");
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (!teamId) return;
    try { await deleteInvite(teamId, inviteId); } catch (err) { console.error(err); }
  };

  const handleUpdateRole = async () => {
    if (!teamId || !editingMember) return;
    setSaving(true);
    try {
      await updateMemberRole(teamId, editingMember.uid, editingMember.role);
      setEditingMember(null);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleRemoveMember = async (uid: string) => {
    if (!teamId) return;
    try { await removeMember(teamId, uid); } catch (err) { console.error(err); }
  };

  const roleBadge = (r: string) => {
    const cfg: Record<string, { color: string; bg: string; label: string }> = {
      admin: { color: colors.accent, bg: colors.accentDim, label: "🔑 Admin" },
      editor: { color: colors.blue, bg: colors.blueDim, label: "✏️ Editor" },
      viewer: { color: colors.textMuted, bg: colors.bg, label: "👁 Viewer" },
    };
    const c = cfg[r] || cfg.viewer;
    return <Badge color={c.color} bg={c.bg}>{c.label}</Badge>;
  };

  return (
    <ScrollView style={s.container}>
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
      {seasons.map(season => (
        <Card key={season.id} style={{ padding: 14, paddingHorizontal: 20 }}>
          <Text style={s.seasonLabel}>{season.name} <Text style={{ color: colors.textDim }}>• {season.division}</Text></Text>
          <Text style={s.teamName}>{season.teamName}</Text>
        </Card>
      ))}

      {/* Members */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <SectionHeader>TEAM MEMBERS</SectionHeader>
        {isAdmin && (
          <TouchableOpacity onPress={() => setShowInviteForm(true)} style={s.inviteBtn}>
            <Text style={s.inviteBtnText}>+ Invite</Text>
          </TouchableOpacity>
        )}
      </View>

      {members.map(m => (
        <Card key={m.uid} style={{ padding: 14, paddingHorizontal: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={s.memberName}>{m.displayName}</Text>
              <Text style={s.memberEmail}>{m.email}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Badge
                color={m.role === "admin" ? colors.accent : m.role === "editor" ? colors.blue : colors.textMuted}
                bg={m.role === "admin" ? colors.accentDim : m.role === "editor" ? colors.blueDim : colors.bg}
              >{m.role}</Badge>
              {isAdmin && m.uid !== user?.uid && (
                <TouchableOpacity onPress={() => setEditingMember({ uid: m.uid, role: m.role as UserRole })}>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>✏️</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Card>
      ))}

      {/* Pending Invites */}
      {invites.length > 0 && (
        <>
          <SectionHeader>PENDING INVITES</SectionHeader>
          {invites.map(inv => (
            <Card key={inv.id} style={{ padding: 14, paddingHorizontal: 20, borderLeftWidth: 3, borderLeftColor: colors.warn }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.memberEmail}>{inv.email}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <Badge color={colors.warn} bg={colors.warnDim}>Pending</Badge>
                    <Badge
                      color={inv.role === "admin" ? colors.accent : inv.role === "editor" ? colors.blue : colors.textMuted}
                      bg={inv.role === "admin" ? colors.accentDim : inv.role === "editor" ? colors.blueDim : colors.bg}
                    >{inv.role}</Badge>
                  </View>
                </View>
                {isAdmin && (
                  <TouchableOpacity onPress={() => handleDeleteInvite(inv.id)}>
                    <Text style={{ color: colors.danger, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          ))}
        </>
      )}

      {members.length === 0 && invites.length === 0 && (
        <Card><Text style={{ color: colors.textDim, textAlign: "center" }}>No members found.</Text></Card>
      )}

      {/* Invite Modal */}
      <FormModal visible={showInviteForm} title="Invite Teammate" onClose={() => setShowInviteForm(false)}>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 16, lineHeight: 20 }}>
          Enter their email address and choose a role. They'll be able to sign up at the app URL and will be automatically added to the team.
        </Text>
        <FormInput label="Email" value={inviteEmail} onChangeText={setInviteEmail} placeholder="teammate@email.com" keyboardType="email-address" />
        <FormPicker label="Role" value={inviteRole} onSelect={v => setInviteRole(v as UserRole)} options={[
          { value: "viewer", label: "👁 Viewer" },
          { value: "editor", label: "✏️ Editor" },
          { value: "admin", label: "🔑 Admin" },
        ]} />
        <View style={{ backgroundColor: colors.bg, borderRadius: radii.sm, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.textDim, fontSize: 12, lineHeight: 18 }}>
            <Text style={{ fontWeight: "600", color: colors.textMuted }}>Viewer</Text> — can see everything but can't edit{"\n"}
            <Text style={{ fontWeight: "600", color: colors.textMuted }}>Editor</Text> — can add/edit games and players{"\n"}
            <Text style={{ fontWeight: "600", color: colors.textMuted }}>Admin</Text> — full access including seasons, standings, and members
          </Text>
        </View>
        <FormButtons onCancel={() => setShowInviteForm(false)} onSave={handleInvite} saving={saving} saveLabel="Send Invite" />
      </FormModal>

      {/* Edit Member Role Modal */}
      {editingMember && (
        <FormModal visible={true} title="Edit Member Role" onClose={() => setEditingMember(null)}>
          {(() => { const m = members.find(mm => mm.uid === editingMember.uid); return m ? <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", marginBottom: 16 }}>{m.displayName} ({m.email})</Text> : null; })()}
          <FormPicker label="Role" value={editingMember.role} onSelect={v => setEditingMember({ ...editingMember, role: v as UserRole })} options={[
            { value: "viewer", label: "👁 Viewer" },
            { value: "editor", label: "✏️ Editor" },
            { value: "admin", label: "🔑 Admin" },
          ]} />
          <TouchableOpacity onPress={() => { handleRemoveMember(editingMember.uid); setEditingMember(null); }} style={s.removeBtn}>
            <Text style={s.removeBtnText}>Remove from Team</Text>
          </TouchableOpacity>
          <FormButtons onCancel={() => setEditingMember(null)} onSave={handleUpdateRole} saving={saving} saveLabel="Update Role" />
        </FormModal>
      )}

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
  inviteBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.md },
  inviteBtnText: { color: colors.bg, fontSize: 13, fontWeight: "700" },
  memberName: { fontWeight: "600", color: colors.text },
  memberEmail: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  removeBtn: { padding: 12, borderRadius: radii.md, backgroundColor: colors.dangerDim, alignItems: "center", marginTop: 8, marginBottom: 8 },
  removeBtnText: { color: colors.danger, fontWeight: "600", fontSize: 14 },
  footer: { marginTop: 32, alignItems: "center", gap: 4 },
  footerText: { fontSize: 12, color: colors.textDim },
});
