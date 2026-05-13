import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Haptics } from "@/util/haptics";
import { Ionicons } from "@expo/vector-icons";
import type { MenuItem } from "@/types/api";
import { formatPrice } from "@/util/format";
import { useCartStore } from "@/stores/cart";
import { Tag } from "./Tag";

export function MenuCardCompact({ item }: { item: MenuItem }) {
  const add = useCartStore((s) => s.add);
  const onAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    add(item.id, { quantity: 1 });
  };
  return (
    <Pressable
      onPress={() => router.push(`/item/${item.id}` as never)}
      className="flex-row items-center bg-ink-700 rounded-2xl overflow-hidden mb-3 active:opacity-80"
    >
      <Image
        source={{ uri: item.image }}
        style={{ width: 92, height: 92 }}
        contentFit="cover"
        transition={200}
      />
      <View className="flex-1 px-4 py-3">
        <Text className="text-cream-50 font-display text-lg leading-tight" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="text-cream-400 font-sans text-xs mt-0.5" numberOfLines={1}>
          {item.tagline}
        </Text>
        <View className="flex-row items-center justify-between mt-2">
          <View className="flex-row gap-1">
            {item.tags.slice(0, 2).map((t) => (
              <Tag key={t} value={t} />
            ))}
          </View>
          <Text className="text-gold-400 font-sansSemi text-sm">
            {formatPrice(item.priceCents)}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onAdd}
        hitSlop={10}
        className="w-10 h-10 rounded-full bg-gold-500 items-center justify-center mr-3 active:opacity-80"
      >
        <Ionicons name="add" size={20} color="#0E0B08" />
      </Pressable>
    </Pressable>
  );
}
