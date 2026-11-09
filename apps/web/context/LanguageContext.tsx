"use client";

/**
 * BhuSetu 3D Global Language Context & i18n Engine
 * Enterprise Multilingual Framework (Phase 12)
 * 
 * Features:
 * - Single source of locale truth (en, kn, hi, ta, te)
 * - Zero runtime Gemini calls for static UI
 * - Instant in-memory translation switching (zero Cesium reload, zero spatial selection loss)
 * - Safe fallback to English for any missing keys
 * - Cookie + localStorage persistence across reloads and route changes
 * - Parameter interpolation ({name}, {count}) and date/number formatting
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";

import enMessages from "@/messages/en.json";
import knMessages from "@/messages/kn.json";
import hiMessages from "@/messages/hi.json";
import taMessages from "@/messages/ta.json";
import teMessages from "@/messages/te.json";

export type SupportedLocale = "en" | "kn" | "hi" | "ta" | "te";

export interface LocaleMetadata {
  code: SupportedLocale;
  label: string;
  nativeName: string;
  direction: "ltr";
}

export const SUPPORTED_LOCALES: LocaleMetadata[] = [
  { code: "en", label: "English", nativeName: "English", direction: "ltr" },
  { code: "kn", label: "Kannada", nativeName: "ಕನ್ನಡ", direction: "ltr" },
  { code: "hi", label: "Hindi", nativeName: "हिंदी", direction: "ltr" },
  { code: "ta", label: "Tamil", nativeName: "தமிழ்", direction: "ltr" },
  { code: "te", label: "Telugu", nativeName: "తెలుగు", direction: "ltr" },
];

const MESSAGES: Record<SupportedLocale, Record<string, any>> = {
  en: enMessages,
  kn: knMessages,
  hi: hiMessages,
  ta: taMessages,
  te: teMessages,
};

interface LanguageContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  currentLocaleMeta: LocaleMetadata;
  supportedLocales: LocaleMetadata[];
  t: (key: string, params?: Record<string, string | number>) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const COOKIE_NAME = "NEXT_LOCALE";
const STORAGE_KEY = "bhusetu_language";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
  return match ? decodeURIComponent(match[3]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function resolveInitialLocale(): SupportedLocale {
  if (typeof window === "undefined") return "en";

  // 1. Check Cookie
  const cookieLocale = getCookie(COOKIE_NAME);
  if (cookieLocale && (SUPPORTED_LOCALES.some((l) => l.code === cookieLocale))) {
    return cookieLocale as SupportedLocale;
  }

  // 2. Check LocalStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LOCALES.some((l) => l.code === saved)) {
      return saved as SupportedLocale;
    }
  } catch {
    // localStorage not accessible
  }

  // 3. Check Browser Languages
  try {
    const browserLang = (navigator.language || "").toLowerCase();
    for (const loc of SUPPORTED_LOCALES) {
      if (browserLang.startsWith(loc.code)) {
        return loc.code;
      }
    }
  } catch {
    // navigator not accessible
  }

  // 4. Default to English
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>("en");
  const [mounted, setMounted] = useState(false);

  // Initialize locale on client mount
  useEffect(() => {
    const initial = resolveInitialLocale();
    setLocaleState(initial);
    setMounted(true);
    if (typeof document !== "undefined") {
      document.documentElement.lang = initial;
    }
  }, []);

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    if (!SUPPORTED_LOCALES.some((l) => l.code === newLocale)) return;

    setLocaleState(newLocale);
    setCookie(COOKIE_NAME, newLocale);

    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // ignore
    }

    if (typeof document !== "undefined") {
      document.documentElement.lang = newLocale;
    }

    // Dispatch global event for non-React canvas or Cesium listeners
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("bhusetu:language-change", { detail: { locale: newLocale } })
      );
    }
  }, []);

  const currentLocaleMeta = useMemo(() => {
    return (
      SUPPORTED_LOCALES.find((l) => l.code === locale) ||
      SUPPORTED_LOCALES[0]
    );
  }, [locale]);

  /**
   * Translates a dot-notation key (e.g., 'header.parcels' or 'verification.legalNotice').
   * Supports parameter interpolation: {count}, {name}, etc.
   * Gracefully falls back to English, then to the key itself.
   */
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const keys = key.split(".");
      const currentDict = MESSAGES[locale] || MESSAGES.en;
      const fallbackDict = MESSAGES.en;

      // 1. Try resolving in current dictionary
      let resolved: any = currentDict;
      for (const k of keys) {
        if (resolved && typeof resolved === "object" && k in resolved) {
          resolved = resolved[k];
        } else {
          resolved = undefined;
          break;
        }
      }

      // 2. If not found, try fallback dictionary (English)
      if (resolved === undefined || typeof resolved !== "string") {
        let fallbackVal: any = fallbackDict;
        for (const k of keys) {
          if (fallbackVal && typeof fallbackVal === "object" && k in fallbackVal) {
            fallbackVal = fallbackVal[k];
          } else {
            fallbackVal = undefined;
            break;
          }
        }
        resolved = typeof fallbackVal === "string" ? fallbackVal : key;
      }

      // 3. Interpolate parameters: {count}, {id}, {name}
      if (params && typeof resolved === "string") {
        return resolved.replace(/\{(\w+)\}/g, (match, paramKey) => {
          if (paramKey in params) {
            return String(params[paramKey]);
          }
          return match;
        });
      }

      return resolved;
    },
    [locale]
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions): string => {
      try {
        return new Intl.NumberFormat(locale, options).format(value);
      } catch {
        return String(value);
      }
    },
    [locale]
  );

  const formatDate = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions): string => {
      try {
        const d = date instanceof Date ? date : new Date(date);
        return new Intl.DateTimeFormat(locale, options).format(d);
      } catch {
        return String(date);
      }
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      currentLocaleMeta,
      supportedLocales: SUPPORTED_LOCALES,
      t,
      formatNumber,
      formatDate,
    }),
    [locale, setLocale, currentLocaleMeta, t, formatNumber, formatDate]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
