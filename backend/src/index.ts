import "dotenv/config";
import express from "express";
import cors from "cors";
import menuRoutes from "./routes/menu.js";
import chatRoutes from "./routes/chat.js";
import { activeProvider } from "./services/ai.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "256kb" }));

function activeModel(): string {
  const p = activeProvider();
  if (p === "anthropic") return process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
  if (p === "gemini") return process.env.GEMINI_MODEL || "gemini-2.5-flash";
  return "fallback-parser";
}

app.get("/health", (_req, res) => {
  const provider = activeProvider();
  res.json({
    ok: true,
    provider,
    aiMode: provider === "fallback" ? "fallback" : "live",
    model: activeModel(),
    time: new Date().toISOString(),
  });
});

app.use("/api/menu", menuRoutes);
app.use("/api/chat", chatRoutes);

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  const provider = activeProvider();
  const note =
    provider === "fallback"
      ? "fallback (no API key set)"
      : `${provider} · ${activeModel()}`;
  console.log(`The Intelligent Bistro API listening on :${port}  [AI: ${note}]`);
});
