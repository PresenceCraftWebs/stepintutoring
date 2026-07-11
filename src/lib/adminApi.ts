import { WORKER_URL } from './config';
import { getAdminKey } from './settings';

/*
 * Thin client for the admin Worker. Every call sends the device-stored
 * X-Admin-Key; a 401 means the key is wrong (or ADMIN_KEY isn't set on the
 * Worker yet — see WIRING.md).
 */

export interface UploadTicket {
  uploadUrl: string;
  objectKey: string;
  expiresInSeconds: number;
}

export interface LessonMetadataInput {
  title: string;
  topic: string;
  grade: number;
  subjectId: string;
  term: number;
  durationMinutes: number;
  notes: string;
  tags: string[];
  youtubeId?: string;
  attribution?: string;
}

class AdminApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(
  path: string,
  method: string,
  body: unknown,
): Promise<T> {
  if (!WORKER_URL) {
    throw new AdminApiError(
      'Admin tools are not set up in this build yet. Use the content ' +
        'editor at /admin to edit content in the meantime.',
      0,
    );
  }
  const key = await getAdminKey();
  if (!key) {
    throw new AdminApiError('No admin key saved on this device.', 0);
  }
  const res = await fetch(`${WORKER_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': key,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & T;
  if (!res.ok) {
    throw new AdminApiError(data.error ?? `HTTP ${res.status}`, res.status);
  }
  return data;
}

export type KeyCheckResult =
  | 'ok'
  | 'unauthorized'
  | 'unreachable'
  | 'unconfigured';

/**
 * Verify a candidate admin key against the Worker BEFORE storing it — the
 * admin gate must not accept a key the server would reject.
 */
export async function verifyAdminKey(key: string): Promise<KeyCheckResult> {
  if (!WORKER_URL) return 'unconfigured';
  try {
    const res = await fetch(`${WORKER_URL}/auth-check`, {
      headers: { 'X-Admin-Key': key },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return 'ok';
    if (res.status === 401) return 'unauthorized';
    return 'unreachable';
  } catch {
    return 'unreachable';
  }
}

export function requestUploadUrl(
  fileName: string,
  fileSizeBytes: number,
): Promise<UploadTicket> {
  return call<UploadTicket>('/upload-url', 'POST', {
    fileName,
    fileSizeBytes,
  });
}

/**
 * PUT the raw file straight to R2 using the signed URL. XMLHttpRequest
 * rather than fetch, because upload progress events matter for multi-GB
 * files on slow connections.
 */
export function uploadRawVideo(
  uploadUrl: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else
        reject(
          new Error(
            `Upload failed (HTTP ${xhr.status}). The upload link may have ` +
              'expired — try again.',
          ),
        );
    };
    xhr.onerror = () =>
      reject(new Error('Upload failed — check your connection and retry.'));
    xhr.send(file);
  });
}

export function notifyUploadComplete(
  objectKey: string,
  metadata: LessonMetadataInput,
  replaceLessonId?: string,
): Promise<{ ok: boolean; message: string }> {
  return call('/upload-complete', 'POST', {
    objectKey,
    metadata,
    replaceLessonId,
  });
}

export function deleteVideo(
  lessonId: string,
  r2VideoKey: string,
): Promise<{ ok: boolean; freedBytes: number; message: string }> {
  return call('/video', 'DELETE', { lessonId, r2VideoKey });
}

export function addYoutubeLesson(
  metadata: LessonMetadataInput,
): Promise<{ ok: boolean; message: string }> {
  return call('/overflow-lesson', 'POST', { metadata });
}

export function updateLesson(
  lessonId: string,
  metadata: LessonMetadataInput,
): Promise<{ ok: boolean; message: string }> {
  return call('/update-lesson', 'POST', { lessonId, metadata });
}

/** Remove a YouTube-tier lesson entry (R2 lessons go through deleteVideo). */
export function deleteYoutubeLesson(
  lessonId: string,
): Promise<{ ok: boolean; message: string }> {
  return call('/lesson', 'DELETE', { lessonId });
}

export interface OfflineRequest {
  lessonId: string;
  count: number;
}

export function getOfflineRequests(): Promise<{ requests: OfflineRequest[] }> {
  return call('/offline-requests', 'GET', undefined);
}

export function dismissOfflineRequest(
  lessonId: string,
): Promise<{ ok: boolean }> {
  return call('/offline-request', 'DELETE', { lessonId });
}

/**
 * PUBLIC (learner) call — no admin key. Marks a lesson as "needed offline"
 * so admins can prioritise re-hosting it on R2.
 */
export async function requestOfflineVersion(lessonId: string): Promise<void> {
  if (!WORKER_URL) throw new Error('Not available in this build.');
  const res = await fetch(`${WORKER_URL}/offline-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lessonId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
