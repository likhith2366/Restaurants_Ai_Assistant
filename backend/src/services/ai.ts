import { Anthropic } from "@anthropic-ai/sdk";
import type { Tool as AnthropicTool } from "@anthropic-ai/sdk/resources/messages/messages.js";
import { MENU, CATEGORIES } from "../data/menu.js";
import { fallbackParse } from "./fallback.js";
import { runChatGemini } from "./gemini.js";
import { narrate } from "./narrate.js";
import type {
  CartAction,
  CartLineForAi,
  ChatMessage,
  ChatResponse,
} from "../types/api.js";

// Provider selection. AI_PROVIDER overrides auto-detection; otherwise we pick
// whichever key is set. If both are set, Anthropic wins by default.
type Provider = "anthropic" | "gemini" | "fallback";
function chooseProvider(): Provider {
  const override = (process.env.AI_PROVIDER || "").toLowerCase().trim();
  if (override === "anthropic" || override === "gemini" || override === "fallback") {
    return override;
  }
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) return "gemini";
  return "fallback";
}

export function activeProvider(): Provider {
  return chooseProvider();
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

// One client, instantiated lazily so the server still boots without a key.
let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// Build the system prompt with a compact, machine-readable menu so the model
// can ground its tool calls in real item ids.
function buildSystemPrompt(): string {
  const lines: string[] = [];
  lines.push(
    "You are the in-house host for The Intelligent Bistro, a refined modern restaurant.",
    "Your job is to help guests build their order through natural conversation.",
    "",
    "Style: warm, concise, confident. Two sentences max unless the guest asks for more.",
    "Never invent menu items — only use ids from the catalog below.",
    "When the guest's intent is to modify the cart, ALWAYS call the appropriate tool.",
    "",
    "CRITICAL — ALWAYS produce conversational TEXT alongside every tool call.",
    "A reply that contains only function calls and no spoken text is unacceptable.",
    "After (or during) each tool call, write 1-2 short host-like sentences that:",
    "  • confirm what you did, AND",
    "  • offer the relevant next prompt (option upgrade, doneness question, etc.).",
    "Examples of GOOD replies:",
    "  - \"Added two spicy chicken sandwiches and a large lemonade — anything else?\"",
    "  - \"Added the Truffle Fries — want to upgrade to Large for $2.50 more?\"",
    "  - \"Added the Ribeye, medium rare by default. How would you like it cooked?\"",
    "BAD reply (DO NOT produce these): just tool calls with no text at all.",
    "",
    "If the guest is just chatting, reply without calling a tool.",
    "",
    "Available cart tools: add_item, remove_item, update_quantity, update_note, clear_cart, place_order.",
    "For drinks and some sides, pass options like { size: \"lg\" } (sm|md|lg|reg).",
    "For spicy items pass { spice: \"mild|medium|hot|extra-hot\" }.",
    "Call place_order only when the guest explicitly says place/send/submit/order. After it runs the cart is cleared automatically.",
    "",
    "HANDLING OPTION GROUPS (very important — be a real host, not a vending machine):",
    "When you add an item whose menu line shows option groups (e.g. \"options.size optional: sm|md(+$1)|lg(+$2)\"):",
    "  • REQUIRED group (e.g. doneness on the ribeye): add immediately with a sensible default",
    "    (medium-rare for steaks; mild for spice) AND in the same reply ask how they'd like it.",
    "    Example: \"Added the Bone-in Ribeye, medium rare by default. How would you like it cooked —",
    "    rare, medium rare, medium, medium-well, or well-done?\"",
    "  • OPTIONAL group with priced upgrades (e.g. size on fries with +$ deltas): add the default,",
    "    then proactively offer the upgrade in your reply.",
    "    Example: \"Added the Truffle Fries — want me to upgrade to Large for $2.50 more?\"",
    "  • When the guest later picks an option for an already-added line, swap it cleanly in ONE",
    "    turn by calling remove_item on the line's lineId AND add_item with the chosen option.",
    "    The two calls go in the same response.",
    "  • If the dish has both required and optional groups, prioritize asking about required first.",
    "  • If the guest already specified the option in the original ask (\"add a ribeye, medium\"),",
    "    just add with that option — no need to ask again.",
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
        const req = g.required ? " REQUIRED" : " optional";
        const choices = g.options
          .map((o) => {
            const delta = o.priceDelta > 0 ? `(+$${(o.priceDelta / 100).toFixed(2)})` : "";
            return `${o.id}${delta}`;
          })
          .join("|");
        lines.push(`      options.${g.id}${req}: ${choices}`);
      }
    }
  }
  return lines.join("\n");
}

