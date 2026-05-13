# The Intelligent Bistro

A premium-feel mobile restaurant ordering experience driven by a conversational AI host. Browse a 29-item menu, build a cart by tap or by chat, modify items with natural language (*"medium rare, extra juicy"*), use **voice input**, and ask the AI to **place the order to the kitchen**.

- **`mobile/`** — Expo React Native app (SDK 52, expo-router, NativeWind v4, Reanimated, Zustand, Bottom Sheet).
- **`backend/`** — Node.js + Express API that turns natural language into structured cart actions via tool/function calling. Supports **Anthropic Claude** *or* **Google Gemini** — pick one with an env var. Has a deterministic offline fallback parser so the demo runs without any key.

---

## Quick start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Pick ONE provider and paste a key into .env:
#   ANTHROPIC_API_KEY=sk-ant-...        (https://console.anthropic.com)
#   GEMINI_API_KEY=AIza...              (https://aistudio.google.com/apikey)
npm run dev
```

The API listens on `http://localhost:3001`. Health probe: `GET /health` returns
the active provider, e.g. `{"provider":"gemini","model":"gemini-2.5-flash",...}`.

**Provider selection:**

- `ANTHROPIC_API_KEY` set → Claude (default `claude-haiku-4-5-20251001`).
- `GEMINI_API_KEY` set → Gemini (default `gemini-2.5-flash`).
- Both set → Anthropic wins; override with `AI_PROVIDER=gemini`.
- Neither set → deterministic **fallback parser** keeps the demo working offline.

> ⚠ Free-tier Gemini quotas vary by model. `gemini-2.5-flash` is generous
> (1500 req/day). `gemini-3-flash-preview` is limited (20/day, 5/min). If you
> hit 429 errors, swap models in `.env`.

### 2. Mobile app

```bash
cd mobile
npm install
npm start
```

Then press **i** for iOS, **a** for Android, or **w** for web. Scan the QR with
Expo Go on a physical device.

#### Pointing the app at the API

The app reads its API base URL in this order:

1. `EXPO_PUBLIC_API_URL` env var — set this when testing on a physical device, e.g.
   `EXPO_PUBLIC_API_URL=http://192.168.1.42:3001 npm start`.
2. `expo.extra.apiBaseUrl` in `app.json` (defaults to `http://localhost:3001`).
3. Platform default — `http://10.0.2.2:3001` on Android emulator, `localhost` elsewhere.

#### Testing in a "mobile-feeling" browser

Open `http://localhost:8081` in Chrome → `F12` → `Ctrl+Shift+M` → pick **iPhone 14 Pro**.

---

## What the AI can do

The chat sheet (gold sparkle button on the menu screen) accepts typing **or voice**.

### Cart building

| Try saying | What happens |
|---|---|
| *"Add two spicy chicken sandwiches and a large lemonade"* | `add_item × 2` with `quantity`, `spice`, and `size` modifiers. |
| *"Surprise me with a date night order for two"* | Multi-course curation (starter, mains, sides, wine, dessert). |
| *"What's good and not spicy?"* | Conversational reply with recommendations — no cart change. |
| *"Make the fries large and remove the burger"* | `update_quantity` / `remove_item` resolved against current cart. |
| *"Clear my cart"* | `clear_cart`. |

### Natural-language preparation requests

| Try saying | What happens |
|---|---|
| *"Add a wagyu burger, medium rare and extra juicy"* | `add_item` with `options.doneness: medium-rare` *and* `note: "extra juicy"`. |
| *"Actually make the wings a bit less salty"* | `update_note` with `target: <lineId>, note: "less salt"` — preserves prior context. |
| *"Add wings, extra crispy and hold the scallions"* | Combined preparation note attached to the line. |
| *"Make the burger medium-well instead"* | `update_note` or structured option change depending on phrasing. |

Notes show on the cart line as italic gold text with a speech-bubble icon.

### Placing the order

| Try saying | What happens |
|---|---|
| *"Place the order to the kitchen"* | `place_order` — cart clears, confirmation dialog pops. |
| *"Send my order"* (cart empty) | AI politely refuses and suggests items. The guardrail is in the prompt. |
| *"Add a burger, medium rare, then place the order"* | Single turn: adds *and* places. |

### Tool schema

The backend exposes the same six tools to both providers
(Anthropic in [`backend/src/services/ai.ts`](backend/src/services/ai.ts),
Gemini in [`backend/src/services/gemini.ts`](backend/src/services/gemini.ts)):

| Tool | Purpose |
|------|---------|
| `add_item` | `itemId`, `quantity`, optional `options` (size/spice/doneness), optional free-form `note`. |
| `remove_item` | `target` may be a cart `lineId` or a menu `itemId`. |
| `update_quantity` | Set a line's quantity (0 removes). |
| `update_note` | Replace the preparation note on an existing line — for *"less salty"*, *"medium rare"*, *"hold the onions"*. |
| `clear_cart` | Empty the cart. |
| `place_order` | Submit the cart to the kitchen. Cart is cleared automatically. Refuses if cart is empty. |

