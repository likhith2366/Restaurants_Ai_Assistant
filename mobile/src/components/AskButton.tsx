import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Haptics } from "@/util/haptics";
import { useEffect } from "react";

interface Props {
  onPress: () => void;
}

// Floating action button that opens the chat sheet. A faint pulse on the
// gold ring hints that it's the AI surface.
export function AskButton({ onPress }: Props) {
  const scale = useSharedValue(1);
  const ring = useSharedValue(0);

  useEffect(() => {
    ring.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [ring]);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - ring.value,
    transform: [{ scale: 1 + ring.value * 0.5 }],
  }));

  return (
    <View pointerEvents="box-none" className="absolute right-5 bottom-28 items-end">
      <Animated.View
        pointerEvents="none"
        style={ringStyle}
        className="absolute w-16 h-16 rounded-full border border-gold-500"
      />
      <Animated.View style={buttonStyle}>
        <Pressable
          onPressIn={() => (scale.value = withSpring(0.94, { damping: 14 }))}
          onPressOut={() => (scale.value = withSpring(1, { damping: 14 }))}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onPress();
          }}
          className="w-16 h-16 rounded-full bg-gold-500 items-center justify-center active:opacity-90"
          style={{
            shadowColor: "#C6913C",
            shadowOpacity: 0.45,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
            elevation: 10,
          }}
        >
          <Ionicons name="sparkles" size={26} color="#0E0B08" />
        </Pressable>
      </Animated.View>
      <Text className="text-cream-300 font-sansMed text-[11px] mt-1.5 mr-1 tracking-wider uppercase">
        Ask
      </Text>
    </View>
  );
}
