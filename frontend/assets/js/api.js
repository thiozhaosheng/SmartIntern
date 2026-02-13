import { API_BASE_URL } from "./config.js";

// Wrapper around fetch with JSON defaults and optional Bearer auth
export async function apiFetch(
  path,
  { method = "GET", body, auth = true } = {},
) {
  const headers = { "Content-Type": "application/json" };

  // Attach access token by default (can be disabled per request)
  if (auth) {
    const token = localStorage.getItem("access_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  // Send request to the backend API
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Try to parse JSON response, fall back to empty object
  const data = await res.json().catch(() => ({}));

  // Normalize error handling to throw a single message
  if (!res.ok) throw new Error(data?.error || "Request failed");

  return data;
}
