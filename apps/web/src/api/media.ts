import { getToken } from "./client";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

/**
 * Upload an image to media-service and return the URL to store in a tweet's
 * mediaUrls. Uses fetch directly (not apiFetch) because the body is multipart
 * FormData — the browser must set the multipart boundary itself.
 */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);

  const token = getToken();
  const res = await fetch(`${BASE_URL}/v1/media`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body && body.message) || `Upload failed (${res.status})`);
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}
