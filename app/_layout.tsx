import { Slot } from "expo-router";
import { ThemeProvider } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/hooks/useAuth";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { colors } from "../src/theme";

const navTheme = {
  dark: true,
  colors: {
    primary: colors.accent,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
  fonts: {
    regular: { fontFamily: "System", fontWeight: "400" as const },
    medium: { fontFamily: "System", fontWeight: "500" as const },
    bold: { fontFamily: "System", fontWeight: "700" as const },
    heavy: { fontFamily: "System", fontWeight: "800" as const },
  },
};

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider value={navTheme}>
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
            <Slot />
            <StatusBar style="light" />
          </View>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
