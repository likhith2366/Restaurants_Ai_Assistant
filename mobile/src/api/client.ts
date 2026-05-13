import Constants from "expo-constants";
import { Platform } from "react-native";
import type {
  ChatRequest,
  ChatResponse,
  MenuPayload,
} from "@/types/api";

// Resolve the API base URL. Priority:
//   1. EXPO_PUBLIC_API_URL env var (recommended for device testing)
//   2. expo.extra.apiBaseUrl from app.json
//   3. Sensible default per platform (Android emulator needs 10.0.2.2)
function resolveBaseUrl(): string {
  const envUrl = (process.env as Record<string, string | undefined>)
    .EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const fromExtra =
    (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
      ?.apiBaseUrl;
  if (fromExtra) return fromExtra.replace(/\/$/, "");
  if (Platform.OS === "android") return "http://10.0.2.2:3001";
  return "http://localhost:3001";
}

const BASE_URL = resolveBaseUrl();

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${path} failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  baseUrl: BASE_URL,
  async getMenu(): Promise<MenuPayload> {
    return jsonFetch<MenuPayload>("/api/menu");
  },
  async chat(req: ChatRequest): Promise<ChatResponse> {
    return jsonFetch<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },
};
