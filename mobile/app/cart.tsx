import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  LinearTransition,
  SlideOutRight,
} from "react-native-reanimated";
import { Haptics } from "@/util/haptics";
import { confirm, notify } from "@/util/dialog";
import { useCartStore, lineUnitCents, type CartLine } from "@/stores/cart";
import { useMenuStore } from "@/stores/menu";
import { formatPrice } from "@/util/format";

export default function CartScreen() {
  const lines = useCartStore((s) => s.lines);
  const getItem = useMenuStore((s) => s.getItem);
  const bump = useCartStore((s) => s.bump);
  const remove = useCartStore((s) => s.remove);
  const clear = useCartStore((s) => s.clear);
  const totalCents = useCartStore((s) => s.totalCents(getItem));

  const subtotal = totalCents;
  const tax = Math.round(subtotal * 0.0875);
  const total = subtotal + tax;

  const askClear = () => {
    confirm({
      title: "Clear cart?",
      message: "This removes all items from your order.",
      confirmLabel: "Clear",
      cancelLabel: "Keep",
      destructive: true,
      onConfirm: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        clear();
      },
    });
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#0E0B08" }}>
      {/* header */}
      <View className="flex-row items-center justify-between px-5 pt-1 pb-4">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          className="w-10 h-10 rounded-full bg-ink-700 items-center justify-center"
        >
          <Ionicons name="chevron-down" size={22} color="#F4EBDD" />
        </Pressable>
        <Text className="text-cream-50 font-display text-2xl">Your Order</Text>
        <Pressable
          onPress={askClear}
          hitSlop={10}
          disabled={lines.length === 0}
          className={`w-10 h-10 rounded-full items-center justify-center ${
            lines.length ? "bg-ink-700" : "bg-ink-800"
          }`}
        >
          <Ionicons
            name="trash-outline"
            size={18}
            color={lines.length ? "#E7D8BF" : "#3A2F23"}
          />
        </Pressable>
      </View>

      {lines.length === 0 ? <Empty /> : null}

      {lines.length > 0 ? (
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 280 }}
        showsVerticalScrollIndicator={false}
      >
        {lines.map((line) => (
          <CartLineRow
            key={line.lineId}
            line={line}
            onIncrement={() => {
              Haptics.selectionAsync();
              bump(line.lineId, 1);
            }}
            onDecrement={() => {
              Haptics.selectionAsync();
              bump(line.lineId, -1);
            }}
            onRemove={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              remove(line.lineId);
            }}
          />
        ))}
      </ScrollView>
      ) : null}

      {lines.length > 0 ? (
        <View className="absolute left-0 right-0 bottom-0 bg-ink-800 border-t border-ink-700 px-5 pt-5 pb-9">
          <Row label="Subtotal" value={formatPrice(subtotal)} />
          <Row label="Tax (8.75%)" value={formatPrice(tax)} />
          <View className="h-px bg-ink-700 my-3" />
          <View className="flex-row items-baseline justify-between mb-4">
            <Text className="text-cream-100 font-sansSemi text-base">Total</Text>
            <Text className="text-cream-50 font-display text-3xl">
              {formatPrice(total)}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              notify(
                "Order sent",
                "This is a demo — the kitchen would confirm here.",
              );
              clear();
              router.back();
            }}
            className="bg-gold-500 rounded-2xl py-4 items-center active:opacity-90"
          >
            <Text className="text-ink-900 font-sansBold text-base tracking-wide">
              Send to kitchen
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function CartLineRow({
  line,
  onIncrement,
  onDecrement,
  onRemove,
}: {
  line: CartLine;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}) {
  const item = useMenuStore((s) => s.getItem(line.itemId));
  if (!item) return null;
  const unit = lineUnitCents(item, line.options);
  const total = unit * line.quantity;

  const optionLabels: string[] = [];
  for (const group of item.optionGroups ?? []) {
    const chosen = line.options[group.id];
    if (!chosen) continue;
    const opt = group.options.find((o) => o.id === chosen);
    if (opt) optionLabels.push(opt.label);
  }

  return (
    <Animated.View
      layout={LinearTransition.springify().damping(20)}
      entering={FadeIn.duration(200)}
      exiting={SlideOutRight.duration(220)}
      className="flex-row bg-ink-700 rounded-2xl overflow-hidden mb-3"
    >
      <Image
        source={{ uri: item.image }}
        style={{ width: 96, height: 96 }}
        contentFit="cover"
      />
      <View className="flex-1 p-3 justify-between">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-2">
            <Text className="text-cream-50 font-display text-base leading-tight" numberOfLines={1}>
              {item.name}
            </Text>
            {optionLabels.length ? (
              <Text className="text-cream-400 font-sans text-xs mt-0.5">
                {optionLabels.join(" · ")}
              </Text>
            ) : null}
            {line.note ? (
              <View className="flex-row items-center mt-1">
                <Ionicons name="chatbubble-ellipses-outline" size={11} color="#E5B16A" />
                <Text className="text-gold-400 font-serif italic text-xs ml-1 flex-1" numberOfLines={2}>
                  {line.note}
                </Text>
              </View>
            ) : null}
          </View>
          <Pressable onPress={onRemove} hitSlop={8} className="p-1">
            <Ionicons name="close" size={18} color="#7B7060" />
          </Pressable>
        </View>

        <View className="flex-row items-center justify-between mt-2">
          <View className="flex-row items-center bg-ink-900 rounded-full border border-ink-500">
            <Pressable onPress={onDecrement} hitSlop={6} className="w-8 h-8 items-center justify-center">
              <Ionicons name="remove" size={16} color="#F4EBDD" />
            </Pressable>
            <Text className="text-cream-50 font-sansSemi text-sm w-6 text-center">
              {line.quantity}
            </Text>
            <Pressable onPress={onIncrement} hitSlop={6} className="w-8 h-8 items-center justify-center">
              <Ionicons name="add" size={16} color="#F4EBDD" />
            </Pressable>
          </View>
          <Text className="text-gold-400 font-sansSemi text-sm">
            {formatPrice(total)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between items-center py-1">
      <Text className="text-cream-400 font-sans text-sm">{label}</Text>
      <Text className="text-cream-200 font-sansMed text-sm">{value}</Text>
    </View>
  );
}

function Empty() {
  return (
    <View className="flex-1 items-center justify-center px-10 py-20">
      <View className="w-20 h-20 rounded-full bg-ink-700 items-center justify-center mb-5">
        <Ionicons name="bag-outline" size={32} color="#7B7060" />
      </View>
      <Text className="text-cream-50 font-display text-2xl text-center">
        Your cart is empty
      </Text>
      <Text className="text-cream-400 font-serif italic text-sm text-center mt-2 max-w-[260px]">
        Browse the menu or tap the gold spark to ask the Bistro for ideas.
      </Text>
      <Pressable
        onPress={() => router.back()}
        className="mt-6 bg-gold-500 rounded-full px-5 py-3 active:opacity-90"
      >
        <Text className="text-ink-900 font-sansBold text-sm tracking-wide">
          Back to menu
        </Text>
      </Pressable>
    </View>
  );
}
