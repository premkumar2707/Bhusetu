/**
 * BhuSetu 3D Authentication API Service
 * Identity verification, role authorization, and session resolution.
 */
import { AuthUser } from "@/types/auth";
import { getApiBaseUrl, getApiCandidates } from "@/lib/api/config";

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface EvaluatorRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  clearance: string;
  status: string;
  badgeColor: string;
  capabilities: string;
}

export interface CreateEvaluatorPayload {
  name: string;
  email: string;
  role: string;
  department: string;
  clearance?: string;
}

/**
 * Executes a resilient fetch with strict timeout to prevent indefinite hangs.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    throw err;
  }
}

export class AuthApiService {
  /**
   * Authenticates user credentials directly against platform API.
   * Tests candidate URLs with fast failover.
   */
  static async login(
    email: string,
    password: string
  ): Promise<LoginResponse> {
    const candidates = getApiCandidates();
    let lastError: Error | null = null;

    for (const baseUrl of candidates) {
      try {
        const response = await fetchWithTimeout(
          `${baseUrl}/auth/login`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
          },
          3000
        );

        if (!response.ok) {
          let errorDetail = "Invalid email or password.";
          try {
            const errorData = await response.json();
            if (errorData.detail) {
              errorDetail = errorData.detail;
            }
          } catch {
            // Non-JSON response
          }
          // Server responded with authoritative auth rejection - do not retry next host
          throw new Error(errorDetail);
        }

        return await response.json();
      } catch (err: unknown) {
        if (err instanceof Error) {
          // If server responded with 401/403 or specific auth error, rethrow immediately
          if (
            err.message.includes("Invalid") ||
            err.message.includes("password") ||
            err.message.includes("credentials") ||
            err.message.includes("deactivated") ||
            err.message.includes("Access Restricted")
          ) {
            throw err;
          }
          lastError = err;
        }
      }
    }

    throw lastError || new Error("Unable to establish secure connection to BhuSetu API.");
  }

  /**
   * Resolves authenticated user profile and roles from the FastAPI backend.
   */
  static async getMe(token: string): Promise<AuthUser> {
    const candidates = getApiCandidates();
    let lastError: Error | null = null;

    for (const baseUrl of candidates) {
      try {
        const response = await fetchWithTimeout(
          `${baseUrl}/auth/me`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
          3000
        );

        if (!response.ok) {
          let errorDetail = "Failed to authenticate session with backend.";
          try {
            const errorData = await response.json();
            if (errorData.detail) {
              errorDetail = errorData.detail;
            }
          } catch {
            // Non-JSON response
          }
          throw new Error(errorDetail);
        }

        const data: AuthUser = await response.json();
        return data;
      } catch (err: unknown) {
        if (err instanceof Error) {
          if (
            err.message.includes("expired") ||
            err.message.includes("Invalid") ||
            err.message.includes("deactivated")
          ) {
            throw err;
          }
          lastError = err;
        }
      }
    }

    throw lastError || new Error("Unable to establish secure connection to BhuSetu API.");
  }

  /**
   * Verifies if the authenticated user possesses an authorized role for a specific action.
   */
  static async verifyRole(token: string, roleName: string): Promise<boolean> {
    const candidates = getApiCandidates();

    for (const baseUrl of candidates) {
      try {
        const response = await fetchWithTimeout(
          `${baseUrl}/auth/verify-role/${roleName.toLowerCase()}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
          2500
        );
        return response.ok;
      } catch {
        // Try next candidate
      }
    }

    return false;
  }

  /**
   * Retrieves all registered evaluators from the authoritative platform database.
   */
  static async listEvaluators(token: string): Promise<EvaluatorRecord[]> {
    const candidates = getApiCandidates();
    let lastError: Error | null = null;

    for (const baseUrl of candidates) {
      try {
        const response = await fetchWithTimeout(
          `${baseUrl}/auth/evaluators`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
          10000
        );

        if (response.ok) {
          return await response.json();
        }
      } catch (err: unknown) {
        if (err instanceof Error) lastError = err;
      }
    }
    throw lastError || new Error("Failed to load evaluators list.");
  }

  /**
   * Provisions a new evaluator in Supabase Auth and public.users table.
   */
  static async createEvaluator(
    token: string,
    payload: CreateEvaluatorPayload
  ): Promise<EvaluatorRecord> {
    const candidates = getApiCandidates();
    let lastError: Error | null = null;

    for (const baseUrl of candidates) {
      try {
        const response = await fetchWithTimeout(
          `${baseUrl}/auth/evaluators`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          },
          15000
        );

        if (!response.ok) {
          let errorDetail = "Failed to create evaluator.";
          try {
            const data = await response.json();
            if (data.detail) errorDetail = data.detail;
          } catch {
            // Non-JSON
          }
          throw new Error(errorDetail);
        }

        return await response.json();
      } catch (err: unknown) {
        if (err instanceof Error) {
          if (
            err.message.includes("already exists") ||
            err.message.includes("Access Restricted")
          ) {
            throw err;
          }
          lastError = err;
        }
      }
    }
    throw lastError || new Error("Failed to create evaluator.");
  }
}

