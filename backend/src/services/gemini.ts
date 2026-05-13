import { GoogleGenAI, Type, type FunctionDeclaration } from "@google/genai";
import { MENU, CATEGORIES } from "../data/menu.js";
import { fallbackParse } from "./fallback.js";
import type {
  CartAction,
  CartLineForAi,
  ChatMessage,
  ChatResponse,
} from "../types/api.js";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return null;
  if (!client) client = new GoogleGenAI({ apiKey: key });
  return client;
}

function buildSystemPrompt(): string {
  const lines: string[] = [];
  lines.push(
    "You are the in-house host for The Intelligent Bistro, a refined modern restaurant.",
    "Your job is to help guests build their order through natural conversation.",
    "",
    "Style: warm, concise, confident. Two sentences max unless the guest asks for more.",
    "Never invent menu items — only use ids from the catalog below.",
    "When the guest's intent is to modify the cart, ALWAYS call the appropriate tool;",
    "after tool calls, also produce a short conversational reply.",
    "If the guest is just chatting, reply without calling a tool.",
    "",
    "Available cart tools: add_item, remove_item, update_quantity, update_note, clear_cart, place_order.",
    "For drinks and some sides, pass options like { size: \"lg\" } (sm|md|lg|reg).",
    "For spicy items pass { spice: \"mild|medium|hot|extra-hot\" }.",
    "Call place_order only when the guest explicitly says place/send/submit/order. After it runs the cart is cleared automatically.",
    "",
    "PREPARATION REQUESTS (very important):",
    "For natural-language modifications that don't fit structured options — e.g.",
    "\"more spicy\", \"less salt\", \"medium rare\", \"extra crispy\", \"juicy\", \"no onions\",",
    "\"on the side\", \"hold the cheese\" — use the `note` field.",
    "  • When adding a new item with a request: pass `note` to add_item.",
    "  • When changing an existing line's request: call update_note with the lineId and the new note.",
    "  • If the guest says \"a bit more spicy\" and the line already has a note, write a new note",
    "    that combines the prior context with the new ask, e.g. note=\"extra spicy, no onions\".",
    "  • If the dish has a matching structured option (spice/size), prefer that over notes.",
    "  • Keep notes terse — kitchen-friendly phrasing only.",
    "",
    "MENU (id — name — $price — tags):",
  );
  for (const cat of CATEGORIES) {
    lines.push(`  [${cat.label}]`);
    for (const m of MENU.filter((x) => x.category === cat.id)) {
      const price = (m.priceCents / 100).toFixed(2);
      const tags = m.tags.length ? ` — ${m.tags.join(",")}` : "";
      lines.push(`    ${m.id} — ${m.name} — $${price}${tags}`);
      for (const g of m.optionGroups ?? []) {
        const choices = g.options.map((o) => o.id).join("|");
        lines.push(`      options.${g.id}: ${choices}`);
      }
    }
  }
  return lines.join("\n");
}

// Gemini function declarations. Schemas use the OpenAPI-style `Type` enum.
const FUNCTIONS: FunctionDeclaration[] = [
  {
    name: "add_item",
    description:
      "Add a menu item to the guest's cart. Use the exact item id from the menu.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        itemId: {
          type: Type.STRING,
          description: "The menu item id, e.g. wagyu-burger",
        },
        quantity: { type: Type.INTEGER, description: "How many to add (1-20)" },
        options: {
          type: Type.OBJECT,
          description:
            "Optional modifiers. Common keys: size (sm|md|lg|reg), spice (mild|medium|hot|extra-hot).",
          // Gemini schemas don't support additionalProperties; declare the
          // common keys explicitly so the model can populate them.
          properties: {
            size: { type: Type.STRING },
            spice: { type: Type.STRING },
          },
        },
        note: { type: Type.STRING, description: "Optional special request" },
      },
      required: ["itemId"],
    },
  },
  {
    name: "remove_item",
    description:
      "Remove a line from the cart. `target` may be a cart line id (preferred) or a menu item id.",
    parameters: {
      type: Type.OBJECT,
      properties: { target: { type: Type.STRING } },
      required: ["target"],
    },
  },
  {
    name: "update_quantity",
    description:
      "Set a line's quantity. `target` may be a cart line id or a menu item id. Quantity 0 removes the line.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        target: { type: Type.STRING },
        quantity: { type: Type.INTEGER },
      },
      required: ["target", "quantity"],
    },
  },
  {
    name: "clear_cart",
    description: "Empty the entire cart. Use only when the guest clearly asks.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "update_note",
    description:
      "Replace the preparation note on an existing cart line. Use this for natural-language requests like \"medium rare\", \"extra crispy\", \"less salt\", \"no onions\", \"juicy\", \"on the side\". The note is shown to the kitchen and to the guest.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        target: {
          type: Type.STRING,
          description: "The cart lineId of the item to modify.",
        },
        note: {
          type: Type.STRING,
          description: "The new preparation note. Replaces any existing note. Keep terse.",
        },
      },
      required: ["target", "note"],
    },
  },
  {
    name: "place_order",
    description:
      "Submit the guest's current cart to the kitchen. Only call this when the guest clearly asks to place, send, submit, confirm, or order the food. Never place an empty cart — if there are no items, suggest adding some first.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        note: {
          type: Type.STRING,
          description: "Optional special instruction for the kitchen.",
        },
      },
    },
  },
];

