import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { colors, spacing, radii } from "../theme";
import { useAuth } from "../hooks/useAuth";

export default function SignInScreen() {
  const { signIn, authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      // Error is handled in useAuth
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoSection}>
          <Text style={styles.logoEmoji}>⚽</Text>
          <Text style={styles.logoText}>TeamTracker</Text>
          <Text style={styles.subtitle}>Sign in to manage your team</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={colors.textDim}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={colors.textDim}
              secureTextEntry
              autoComplete="password"
              onSubmitEditing={handleSignIn}
            />
          </View>

          {authError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{authError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg} size="small" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Ask your team admin for an invite to get access.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  logoSection: {
    alignItems: "center",
    marginBottom: 48,
  },
  logoEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  logoText: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    marginTop: 8,
  },
  form: {
    gap: 16,
  },
  inputWrapper: {
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: 14,
    fontSize: 16,
    color: colors.text,
  },
  errorBox: {
    backgroundColor: colors.dangerDim,
    borderRadius: radii.sm,
    padding: 12,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: "700",
  },
  footer: {
    textAlign: "center",
    color: colors.textDim,
    fontSize: 13,
    marginTop: 32,
  },
});
