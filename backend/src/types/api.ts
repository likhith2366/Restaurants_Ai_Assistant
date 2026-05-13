// Shared API contract. The mobile app keeps a mirrored copy in
// `mobile/src/types/api.ts` — keep them in sync.

export type CartAction =
  | {
      type: "add_item";
      itemId: string;
      quantity: number;
      options?: Record<string, string>;
      note?: string;
    }
  | {
      type: "remove_item";
      // Either a cart line id (preferred when known) or the menu item id
      target: string;
    }
  | {
      type: "update_quantity";
      target: string;
      quantity: number;
    }
  | { type: "clear_cart" }
  | { type: "place_order"; note?: string }
  | { type: "update_note"; target: string; note: string };

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CartLineForAi {
  lineId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  options?: Record<string, string>;
  // Free-form preparation request, e.g. "medium rare", "extra crispy",
  // "less salt", "no onions". The model can read and overwrite this.
  note?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  // Current cart contents so the AI can resolve references like "the burger"
  cart: CartLineForAi[];
}

export interface ChatResponse {
  reply: string;
  actions: CartAction[];
  // Optional debug info — surfaced in the UI only when DEV
  meta?: { mode: "live" | "fallback"; model?: string };
}
