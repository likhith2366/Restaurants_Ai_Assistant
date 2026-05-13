import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { router } from "expo-router";
import { useCartStore } from "@/stores/cart";
import { useMenuStore } from "@/stores/menu";
import { formatPrice } from "@/util/format";

// Sticky bottom action — appears only when the cart has items.
export function CartBar() {
  const quantity = useCartStore((s) => s.totalQuantity());
  const totalCents = useCartStore((s) => s.totalCents(useMenuStore.getState().getItem));
  if (quantity === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(20)}
      exiting={FadeOutDown.springify().damping(20)}
      pointerEvents="box-none"
      className="absolute left-0 right-0 bottom-6 px-5"
    >
      <BlurView intensity={50} tint="dark" className="rounded-2xl overflow-hidden">
        <Pressable
          onPress={() => router.push("/cart" as never)}
          className="flex-row items-center px-5 py-4 bg-gold-500 active:opacity-90"
        >
          <View className="w-9 h-9 rounded-full bg-ink-900 items-center justify-center mr-3">
            <Text className="text-cream-50 font-sansBold text-sm">{quantity}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-ink-900 font-sansSemi text-xs uppercase tracking-wider opacity-80">
              View cart
            </Text>
            <Text className="text-ink-900 font-display text-lg leading-tight">
              {formatPrice(totalCents)}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color="#0E0B08" />
        </Pressable>
      </BlurView>
    </Animated.View>
  );
}
