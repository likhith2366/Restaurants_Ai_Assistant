import { create } from "zustand";
import { api } from "@/api/client";
import type { Category, MenuItem } from "@/types/api";

interface MenuState {
  items: MenuItem[];
  categories: { id: Category; label: string; blurb: string }[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  getItem: (id: string) => MenuItem | undefined;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  items: [],
  categories: [],
  loading: false,
  error: null,
  async fetch() {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const data = await api.getMenu();
      set({
        items: data.items,
        categories: data.categories,
        loading: false,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load menu",
      });
    }
  },
  getItem(id) {
    return get().items.find((i) => i.id === id);
  },
}));
