// The Intelligent Bistro — menu catalog.
// Images are from Unsplash (free for commercial use) and chosen to look great
// on a dark background. Prices are in USD cents to avoid floating-point math.

export type Category = "starters" | "mains" | "sides" | "desserts" | "drinks";

export interface MenuOption {
  id: string;
  label: string;
  // delta in cents added to base price when selected
  priceDelta: number;
}

export interface MenuOptionGroup {
  id: string;
  label: string;
  // when required, the cart UI/AI must pick exactly one
  required: boolean;
  options: MenuOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: Category;
  priceCents: number;
  image: string;
  tags: string[]; // e.g. ["spicy", "vegan", "gf"] — used for AI matching
  optionGroups?: MenuOptionGroup[];
}

export const CATEGORIES: { id: Category; label: string; blurb: string }[] = [
  { id: "starters", label: "Starters", blurb: "Small plates to begin" },
  { id: "mains", label: "Mains", blurb: "The heart of the meal" },
  { id: "sides", label: "Sides", blurb: "Companions" },
  { id: "desserts", label: "Desserts", blurb: "Sweet endings" },
  { id: "drinks", label: "Drinks", blurb: "Pours & pairings" },
];

// Size is an upgrade path, not a forced choice — items default to the
// smallest/regular and the AI proactively offers the larger pour/portion.
const sizeGroup = (basis: "drink" | "side"): MenuOptionGroup => ({
  id: "size",
  label: "Size",
  required: false,
  options:
    basis === "drink"
      ? [
          { id: "sm", label: "Small", priceDelta: 0 },
          { id: "md", label: "Medium", priceDelta: 100 },
          { id: "lg", label: "Large", priceDelta: 200 },
        ]
      : [
          { id: "reg", label: "Regular", priceDelta: 0 },
          { id: "lg", label: "Large", priceDelta: 250 },
        ],
});

const spiceGroup: MenuOptionGroup = {
  id: "spice",
  label: "Spice level",
  required: false,
  options: [
    { id: "mild", label: "Mild", priceDelta: 0 },
    { id: "medium", label: "Medium", priceDelta: 0 },
    { id: "hot", label: "Hot", priceDelta: 0 },
    { id: "extra-hot", label: "Extra hot", priceDelta: 0 },
  ],
};

