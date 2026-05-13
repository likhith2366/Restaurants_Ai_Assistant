// Express app factory. Importable from both the local dev entry
// (`src/index.ts`) and the Vercel serverless handler (`api/index.ts`).

import "dotenv/config";
import express, { type Express } from "express";
import cors from "cors";
import menuRoutes from "./routes/menu.js";
import chatRoutes from "./routes/chat.js";
import { activeProvider } from "./services/ai.js";

export function activeModel(): string {
  const p = activeProvider();
  if (p === "anthropic") return process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
  if (p === "gemini") return process.env.GEMINI_MODEL || "gemini-2.5-flash";
  return "fallback-parser";
}

export function createApp(): Express {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "256kb" }));

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

  // Root index — useful response when someone hits the backend URL directly,
  // and a guard against Vercel sending an empty path which Express can't route.
  app.get("/", (_req, res) => {
    res.json({
      name: "The Intelligent Bistro API",
      endpoints: ["/health", "/api/menu", "/api/chat (POST)"],
      docs: "https://github.com/likhith2366/Restaurants_Ai_Assistant",
    });
  });

  app.use("/api/menu", menuRoutes);
  app.use("/api/chat", chatRoutes);

  return app;
}

// Vercel's bundler sometimes inspects this file as if it were a serverless
// function and fails with "default export must be a function or server".
// Exporting a ready-made Express app as the default makes that path safe —
// Express apps are valid (req, res) handlers.
const defaultApp = createApp();
export default defaultApp;
