/*
 * Deployment configuration. Values come from .env / .env.production —
 * see WIRING.md for what to put in each. Everything has a safe fallback so
 * the app runs locally with seed data before anything is wired in.
 */

/** Base URL videos stream from: the R2 public bucket domain (no trailing /). */
export const R2_PUBLIC_URL: string =
  import.meta.env.VITE_R2_PUBLIC_URL ?? '';

/** The admin Cloudflare Worker (upload URLs, delete, overflow lessons). */
export const WORKER_URL: string = import.meta.env.VITE_WORKER_URL ?? '';

/**
 * Where the *web build* of this app lives (Cloudflare Pages). The native app
 * fetches fresh curriculum.json / storage-manifest.json from here so students
 * see new lessons without installing a new APK. Empty = bundled data only.
 */
export const CONTENT_BASE_URL: string =
  import.meta.env.VITE_CONTENT_BASE_URL ?? '';

/** Resolve a lesson's r2VideoKey to a streamable URL. */
export function videoUrl(r2VideoKey: string): string {
  // Seed-data escape hatch: seeds use full URLs to sample MP4s.
  if (/^https?:\/\//.test(r2VideoKey)) return r2VideoKey;
  return `${R2_PUBLIC_URL}/${r2VideoKey}`;
}
