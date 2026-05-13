// Mirror of backend/src/types/api.ts and backend/src/data/menu.ts.
// Keep these in sync — kept duplicated to avoid a monorepo for this take-home.

export type Category = "starters" | "mains" | "sides" | "desserts" | "drinks";

export interface MenuOption {
  id: string;
  label: string;
  priceDelta: number;
}

export interface MenuOptionGroup {
  id: string;
  label: string;
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
  tags: string[];
  optionGroups?: MenuOptionGroup[];
}

export interface MenuPayload {
  categories: { id: Category; label: string; blurb: string }[];
  items: MenuItem[];
}

export type CartAction =
  | {
      type: "add_item";
      itemId: string;
      quantity: number;
      options?: Record<string, string>;
      note?: string;
    }
  | { type: "remove_item"; target: string }
  | { type: "update_quantity"; target: string; quantity: number }
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
  note?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  cart: CartLineForAi[];
}

export interface ChatResponse {
  reply: string;
  actions: CartAction[];
  meta?: { mode: "live" | "fallback"; model?: string };
}
