import "../global.css";

import { useEffect, useRef } from "react";
import { View } from "react-native";
import { Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import {
  useFonts,
  Fraunces_400Regular,
  Fraunces_500Medium_Italic,
  Fraunces_700Bold,
} from "@expo-google-fonts/fraunces";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { AskButton } from "@/components/AskButton";
import { ChatSheet, type ChatSheetRef } from "@/components/ChatSheet";
import { useMenuStore } from "@/stores/menu";

SplashScreen.preventAutoHideAsync().catch(() => {});
SystemUI.setBackgroundColorAsync("#0E0B08").catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_500Medium_Italic,
    Fraunces_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const fetchMenu = useMenuStore((s) => s.fetch);
  const sheetRef = useRef<ChatSheetRef>(null);
  const segments = useSegments();

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  // Hide the global ask FAB on the cart screen — too crowded otherwise.
  const hideAskOn = new Set(["cart"]);
  const top = segments[segments.length - 1] ?? "";
  const showAsk = !hideAskOn.has(top);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0E0B08" }}>
      <BottomSheetModalProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: "#0E0B08" }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#0E0B08" },
              animation: "slide_from_right",
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="cart" options={{ presentation: "modal" }} />
            <Stack.Screen name="item/[id]" options={{ presentation: "modal" }} />
          </Stack>
          {showAsk ? <AskButton onPress={() => sheetRef.current?.open()} /> : null}
          <ChatSheet ref={sheetRef} />
        </View>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
