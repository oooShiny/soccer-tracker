import { NavigationIndependentTree } from "@react-navigation/native";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import AppNavigator from "../src/navigation/AppNavigator";
import SignInScreen from "../src/screens/SignInScreen";
import { useAuth } from "../src/hooks/useAuth";
import { colors } from "../src/theme";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!user) {
    return <SignInScreen />;
  }

  return (
    <NavigationIndependentTree>
      <AppNavigator />
    </NavigationIndependentTree>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
