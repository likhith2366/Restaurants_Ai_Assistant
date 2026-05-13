export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function tagLabel(tag: string): string {
  switch (tag) {
    case "spicy":
      return "Spicy";
    case "vegan":
      return "Vegan";
    case "vegetarian":
      return "Veg";
    case "gf":
      return "GF";
    case "seafood":
      return "Seafood";
    case "popular":
      return "Popular";
    case "cold":
      return "Cold";
    default:
      return tag;
  }
}
