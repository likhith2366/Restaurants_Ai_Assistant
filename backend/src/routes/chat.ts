import { Router } from "express";
import { z } from "zod";
import { runChat } from "../services/ai.js";

const router = Router();

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
  cart: z
    .array(
      z.object({
        lineId: z.string(),
        itemId: z.string(),
        itemName: z.string(),
        quantity: z.number().int().nonnegative(),
        options: z.record(z.string()).optional(),
        note: z.string().optional(),
      }),
    )
    .max(50)
    .default([]),
});

router.post("/", async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "invalid_request", details: parsed.error.flatten() });
  }
  try {
    const result = await runChat(parsed.data.messages, parsed.data.cart);
    res.json(result);
  } catch (err) {
    console.error("[chat] unexpected error:", err);
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
