// Vercel serverless entry. The Express app is built once in `src/app.ts`
// and reused here as the default export — Vercel invokes it as the request
// handler. The catch-all rewrite in ../vercel.json sends every path here.

import app from "../src/app.js";

export default app;
