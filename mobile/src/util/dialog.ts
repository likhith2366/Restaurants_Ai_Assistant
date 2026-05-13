// react-native's Alert is a no-op on react-native-web, so confirmation /
// notification flows that rely on it silently fail in the browser. This shim
// routes web through the browser's native confirm/alert and keeps the rich
// modal Alert on iOS/Android.

import { Alert, Platform } from "react-native";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function confirm({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmOptions) {
  if (Platform.OS === "web") {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== "undefined" && window.confirm(text)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: "cancel" },
    {
      text: confirmLabel,
      style: destructive ? "destructive" : "default",
      onPress: onConfirm,
    },
  ]);
}

export function notify(title: string, message?: string) {
  if (Platform.OS === "web") {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== "undefined") window.alert(text);
    return;
  }
  Alert.alert(title, message);
}
