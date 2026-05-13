import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Haptics } from "@/util/haptics";
import { useMenuStore } from "@/stores/menu";
import { useCartStore, lineUnitCents } from "@/stores/cart";
import { formatPrice } from "@/util/format";
import { Tag } from "@/components/Tag";

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useMenuStore((s) => (id ? s.getItem(id) : undefined));
  const add = useCartStore((s) => s.add);

  const [options, setOptions] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);

  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0E0B08" }}>
        <View className="flex-1 items-center justify-center">
          <Text className="text-cream-300 font-sans">Item not found.</Text>
          <Pressable onPress={() => router.back()} className="mt-4">
            <Text className="text-gold-400 font-sansSemi">Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const unit = useMemo(() => lineUnitCents(item, options), [item, options]);

  const onAdd = () => {
    // require all "required" option groups to be set
    for (const g of item.optionGroups ?? []) {
      if (g.required && !options[g.id]) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    add(item.id, { quantity, options });
    router.back();
  };

  const missingRequired = (item.optionGroups ?? []).some(
    (g) => g.required && !options[g.id],
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#0E0B08" }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="relative h-[420px]">
          <Image
            source={{ uri: item.image }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={300}
          />
          <LinearGradient
            colors={["rgba(14,11,8,0.5)", "rgba(14,11,8,0)", "rgba(14,11,8,1)"]}
            locations={[0, 0.45, 1]}
            style={{ position: "absolute", inset: 0 } as any}
          />
          <SafeAreaView edges={["top"]} className="absolute top-0 left-0 right-0">
            <View className="flex-row items-center justify-between px-5 pt-1">
              <Pressable
                onPress={() => router.back()}
                hitSlop={10}
                className="w-10 h-10 rounded-full bg-ink-900/70 border border-ink-700 items-center justify-center"
              >
                <Ionicons name="chevron-down" size={22} color="#F4EBDD" />
              </Pressable>
            </View>
          </SafeAreaView>
          <View className="absolute left-5 right-5 bottom-5">
            <View className="flex-row gap-1.5 mb-3">
              {item.tags.map((t) => (
                <Tag key={t} value={t} />
              ))}
            </View>
            <Text className="text-cream-50 font-display text-[40px] leading-[42px]">
              {item.name}
            </Text>
            <Text className="text-cream-300 font-serif italic text-sm mt-1">
              {item.tagline}
            </Text>
          </View>
        </View>

        <View className="px-6 pt-6">
          <Text className="text-cream-200 font-sans text-[15px] leading-relaxed">
            {item.description}
          </Text>

          {item.optionGroups?.map((group) => (
            <View key={group.id} className="mt-7">
              <View className="flex-row items-baseline mb-3">
                <Text className="text-cream-50 font-display text-lg">
                  {group.label}
                </Text>
                {group.required ? (
                  <Text className="text-gold-400 font-sansMed text-xs ml-2">
                    · required
                  </Text>
                ) : (
                  <Text className="text-cream-500 font-sans text-xs ml-2">
                    · optional
                  </Text>
                )}
              </View>
              <View className="flex-row flex-wrap gap-2">
                {group.options.map((opt) => {
                  const active = options[group.id] === opt.id;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setOptions((o) => ({ ...o, [group.id]: opt.id }));
                      }}
                      className={`flex-row items-center px-4 py-2.5 rounded-full border ${
                        active
                          ? "bg-cream-50 border-cream-50"
                          : "bg-ink-700 border-ink-500"
                      } active:opacity-80`}
                    >
                      <Text
                        className={`font-sansMed text-sm ${
                          active ? "text-ink-900" : "text-cream-100"
                        }`}
                      >
                        {opt.label}
                      </Text>
                      {opt.priceDelta > 0 ? (
                        <Text
                          className={`font-sans text-xs ml-1.5 ${
                            active ? "text-ink-700" : "text-cream-400"
                          }`}
                        >
                          +{formatPrice(opt.priceDelta)}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View className="absolute left-0 right-0 bottom-0 bg-ink-800 border-t border-ink-700 px-5 pt-4 pb-9">
        <View className="flex-row items-center mb-3">
          <View className="flex-row items-center bg-ink-700 rounded-full border border-ink-500 mr-3">
            <Pressable
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              hitSlop={8}
              className="w-10 h-10 items-center justify-center"
            >
              <Ionicons name="remove" size={18} color="#F4EBDD" />
            </Pressable>
            <Text className="text-cream-50 font-sansSemi w-6 text-center">
              {quantity}
            </Text>
            <Pressable
              onPress={() => setQuantity((q) => Math.min(20, q + 1))}
              hitSlop={8}
              className="w-10 h-10 items-center justify-center"
            >
              <Ionicons name="add" size={18} color="#F4EBDD" />
            </Pressable>
          </View>
          <View className="flex-1">
            <Text className="text-cream-400 font-sans text-[11px] uppercase tracking-wider">
              Total
            </Text>
            <Text className="text-cream-50 font-display text-2xl">
              {formatPrice(unit * quantity)}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onAdd}
          disabled={missingRequired}
          className={`rounded-2xl py-4 items-center ${
            missingRequired ? "bg-ink-600" : "bg-gold-500 active:opacity-90"
          }`}
        >
          <Text
            className={`font-sansBold text-base tracking-wide ${
              missingRequired ? "text-cream-500" : "text-ink-900"
            }`}
          >
            {missingRequired ? "Choose an option" : "Add to cart"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
