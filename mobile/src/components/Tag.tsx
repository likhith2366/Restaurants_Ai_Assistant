import { Text, View } from "react-native";
import { tagLabel } from "@/util/format";

export function Tag({ value, tone }: { value: string; tone?: "default" | "spice" | "veg" | "gold" }) {
  const resolvedTone =
    tone ??
    (value === "spicy"
      ? "spice"
      : value === "vegan" || value === "vegetarian" || value === "gf"
        ? "veg"
        : value === "popular"
          ? "gold"
          : "default");

  const styles: Record<typeof resolvedTone, { bg: string; text: string; border: string }> = {
    default: { bg: "bg-ink-700", text: "text-cream-300", border: "border-ink-500" },
    spice: { bg: "bg-ember-500/15", text: "text-ember-500", border: "border-ember-500/40" },
    veg: { bg: "bg-leaf-500/15", text: "text-leaf-500", border: "border-leaf-500/40" },
    gold: { bg: "bg-gold-500/15", text: "text-gold-400", border: "border-gold-500/40" },
  } as const;

  const s = styles[resolvedTone];
  return (
    <View className={`px-2 py-0.5 rounded-full border ${s.bg} ${s.border}`}>
      <Text className={`text-[10px] font-sansSemi tracking-wider uppercase ${s.text}`}>
        {tagLabel(value)}
      </Text>
    </View>
  );
}
