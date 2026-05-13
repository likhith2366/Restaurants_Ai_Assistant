import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { router } from "expo-router";
import { useMenuStore } from "@/stores/menu";
import { MenuCard } from "@/components/MenuCard";
import { MenuCardCompact } from "@/components/MenuCardCompact";
import { CartBar } from "@/components/CartBar";
import type { Category, MenuItem } from "@/types/api";
import { useCartStore } from "@/stores/cart";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=1400&q=85";

export default function MenuScreen() {
  const items = useMenuStore((s) => s.items);
  const categories = useMenuStore((s) => s.categories);
  const loading = useMenuStore((s) => s.loading);
  const error = useMenuStore((s) => s.error);
  const refetch = useMenuStore((s) => s.fetch);
  const cartQty = useCartStore((s) => s.totalQuantity());

  const [active, setActive] = useState<Category | "all">("all");

  const filtered = useMemo(() => {
    if (active === "all") return items;
    return items.filter((i) => i.category === active);
  }, [active, items]);

  const popular = useMemo(
    () => items.filter((i) => i.tags.includes("popular")).slice(0, 5),
    [items],
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#0E0B08" }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View className="relative h-[340px] mb-2">
          <Image
            source={{ uri: HERO_IMAGE }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={400}
          />
          <LinearGradient
            colors={["rgba(14,11,8,0.35)", "rgba(14,11,8,0)", "rgba(14,11,8,1)"]}
            locations={[0, 0.5, 1]}
            style={{ position: "absolute", inset: 0 } as any}
          />

          <View className="absolute top-3 left-5 right-5 flex-row items-center justify-between">
            <View>
              <Text className="text-cream-300 font-sansMed text-[11px] tracking-[3px] uppercase">
                The Intelligent
              </Text>
            </View>
            <Pressable
              onPress={() => router.push("/cart" as never)}
              className="w-11 h-11 rounded-full bg-ink-900/60 border border-ink-700 items-center justify-center"
            >
              <Ionicons name="bag-outline" size={20} color="#F4EBDD" />
              {cartQty > 0 ? (
                <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gold-500 items-center justify-center">
                  <Text className="text-ink-900 font-sansBold text-[10px]">{cartQty}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <Animated.View
            entering={FadeIn.delay(200).duration(600)}
            className="absolute left-5 right-5 bottom-7"
          >
            <Text className="text-cream-50 font-display text-[56px] leading-[56px] tracking-tight">
              Bistro
            </Text>
            <Text className="text-cream-300 font-serif italic text-base mt-1">
              A conversation with the kitchen.
            </Text>
          </Animated.View>
        </View>

        {/* ── Categories ───────────────────────────────────────────────── */}
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 14, gap: 8 }}
          >
            <CategoryChip
              label="All"
              active={active === "all"}
              onPress={() => setActive("all")}
            />
            {categories.map((c) => (
              <CategoryChip
                key={c.id}
                label={c.label}
                active={active === c.id}
                onPress={() => setActive(c.id)}
              />
            ))}
          </ScrollView>
        </View>

        {/* ── Loading / error ──────────────────────────────────────────── */}
        {loading && items.length === 0 ? (
          <View className="px-5 py-16 items-center">
            <ActivityIndicator color="#C6913C" />
            <Text className="text-cream-400 font-sans text-sm mt-3">
              Loading the menu…
            </Text>
          </View>
        ) : null}

        {error && items.length === 0 ? (
          <View className="mx-5 my-6 p-5 rounded-2xl bg-ember-500/10 border border-ember-500/30">
            <Text className="text-ember-500 font-sansSemi text-sm mb-1">
              Couldn't reach the kitchen
            </Text>
            <Text className="text-cream-300 font-sans text-xs mb-3">{error}</Text>
            <Pressable
              onPress={refetch}
              className="bg-ember-500 rounded-full px-4 py-2 self-start"
            >
              <Text className="text-cream-50 font-sansSemi text-xs">Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── Featured row (only on "all") ─────────────────────────────── */}
        {active === "all" && popular.length > 0 ? (
          <View className="mb-2">
            <SectionTitle label="Tonight's Favorites" caption="Hand-picked by the chef" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
            >
              {popular.map((item) => (
                <MenuCard key={item.id} item={item} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* ── Grouped sections ─────────────────────────────────────────── */}
        {active === "all" ? (
          categories.map((cat, sIdx) => {
            const sectionItems = items.filter((i) => i.category === cat.id);
            if (!sectionItems.length) return null;
            return (
              <Animated.View
                key={cat.id}
                entering={FadeInDown.delay(80 * sIdx).springify().damping(20)}
                className="mt-2"
              >
                <SectionTitle label={cat.label} caption={cat.blurb} />
                <View className="px-5">
                  {sectionItems.map((item) => (
                    <MenuCardCompact key={item.id} item={item} />
                  ))}
                </View>
              </Animated.View>
            );
          })
        ) : (
          <View className="mt-2">
            <SectionTitle
              label={categories.find((c) => c.id === active)?.label ?? ""}
              caption={categories.find((c) => c.id === active)?.blurb}
            />
            <View className="px-5">
              {filtered.map((item) => (
                <MenuCardCompact key={item.id} item={item} />
              ))}
            </View>
          </View>
        )}

        {/* footer flourish */}
        <View className="items-center mt-8">
          <Text className="text-cream-500 font-serif italic text-xs">
            — fin —
          </Text>
        </View>
      </ScrollView>
      <CartBar />
    </SafeAreaView>
  );
}

function CategoryChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-4 py-2 rounded-full border ${
        active
          ? "bg-cream-50 border-cream-50"
          : "bg-transparent border-ink-500"
      } active:opacity-80`}
    >
      <Text
        className={`font-sansMed text-[13px] ${
          active ? "text-ink-900" : "text-cream-200"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SectionTitle({ label, caption }: { label: string; caption?: string }) {
  return (
    <View className="px-5 mt-5 mb-4">
      <Text className="text-cream-50 font-display text-3xl leading-tight">
        {label}
      </Text>
      {caption ? (
        <Text className="text-cream-400 font-serif italic text-sm mt-0.5">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
