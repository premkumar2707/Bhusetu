/**
 * BhuSetu 3D Centralized API Base URL Configuration
 * Single Source of Truth for Backend URL Resolution with Resilient Failover
 * 
 * Rules:
 * 1. Production must ALWAYS point to https://bhusetu3d-backend.onrender.com/api/v1
 * 2. Production NEVER falls back to localhost or 127.0.0.1
 * 3. Development uses NEXT_PUBLIC_API_URL or falls back to local backend,
 *    with automatic failover to the live cloud backend if local port 8000 is offline.
 */

export const RENDER_BACKEND_URL = "https://bhusetu3d-backend.onrender.com/api/v1";
export const LOCAL_BACKEND_URL = "http://127.0.0.1:8000/api/v1";

/**
 * Returns the effective API base URL without trailing slashes.
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  // Detect production environment via NODE_ENV or browser host
  const isProduction =
    process.env.NODE_ENV === "production" ||
    (typeof window !== "undefined" &&
      (window.location.hostname.includes("vercel.app") ||
        window.location.hostname === "bhusetu3d.com" ||
        window.location.protocol === "https:"));

  // 1. If explicit env variable is set, validate it
  if (envUrl && envUrl.trim() !== "") {
    const trimmed = envUrl.trim().replace(/\/+$/, "");
    // If running in production but env mistakenly contains localhost, force Render backend
    if (isProduction && (trimmed.includes("localhost") || trimmed.includes("127.0.0.1"))) {
      return RENDER_BACKEND_URL;
    }
    return trimmed;
  }

  // 2. Environment-based resolution
  if (isProduction) {
    return RENDER_BACKEND_URL;
  }

  return LOCAL_BACKEND_URL;
}

/**
 * Returns prioritized list of candidate API base URLs.
 * In development, includes local server and live cloud backend.
 */
export function getApiCandidates(): string[] {
  const primaryUrl = getApiBaseUrl();

  const isProduction =
    process.env.NODE_ENV === "production" ||
    (typeof window !== "undefined" &&
      (window.location.hostname.includes("vercel.app") ||
        window.location.hostname === "bhusetu3d.com" ||
        window.location.protocol === "https:"));

  if (isProduction) {
    return [primaryUrl, RENDER_BACKEND_URL];
  }

  const candidates: string[] = [
    primaryUrl,
    "http://127.0.0.1:8000/api/v1",
    "http://localhost:8000/api/v1",
    RENDER_BACKEND_URL,
  ];

  return Array.from(new Set(candidates));
}

/**
 * Executes a resilient fetch with automatic host failover and strict timeout.
 */
export async function fetchWithFailover(
  path: string,
  options: RequestInit = {},
  timeoutMs = 5000
): Promise<Response> {
  const candidates = getApiCandidates();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  let lastError: unknown = null;

  for (const base of candidates) {
    const targetUrl = `${base}${normalizedPath}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(targetUrl, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      lastError = err;
      // Network refusal or timeout -> silently proceed to next candidate
    }
  }

  throw lastError || new Error(`Unable to establish connection to BhuSetu API service.`);
}

export const API_BASE = getApiBaseUrl();
export const API_BASE_URL = API_BASE;
export default API_BASE;