function describeCart(cart: CartLineForAi[]): string {
  if (!cart.length) return "(empty)";
  return cart
    .map((l) => {
      const opts = l.options
        ? ` [${Object.entries(l.options).map(([k, v]) => `${k}=${v}`).join(", ")}]`
        : "";
      const note = l.note ? ` — note: "${l.note}"` : "";
      return `${l.lineId}: ${l.quantity}× ${l.itemName}${opts}${note}`;
    })
    .join("\n");
}

export async function runChatGemini(
  messages: ChatMessage[],
  cart: CartLineForAi[],
): Promise<ChatResponse> {
  const ai = getClient();
  const latestUser = [...messages].reverse().find((m) => m.role === "user");

  if (!ai) {
    const parsed = fallbackParse(latestUser?.content ?? "", cart);
    return { ...parsed, meta: { mode: "fallback" } };
  }

  const systemPrompt =
    buildSystemPrompt() + `\n\nCURRENT CART:\n${describeCart(cart)}`;

  // Gemini uses "model" instead of "assistant" for the assistant role.
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  try {
    const resp = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: FUNCTIONS }],
      },
    });

    const actions: CartAction[] = [];
    for (const fc of resp.functionCalls ?? []) {
      const args = (fc.args ?? {}) as Record<string, unknown>;
      switch (fc.name) {
        case "add_item": {
          const itemId = String(args.itemId ?? "");
          if (!itemId) break;
          actions.push({
            type: "add_item",
            itemId,
            quantity: Number(args.quantity ?? 1) || 1,
            options:
              args.options && typeof args.options === "object"
                ? (args.options as Record<string, string>)
                : undefined,
            note: typeof args.note === "string" ? args.note : undefined,
          });
          break;
        }
        case "remove_item": {
          const target = String(args.target ?? "");
          if (target) actions.push({ type: "remove_item", target });
          break;
        }
        case "update_quantity": {
          const target = String(args.target ?? "");
          const quantity = Number(args.quantity ?? 0);
          if (target)
            actions.push({ type: "update_quantity", target, quantity });
          break;
        }
        case "clear_cart":
          actions.push({ type: "clear_cart" });
          break;
        case "update_note": {
          const target = String(args.target ?? "");
          const note = String(args.note ?? "");
          if (target) actions.push({ type: "update_note", target, note });
          break;
        }
        case "place_order":
          actions.push({
            type: "place_order",
            note: typeof args.note === "string" ? args.note : undefined,
          });
          break;
      }
    }

    // `.text` concatenates text parts from the first candidate. May be empty
    // when the model only emits function calls — fall back to a generic line.
    const reply =
      (resp.text ?? "").trim() ||
      (actions.length ? "Done — updated your cart." : "");

    return { reply, actions, meta: { mode: "live", model: MODEL } };
  } catch (err) {
    console.error("[gemini] live call failed, falling back:", err);
    const parsed = fallbackParse(latestUser?.content ?? "", cart);
    return { ...parsed, meta: { mode: "fallback" } };
  }
}
