// Thin shim over expo-haptics that no-ops on web. expo-haptics throws
// "not available on web" if called there, so we guard at the boundary
// instead of sprinkling Platform checks across every component.

import { Platform } from "react-native";
import * as ExpoHaptics from "expo-haptics";

const isNative = Platform.OS !== "web";

export const Haptics = {
  impactAsync: (style?: ExpoHaptics.ImpactFeedbackStyle): Promise<void> => {
    if (!isNative) return Promise.resolve();
    return ExpoHaptics.impactAsync(style).catch(() => {});
  },
  notificationAsync: (
    type?: ExpoHaptics.NotificationFeedbackType,
  ): Promise<void> => {
    if (!isNative) return Promise.resolve();
    return ExpoHaptics.notificationAsync(type).catch(() => {});
  },
  selectionAsync: (): Promise<void> => {
    if (!isNative) return Promise.resolve();
    return ExpoHaptics.selectionAsync().catch(() => {});
  },
  ImpactFeedbackStyle: ExpoHaptics.ImpactFeedbackStyle,
  NotificationFeedbackType: ExpoHaptics.NotificationFeedbackType,
};
