import { AwsClient } from 'aws4fetch';

/*
 * Step-In Tutoring admin Worker.
 *
 *   POST   /upload-url       → short-lived signed PUT URL into R2 incoming/
 *   POST   /upload-complete  → trigger the compress-video GitHub workflow
 *   DELETE /video            → delete an R2 object + flag its lesson in git
 *   POST   /overflow-lesson  → commit a YouTube-hosted lesson via git workflow
 *   GET    /health           → unauthenticated liveness check
 *
 * AUTH: every mutating endpoint requires the X-Admin-Key header to match the
 * ADMIN_KEY secret (compared as SHA-256 digests to avoid timing leaks).
 * This is deliberately simple — one NGO, one admin. If the org ever needs
 * real user management, put this Worker behind Cloudflare Access instead and
 * drop the header check (README documents this upgrade path).
 *
 * Design note: this Worker never writes to the git repo itself. All repo
 * writes happen in GitHub Actions (single writer), which this Worker only
 * triggers via workflow_dispatch.
 */

export interface Env {
  VIDEOS: R2Bucket;
  R2_ACCOUNT_ID: string;
  R2_BUCKET_NAME: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  // Secrets
  ADMIN_KEY: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  GITHUB_TOKEN: string;
}

const UPLOAD_URL_TTL_SECONDS = 3600; // large raw files on slow connections
const MAX_SINGLE_PUT_BYTES = 4_995_000_000; // R2 single-PUT limit (~4.995 GB)

/* ------------------------------------------------------------------- CORS */

// The API is called from the Capacitor app (origin capacitor://localhost or
// https://localhost) and the Pages web build. The shared-secret header is the
// actual access control, so CORS can be permissive.
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Key',
  'Access-Control-Max-Age': '86400',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function error(message: string, status: number): Response {
  return json({ error: message }, status);
}

/* ------------------------------------------------------------------- auth */

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time-ish comparison via digest equality. */
async function isAuthorized(request: Request, env: Env): Promise<boolean> {
  const provided = request.headers.get('X-Admin-Key');
  if (!provided || !env.ADMIN_KEY) return false;
  const [a, b] = await Promise.all([
    sha256Hex(provided),
    sha256Hex(env.ADMIN_KEY),
  ]);
  return a === b;
}

/* ----------------------------------------------------------- body parsing */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

/* ----------------------------------------------------- GitHub dispatching */

