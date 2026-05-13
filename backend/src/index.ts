// Local dev entry. On Vercel, `api/index.ts` is used instead.

// dotenv must load before any module that reads process.env at import time.
import "dotenv/config";
import { activeProvider } from "./services/ai.js";
import { activeModel } from "./app.js";
import app from "./app.js";

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  const provider = activeProvider();
  const note =
    provider === "fallback"
      ? "fallback (no API key set)"
      : `${provider} · ${activeModel()}`;
  console.log(`The Intelligent Bistro API listening on :${port}  [AI: ${note}]`);
});
