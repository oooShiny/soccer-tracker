import { NavigationIndependentTree } from "@react-navigation/native";
import AppNavigator from "../src/navigation/AppNavigator";
import { colors } from "../src/theme";

export default function Index() {
  return (
    <NavigationIndependentTree>
      <AppNavigator />
    </NavigationIndependentTree>
  );
}
