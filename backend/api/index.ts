// Vercel serverless entry. @vercel/node detects this file path automatically
// when the project root is set to `backend/`. The Express app handles all
// incoming routes — see ../vercel.json for the catch-all rewrite.

import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../src/app.js";

// Lazily create the app so a startup error surfaces as a real 500 with a
// stack trace in Vercel's runtime logs, instead of crashing at module load.
let app: ReturnType<typeof createApp> | null = null;

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (!app) app = createApp();
    // Express apps are themselves (req, res, next) handlers.
    return app(req as any, res as any);
  } catch (err) {
    console.error("[vercel] handler crash:", err);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error: "internal_error",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