// Tool schemas the model is allowed to call.
const TOOLS: AnthropicTool[] = [
  {
    name: "add_item",
    description:
      "Add a menu item to the guest's cart. Use the exact item id from the menu.",
    input_schema: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "The menu item id, e.g. wagyu-burger" },
        quantity: { type: "integer", minimum: 1, maximum: 20, default: 1 },
        options: {
          type: "object",
          description:
            "Optional modifiers. Common keys: size (sm|md|lg|reg), spice (mild|medium|hot|extra-hot).",
          additionalProperties: { type: "string" },
        },
        note: { type: "string", description: "Optional special request" },
      },
      required: ["itemId"],
    },
  },
  {
    name: "remove_item",
    description:
      "Remove a line from the cart. `target` may be a cart line id (preferred) or a menu item id.",
    input_schema: {
      type: "object",
      properties: { target: { type: "string" } },
      required: ["target"],
    },
  },
  {
    name: "update_quantity",
    description:
      "Set a line's quantity. `target` may be a cart line id or a menu item id. Quantity 0 removes the line.",
    input_schema: {
      type: "object",
      properties: {
        target: { type: "string" },
        quantity: { type: "integer", minimum: 0, maximum: 20 },
      },
      required: ["target", "quantity"],
    },
  },
  {
    name: "clear_cart",
    description: "Empty the entire cart. Use only when the guest clearly asks.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "update_note",
    description:
      "Replace the preparation note on an existing cart line. Use this for natural-language requests like \"medium rare\", \"extra crispy\", \"less salt\", \"no onions\", \"juicy\", \"on the side\". The note is shown to the kitchen and to the guest.",
    input_schema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "The cart lineId of the item to modify.",
        },
        note: {
          type: "string",
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
    input_schema: {
      type: "object",
      properties: {
        note: {
          type: "string",
          description: "Optional special instruction for the kitchen, e.g. allergies or timing.",
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

// Top-level dispatch: route to the selected provider. Falls back to the
// deterministic parser if no key is configured for the chosen provider.
export async function runChat(
  messages: ChatMessage[],
  cart: CartLineForAi[],
): Promise<ChatResponse> {
  const provider = chooseProvider();
  if (provider === "gemini") return runChatGemini(messages, cart);
  if (provider === "fallback") {
    const latestUser = [...messages].reverse().find((m) => m.role === "user");
    const parsed = fallbackParse(latestUser?.content ?? "", cart);
    return { ...parsed, meta: { mode: "fallback" } };
  }
  return runChatAnthropic(messages, cart);
}

async function runChatAnthropic(
  messages: ChatMessage[],
  cart: CartLineForAi[],
): Promise<ChatResponse> {
  const anthropic = getClient();
  const latestUser = [...messages].reverse().find((m) => m.role === "user");

  // Fallback path: deterministic parser when no key is configured.
  if (!anthropic) {
    const parsed = fallbackParse(latestUser?.content ?? "", cart);
    return { ...parsed, meta: { mode: "fallback" } };
  }

  // Tack on the live cart state as a system-side note so the model can resolve
  // references like "make those fries large" or "remove the burger".
  const systemPrompt =
    buildSystemPrompt() +
    `\n\nCURRENT CART:\n${describeCart(cart)}`;

  try {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const actions: CartAction[] = [];
    const textParts: string[] = [];

    for (const block of resp.content) {
      if (block.type === "text") {
        textParts.push(block.text);
      } else if (block.type === "tool_use") {
        const input = (block.input ?? {}) as Record<string, unknown>;
        switch (block.name) {
          case "add_item": {
            const itemId = String(input.itemId ?? "");
            if (!itemId) break;
            actions.push({
              type: "add_item",
              itemId,
              quantity: Number(input.quantity ?? 1) || 1,
              options:
                input.options && typeof input.options === "object"
                  ? (input.options as Record<string, string>)
                  : undefined,
              note: typeof input.note === "string" ? input.note : undefined,
            });
            break;
          }
          case "remove_item": {
            const target = String(input.target ?? "");
            if (target) actions.push({ type: "remove_item", target });
            break;
          }
          case "update_quantity": {
            const target = String(input.target ?? "");
            const quantity = Number(input.quantity ?? 0);
            if (target) actions.push({ type: "update_quantity", target, quantity });
            break;
          }
          case "clear_cart":
            actions.push({ type: "clear_cart" });
            break;
          case "update_note": {
            const target = String(input.target ?? "");
            const note = String(input.note ?? "");
            if (target) actions.push({ type: "update_note", target, note });
            break;
          }
          case "place_order":
            actions.push({
              type: "place_order",
              note: typeof input.note === "string" ? input.note : undefined,
            });
            break;
        }
      }
    }

    const reply =
      textParts.join("\n").trim() ||
      (actions.length ? narrate(actions, cart) : "");

    return { reply, actions, meta: { mode: "live", model: MODEL } };
  } catch (err) {
    console.error("[ai] live call failed, falling back:", err);
    const parsed = fallbackParse(latestUser?.content ?? "", cart);
    return { ...parsed, meta: { mode: "fallback" } };
  }
}
