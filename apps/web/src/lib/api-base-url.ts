const DEFAULT_API_BASE_URL = "http://localhost:8787";

export function getApiBaseUrl(): URL {
  const value = process.env.API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;

  try {
    return new URL(value);
  } catch {
    throw new Error("API_BASE_URL must be an absolute URL.");
  }
}
