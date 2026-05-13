import { create } from "zustand";
import { nanoid } from "nanoid/non-secure";
import type {
  CartAction,
  CartLineForAi,
  MenuItem,
} from "@/types/api";

export interface CartLine {
  lineId: string;
  itemId: string;
  quantity: number;
  options: Record<string, string>;
  note?: string;
}

interface CartState {
  lines: CartLine[];

  // user-driven ops
  add: (itemId: string, opts?: { quantity?: number; options?: Record<string, string>; note?: string }) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  bump: (lineId: string, delta: number) => void;
  setNote: (lineId: string, note: string) => void;
  remove: (lineId: string) => void;
  clear: () => void;

  // AI-driven ops — apply server-returned actions atomically and return a
  // human summary so the chat can confirm what happened.
  applyActions: (
    actions: CartAction[],
    resolveMenuItem: (id: string) => MenuItem | undefined,
  ) => string[];

  // snapshot for the AI: line-level info with resolved names
  snapshotForAi: (resolveMenuItem: (id: string) => MenuItem | undefined) => CartLineForAi[];

  // derived
  totalQuantity: () => number;
  totalCents: (resolveMenuItem: (id: string) => MenuItem | undefined) => number;
}

function sameOptions(a: Record<string, string>, b: Record<string, string>): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => a[k] === b[k]);
}

// Compute the price of a line given the menu item snapshot.
export function lineUnitCents(item: MenuItem, options: Record<string, string>): number {
  let cents = item.priceCents;
  for (const group of item.optionGroups ?? []) {
    const chosen = options[group.id];
    if (!chosen) continue;
    const opt = group.options.find((o) => o.id === chosen);
    if (opt) cents += opt.priceDelta;
  }
  return cents;
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],

  add(itemId, opts) {
    const quantity = Math.max(1, Math.floor(opts?.quantity ?? 1));
    const options = opts?.options ?? {};
    set((s) => {
      // Merge into an existing line if same item + identical options.
      const existing = s.lines.find(
        (l) => l.itemId === itemId && sameOptions(l.options, options),
      );
      if (existing) {
        return {
          lines: s.lines.map((l) =>
            l.lineId === existing.lineId
              ? { ...l, quantity: Math.min(20, l.quantity + quantity) }
              : l,
          ),
        };
      }
      return {
        lines: [
          ...s.lines,
          { lineId: nanoid(8), itemId, quantity, options, note: opts?.note },
        ],
      };
    });
  },

  setQuantity(lineId, quantity) {
    set((s) => {
      if (quantity <= 0) {
        return { lines: s.lines.filter((l) => l.lineId !== lineId) };
      }
      return {
        lines: s.lines.map((l) =>
          l.lineId === lineId ? { ...l, quantity: Math.min(20, quantity) } : l,
        ),
      };
    });
  },

  bump(lineId, delta) {
    const line = get().lines.find((l) => l.lineId === lineId);
    if (!line) return;
    get().setQuantity(lineId, line.quantity + delta);
  },

  setNote(lineId, note) {
    set((s) => ({
      lines: s.lines.map((l) =>
        l.lineId === lineId
          ? { ...l, note: note.trim() ? note.trim() : undefined }
          : l,
      ),
    }));
  },

  remove(lineId) {
    set((s) => ({ lines: s.lines.filter((l) => l.lineId !== lineId) }));
  },

  clear() {
    set({ lines: [] });
  },

  applyActions(actions, resolveMenuItem) {
    const summaries: string[] = [];
    for (const action of actions) {
      switch (action.type) {
        case "add_item": {
          const item = resolveMenuItem(action.itemId);
          if (!item) continue;
          get().add(action.itemId, {
            quantity: action.quantity,
            options: action.options,
            note: action.note,
          });
          summaries.push(`Added ${action.quantity}× ${item.name}`);
          break;
        }
        case "remove_item": {
          const target = action.target;
          // Try as lineId first, then fall back to itemId.
          const byLine = get().lines.find((l) => l.lineId === target);
          if (byLine) {
            const item = resolveMenuItem(byLine.itemId);
            get().remove(byLine.lineId);
            summaries.push(`Removed ${item?.name ?? "item"}`);
            break;
          }
          const byItem = get().lines.filter((l) => l.itemId === target);
          for (const line of byItem) {
            const item = resolveMenuItem(line.itemId);
            get().remove(line.lineId);
            summaries.push(`Removed ${item?.name ?? "item"}`);
          }
          break;
        }
        case "update_quantity": {
          const target = action.target;
          const byLine = get().lines.find((l) => l.lineId === target);
          if (byLine) {
            const item = resolveMenuItem(byLine.itemId);
            get().setQuantity(byLine.lineId, action.quantity);
            summaries.push(
              action.quantity <= 0
                ? `Removed ${item?.name ?? "item"}`
                : `Set ${item?.name ?? "item"} to ${action.quantity}`,
            );
            break;
          }
          const byItem = get().lines.find((l) => l.itemId === target);
          if (byItem) {
            const item = resolveMenuItem(byItem.itemId);
            get().setQuantity(byItem.lineId, action.quantity);
            summaries.push(
              action.quantity <= 0
                ? `Removed ${item?.name ?? "item"}`
                : `Set ${item?.name ?? "item"} to ${action.quantity}`,
            );
          }
          break;
        }
        case "clear_cart": {
          if (get().lines.length > 0) {
            get().clear();
            summaries.push("Cleared cart");
          }
          break;
        }
        case "place_order": {
          // place_order clears the cart as a side effect — the chat layer is
          // responsible for any UI notification (toast / alert / haptic).
          if (get().lines.length > 0) {
            get().clear();
            summaries.push("Order placed");
          } else {
            summaries.push("Cart is empty — add items first");
          }
          break;
        }
        case "update_note": {
          const byLine = get().lines.find((l) => l.lineId === action.target);
          const target = byLine ?? get().lines.find((l) => l.itemId === action.target);
          if (target) {
            const item = resolveMenuItem(target.itemId);
            get().setNote(target.lineId, action.note);
            const name = item?.name ?? "item";
            summaries.push(
              action.note.trim()
                ? `${name}: “${action.note.trim()}”`
                : `${name}: note cleared`,
            );
          }
          break;
        }
      }
    }
    return summaries;
  },

  snapshotForAi(resolveMenuItem) {
    return get().lines.map((l) => {
      const item = resolveMenuItem(l.itemId);
      return {
        lineId: l.lineId,
        itemId: l.itemId,
        itemName: item?.name ?? l.itemId,
        quantity: l.quantity,
        options: Object.keys(l.options).length ? l.options : undefined,
        note: l.note,
      };
    });
  },

  totalQuantity() {
    return get().lines.reduce((sum, l) => sum + l.quantity, 0);
  },

  totalCents(resolveMenuItem) {
    return get().lines.reduce((sum, l) => {
      const item = resolveMenuItem(l.itemId);
      if (!item) return sum;
      return sum + lineUnitCents(item, l.options) * l.quantity;
    }, 0);
  },
}));
