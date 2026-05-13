// Vercel serverless entry. @vercel/node detects this file path automatically
// when the project root is set to `backend/`. The Express app handles all
// incoming routes — see ../vercel.json for the catch-all rewrite.

import { createApp } from "../src/app.js";

export default createApp();
