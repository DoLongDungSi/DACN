// API related constants and functions
import type { ApiResponse } from '../types';

// --- API CONFIG ---
const envApiBase = import.meta.env?.VITE_API_BASE_URL;
const globalApiBase = (window as any).__APP_API_BASE_URL__;
export const API_BASE_URL = envApiBase || globalApiBase || "/api";
export const OWNER_ID = 1;

// Default timeout (5 seconds)
const API_TIMEOUT = 5000;

/**
 * Enhanced API request handler with:
 * - Timeout support
 * - Better error handling
 * - Response validation
 * - Retry mechanism for failed requests
 */
export const apiRequest = async <T = any>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  body?: any,
  retries = 1
): Promise<ApiResponse<T>> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  const options: RequestInit = {
    method,
    headers: {},
    credentials: "include",
    cache: "no-cache",
    signal: controller.signal
  };

  if (body) {
    if (body instanceof FormData) {
      options.body = body;
    } else {
      (options.headers as Record<string, string>)["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
  }

  try {
    const response = await fetch(url, options);
    clearTimeout(timeoutId);

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      if (response.status === 204) {
        return { success: true };
      }
      const text = await response.text();
      return { success: true, data: text as any };
    }

    const data: ApiResponse<T> = await response.json();

    if (!response.ok) {
      // Retry if server error and we have retries left
      if (response.status >= 500 && retries > 0) {
        return apiRequest<T>(endpoint, method, body, retries - 1);
      }
      throw new Error(data.message || data.error || `API Error: ${response.status}`);
    }

    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    
    // Retry on network errors if we have retries left
    if (err.name === 'AbortError' && retries > 0) {
      return apiRequest<T>(endpoint, method, body, retries - 1);
    }

    console.error(`API Error on ${method} ${endpoint}:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err)
    };
  }
};

// Enhanced convenience methods with proper typing
export const api = {
    get: <T = any>(endpoint: string) => apiRequest<T>(endpoint, "GET"),
    post: <T = any>(endpoint: string, body: any) => apiRequest<T>(endpoint, "POST", body),
    put: <T = any>(endpoint: string, body: any) => apiRequest<T>(endpoint, "PUT", body),
    patch: <T = any>(endpoint: string, body: any) => apiRequest<T>(endpoint, "PATCH", body),
    delete: <T = any>(endpoint: string) => apiRequest<T>(endpoint, "DELETE"),

    // Specialized methods
    download: async (endpoint: string) => {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        credentials: "include",
        cache: "no-cache"
      });
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }
      return response.blob();
    },

    upload: async <T = any>(endpoint: string, formData: FormData) => {
      return apiRequest<T>(endpoint, "POST", formData);
    }
};
