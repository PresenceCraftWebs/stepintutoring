const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Accepts whatever an admin pastes — a full YouTube URL in any common shape
 * or a bare 11-character id — and returns the video id, or null.
 *
 *   https://www.youtube.com/watch?v=aqz-KE-bpKQ
 *   https://youtu.be/aqz-KE-bpKQ?t=30
 *   https://www.youtube.com/shorts/aqz-KE-bpKQ
 *   https://www.youtube.com/embed/aqz-KE-bpKQ
 *   https://www.youtube.com/live/aqz-KE-bpKQ
 *   aqz-KE-bpKQ
 */
export function parseYoutubeInput(input: string): string | null {
  const text = input.trim();
  if (ID_RE.test(text)) return text;

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0] ?? '';
    return ID_RE.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v');
    if (v && ID_RE.test(v)) return v;
    const m = /^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/.exec(
      url.pathname,
    );
    if (m?.[1]) return m[1];
  }
  return null;
}
