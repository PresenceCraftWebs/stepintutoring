/*
 * Runs inside the content-maintenance workflow. Two actions:
 *
 *   video-deleted       payload: { lessonId, r2VideoKey, freedBytes }
 *     Removes the lesson entry along with its deleted video — students never
 *     see a broken lesson — and decrements the storage manifest.
 *
 *   add-youtube-lesson  payload: lesson metadata incl. youtubeId
 *     Appends a stream-only YouTube lesson (the overflow path used when R2
 *     is near its free-tier cap).
 *
 * Reads ACTION and PAYLOAD_JSON from the environment.
 */
import {
  allLessonFiles,
  lessonFilePath,
  loadLessonFile,
  saveLessonFile,
  makeLessonId,
  nextOrder,
  updateManifest,
  sanitizeTags,
} from './lib.mjs';

const action = process.env.ACTION ?? '';
const payload = JSON.parse(process.env.PAYLOAD_JSON ?? '{}');

if (action === 'video-deleted') {
  const { lessonId, freedBytes } = payload;
  if (!lessonId) {
    console.error('✖ payload.lessonId is required');
    process.exit(1);
  }
  let found = false;
  for (const path of allLessonFiles()) {
    const doc = loadLessonFile(path);
    const index = doc.lessons.findIndex((l) => l.id === lessonId);
    if (index === -1) continue;
    doc.lessons.splice(index, 1);
    saveLessonFile(path, doc);
    console.log(`✔ Removed lesson ${lessonId} from ${path}`);
    found = true;
    break;
  }
  if (!found) {
    // The R2 object is already gone; a missing lesson entry is worth noting
    // but not worth failing the manifest update over.
    console.warn(`⚠ Lesson ${lessonId} not found in any content file`);
  }
  updateManifest(-Math.abs(Number(freedBytes) || 0));
  console.log('✔ Storage manifest updated');
} else if (action === 'add-youtube-lesson') {
  for (const field of ['title', 'topic', 'grade', 'subjectId', 'term', 'durationMinutes', 'youtubeId']) {
    if (payload[field] === undefined || payload[field] === '') {
      console.error(`✖ payload is missing "${field}"`);
      process.exit(1);
    }
  }
  const path = lessonFilePath(payload.grade, payload.subjectId, payload.term);
  const doc = loadLessonFile(path);
  const lessonId = makeLessonId(payload);
  doc.lessons.push({
    id: lessonId,
    title: payload.title,
    topic: payload.topic,
    order: nextOrder(doc),
    hostProvider: 'youtube',
    youtubeId: payload.youtubeId,
    durationMinutes: payload.durationMinutes,
    tags: sanitizeTags(payload.tags),
    notes: payload.notes ?? '',
  });
  saveLessonFile(path, doc);
  console.log(`✔ Added YouTube lesson ${lessonId} to ${path}`);
} else {
  console.error(`✖ Unknown action "${action}"`);
  process.exit(1);
}
