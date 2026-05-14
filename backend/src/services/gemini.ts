import { GoogleGenAI, Type, type FunctionDeclaration } from "@google/genai";
import { MENU, CATEGORIES } from "../data/menu.js";
import { fallbackParse } from "./fallback.js";
import { narrate } from "./narrate.js";
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
            "Optional modifiers. Keys map to the menu's option-group ids: size (sm|md|lg|reg), spice (mild|medium|hot|extra-hot), doneness (rare|medium-rare|medium|medium-well|well-done).",
          // Gemini schemas don't support additionalProperties; declare every
          // option-group id we use across the menu so the model can populate them.
          properties: {
            size: { type: Type.STRING },
            spice: { type: Type.STRING },
            doneness: { type: Type.STRING },
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

// Gemini 2.5 Flash sometimes leaks its internal thinking trace into the text
// response instead of emitting real function_call parts, producing output
// like:
//   tool_code
//   print(default_api.add_item(itemId='ribeye', options=default_api.AddItemOptions(doneness='medium-rare')))
//   thought
//   ...reasoning...
//   Added the Bone-in Ribeye, medium rare by default. How would you like...
//
// This salvages the situation: parse the pseudo-call out, return real actions,
// and strip the noise from the user-visible reply.
function rescueFromToolCodeLeak(
  text: string,
): { actions: CartAction[]; cleanText: string } | null {
  if (!/tool_code/i.test(text)) return null;

  const actions: CartAction[] = [];
  // Match each "print(default_api.<fn>(<args>))" call, allowing one level
  // of nested parens (for default_api.AddItemOptions(...)).
  const callRe =
    /print\s*\(\s*default_api\.(\w+)\s*\(((?:[^()]|\([^()]*\))*)\)\s*\)/gs;
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(text)) !== null) {
    const fn = m[1];
    const args = parsePythonKwargs(m[2]);
    const action = pythonArgsToAction(fn, args);
    if (action) actions.push(action);
  }

  if (!actions.length) return null;

  // Strip tool_code/thought sections. The user-facing sentence usually sits
  // at the very end. Heuristic: drop everything up to and including the last
  // newline-separated block that looks like reasoning. Then trim leading
  // labels like "thought\n" or "tool_code\n".
  let clean = text
    .replace(/tool_code\s*\n[\s\S]*?(?=thought)/i, "")
    .replace(/thought\s*\n[\s\S]*?(?=\n[A-Z][^\n]{0,5}\w)/i, "")
    .replace(/^(tool_code|thought)\b[\s\S]*?$/im, "")
    .trim();
  // Final cleanup: if "tool_code" or "print(" still appears, take only the
  // text after the last sentence-terminator that precedes a capitalized word.
  if (/tool_code|^print\(/m.test(clean)) {
    const lastSentenceStart = clean.match(/(?:^|[.!?]\s+|\n)([A-Z][^\n]{8,}\.?[!?]?\s*)$/);
    clean = lastSentenceStart?.[1]?.trim() ?? "";
  }
  return { actions, cleanText: clean };
}

// Parse a Python-style kwargs string into a plain object. Supports:
//   key='string'   key=123   key=default_api.X(nested='val', ...)
// Quotes can be single or double. Nesting is limited to one level — enough
// for `options=default_api.AddItemOptions(doneness='medium-rare')`.
function parsePythonKwargs(s: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let i = 0;
  while (i < s.length) {
    // skip whitespace + commas
    while (i < s.length && /[\s,]/.test(s[i])) i++;
    // read key
    const keyMatch = /^([A-Za-z_]\w*)\s*=\s*/.exec(s.slice(i));
    if (!keyMatch) break;
    i += keyMatch[0].length;
    const key = keyMatch[1];

    // read value: string, number, or nested call
    if (s[i] === "'" || s[i] === '"') {
      const quote = s[i++];
      let val = "";
      while (i < s.length && s[i] !== quote) {
        if (s[i] === "\\" && i + 1 < s.length) {
          val += s[i + 1];
          i += 2;
        } else {
          val += s[i++];
        }
      }
      i++; // closing quote
      out[key] = val;
    } else if (/\d/.test(s[i]) || s[i] === "-") {
      const numMatch = /^-?\d+(?:\.\d+)?/.exec(s.slice(i))!;
      out[key] = parseFloat(numMatch[0]);
      i += numMatch[0].length;
    } else if (s.slice(i).startsWith("default_api.")) {
      // nested call: extract everything inside the parens
      const call = /^default_api\.\w+\s*\(((?:[^()]|\([^()]*\))*)\)/.exec(s.slice(i));
      if (!call) break;
      out[key] = parsePythonKwargs(call[1]);
      i += call[0].length;
    } else {
      // unknown — bail
      break;
    }
  }
  return out;
}

