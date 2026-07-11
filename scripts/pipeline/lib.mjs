/*
 * Shared helpers for the pipeline scripts that GitHub Actions runs
 * (add-lesson.mjs, maintenance.mjs). Plain Node + js-yaml, no TypeScript,
 * so the workflows can run them directly after `npm ci`.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';

export const CONTENT_DIR = join(process.cwd(), 'content');
export const LESSONS_DIR = join(CONTENT_DIR, 'lessons');
export const MANIFEST_PATH = join(CONTENT_DIR, 'storage-manifest.json');

export function lessonFilePath(grade, subjectId, term) {
  return join(LESSONS_DIR, `grade-${grade}-${subjectId}-term-${term}.yml`);
}

/** Parse grade/subjectId/term back out of a lesson file path. */
export function parseLessonFilePath(path) {
  const m = /grade-(\d+)-([a-z0-9-]+?)-term-(\d)\.yml$/.exec(path);
  if (!m) return null;
  return { grade: Number(m[1]), subjectId: m[2], term: Number(m[3]) };
}

/** Find the file containing a lesson id → { path, doc, index } or null. */
export function findLesson(lessonId) {
  for (const path of allLessonFiles()) {
    const doc = loadLessonFile(path);
    const index = doc.lessons.findIndex((l) => l.id === lessonId);
    if (index !== -1) return { path, doc, index };
  }
  return null;
}

export function loadLessonFile(path) {
  if (!existsSync(path)) return { lessons: [] };
  const doc = yamlLoad(readFileSync(path, 'utf8'));
  if (!doc || !Array.isArray(doc.lessons)) return { lessons: [] };
  return doc;
}

export function saveLessonFile(path, doc) {
  // NOTE: js-yaml re-serialises the whole file, so hand-written comments in a
  // file are dropped the first time the pipeline touches it. Metadata is
  // preserved exactly; only comments are affected.
  writeFileSync(
    path,
    yamlDump(doc, { lineWidth: 100, noRefs: true, quotingType: '"' }),
  );
}

export function allLessonFiles() {
  if (!existsSync(LESSONS_DIR)) return [];
  return readdirSync(LESSONS_DIR)
    .filter((f) => f.endsWith('.yml'))
    .map((f) => join(LESSONS_DIR, f));
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
}

/** Unique, readable lesson id: g10-mathematics-t1-laws-of-exponents-k3f9 */
export function makeLessonId(meta) {
  const rand = Math.random().toString(36).slice(2, 6);
  return `g${meta.grade}-${meta.subjectId}-t${meta.term}-${slugify(meta.title)}-${rand}`;
}

export function nextOrder(doc) {
  return doc.lessons.reduce((max, l) => Math.max(max, l.order ?? 0), 0) + 1;
}

export function updateManifest(deltaBytes) {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  manifest.totalBytesUsed = Math.max(
    0,
    (manifest.totalBytesUsed ?? 0) + deltaBytes,
  );
  manifest.lastUpdated = new Date().toISOString();
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

export function sanitizeTags(tags) {
  const valid = new Set(['exam-prep', 'past-paper', 'revision']);
  return (Array.isArray(tags) ? tags : []).filter((t) => valid.has(t));
}
