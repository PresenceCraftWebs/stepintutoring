import { CONTENT_BASE_URL } from '@/lib/config';
import type {
  CareerArticle,
  Curriculum,
  Lesson,
  StorageManifest,
  Subject,
} from './types';

/*
 * Curriculum loading with an offline-first fallback chain:
 *
 *   1. fresh copy from the Cloudflare Pages deployment (CONTENT_BASE_URL) —
 *      lets sideloaded APKs pick up new lessons without an app update
 *   2. last good copy cached in localStorage
 *   3. the copy bundled into the app at build time
 *
 * The whole file is ~tens of KB, so a refresh costs less data than a single
 * second of video.
 */

const CACHE_KEY = 'sit.curriculum.v1';
const FETCH_TIMEOUT_MS = 8000;
/**
 * How long an in-memory curriculum stays fresh. After this, the next page
 * navigation refetches — so newly published lessons appear without the
 * student reloading or reinstalling anything. Refreshes are cheap: the
 * browser revalidates with an ETag, so an unchanged curriculum is a 304.
 */
const STALE_AFTER_MS = 5 * 60 * 1000;

let inFlight: Promise<Curriculum> | null = null;
let fetchedAt = 0;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

function readCache(): Curriculum | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Curriculum) : null;
  } catch {
    return null;
  }
}

function writeCache(c: Curriculum): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    // Storage full or unavailable — non-fatal, bundled copy still works.
  }
}

async function load(): Promise<Curriculum> {
  if (CONTENT_BASE_URL) {
    try {
      const fresh = await fetchJson<Curriculum>(
        `${CONTENT_BASE_URL}/curriculum.json`,
      );
      writeCache(fresh);
      return fresh;
    } catch {
      // Offline or deployment unreachable — fall through.
    }
  }
  const cached = readCache();
  if (cached) return cached;
  return fetchJson<Curriculum>('/curriculum.json');
}

export function getCurriculum(): Promise<Curriculum> {
  if (inFlight && Date.now() - fetchedAt < STALE_AFTER_MS) {
    return inFlight;
  }
  const previous = inFlight;
  const next = load()
    .then((c) => {
      fetchedAt = Date.now();
      return c;
    })
    .catch((e: unknown) => {
      // A failed refresh must not break pages that had data before.
      if (previous) {
        inFlight = previous;
        return previous;
      }
      throw e instanceof Error ? e : new Error(String(e));
    });
  inFlight = next;
  return next;
}

export async function getCareers(): Promise<CareerArticle[]> {
  if (CONTENT_BASE_URL) {
    try {
      return await fetchJson<CareerArticle[]>(
        `${CONTENT_BASE_URL}/careers.json`,
      );
    } catch {
      /* fall through to bundled copy */
    }
  }
  return fetchJson<CareerArticle[]>('/careers.json');
}

/**
 * Storage manifest for admin screens. Freshness matters here (it gates the
 * upload path), so remote is tried first and the bundled copy is only a
 * last resort.
 */
export async function getStorageManifest(): Promise<StorageManifest> {
  if (CONTENT_BASE_URL) {
    try {
      return await fetchJson<StorageManifest>(
        `${CONTENT_BASE_URL}/storage-manifest.json`,
      );
    } catch {
      /* fall through */
    }
  }
  return fetchJson<StorageManifest>('/storage-manifest.json');
}

/* --------------------------------------------------------------- selectors */

export function subjectById(
  c: Curriculum,
  id: string,
): Subject | undefined {
  return c.subjects.find((s) => s.id === id);
}

/** Distinct grades that actually have lessons, ascending. */
export function gradesWithContent(c: Curriculum): number[] {
  return [...new Set(c.lessons.map((l) => l.grade))].sort((a, b) => a - b);
}

/** Subjects that have at least one lesson for the given grade. */
export function subjectsForGrade(c: Curriculum, grade: number): Subject[] {
  const ids = new Set(
    c.lessons.filter((l) => l.grade === grade).map((l) => l.subjectId),
  );
  return c.subjects.filter((s) => ids.has(s.id));
}

export function lessonsFor(
  c: Curriculum,
  grade: number,
  subjectId: string,
  term?: number,
): Lesson[] {
  return c.lessons
    .filter(
      (l) =>
        l.grade === grade &&
        l.subjectId === subjectId &&
        (term === undefined || l.term === term),
    )
    .sort((a, b) => a.term - b.term || a.order - b.order);
}

export function lessonById(c: Curriculum, id: string): Lesson | undefined {
  return c.lessons.find((l) => l.id === id);
}

/** Ordered topics within one (grade, subject, term), with their lessons. */
export function topicsFor(
  c: Curriculum,
  grade: number,
  subjectId: string,
  term: number,
): { topic: string; lessons: Lesson[] }[] {
  const groups = new Map<string, Lesson[]>();
  for (const lesson of lessonsFor(c, grade, subjectId, term)) {
    const list = groups.get(lesson.topic) ?? [];
    list.push(lesson);
    groups.set(lesson.topic, list);
  }
  return [...groups.entries()].map(([topic, lessons]) => ({ topic, lessons }));
}

/** Previous/next lesson within the same (grade, subject, term) play order. */
export function lessonSiblings(
  c: Curriculum,
  lesson: Lesson,
): { prev: Lesson | undefined; next: Lesson | undefined } {
  const list = lessonsFor(c, lesson.grade, lesson.subjectId, lesson.term);
  const i = list.findIndex((l) => l.id === lesson.id);
  return {
    prev: i > 0 ? list[i - 1] : undefined,
    next: i >= 0 ? list[i + 1] : undefined,
  };
}

/** All R2-hosted lessons (the only downloadable/deletable tier). */
export function r2Lessons(c: Curriculum): Lesson[] {
  return c.lessons.filter((l) => l.hostProvider === 'r2');
}