The current cart is injected into the system prompt — including each line's
`lineId`, options, and existing notes — so the model can resolve phrases like
"those fries" or "actually make it spicier."

---

## Voice input

Tap the mic icon in the chat input (visible when text is empty). The browser
asks for microphone permission; speak; live transcript appears above the input;
the final transcript auto-sends to the AI.

- **Implementation:** Web Speech API ([`mobile/src/util/voice.ts`](mobile/src/util/voice.ts)).
- **Supported:** Chrome / Edge on desktop and Android.
- **Not supported:** Safari iOS, React Native (Expo Go) — the mic button is
  hidden gracefully and typing still works.

---

## Architecture

### State

- **`stores/menu.ts`** — fetches `/api/menu` once on app launch, exposes `getItem(id)`.
- **`stores/cart.ts`** — lines with merged option-sets, derived totals, and an
  `applyActions()` reducer that takes the AI's `CartAction[]` response and
  returns human summaries (rendered as chips below the assistant bubble).
- **`stores/chat.ts`** — bubbles, pending state, suggestions, history shipped
  to the API. Triggers the kitchen-confirmation dialog when `place_order` lands.

### UI

- Warm near-black palette (`ink`) with a single gold accent (`gold-500`).
- Display typography: Fraunces (serif) for emphasis, Inter for body.
- Reanimated layout transitions on cart lines so AI edits feel kinetic.
- Haptics on every consequential tap (no-op on web via [`util/haptics.ts`](mobile/src/util/haptics.ts) shim).
- Floating "Ask" FAB on the menu opens an 85% bottom sheet for chat.
- Cross-platform dialog shim ([`util/dialog.ts`](mobile/src/util/dialog.ts)) — native `Alert` on iOS/Android, browser `confirm`/`alert` on web.

### Backend

- Single Express app, two routes (`/api/menu`, `/api/chat`).
- Zod validates every chat request (including notes on cart snapshot).
- Provider routing in [`services/ai.ts`](backend/src/services/ai.ts): dispatches to Anthropic
  (`messages.create` + tool use blocks) or Gemini (`generateContent` + function declarations).
  Either way, the SDK's tool-call output is normalized to the same
  `CartAction[]` shape — the mobile app doesn't know or care which provider ran.
- If the live call fails or no key is set, the deterministic
  [`fallback.ts`](backend/src/services/fallback.ts) parser handles the same intents
  (with aliases for every menu item).

### Menu

29 items across 5 categories — starters, mains, sides, desserts, drinks — with
images from Unsplash. Option groups demonstrate three patterns: `size` (drinks
and some sides), `spice` (heat-bearing items), `doneness` (Wagyu Smashburger
and Bone-in Ribeye).

---

## Project layout

```
backend/
  src/
    data/menu.ts          # 29-item catalog with categories, tags, option groups
    routes/{menu,chat}.ts # HTTP endpoints
    services/
      ai.ts               # Provider routing + Anthropic tool use
      gemini.ts           # Google Gemini function calling
      fallback.ts         # Offline NL parser with menu aliases
    types/api.ts          # Shared types (mirrored on mobile)
  .env.example
  package.json
  tsconfig.json

mobile/
  app/
    _layout.tsx           # Root: fonts, providers, ChatSheet, FAB
    index.tsx             # Menu / home
    cart.tsx              # Cart modal — quantities, notes, totals
    item/[id].tsx         # Item detail modal — option groups
  src/
    api/client.ts
    stores/{menu,cart,chat}.ts
    components/
      MenuCard.tsx        # Featured hero card
      MenuCardCompact.tsx # List row
      ChatSheet.tsx       # Bottom-sheet conversational UI + voice
      AskButton.tsx       # Floating action with pulse ring
      CartBar.tsx         # Sticky "view cart" pill
      Tag.tsx             # Spice/Veg/Popular chips
    util/
      format.ts
      haptics.ts          # Web-safe haptic shim
      dialog.ts           # Cross-platform Alert/confirm shim
      voice.ts            # Web Speech API wrapper
    types/api.ts          # Mirror of backend types
  app.json
  babel.config.js
  metro.config.js
  tailwind.config.js
  global.css
  package.json
  tsconfig.json
```

---

## Verification

Backend:

```bash
cd backend
npm run typecheck
PORT=3001 npm run dev
curl http://localhost:3001/health
curl -X POST http://localhost:3001/api/chat \
  -H "content-type: application/json" \
  -d '{"messages":[{"role":"user","content":"add a wagyu burger medium rare and extra juicy, then place the order"}],"cart":[]}'
```

Mobile:

```bash
cd mobile
npx tsc --noEmit          # clean
npx expo-doctor           # 17/17 passes
```