function pythonArgsToAction(
  fn: string,
  args: Record<string, unknown>,
): CartAction | null {
  switch (fn) {
    case "add_item": {
      const itemId = typeof args.itemId === "string" ? args.itemId : "";
      if (!itemId) return null;
      return {
        type: "add_item",
        itemId,
        quantity: typeof args.quantity === "number" ? args.quantity : 1,
        options:
          args.options && typeof args.options === "object"
            ? (args.options as Record<string, string>)
            : undefined,
        note: typeof args.note === "string" ? args.note : undefined,
      };
    }
    case "remove_item": {
      const target = typeof args.target === "string" ? args.target : "";
      return target ? { type: "remove_item", target } : null;
    }
    case "update_quantity": {
      const target = typeof args.target === "string" ? args.target : "";
      const quantity = typeof args.quantity === "number" ? args.quantity : NaN;
      return target && !isNaN(quantity)
        ? { type: "update_quantity", target, quantity }
        : null;
    }
    case "update_note": {
      const target = typeof args.target === "string" ? args.target : "";
      const note = typeof args.note === "string" ? args.note : "";
      return target ? { type: "update_note", target, note } : null;
    }
    case "clear_cart":
      return { type: "clear_cart" };
    case "place_order":
      return {
        type: "place_order",
        note: typeof args.note === "string" ? args.note : undefined,
      };
    default:
      return null;
  }
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
    // Salvage path: when the model didn't emit real function_call parts but
    // its text contains a `tool_code\nprint(default_api.X(...))` leak, parse
    // those out and treat them as actions. Strip the leak from the reply.
    const rawText = (resp.text ?? "").trim();
    let finalText = rawText;
    if (actions.length === 0 && rawText) {
      const rescued = rescueFromToolCodeLeak(rawText);
      if (rescued && rescued.actions.length) {
        actions.push(...rescued.actions);
        finalText = rescued.cleanText;
      }
    }

    // Sometimes the model emits real function calls AND a text reply that
    // leaks internal reasoning ("Looking at the menu...", "Therefore I
    // should...", "I need to..."). In that case the narrator's clean output
    // is much better. Detect the pattern and drop the messy text.
    if (actions.length > 0 && finalText) {
      const looksLikeReasoning =
        /\b(Looking at|Therefore,? I|I should|I need to|According to the|Based on the)\b/i.test(
          finalText,
        );
      if (looksLikeReasoning) finalText = "";
    }

    // Last resort: if Gemini returned absolutely nothing usable (no actions,
    // no text — happens unpredictably on Gemini 2.5 Flash for some prompts),
    // hand off to the deterministic parser so the user gets a real reply
    // instead of awkward silence.
    if (actions.length === 0 && !finalText.trim()) {
      console.warn("[gemini] empty response, falling back to rule-based parser");
      const parsed = fallbackParse(latestUser?.content ?? "", cart);
      return { ...parsed, meta: { mode: "fallback" } };
    }

    // when the model only emits function calls — synthesize a host-like reply
    // from the actions + menu data so the chat doesn't feel dead.
    const reply =
      finalText ||
      (actions.length ? narrate(actions, cart) : "");

    return { reply, actions, meta: { mode: "live", model: MODEL } };
  } catch (err) {
    console.error("[gemini] live call failed, falling back:", err);
    const parsed = fallbackParse(latestUser?.content ?? "", cart);
    return { ...parsed, meta: { mode: "fallback" } };
  }
}
