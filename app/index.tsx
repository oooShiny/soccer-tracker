import { NavigationContainer } from "@react-navigation/native";
import AppNavigator from "../src/navigation/AppNavigator";
import { colors } from "../src/theme";

export default function Index() {
  return (
    <NavigationContainer
      independent={true}
      theme={{
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
          regular: { fontFamily: "System", fontWeight: "400" },
          medium: { fontFamily: "System", fontWeight: "500" },
          bold: { fontFamily: "System", fontWeight: "700" },
          heavy: { fontFamily: "System", fontWeight: "800" },
        },
      }}
    >
      <AppNavigator />
    </NavigationContainer>
  );
}
