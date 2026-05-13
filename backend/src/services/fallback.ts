// Deterministic NL parser used when ANTHROPIC_API_KEY is not set, or as a
// safety net if the model errors. It's intentionally simple — the live
// Anthropic path is the real intelligence — but it's good enough to demo.

import { MENU, findMenuItem, type MenuItem } from "../data/menu.js";
import type { CartAction, CartLineForAi } from "../types/api.js";

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  couple: 2,
  few: 3,
};

// Look at the 25 characters of text preceding `index` for a quantity hint.
function quantityBefore(text: string, index: number): number {
  const window = text.slice(Math.max(0, index - 25), index).toLowerCase();
  const digit = window.match(/(\d+)\s*$/);
  if (digit) return Math.min(20, Math.max(1, parseInt(digit[1], 10)));
  for (const [word, n] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b\\s*$`).test(window)) return n;
  }
  return 1;
}

function parseSpice(text: string): string | undefined {
  if (/extra\s*hot|extra\s*spicy|fire/i.test(text)) return "extra-hot";
  if (/\bhot\b|very\s*spicy/i.test(text)) return "hot";
  if (/\bmedium\b/i.test(text)) return "medium";
  if (/\bmild\b/i.test(text)) return "mild";
  return undefined;
}

function parseSize(text: string): string | undefined {
  if (/\blarge\b|\bbig\b/i.test(text)) return "lg";
  if (/\bmedium\b|\bmed\b/i.test(text)) return "md";
  if (/\bsmall\b/i.test(text)) return "sm";
  if (/\bregular\b/i.test(text)) return "reg";
  return undefined;
}

// Hand-tuned aliases — single words that should map to a menu item when the
// user uses a casual short form ("water", "wings", "burger", "fries"…).
const ALIASES: { pattern: RegExp; itemId: string }[] = [
  { pattern: /\bsparkling\b/i, itemId: "water-sparkling" },
  { pattern: /\bstill\s+water\b/i, itemId: "water-still" },
  { pattern: /\bwater\b/i, itemId: "water-still" },
  { pattern: /\bwings?\b/i, itemId: "wings" },
  { pattern: /\bburger\b/i, itemId: "wagyu-burger" },
  { pattern: /\bfries\b/i, itemId: "truffle-fries" },
  { pattern: /\bsprouts?\b/i, itemId: "brussels" },
  { pattern: /\brisotto\b/i, itemId: "mushroom-risotto" },
  { pattern: /\bbranzino\b|\bsea\s+bass\b/i, itemId: "branzino" },
  { pattern: /\btartare\b|\btuna\b/i, itemId: "tuna-tartare" },
  { pattern: /\bburrata\b/i, itemId: "burrata" },
  { pattern: /\bcaesar\b/i, itemId: "caesar" },
  { pattern: /\btiramisu\b/i, itemId: "tiramisu" },
  { pattern: /\bchocolate\s+cake\b|\bmolten\b/i, itemId: "chocolate-cake" },
  { pattern: /\blemonade\b/i, itemId: "lemonade" },
  { pattern: /\bespresso\b/i, itemId: "espresso" },
  { pattern: /\b(red\s+)?wine\b|\bsangiovese\b/i, itemId: "red-wine" },
  { pattern: /\bsandwich\b/i, itemId: "spicy-chicken-sandwich" },
  // New items
  { pattern: /\boysters?\b/i, itemId: "oysters" },
  { pattern: /\b(carrot\s+)?soup\b/i, itemId: "carrot-soup" },
  { pattern: /\b(cacio\s+e\s+pepe|cacio|pasta|tonnarelli)\b/i, itemId: "cacio-e-pepe" },
  { pattern: /\bribeye\b|\bsteak\b/i, itemId: "ribeye" },
  { pattern: /\bcauliflower\b/i, itemId: "cauliflower-steak" },
  { pattern: /\bmac(\s|-)?(and|n|&|')?(\s|-)?cheese\b|\bmac\b/i, itemId: "mac-and-cheese" },
  { pattern: /\bcarrots?\b/i, itemId: "roasted-carrots" },
  { pattern: /\b(crème|creme)\s+brûlée\b|\bbrulee\b/i, itemId: "creme-brulee" },
  { pattern: /\bsorbet\b/i, itemId: "lemon-sorbet" },
  { pattern: /\bold\s+fashioned\b/i, itemId: "old-fashioned" },
  { pattern: /\bnegroni\b/i, itemId: "negroni" },
  { pattern: /\bcold\s+brew\b|\bcoffee\b/i, itemId: "cold-brew" },
];

interface Match {
  item: MenuItem;
  index: number;
}

function findMatches(text: string): Match[] {
  const matches: Match[] = [];
  const lower = text.toLowerCase();
  const taken: boolean[] = new Array(lower.length).fill(false);
  const claim = (item: MenuItem, idx: number, len: number) => {
    // avoid double-counting the same span
    for (let i = idx; i < idx + len; i++) if (taken[i]) return false;
    matches.push({ item, index: idx });
    for (let i = idx; i < idx + len; i++) taken[i] = true;
    return true;
  };

  // 1) full menu names first (highest signal).
  for (const item of MENU) {
    const name = item.name.toLowerCase();
    let from = 0;
    while (true) {
      const idx = lower.indexOf(name, from);
      if (idx === -1) break;
      claim(item, idx, name.length);
      from = idx + name.length;
    }
  }
  // 2) then aliases.
  for (const { pattern, itemId } of ALIASES) {
    const m = pattern.exec(text);
    if (m && m.index !== undefined) {
      const item = MENU.find((x) => x.id === itemId);
      if (item) claim(item, m.index, m[0].length);
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}

export function fallbackParse(
  userText: string,
  cart: CartLineForAi[],
): { reply: string; actions: CartAction[] } {
  const text = userText.trim();
  const actions: CartAction[] = [];

  if (/^(clear|empty|reset|start over)\b/i.test(text)) {
    return {
      reply: "Cleared your cart. Ready to start fresh.",
      actions: [{ type: "clear_cart" }],
    };
  }

  // place-order intents: "place the order", "send it to the kitchen",
  // "submit my order", "order it", "confirm order".
  if (
    /\b(place|submit|send|order|confirm)\b.*\b(order|kitchen|food)\b/i.test(text) ||
    /^(order|place it|send it|submit|confirm)\b/i.test(text)
  ) {
    return {
      reply: "Sending your order to the kitchen now.",
      actions: [{ type: "place_order" }],
    };
  }

  // remove / cancel
  if (/\b(remove|delete|cancel|take off|drop)\b/i.test(text)) {
    for (const { item } of findMatches(text)) {
      const line = cart.find((c) => c.itemId === item.id);
      actions.push({ type: "remove_item", target: line ? line.lineId : item.id });
    }
    if (actions.length) {
      return { reply: "Done — removed those from your cart.", actions };
    }
  }

  // update quantity ("make the fries 3", "change wagyu to 2")
  const updateMatch = text.match(
    /(?:make|change|set|update)\s+(?:the\s+)?(.+?)\s+(?:to\s+)?(\d+)\b/i,
  );
  if (updateMatch) {
    const item = findMenuItem(updateMatch[1]);
    const qty = parseInt(updateMatch[2], 10);
    if (item) {
      const line = cart.find((c) => c.itemId === item.id);
      return {
        reply: `Updated ${item.name} to ${qty}.`,
        actions: [
          { type: "update_quantity", target: line ? line.lineId : item.id, quantity: qty },
        ],
      };
    }
  }

  // Add path. Scan for items and infer per-item quantity from what precedes.
  const matches = findMatches(text);
  const summary: string[] = [];
  const spice = parseSpice(text);
  const size = parseSize(text);
  for (const { item, index } of matches) {
    const qty = quantityBefore(text, index);
    const options: Record<string, string> = {};
    if (spice && item.optionGroups?.some((g) => g.id === "spice")) options.spice = spice;
    if (size && item.optionGroups?.some((g) => g.id === "size")) options.size = size;
    actions.push({
      type: "add_item",
      itemId: item.id,
      quantity: qty,
      options: Object.keys(options).length ? options : undefined,
    });
    summary.push(`${qty}× ${item.name}`);
  }

  if (actions.length) {
    return { reply: `Added ${summary.join(", ")} to your cart.`, actions };
  }

  if (/\b(hi|hello|hey|yo)\b/i.test(text)) {
    return {
      reply:
        "Welcome to the Bistro. I can build your order — try “add a wagyu burger and large lemonade.”",
      actions: [],
    };
  }
  return {
    reply:
      "I didn't catch a menu item there. Try something like “two spicy chicken sandwiches and a large water.”",
    actions: [],
  };
}
