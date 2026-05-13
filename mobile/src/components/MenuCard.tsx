import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Haptics } from "@/util/haptics";
import type { MenuItem } from "@/types/api";
import { formatPrice } from "@/util/format";
import { useCartStore } from "@/stores/cart";
import { Tag } from "./Tag";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  item: MenuItem;
  // when true, render the wide hero variant (first card of a section)
  featured?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MenuCard({ item, featured = false }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const add = useCartStore((s) => s.add);

  const onAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    add(item.id, { quantity: 1 });
  };

  const heightClass = featured ? "h-72" : "h-56";
  const widthClass = featured ? "w-full" : "w-[280px]";

  return (
    <AnimatedPressable
      onPressIn={() => (scale.value = withSpring(0.97, { damping: 18 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 18 }))}
      onPress={() => router.push(`/item/${item.id}` as never)}
      style={animatedStyle}
      className={`${widthClass} rounded-3xl overflow-hidden bg-ink-700`}
    >
      <View className={`${heightClass} relative`}>
        <Image
          source={{ uri: item.image }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={300}
        />
        <LinearGradient
          colors={["rgba(14,11,8,0)", "rgba(14,11,8,0.55)", "rgba(14,11,8,0.95)"]}
          locations={[0, 0.55, 1]}
          style={{ position: "absolute", inset: 0 } as any}
        />
        {/* tags top-left */}
        <View className="absolute top-3 left-3 flex-row gap-1.5">
          {item.tags.slice(0, 2).map((t) => (
            <Tag key={t} value={t} />
          ))}
        </View>

        {/* add button top-right */}
        <Pressable
          onPress={onAdd}
          hitSlop={12}
          className="absolute top-3 right-3 w-10 h-10 rounded-full bg-cream-50/95 items-center justify-center active:opacity-80"
        >
          <Ionicons name="add" size={22} color="#0E0B08" />
        </Pressable>

        {/* title block bottom */}
        <View className="absolute left-4 right-4 bottom-4">
          <Text
            className="text-cream-50 font-display text-2xl leading-tight"
            numberOfLines={2}
          >
            {item.name}
          </Text>
          <View className="flex-row items-center justify-between mt-1.5">
            <Text className="text-cream-300 font-sans text-xs flex-1 mr-2" numberOfLines={1}>
              {item.tagline}
            </Text>
            <Text className="text-gold-400 font-sansSemi text-base">
              {formatPrice(item.priceCents)}
            </Text>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}
