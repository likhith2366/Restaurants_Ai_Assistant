// When the model emits tool calls but no accompanying text (Gemini does this
// fairly often, Claude does it less), synthesize a host-like reply here using
// the menu data. This keeps the conversation feeling alive without requiring
// a second model round-trip.

import { MENU, type MenuItem } from "../data/menu.js";
import type { CartAction, CartLineForAi } from "../types/api.js";

function fmtPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function getItem(id: string): MenuItem | undefined {
  return MENU.find((m) => m.id === id);
}

function optionLabel(item: MenuItem, groupId: string, optionId: string): string {
  const g = item.optionGroups?.find((og) => og.id === groupId);
  return g?.options.find((o) => o.id === optionId)?.label ?? optionId;
}

// Group-specific natural-language question so we don't say things like
// "how would you like it size".
function questionFor(groupId: string, groupLabel: string): string {
  switch (groupId) {
    case "doneness":
      return "How would you like it cooked";
    case "spice":
      return "How spicy would you like it";
    case "size":
      return "What size would you like";
    default:
      return `How would you like the ${groupLabel.toLowerCase()}`;
  }
}

export function narrate(
  actions: CartAction[],
  _cartBefore: CartLineForAi[],
): string {
  if (!actions.length) return "";

  const adds = actions.filter(
    (a): a is Extract<CartAction, { type: "add_item" }> => a.type === "add_item",
  );
  const removes = actions.filter(
    (a): a is Extract<CartAction, { type: "remove_item" }> => a.type === "remove_item",
  );
  const updateQtys = actions.filter(
    (a): a is Extract<CartAction, { type: "update_quantity" }> =>
      a.type === "update_quantity",
  );
  const updateNotes = actions.filter(
    (a): a is Extract<CartAction, { type: "update_note" }> => a.type === "update_note",
  );

  // Place / clear — terminal states, simple phrasing.
  if (actions.some((a) => a.type === "place_order")) {
    return "Sending your order to the kitchen now — thank you.";
  }
  if (actions.some((a) => a.type === "clear_cart")) {
    return "Cleared your cart. What would you like to start with?";
  }

  // Swap pattern: one remove + one add (same itemId) → an option upgrade.
  if (adds.length === 1 && removes.length === 1) {
    const add = adds[0];
    const item = getItem(add.itemId);
    if (item && add.options) {
      const opts = Object.entries(add.options)
        .map(([k, v]) => optionLabel(item, k, v).toLowerCase())
        .join(", ");
      return `Done — switched the ${item.name} to ${opts}.`;
    }
    return "Done — updated your cart.";
  }

  // Single add — this is the conversational sweet spot.
  if (adds.length === 1 && removes.length === 0) {
    const add = adds[0];
    const item = getItem(add.itemId);
    if (!item) return "Added to your cart.";

    const used = add.options ?? {};

    // 1) Required option groups → always ask, even if defaulted.
    for (const g of item.optionGroups ?? []) {
      if (!g.required) continue;
      const labels = g.options.map((o) => o.label).join(", ");
      const chosen = used[g.id];
      const defaultLabel = chosen
        ? optionLabel(item, g.id, chosen).toLowerCase()
        : undefined;
      const defaultClause = defaultLabel ? `, ${defaultLabel} by default` : "";
      const question = questionFor(g.id, g.label);
      return `Added the ${item.name}${defaultClause}. ${question} — ${labels}?`;
    }

    // 2) Optional group with a priced upgrade available → offer it.
    for (const g of item.optionGroups ?? []) {
      const chosenId = used[g.id];
      const chosenOpt = g.options.find((o) => o.id === chosenId);
      const upgrades = g.options.filter((o) => o.priceDelta > 0);
      if (!upgrades.length) continue;
      // Find the next-priciest option above what they currently have.
      const currentDelta = chosenOpt?.priceDelta ?? 0;
      const better = upgrades
        .filter((o) => o.priceDelta > currentDelta)
        .sort((a, b) => a.priceDelta - b.priceDelta)[0];
      if (!better) continue;
      return `Added the ${item.name} — want to upgrade to ${better.label} for ${fmtPrice(better.priceDelta)} more?`;
    }

    // 3) Note attached? Echo it.
    if (add.note) {
      return `Added the ${item.name} with a note for the kitchen: "${add.note}".`;
    }

    return `Added the ${item.name}. Anything else?`;
  }

  // Multi-add — single confirmation line.
  if (adds.length > 1 && removes.length === 0) {
    const summary = adds
      .map((a) => {
        const item = getItem(a.itemId);
        return `${a.quantity}× ${item?.name ?? a.itemId}`;
      })
      .join(", ");
    return `Added ${summary}. Anything else?`;
  }

  // Pure removes.
  if (removes.length > 0 && adds.length === 0) {
    return removes.length === 1
      ? "Done — removed that from your cart."
      : "Done — removed those from your cart.";
  }

  // Quantity bumps.
  if (updateQtys.length > 0 && adds.length === 0 && removes.length === 0) {
    return "Done — updated the quantity.";
  }

  // Note updates.
  if (updateNotes.length > 0 && adds.length === 0 && removes.length === 0) {
    const n = updateNotes[0];
    return `Done — note updated: "${n.note}".`;
  }

  return "Done — updated your cart.";
}
