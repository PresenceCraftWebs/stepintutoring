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
  findLesson,
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
// Set when converting an existing lesson (usually YouTube-tier) to R2 in
// place — the lesson keeps its id, position and any learner progress.
const replaceLessonId = process.env.REPLACE_LESSON_ID ?? '';

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

let lessonId;
let videoKey;

if (replaceLessonId) {
  const found = findLesson(replaceLessonId);
  if (!found) {
    console.error(`✖ Lesson to replace not found: ${replaceLessonId}`);
    process.exit(1);
  }
  lessonId = replaceLessonId;
  videoKey = `videos/${lessonId}.mp4`;
  const lesson = found.doc.lessons[found.index];
  // Free the manifest space of a previous R2 copy, if any (re-upload case).
  if (lesson.r2FileSizeBytes) updateManifest(-lesson.r2FileSizeBytes);
  lesson.hostProvider = 'r2';
  lesson.r2VideoKey = videoKey;
  lesson.r2FileSizeBytes = sizeBytes;
  delete lesson.youtubeId;
  delete lesson.attribution;
  delete lesson.videoRemoved;
  lesson.title = meta.title;
  lesson.topic = meta.topic;
  lesson.durationMinutes = meta.durationMinutes;
  lesson.tags = sanitizeTags(meta.tags);
  lesson.notes = meta.notes ?? '';
  saveLessonFile(found.path, found.doc);
  console.log(`✔ Converted ${lessonId} to R2 in ${found.path}`);
} else {
  lessonId = makeLessonId(meta);
  videoKey = `videos/${lessonId}.mp4`;
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
  console.log(`✔ Added lesson ${lessonId} to ${path}`);
}

const manifest = updateManifest(sizeBytes);

console.log(
  `✔ Manifest now ${(manifest.totalBytesUsed / 1e9).toFixed(2)} GB of ` +
    `${(manifest.softCapBytes / 1e9).toFixed(2)} GB soft cap`,
);

const out = process.env.GITHUB_OUTPUT;
if (out) {
  appendFileSync(out, `lesson_id=${lessonId}\n`);
  appendFileSync(out, `video_key=${videoKey}\n`);
}
