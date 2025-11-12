// API related constants and functions

// --- API CONFIG ---
// Use environment variables in a real application
const envApiBase = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE_URL : undefined;
const globalApiBase = typeof window !== 'undefined' ? (window as any).__APP_API_BASE_URL__ : undefined;
export const API_BASE_URL = envApiBase || globalApiBase || "http://localhost:5001/api"; 
export const OWNER_ID = 1; // Assuming owner ID is constant

/**
 * A helper function to make API requests.
 * Handles credentials, headers, error handling, and JSON parsing.
 * @param endpoint - The API endpoint (e.g., "/users").
 * @param method - The HTTP method ("GET", "POST", "PUT", "DELETE").
 * @param body - The request body (optional). Can be an object (JSON) or FormData.
 * @returns A Promise resolving to the parsed JSON response or null for 204 status.
 * @throws An error with the message from the server if the request fails.
 */
export const apiRequest = async <T = any>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: any
): Promise<T | null> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {},
    credentials: "include", // Essential for sending/receiving cookies
  };

  if (body) {
    if (body instanceof FormData) {
      // Don't set Content-Type for FormData, the browser does it
      options.body = body;
    } else {
      // Default to JSON
      (options.headers as Record<string, string>)["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }
  }

  try {
    const response = await fetch(url, options);

    // Handle 204 No Content response
    if (response.status === 204) {
      return null;
    }

    const data = await response.json();

    if (!response.ok) {
      // Throw an error with the message from the backend, or a default one
      throw new Error(data.message || `API Error: ${response.status} ${response.statusText}`);
    }

    return data as T;
  } catch (err: any) {
    console.error(`API Error on ${method} ${endpoint}:`, err);
    // Re-throw the error but ensure it's an Error object with a message
    if (err instanceof Error) {
        throw err;
    } else {
        throw new Error(String(err));
    }
  }
};

// Convenience methods
export const api = {
    get: <T = any>(endpoint: string) => apiRequest<T>(endpoint, "GET"),
    post: <T = any>(endpoint: string, body: any) => apiRequest<T>(endpoint, "POST", body),
    put: <T = any>(endpoint: string, body: any) => apiRequest<T>(endpoint, "PUT", body),
    delete: <T = any>(endpoint: string) => apiRequest<T>(endpoint, "DELETE"),
};