async function dispatchWorkflow(
  env: Env,
  workflowFile: string,
  inputs: Record<string, string>,
): Promise<Response | null> {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${workflowFile}/dispatches`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'sit-admin-worker',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ ref: env.GITHUB_BRANCH, inputs }),
  });
  if (res.status === 204) return null; // success
  const detail = await res.text();
  console.error(`workflow_dispatch ${workflowFile} failed`, res.status, detail);
  return error(
    `GitHub workflow trigger failed (HTTP ${res.status}). ` +
      'Check the GITHUB_TOKEN secret and that the workflow file exists.',
    502,
  );
}

/* ------------------------------------------------- lesson metadata checks */

interface LessonMetadata {
  title: string;
  topic: string;
  grade: number;
  subjectId: string;
  term: number;
  durationMinutes: number;
  notes: string;
  tags: string[];
  youtubeId?: string;
}

function parseMetadata(
  raw: unknown,
  { requireYoutubeId }: { requireYoutubeId: boolean },
): LessonMetadata | string {
  if (!isRecord(raw)) return 'missing "metadata" object';
  const { title, topic, grade, subjectId, term, durationMinutes } = raw;
  if (typeof title !== 'string' || !title.trim()) return 'metadata.title is required';
  if (typeof topic !== 'string' || !topic.trim()) return 'metadata.topic is required';
  if (typeof grade !== 'number' || grade < 10 || grade > 12)
    return 'metadata.grade must be 10–12';
  if (typeof subjectId !== 'string' || !subjectId)
    return 'metadata.subjectId is required';
  if (typeof term !== 'number' || term < 1 || term > 4)
    return 'metadata.term must be 1–4';
  if (typeof durationMinutes !== 'number' || durationMinutes <= 0)
    return 'metadata.durationMinutes must be positive';
  const youtubeId =
    typeof raw.youtubeId === 'string' ? raw.youtubeId : undefined;
  if (requireYoutubeId && !/^[A-Za-z0-9_-]{11}$/.test(youtubeId ?? ''))
    return 'metadata.youtubeId must be an 11-character YouTube video id';
  return {
    title: title.trim(),
    topic: topic.trim(),
    grade,
    subjectId,
    term,
    durationMinutes,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter((t): t is string => typeof t === 'string')
      : [],
    youtubeId,
  };
}

/* ---------------------------------------------------------------- handler */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (url.pathname === '/health') {
      return json({ ok: true });
    }
    if (!(await isAuthorized(request, env))) {
      return error('Unauthorized — missing or wrong X-Admin-Key header', 401);
    }

    try {
      if (url.pathname === '/upload-url' && request.method === 'POST') {
        return await handleUploadUrl(request, env);
      }
      if (url.pathname === '/upload-complete' && request.method === 'POST') {
        return await handleUploadComplete(request, env);
      }
      if (url.pathname === '/video' && request.method === 'DELETE') {
        return await handleDeleteVideo(request, env);
      }
      if (url.pathname === '/overflow-lesson' && request.method === 'POST') {
        return await handleOverflowLesson(request, env);
      }
    } catch (e) {
      console.error('Unhandled worker error', e);
      return error('Internal error — check Worker logs (wrangler tail)', 500);
    }
    return error('Not found', 404);
  },
};

/**
 * (a) Issue a short-lived signed PUT URL for a raw video into incoming/.
 * The app then uploads directly to R2 — the file never passes through this
 * Worker (raw footage can be far bigger than a Worker's request limit).
 */
async function handleUploadUrl(request: Request, env: Env): Promise<Response> {
  const body = await readBody(request);
  const fileName =
    typeof body.fileName === 'string' && body.fileName
      ? body.fileName
      : 'video.mp4';
  const fileSizeBytes =
    typeof body.fileSizeBytes === 'number' ? body.fileSizeBytes : 0;
  if (fileSizeBytes > MAX_SINGLE_PUT_BYTES) {
    return error(
      'File is larger than a single R2 upload allows (~5 GB). ' +
        'Export the recording at a lower quality first — the pipeline ' +
        'compresses it anyway, so a smaller export loses nothing.',
      413,
    );
  }

  const safeName = fileName.replace(/[^A-Za-z0-9._-]+/g, '-').slice(-80);
  const objectKey = `incoming/${Date.now()}-${safeName}`;

  const r2 = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  });
  const target = new URL(
    `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${objectKey}`,
  );
  target.searchParams.set('X-Amz-Expires', String(UPLOAD_URL_TTL_SECONDS));
  const signed = await r2.sign(
    new Request(target.toString(), { method: 'PUT' }),
    { aws: { signQuery: true, service: 's3' } },
  );

  return json({
    uploadUrl: signed.url,
    objectKey,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  });
}

/**
 * (b) After the direct upload finishes, kick off the GitHub Actions
 * compression pipeline, passing the object key + lesson metadata.
 */
async function handleUploadComplete(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await readBody(request);
  const objectKey = body.objectKey;
  if (typeof objectKey !== 'string' || !objectKey.startsWith('incoming/')) {
    return error('objectKey must be the incoming/... key from /upload-url', 400);
  }
  const meta = parseMetadata(body.metadata, { requireYoutubeId: false });
  if (typeof meta === 'string') return error(meta, 400);

  // Verify the object actually landed in R2 before burning an Actions run.
  const head = await env.VIDEOS.head(objectKey);
  if (!head) {
    return error(
      'No file found at that key — the upload may have failed or expired.',
      404,
    );
  }

  const failure = await dispatchWorkflow(env, 'compress-video.yml', {
    object_key: objectKey,
    metadata_json: JSON.stringify(meta),
  });
  if (failure) return failure;
  return json({
    ok: true,
    message:
      'Processing started. Compression usually takes roughly the length ' +
      'of the video; the lesson appears automatically when it finishes.',
  });
}

/**
 * (c) Admin-initiated deletion of an R2-hosted video. Deletes the object
 * immediately, then triggers the content-maintenance workflow to update
 * storage-manifest.json and flag the lesson as needing attention (so the
 * lesson entry is never silently broken).
 */
async function handleDeleteVideo(request: Request, env: Env): Promise<Response> {
  const body = await readBody(request);
  const { lessonId, r2VideoKey } = body;
  if (typeof lessonId !== 'string' || !lessonId) {
    return error('lessonId is required', 400);
  }
  if (
    typeof r2VideoKey !== 'string' ||
    !r2VideoKey.startsWith('videos/')
  ) {
    return error(
      'r2VideoKey must be a videos/... object key (seed lessons that point ' +
        'at external sample URLs have nothing in R2 to delete)',
      400,
    );
  }

  const head = await env.VIDEOS.head(r2VideoKey);
  const freedBytes = head?.size ?? 0;
  await env.VIDEOS.delete(r2VideoKey);

  const failure = await dispatchWorkflow(env, 'content-maintenance.yml', {
    action: 'video-deleted',
    payload_json: JSON.stringify({ lessonId, r2VideoKey, freedBytes }),
  });
  if (failure) return failure;
  return json({
    ok: true,
    freedBytes,
    message:
      'Video deleted. The lesson is being flagged as "needs attention" — ' +
      're-upload it or give it a YouTube link from the CMS.',
  });
}

/**
 * (d) YouTube overflow path: no file involved — just commit the lesson
 * metadata (with youtubeId) via the content-maintenance workflow.
 */
async function handleOverflowLesson(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await readBody(request);
  const meta = parseMetadata(body.metadata, { requireYoutubeId: true });
  if (typeof meta === 'string') return error(meta, 400);

  const failure = await dispatchWorkflow(env, 'content-maintenance.yml', {
    action: 'add-youtube-lesson',
    payload_json: JSON.stringify(meta),
  });
  if (failure) return failure;
  return json({
    ok: true,
    message:
      'Lesson submitted. It appears in the app after the site rebuilds ' +
      '(usually a few minutes).',
  });
}