export const MENU: MenuItem[] = [
  // ── Starters ───────────────────────────────────────────────────────────────
  {
    id: "burrata",
    name: "Heirloom Burrata",
    tagline: "Creamy burrata, tomato confit, basil oil",
    description:
      "Cold-pressed Tuscan olive oil, slow-roasted heirloom tomatoes, torn basil, sourdough crostini.",
    category: "starters",
    priceCents: 1600,
    image:
      "https://images.unsplash.com/photo-1608897013039-887f21d8c804?w=900&q=80",
    tags: ["vegetarian", "cold"],
  },
  {
    id: "tuna-tartare",
    name: "Yellowfin Tartare",
    tagline: "Sesame, avocado, citrus ponzu",
    description:
      "Sushi-grade yellowfin tuna, ripe avocado, micro shiso, crisp wonton, yuzu ponzu.",
    category: "starters",
    priceCents: 1900,
    image:
      "https://images.unsplash.com/photo-1553621042-f6e147245754?w=900&q=80",
    tags: ["seafood", "gf"],
  },
  {
    id: "wings",
    name: "Smoked Korean Wings",
    tagline: "Gochujang glaze, sesame, scallion",
    description:
      "Apple-wood smoked then flash-fried. Sticky gochujang lacquer with toasted sesame.",
    category: "starters",
    priceCents: 1500,
    image:
      "https://images.unsplash.com/photo-1527477396000-e27163b481c2?w=900&q=80",
    tags: ["spicy", "gf"],
    optionGroups: [spiceGroup],
  },
  {
    id: "oysters",
    name: "Pacific Oysters",
    tagline: "Half dozen, mignonette, lemon",
    description:
      "Six Pacific Northwest oysters on the half shell, classic shallot mignonette, lemon wedge, fresh horseradish.",
    category: "starters",
    priceCents: 2400,
    image:
      "https://images.unsplash.com/photo-1606851094291-6efae152bb87?w=900&q=80",
    tags: ["seafood", "gf", "cold"],
  },
  {
    id: "carrot-soup",
    name: "Roasted Carrot Soup",
    tagline: "Ginger, coconut, toasted seeds",
    description:
      "Slow-roasted heirloom carrots blended with ginger and coconut milk, toasted pumpkin seeds, chili oil drizzle.",
    category: "starters",
    priceCents: 1300,
    image:
      "https://images.unsplash.com/photo-1547592180-85f173990554?w=900&q=80",
    tags: ["vegan", "gf"],
  },

  // ── Mains ──────────────────────────────────────────────────────────────────
  {
    id: "spicy-chicken-sandwich",
    name: "Spicy Chicken Sandwich",
    tagline: "Buttermilk-fried, Nashville hot, brioche",
    description:
      "Buttermilk-brined chicken thigh, Nashville hot oil, pickles, slaw, toasted brioche.",
    category: "mains",
    priceCents: 1800,
    image:
      "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=900&q=80",
    tags: ["spicy", "popular"],
    optionGroups: [spiceGroup],
  },
  {
    id: "wagyu-burger",
    name: "Wagyu Smashburger",
    tagline: "Double patty, aged cheddar, secret sauce",
    description:
      "American wagyu smashed on the plancha, aged cheddar, caramelized onion, milk bun.",
    category: "mains",
    priceCents: 2400,
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=900&q=80",
    tags: ["popular"],
    optionGroups: [
      {
        id: "doneness",
        label: "Doneness",
        required: false,
        options: [
          { id: "rare", label: "Rare", priceDelta: 0 },
          { id: "medium-rare", label: "Medium rare", priceDelta: 0 },
          { id: "medium", label: "Medium", priceDelta: 0 },
          { id: "medium-well", label: "Medium well", priceDelta: 0 },
          { id: "well-done", label: "Well done", priceDelta: 0 },
        ],
      },
    ],
  },
  {
    id: "branzino",
    name: "Whole Roasted Branzino",
    tagline: "Lemon, capers, brown butter",
    description:
      "Mediterranean sea bass roasted whole, finished with brown butter, capers, and Amalfi lemon.",
    category: "mains",
    priceCents: 3400,
    image:
      "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=900&q=80",
    tags: ["seafood", "gf"],
  },
  {
    id: "mushroom-risotto",
    name: "Wild Mushroom Risotto",
    tagline: "Carnaroli, porcini, aged parmesan",
    description:
      "Slow-stirred carnaroli rice, mixed wild mushrooms, parmesan, truffle finish.",
    category: "mains",
    priceCents: 2600,
    image:
      "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=900&q=80",
    tags: ["vegetarian"],
  },
  {
    id: "cacio-e-pepe",
    name: "Truffle Cacio e Pepe",
    tagline: "Hand-cut pasta, pecorino, summer truffle",
    description:
      "Hand-cut tonnarelli, aged pecorino, cracked Tellicherry pepper, finished with shaved summer truffle.",
    category: "mains",
    priceCents: 2800,
    image:
      "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=900&q=80",
    tags: ["vegetarian", "popular"],
  },
  {
    id: "ribeye",
    name: "Bone-in Ribeye",
    tagline: "16oz, 32-day dry-aged, beef tallow",
    description:
      "16oz bone-in ribeye, 32-day dry-aged, basted in beef tallow with rosemary and garlic. Served with truffle butter and grilled lemon.",
    category: "mains",
    priceCents: 5800,
    image:
      "https://images.unsplash.com/photo-1546964124-0cce460f38ef?w=900&q=80",
    tags: ["gf", "popular"],
    optionGroups: [
      {
        id: "doneness",
        label: "Doneness",
        required: true,
        options: [
          { id: "rare", label: "Rare", priceDelta: 0 },
          { id: "medium-rare", label: "Medium rare", priceDelta: 0 },
          { id: "medium", label: "Medium", priceDelta: 0 },
          { id: "medium-well", label: "Medium well", priceDelta: 0 },
          { id: "well-done", label: "Well done", priceDelta: 0 },
        ],
      },
    ],
  },
  {
    id: "cauliflower-steak",
    name: "Charred Cauliflower Steak",
    tagline: "Romesco, Marcona almonds, salsa verde",
    description:
      "Whole head of cauliflower charred over wood, romesco purée, toasted Marcona almonds, herb salsa verde.",
    category: "mains",
    priceCents: 2200,
    image:
      "https://images.unsplash.com/photo-1568625365131-079e026a927d?w=900&q=80",
    tags: ["vegan", "gf"],
  },

  // ── Sides ──────────────────────────────────────────────────────────────────
  {
    id: "truffle-fries",
    name: "Truffle Fries",
    tagline: "Black truffle, parmesan, herbs",
    description:
      "Triple-cooked Yukon golds tossed in truffle oil, parmesan, and fresh herbs.",
    category: "sides",
    priceCents: 1100,
    image:
      "https://images.unsplash.com/photo-1576107232684-1279f390859f?w=900&q=80",
    tags: ["vegetarian", "popular"],
    optionGroups: [sizeGroup("side")],
  },
  {
    id: "brussels",
    name: "Charred Brussels Sprouts",
    tagline: "Maple, chili, lime",
    description:
      "Wok-charred sprouts, maple glaze, calabrian chili, lime zest, crushed peanuts.",
    category: "sides",
    priceCents: 1200,
    image:
      "https://images.unsplash.com/photo-1438118907704-7718ee9a191a?w=900&q=80",
    tags: ["vegan", "gf", "spicy"],
  },
  {
    id: "caesar",
    name: "Little Gem Caesar",
    tagline: "Anchovy, parmesan, sourdough",
    description:
      "Crisp little gems, white anchovy, aged parmesan, torn sourdough croutons.",
    category: "sides",
    priceCents: 1400,
    image:
      "https://images.unsplash.com/photo-1546793665-c74683f339c1?w=900&q=80",
    tags: [],
  },
  {
    id: "mac-and-cheese",
    name: "Cast-Iron Mac & Cheese",
    tagline: "Aged gouda, gruyère, brioche crumb",
    description:
      "Cavatappi tossed in a four-cheese béchamel — aged gouda, gruyère, cheddar, parmesan — topped with brioche crumb and baked.",
    category: "sides",
    priceCents: 1300,
    image:
      "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=900&q=80",
    tags: ["vegetarian", "popular"],
  },
  {
    id: "roasted-carrots",
    name: "Glazed Heirloom Carrots",
    tagline: "Honey, harissa, labneh",
    description:
      "Heirloom carrots glazed in honey and harissa, served over cool labneh, finished with toasted dukkah.",
    category: "sides",
    priceCents: 1100,
    image:
      "https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=900&q=80",
    tags: ["vegetarian", "gf"],
  },

  // ── Desserts ───────────────────────────────────────────────────────────────
  {
    id: "tiramisu",
    name: "Espresso Tiramisu",
    tagline: "Mascarpone, cocoa, ladyfingers",
    description:
      "Hand-whipped mascarpone, espresso-soaked ladyfingers, dark cocoa, marsala.",
    category: "desserts",
    priceCents: 1200,
    image:
      "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=900&q=80",
    tags: ["vegetarian"],
  },
  {
    id: "chocolate-cake",
    name: "Molten Chocolate Cake",
    tagline: "Valrhona, sea salt, vanilla bean",
    description:
      "Warm Valrhona dark chocolate cake, flaky sea salt, Tahitian vanilla ice cream.",
    category: "desserts",
    priceCents: 1300,
    image:
      "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=900&q=80",
    tags: ["vegetarian", "popular"],
  },
  {
    id: "creme-brulee",
    name: "Vanilla Crème Brûlée",
    tagline: "Tahitian vanilla, torched sugar",
    description:
      "Tahitian vanilla custard, cassonade sugar crust torched to order, fresh berry compote on the side.",
    category: "desserts",
    priceCents: 1200,
    image:
      "https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=900&q=80",
    tags: ["vegetarian", "gf"],
  },
  {
    id: "lemon-sorbet",
    name: "Meyer Lemon Sorbet",
    tagline: "Two scoops, candied zest",
    description:
      "House-churned Meyer lemon sorbet, candied lemon zest, drizzle of basil oil.",
    category: "desserts",
    priceCents: 900,
    image:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=900&q=80",
    tags: ["vegan", "gf"],
  },

  // ── Drinks ─────────────────────────────────────────────────────────────────
  {
    id: "water-still",
    name: "Still Water",
    tagline: "Acqua Panna",
    description: "Bottled still water, served chilled.",
    category: "drinks",
    priceCents: 500,
    image:
      "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=900&q=80",
    tags: ["vegan", "gf"],
    optionGroups: [sizeGroup("drink")],
  },
  {
    id: "water-sparkling",
    name: "Sparkling Water",
    tagline: "San Pellegrino",
    description: "Bottled sparkling water, served chilled.",
    category: "drinks",
    priceCents: 500,
    image:
      "https://images.unsplash.com/photo-1605185189311-46d4b07ed6f8?w=900&q=80",
    tags: ["vegan", "gf"],
    optionGroups: [sizeGroup("drink")],
  },
  {
    id: "lemonade",
    name: "House Lemonade",
    tagline: "Meyer lemon, rosemary, honey",
    description:
      "Cold-pressed Meyer lemons, rosemary syrup, raw wildflower honey.",
    category: "drinks",
    priceCents: 700,
    image:
      "https://images.unsplash.com/photo-1556881286-fc6915169721?w=900&q=80",
    tags: ["vegan"],
    optionGroups: [sizeGroup("drink")],
  },
  {
    id: "espresso",
    name: "Espresso",
    tagline: "Single origin, double shot",
    description:
      "Direct-trade Ethiopian single origin, pulled as a double ristretto.",
    category: "drinks",
    priceCents: 450,
    image:
      "https://images.unsplash.com/photo-1510707577719-ae7c14805e3a?w=900&q=80",
    tags: ["vegan", "gf"],
  },
  {
    id: "red-wine",
    name: "Sangiovese, Tuscany",
    tagline: "Glass — medium body",
    description:
      "Bright cherry, leather, soft tannins. Pairs with mains and reds.",
    category: "drinks",
    priceCents: 1400,
    image:
      "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=900&q=80",
    tags: [],
  },
  {
    id: "old-fashioned",
    name: "Bourbon Old Fashioned",
    tagline: "Demerara, Angostura, orange",
    description:
      "Buffalo Trace bourbon, demerara syrup, Angostura and orange bitters, expressed orange peel.",
    category: "drinks",
    priceCents: 1600,
    image:
      "https://images.unsplash.com/photo-1568644396922-5c3bfae12521?w=900&q=80",
    tags: [],
  },
  {
    id: "negroni",
    name: "Classic Negroni",
    tagline: "Gin, Campari, sweet vermouth",
    description:
      "Equal parts London dry gin, Campari, and Carpano Antica, stirred over ice, orange twist.",
    category: "drinks",
    priceCents: 1500,
    image:
      "https://images.unsplash.com/photo-1551751299-1b51cab2694c?w=900&q=80",
    tags: [],
  },
  {
    id: "cold-brew",
    name: "Cold Brew",
    tagline: "Ethiopian, slow-steeped 18 hours",
    description:
      "Single-origin Ethiopian beans, slow-steeped for 18 hours, served over a clear ice cube.",
    category: "drinks",
    priceCents: 600,
    image:
      "https://images.unsplash.com/photo-1497636577773-f1231844b336?w=900&q=80",
    tags: ["vegan", "gf"],
    optionGroups: [sizeGroup("drink")],
  },
];

export function findMenuItem(idOrName: string): MenuItem | undefined {
  const needle = idOrName.toLowerCase().trim();
  // exact id match wins
  const byId = MENU.find((m) => m.id === needle);
  if (byId) return byId;
  // name exact / contains
  return (
    MENU.find((m) => m.name.toLowerCase() === needle) ??
    MENU.find((m) => m.name.toLowerCase().includes(needle)) ??
    MENU.find((m) => needle.includes(m.name.toLowerCase()))
  );
}
