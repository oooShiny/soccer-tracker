import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";

export default function SignInScreen() {
  const { signIn, signUp, authError } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) return;
    if (mode === "signup" && !displayName.trim()) return;
    setLoading(true);
    try {
      if (mode === "signin") await signIn(email.trim(), password);
      else await signUp(email.trim(), password, displayName.trim());
    } catch { }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={s.inner}>
        <View style={s.logoSection}>
          <Text style={s.logoEmoji}>⚽</Text>
          <Text style={s.logoText}>TeamTracker</Text>
          <Text style={s.subtitle}>{mode === "signin" ? "Sign in to manage your team" : "Create your account"}</Text>
        </View>

        {/* Mode toggle */}
        <View style={s.toggleRow}>
          <TouchableOpacity onPress={() => setMode("signin")} style={[s.toggleBtn, mode === "signin" && s.toggleActive]}>
            <Text style={[s.toggleText, mode === "signin" && s.toggleTextActive]}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode("signup")} style={[s.toggleBtn, mode === "signup" && s.toggleActive]}>
            <Text style={[s.toggleText, mode === "signup" && s.toggleTextActive]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        <View style={s.form}>
          {mode === "signup" && (
            <View style={s.inputWrapper}>
              <Text style={s.label}>YOUR NAME</Text>
              <TextInput style={s.input} value={displayName} onChangeText={setDisplayName} placeholder="How your teammates know you" placeholderTextColor={colors.textDim} autoCapitalize="words" />
            </View>
          )}
          <View style={s.inputWrapper}>
            <Text style={s.label}>EMAIL</Text>
            <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="your@email.com" placeholderTextColor={colors.textDim} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" />
          </View>
          <View style={s.inputWrapper}>
            <Text style={s.label}>PASSWORD</Text>
            <TextInput style={s.input} value={password} onChangeText={setPassword} placeholder={mode === "signup" ? "Create a password (6+ chars)" : "Enter your password"} placeholderTextColor={colors.textDim} secureTextEntry autoComplete="password" onSubmitEditing={handleSubmit} />
          </View>

          {authError && (
            <View style={s.errorBox}><Text style={s.errorText}>{authError}</Text></View>
          )}

          <TouchableOpacity style={[s.button, loading && s.buttonDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.8}>
            {loading ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={s.buttonText}>{mode === "signin" ? "Sign In" : "Sign Up"}</Text>}
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>
          {mode === "signin"
            ? "Don't have an account? Ask your team admin for an invite, then tap Sign Up."
            : "You need an invite from your team admin to sign up. Your email must match the invite."}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: "center", padding: spacing.lg, maxWidth: 400, width: "100%", alignSelf: "center" },
  logoSection: { alignItems: "center", marginBottom: 36 },
  logoEmoji: { fontSize: 48, marginBottom: 12 },
  logoText: { fontSize: 32, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: 8 },
  toggleRow: { flexDirection: "row", gap: 2, backgroundColor: colors.surface, borderRadius: radii.md, padding: 3, borderWidth: 1, borderColor: colors.border, marginBottom: 20 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: radii.sm, alignItems: "center" },
  toggleActive: { backgroundColor: colors.accentDim },
  toggleText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  toggleTextActive: { color: colors.accent },
  form: { gap: 16 },
  inputWrapper: { marginBottom: 4 },
  label: { fontSize: 11, fontWeight: "600", color: colors.textMuted, letterSpacing: 1, marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 14, fontSize: 16, color: colors.text },
  errorBox: { backgroundColor: colors.dangerDim, borderRadius: radii.sm, padding: 12 },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: "500", textAlign: "center" },
  button: { backgroundColor: colors.accent, borderRadius: radii.md, padding: 16, alignItems: "center", marginTop: 8 },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: colors.bg, fontSize: 16, fontWeight: "700" },
  footer: { textAlign: "center", color: colors.textDim, fontSize: 13, marginTop: 24, lineHeight: 20 },
});
