/**
 * BhuSetu 3D Supabase Browser Client
 * Enterprise 3D Cadastral Intelligence Platform
 *
 * Provides Tab-Isolated Sessions:
 * - Each browser tab manages its own authenticated identity.
 * - Tab A (e.g. Vikram Sen / ADMIN) and Tab B (e.g. Sunil Rao / SURVEYOR)
 *   operate completely independently without cross-tab session contamination.
 * - Uses tab-specific storage and channel keys so BroadcastChannel does not leak events between tabs.
 * - Sessions persist across reloads within each tab.
 */
import { createClient, SupabaseClient, SupportedStorage } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://dvxzekhcylnottvaljwm.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_FPlHAhHASCaz-fWgnBx_BQ_21ZvKqCr";

/**
 * Returns a stable identifier for the current browser tab.
 * Persists across page refreshes in this tab via sessionStorage,
 * but is distinct for each opened tab.
 */
export function getTabSessionId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let tabId = sessionStorage.getItem("bhusetu_tab_id");
    if (!tabId) {
      tabId = "tab_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now().toString(36);
      sessionStorage.setItem("bhusetu_tab_id", tabId);
    }
    return tabId;
  } catch {
    return "tab_fallback";
  }
}

/**
 * Tab-Isolated Storage Adapter.
 * - Reads & writes to sessionStorage scoped by tab ID.
 * - On cold tab open, can bootstrap from the most recent session in localStorage if present.
 * - Once active in the tab, does not listen to or broadcast across other tabs.
 */
export class TabSessionStorage implements SupportedStorage {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    try {
      const tabId = getTabSessionId();
      const tabKey = `${tabId}_${key}`;
      const existing = sessionStorage.getItem(tabKey);
      if (existing) return existing;

      // If opening a new tab or reopening a closed window, bootstrap from primary session if present
      const primaryKey = `bhusetu_primary_${key}`;
      const primarySession = localStorage.getItem(primaryKey);
      if (primarySession) {
        // Clone into this tab's isolated storage so future actions are tab-isolated
        sessionStorage.setItem(tabKey, primarySession);
        return primarySession;
      }
      return null;
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    try {
      const tabId = getTabSessionId();
      const tabKey = `${tabId}_${key}`;
      sessionStorage.setItem(tabKey, value);

      // Save to primary session for reopening/new tab bootstrap
      const primaryKey = `bhusetu_primary_${key}`;
      localStorage.setItem(primaryKey, value);
    } catch {
      // Ignore storage quota errors
    }
  }

  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    try {
      const tabId = getTabSessionId();
      const tabKey = `${tabId}_${key}`;
      sessionStorage.removeItem(tabKey);
    } catch {
      // Ignore
    }
  }
}

let _clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (typeof window === "undefined") {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
  }

  if (!_clientInstance) {
    const tabId = getTabSessionId();
    // Unique storageKey prevents cross-tab BroadcastChannel event collisions in @supabase/auth-js
    const tabStorageKey = `bhusetu_sb_${tabId}_auth`;

    _clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: new TabSessionStorage(),
        storageKey: tabStorageKey,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return _clientInstance;
}

/**
 * Authoritative Supabase Client export.
 * Delegates all property accesses to the tab-isolated client instance.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const val = (client as any)[prop];
    if (typeof val === "function") {
      return val.bind(client);
    }
    return val;
  },
});
