import { create } from "zustand";
import { nanoid } from "nanoid/non-secure";
import { api } from "@/api/client";
import type { ChatMessage } from "@/types/api";
import { notify } from "@/util/dialog";
import { useCartStore } from "./cart";
import { useMenuStore } from "./menu";

export interface ChatBubble {
  id: string;
  role: "user" | "assistant";
  content: string;
  // optional tags rendered as small chips below the bubble
  chips?: string[];
  // mode badge for the assistant's reply (live vs fallback)
  mode?: "live" | "fallback";
  pending?: boolean;
}

interface ChatState {
  bubbles: ChatBubble[];
  sending: boolean;
  error: string | null;
  send: (userText: string) => Promise<void>;
  reset: () => void;
  // quick-suggestion seeds — shown when the chat is empty
  suggestions: string[];
}

const INITIAL_GREETING: ChatBubble = {
  id: "greeting",
  role: "assistant",
  content:
    "Welcome to the Bistro. Tell me what you're craving — “two spicy chicken sandwiches and a large lemonade” — and I'll build your order.",
};

export const useChatStore = create<ChatState>((set, get) => ({
  bubbles: [INITIAL_GREETING],
  sending: false,
  error: null,
  suggestions: [
    "Add a wagyu burger and truffle fries",
    "Two spicy chicken sandwiches and a large water",
    "What's good and not spicy?",
    "Make it a date night for two",
  ],

  async send(userText: string) {
    const trimmed = userText.trim();
    if (!trimmed || get().sending) return;

    const userBubble: ChatBubble = {
      id: nanoid(8),
      role: "user",
      content: trimmed,
    };
    const pendingId = nanoid(8);

    set((s) => ({
      bubbles: [
        ...s.bubbles,
        userBubble,
        { id: pendingId, role: "assistant", content: "", pending: true },
      ],
      sending: true,
      error: null,
    }));

    try {
      // Build the message history the server sees: everything except greeting
      // and pending placeholder. The greeting is a UI courtesy, not real ctx.
      const history: ChatMessage[] = get()
        .bubbles.filter((b) => b.id !== "greeting" && !b.pending)
        .map((b) => ({ role: b.role, content: b.content }));
      history.push({ role: "user", content: trimmed });

      const menu = useMenuStore.getState();
      const cart = useCartStore.getState();
      const snapshot = cart.snapshotForAi(menu.getItem);

      const resp = await api.chat({ messages: history, cart: snapshot });

      // Apply actions to the cart — this also gives us human summaries.
      const summaries = cart.applyActions(resp.actions, menu.getItem);

      // Side effect: if the AI placed the order, pop a kitchen-confirmation
      // dialog. The cart store already cleared the lines.
      const placed = resp.actions.find((a) => a.type === "place_order");
      if (placed) {
        notify(
          "Order placed",
          "The kitchen has your ticket. Your table will be set shortly.",
        );
      }

      const finalContent =
        resp.reply.trim() || summaries.join(". ") || "Done.";

      set((s) => ({
        bubbles: s.bubbles.map((b) =>
          b.id === pendingId
            ? {
                ...b,
                content: finalContent,
                chips: summaries.length ? summaries : undefined,
                mode: resp.meta?.mode,
                pending: false,
              }
            : b,
        ),
        sending: false,
      }));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Sorry, I lost my train of thought.";
      set((s) => ({
        sending: false,
        error: message,
        bubbles: s.bubbles.map((b) =>
          b.id === pendingId
            ? {
                ...b,
                content:
                  "I couldn't reach the kitchen — please check the API and try again.",
                pending: false,
              }
            : b,
        ),
      }));
    }
  },

  reset() {
    set({ bubbles: [INITIAL_GREETING], error: null });
  },
}));
