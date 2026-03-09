import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/hooks/useAuth";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { colors } from "../src/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <Slot />
          <StatusBar style="light" />
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
