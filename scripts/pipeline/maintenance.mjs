/*
 * Runs inside the content-maintenance workflow. Two actions:
 *
 *   video-deleted       payload: { lessonId, r2VideoKey, freedBytes }
 *     Removes the lesson entry along with its deleted video — students never
 *     see a broken lesson — and decrements the storage manifest.
 *
 *   add-youtube-lesson  payload: lesson metadata incl. youtubeId
 *     Appends a stream-only YouTube lesson (curated public video or the
 *     org's own unlisted upload).
 *
 *   update-lesson       payload: { lessonId, fields }
 *     Edits a published lesson. Changing grade/subject/term moves the entry
 *     to the correct content file (appended at the end of that term).
 *
 *   delete-lesson       payload: { lessonId }
 *     Removes a YouTube-tier lesson entry. R2-tier lessons must go through
 *     the video-deleted flow so the stored file and manifest stay honest.
 *
 * Reads ACTION and PAYLOAD_JSON from the environment.
 */
import {
  allLessonFiles,
  findLesson,
  lessonFilePath,
  loadLessonFile,
  parseLessonFilePath,
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
    ...(payload.attribution ? { attribution: payload.attribution } : {}),
    durationMinutes: payload.durationMinutes,
    tags: sanitizeTags(payload.tags),
    notes: payload.notes ?? '',
  });
  saveLessonFile(path, doc);
  console.log(`✔ Added YouTube lesson ${lessonId} to ${path}`);
} else if (action === 'update-lesson') {
  const { lessonId, fields } = payload;
  if (!lessonId || !fields) {
    console.error('✖ payload needs lessonId and fields');
    process.exit(1);
  }
  const found = findLesson(lessonId);
  if (!found) {
    console.error(`✖ Lesson ${lessonId} not found`);
    process.exit(1);
  }
  const { path, doc, index } = found;
  const lesson = doc.lessons[index];

  // Scalar fields.
  if (fields.title) lesson.title = fields.title;
  if (fields.topic) lesson.topic = fields.topic;
  if (fields.durationMinutes) lesson.durationMinutes = fields.durationMinutes;
  if (fields.notes !== undefined) lesson.notes = fields.notes;
  if (fields.tags !== undefined) lesson.tags = sanitizeTags(fields.tags);
  if (lesson.hostProvider === 'youtube') {
    if (fields.youtubeId) lesson.youtubeId = fields.youtubeId;
    if (fields.attribution) lesson.attribution = fields.attribution;
    else delete lesson.attribution;
  }

  // Placement: did grade / subject / term change?
  const here = parseLessonFilePath(path);
  const target = {
    grade: fields.grade ?? here.grade,
    subjectId: fields.subjectId ?? here.subjectId,
    term: fields.term ?? here.term,
  };
  const moved =
    target.grade !== here.grade ||
    target.subjectId !== here.subjectId ||
    target.term !== here.term;

  if (moved) {
    doc.lessons.splice(index, 1);
    saveLessonFile(path, doc);
    const destPath = lessonFilePath(target.grade, target.subjectId, target.term);
    const destDoc = loadLessonFile(destPath);
    lesson.order = nextOrder(destDoc);
    destDoc.lessons.push(lesson);
    saveLessonFile(destPath, destDoc);
    console.log(`✔ Updated ${lessonId} and moved it to ${destPath}`);
  } else {
    saveLessonFile(path, doc);
    console.log(`✔ Updated ${lessonId} in ${path}`);
  }
} else if (action === 'delete-lesson') {
  const { lessonId } = payload;
  if (!lessonId) {
    console.error('✖ payload.lessonId is required');
    process.exit(1);
  }
  const found = findLesson(lessonId);
  if (!found) {
    console.error(`✖ Lesson ${lessonId} not found`);
    process.exit(1);
  }
  const lesson = found.doc.lessons[found.index];
  if (lesson.hostProvider === 'r2' && lesson.r2VideoKey) {
    console.error(
      `✖ ${lessonId} is R2-hosted — delete it via Manage videos (the ` +
        'video-deleted flow) so the stored file and manifest are freed too.',
    );
    process.exit(1);
  }
  found.doc.lessons.splice(found.index, 1);
  saveLessonFile(found.path, found.doc);
  console.log(`✔ Removed lesson ${lessonId} from ${found.path}`);
} else {
  console.error(`✖ Unknown action "${action}"`);
  process.exit(1);
}
