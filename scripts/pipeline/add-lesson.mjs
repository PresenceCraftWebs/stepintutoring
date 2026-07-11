/*
 * Runs inside the compress-video workflow AFTER ffmpeg compression.
 * Reads:  METADATA_JSON (from the workflow_dispatch input)
 *         SIZE_BYTES    (size of the compressed file)
 * Does:   generates the lesson id, appends the lesson entry to the right
 *         content/lessons/*.yml, bumps storage-manifest.json.
 * Emits:  lesson_id and video_key via GITHUB_OUTPUT so later steps know
 *         where to upload the compressed file in R2.
 */
import { appendFileSync } from 'node:fs';
import {
  lessonFilePath,
  loadLessonFile,
  saveLessonFile,
  makeLessonId,
  nextOrder,
  updateManifest,
  sanitizeTags,
} from './lib.mjs';

const meta = JSON.parse(process.env.METADATA_JSON ?? '{}');
const sizeBytes = Number(process.env.SIZE_BYTES ?? 0);

for (const field of ['title', 'topic', 'grade', 'subjectId', 'term', 'durationMinutes']) {
  if (meta[field] === undefined || meta[field] === '') {
    console.error(`✖ metadata is missing "${field}"`);
    process.exit(1);
  }
}
if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
  console.error('✖ SIZE_BYTES must be a positive number');
  process.exit(1);
}

const lessonId = makeLessonId(meta);
const videoKey = `videos/${lessonId}.mp4`;

const path = lessonFilePath(meta.grade, meta.subjectId, meta.term);
const doc = loadLessonFile(path);
doc.lessons.push({
  id: lessonId,
  title: meta.title,
  topic: meta.topic,
  order: nextOrder(doc),
  hostProvider: 'r2',
  r2VideoKey: videoKey,
  r2FileSizeBytes: sizeBytes,
  durationMinutes: meta.durationMinutes,
  tags: sanitizeTags(meta.tags),
  notes: meta.notes ?? '',
});
saveLessonFile(path, doc);

const manifest = updateManifest(sizeBytes);

console.log(`✔ Added lesson ${lessonId} to ${path}`);
console.log(
  `✔ Manifest now ${(manifest.totalBytesUsed / 1e9).toFixed(2)} GB of ` +
    `${(manifest.softCapBytes / 1e9).toFixed(2)} GB soft cap`,
);

const out = process.env.GITHUB_OUTPUT;
if (out) {
  appendFileSync(out, `lesson_id=${lessonId}\n`);
  appendFileSync(out, `video_key=${videoKey}\n`);
}
