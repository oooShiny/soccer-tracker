import React from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Modal as RNModal, ScrollView, Platform } from "react-native";
import { colors, spacing, radii } from "../theme";

// ─── Form Modal Wrapper ───────────────────────────────────────────
export function FormModal({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={s.modal}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: colors.textMuted, fontSize: 22 }}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </RNModal>
  );
}

// ─── Form Input ───────────────────────────────────────────────────
export function FormInput({ label, value, onChangeText, placeholder, keyboardType, multiline }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: "default" | "numeric" | "email-address"; multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, multiline && { height: 80, textAlignVertical: "top" }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

// ─── Form Picker (simple dropdown alternative) ────────────────────
export function FormPicker({ label, options, value, onSelect }: {
  label: string; options: { value: string; label: string }[]; value: string; onSelect: (v: string) => void;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            style={[s.pickerOption, value === opt.value && s.pickerOptionActive]}
          >
            <Text style={[s.pickerText, value === opt.value && s.pickerTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Form Checkbox ────────────────────────────────────────────────
export function FormCheckbox({ label, subtitle, value, onToggle }: {
  label: string; subtitle?: string; value: boolean; onToggle: () => void;
}) {
  return (
    <TouchableOpacity onPress={onToggle} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }} activeOpacity={0.7}>
      <View style={[s.checkbox, value && s.checkboxChecked]}>
        {value && <Text style={{ color: colors.bg, fontSize: 12, fontWeight: "700" }}>✓</Text>}
      </View>
      <View>
        <Text style={{ fontSize: 14, fontWeight: "500", color: colors.text }}>{label}</Text>
        {subtitle && <Text style={{ fontSize: 12, color: colors.textDim }}>{subtitle}</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─── Form Buttons ─────────────────────────────────────────────────
export function FormButtons({ onCancel, onSave, saving, saveLabel }: {
  onCancel: () => void; onSave: () => void; saving?: boolean; saveLabel?: string;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
      <TouchableOpacity onPress={onCancel} style={s.cancelBtn}><Text style={s.cancelText}>Cancel</Text></TouchableOpacity>
      <TouchableOpacity onPress={onSave} style={[s.saveBtn, saving && { opacity: 0.7 }]} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={s.saveText}>{saveLabel || "Save"}</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ─── Small Number Input ───────────────────────────────────────────
export function NumInput({ value, onChangeText, placeholder, width }: {
  value: string; onChangeText: (v: string) => void; placeholder?: string; width?: number;
}) {
  return (
    <TextInput
      style={[s.numInput, width ? { width } : {}]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textDim}
      keyboardType="numeric"
    />
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)" },
  modal: { backgroundColor: colors.surface, borderRadius: 18, padding: 24, width: "100%", maxWidth: 500, borderWidth: 1, borderColor: colors.border, zIndex: 10 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  label: { fontSize: 12, fontWeight: "600", color: colors.textMuted, letterSpacing: 0.5, marginBottom: 5 },
  input: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 12, fontSize: 14, color: colors.text },
  pickerOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  pickerOptionActive: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  pickerText: { fontSize: 13, fontWeight: "500", color: colors.textMuted },
  pickerTextActive: { color: colors.accent },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radii.md, backgroundColor: colors.accent },
  saveText: { color: colors.bg, fontSize: 14, fontWeight: "700" },
  numInput: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, fontSize: 13, color: colors.text, textAlign: "center", fontFamily: "monospace", width: 56 },
});
