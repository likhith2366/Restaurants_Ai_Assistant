import { Router } from "express";
import { CATEGORIES, MENU } from "../data/menu.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ categories: CATEGORIES, items: MENU });
});

router.get("/:id", (req, res) => {
  const item = MENU.find((m) => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: "not_found" });
  res.json(item);
});

export default router;
