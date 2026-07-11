/*
 * build:content — compiles /content into the JSON the app ships with.
 *
 *   content/subjects.json            ┐
 *   content/lessons/*.yml            ├─▶ public/curriculum.json
 *   content/careers/*.md             ──▶ public/careers.json
 *   content/storage-manifest.json    ──▶ public/storage-manifest.json (copied)
 *
 * Validates everything and exits non-zero with a readable error list on any
 * real problem, so a broken CMS edit fails the Cloudflare Pages build instead
 * of shipping a broken app.
 *
 * Run: npm run build:content
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';

// Duplicated (small, dependency-free) from src/content/types.ts so the script
// has no import path into app code; keep the two in sync.
const VALID_GRADES = [10, 11, 12]; // FET phase only
const VALID_TERMS = [1, 2, 3, 4];
const VALID_TAGS = ['exam-prep', 'past-paper', 'revision'];
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const LESSON_FILE_RE = /^grade-(\d+)-([a-z0-9-]+?)-term-(\d)\.yml$/;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'content');
const outDir = join(root, 'public');

const errors: string[] = [];
function fail(file: string, message: string): void {
  errors.push(`  ${file}: ${message}`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/* ---------------------------------------------------------------- subjects */

interface SubjectOut {
  id: string;
  name: string;
  icon: string;
  color: string;
}

function readSubjects(): SubjectOut[] {
  const file = 'subjects.json';
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(contentDir, file), 'utf8'));
  } catch (e) {
    fail(file, `cannot read/parse: ${(e as Error).message}`);
    return [];
  }
  if (!Array.isArray(raw)) {
    fail(file, 'must be a JSON array of subjects');
    return [];
  }
  const seen = new Set<string>();
  const subjects: SubjectOut[] = [];
  raw.forEach((s, i) => {
    if (!isRecord(s)) {
      fail(file, `entry ${i} is not an object`);
      return;
    }
    const { id, name, icon, color } = s;
    if (typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id)) {
      fail(file, `entry ${i}: "id" must be a kebab-case string`);
      return;
    }
    if (seen.has(id)) fail(file, `duplicate subject id "${id}"`);
    seen.add(id);
    if (typeof name !== 'string' || name.length === 0)
      fail(file, `subject "${id}": "name" is required`);
    if (typeof icon !== 'string')
      fail(file, `subject "${id}": "icon" is required (string)`);
    if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color))
      fail(file, `subject "${id}": "color" must be a hex colour like #2456c4`);
    subjects.push({
      id,
      name: String(name),
      icon: String(icon),
      color: String(color),
    });
  });
  return subjects;
}

/* ----------------------------------------------------------------- lessons */

interface LessonOut {
  id: string;
  title: string;
  topic: string;
  order: number;
  hostProvider: 'r2' | 'youtube';
  r2VideoKey?: string;
  r2FileSizeBytes?: number;
  youtubeId?: string;
  attribution?: string;
  durationMinutes: number;
  notes: string;
  worksheet?: string;
  tags: string[];
  videoRemoved?: boolean;
  grade: number;
  subjectId: string;
  term: number;
}

function readLessons(subjectIds: Set<string>): LessonOut[] {
  const lessonsDir = join(contentDir, 'lessons');
  let files: string[];
  try {
    files = readdirSync(lessonsDir).filter((f) => f.endsWith('.yml'));
  } catch {
    fail('content/lessons', 'directory is missing');
    return [];
  }
  if (files.length === 0) fail('content/lessons', 'contains no .yml files');

  const all: LessonOut[] = [];
  const idToFile = new Map<string, string>();

  for (const file of files) {
    const m = LESSON_FILE_RE.exec(file);
    if (!m) {
      fail(
        `lessons/${file}`,
        'file name must match grade-{n}-{subject}-term-{n}.yml',
      );
      continue;
    }
    const grade = Number(m[1]);
    const subjectId = m[2] ?? '';
    const term = Number(m[3]);
    if (!VALID_GRADES.includes(grade))
      fail(`lessons/${file}`, `grade ${grade} is not one of ${VALID_GRADES.join(', ')}`);
    if (!VALID_TERMS.includes(term))
      fail(`lessons/${file}`, `term ${term} is not one of ${VALID_TERMS.join(', ')}`);
    if (!subjectIds.has(subjectId))
      fail(
        `lessons/${file}`,
        `subject "${subjectId}" is not defined in subjects.json`,
      );

    let doc: unknown;
    try {
      doc = parseYaml(readFileSync(join(lessonsDir, file), 'utf8'));
    } catch (e) {
      fail(`lessons/${file}`, `invalid YAML: ${(e as Error).message}`);
      continue;
    }
    if (!isRecord(doc) || !Array.isArray(doc.lessons)) {
      fail(`lessons/${file}`, 'must contain a top-level "lessons:" array');
      continue;
    }

    const ordersSeen = new Set<number>();
    doc.lessons.forEach((l, i) => {
      const where = `lessons/${file} entry ${i + 1}`;
      if (!isRecord(l)) {
        fail(where, 'lesson is not an object');
        return;
      }
      const id = l.id;
      if (typeof id !== 'string' || id.length === 0) {
        fail(where, '"id" is required');
        return;
      }
      const prior = idToFile.get(id);
      if (prior) fail(where, `duplicate lesson id "${id}" (also in ${prior})`);
      idToFile.set(id, file);

      const lesson: Partial<LessonOut> = { id, grade, subjectId, term };

      if (typeof l.title === 'string' && l.title) lesson.title = l.title;
      else fail(`lesson "${id}"`, '"title" is required');

      if (typeof l.topic === 'string' && l.topic) lesson.topic = l.topic;
      else fail(`lesson "${id}"`, '"topic" is required');

      if (typeof l.order === 'number' && Number.isInteger(l.order)) {
        lesson.order = l.order;
        if (ordersSeen.has(l.order))
          fail(`lesson "${id}"`, `duplicate order ${l.order} in ${file}`);
        ordersSeen.add(l.order);
      } else fail(`lesson "${id}"`, '"order" must be an integer');

      if (
        typeof l.durationMinutes === 'number' &&
        l.durationMinutes > 0
      )
        lesson.durationMinutes = l.durationMinutes;
      else fail(`lesson "${id}"`, '"durationMinutes" must be a positive number');

      lesson.notes = typeof l.notes === 'string' ? l.notes : '';

      if (l.worksheet !== undefined) {
        if (typeof l.worksheet === 'string' && l.worksheet)
          lesson.worksheet = l.worksheet;
        else fail(`lesson "${id}"`, '"worksheet" must be a non-empty string');
      }

      const tags = l.tags ?? [];
      if (
        Array.isArray(tags) &&
        tags.every((t) => typeof t === 'string' && VALID_TAGS.includes(t))
      )
        lesson.tags = tags as string[];
      else
        fail(
          `lesson "${id}"`,
          `"tags" may only contain: ${VALID_TAGS.join(', ')}`,
        );

      if (l.attribution !== undefined) {
        if (typeof l.attribution === 'string' && l.attribution)
          lesson.attribution = l.attribution;
        else fail(`lesson "${id}"`, '"attribution" must be a non-empty string');
      }

      if (l.videoRemoved !== undefined) {
        if (typeof l.videoRemoved === 'boolean')
          lesson.videoRemoved = l.videoRemoved;
        else fail(`lesson "${id}"`, '"videoRemoved" must be true/false');
      }

      // hostProvider-specific requirements — the heart of the routing model.
      if (l.hostProvider === 'r2') {
        lesson.hostProvider = 'r2';
        const removed = lesson.videoRemoved === true;
        if (typeof l.r2VideoKey === 'string' && l.r2VideoKey)
          lesson.r2VideoKey = l.r2VideoKey;
        else if (!removed)
          fail(
            `lesson "${id}"`,
            'hostProvider "r2" requires "r2VideoKey" (or videoRemoved: true)',
          );
        if (typeof l.r2FileSizeBytes === 'number' && l.r2FileSizeBytes > 0)
          lesson.r2FileSizeBytes = l.r2FileSizeBytes;
        else if (!removed)
          fail(
            `lesson "${id}"`,
            'hostProvider "r2" requires a positive "r2FileSizeBytes"',
          );
        if (l.youtubeId !== undefined)
          fail(
            `lesson "${id}"`,
            'hostProvider "r2" must not also set "youtubeId" — pick one provider',
          );
      } else if (l.hostProvider === 'youtube') {
        lesson.hostProvider = 'youtube';
        if (typeof l.youtubeId === 'string' && YOUTUBE_ID_RE.test(l.youtubeId))
          lesson.youtubeId = l.youtubeId;
        else
          fail(
            `lesson "${id}"`,
            'hostProvider "youtube" requires an 11-character "youtubeId" ' +
              '(the part after watch?v= — not the full URL)',
          );
        if (l.r2VideoKey !== undefined || l.r2FileSizeBytes !== undefined)
          fail(
            `lesson "${id}"`,
            'hostProvider "youtube" must not set r2VideoKey/r2FileSizeBytes',
          );
      } else {
        fail(
          `lesson "${id}"`,
          `"hostProvider" must be "r2" or "youtube" (got ${JSON.stringify(
            l.hostProvider,
          )})`,
        );
      }

      all.push(lesson as LessonOut);
    });
  }
  return all;
}

/* ----------------------------------------------------------------- careers */

interface CareerOut {
  slug: string;
  title: string;
  summary: string;
  order: number;
  body: string;
}

function readCareers(): CareerOut[] {
  const dir = join(contentDir, 'careers');
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  } catch {
    // Careers section is optional — an empty list is fine.
    return [];
  }
  const out: CareerOut[] = [];
  for (const file of files) {
    const slug = basename(file, '.md');
    const raw = readFileSync(join(dir, file), 'utf8');
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
    if (!m) {
      fail(`careers/${file}`, 'missing --- front matter block');
      continue;
    }
    let meta: unknown;
    try {
      meta = parseYaml(m[1] ?? '');
    } catch (e) {
      fail(`careers/${file}`, `invalid front matter: ${(e as Error).message}`);
      continue;
    }
    if (!isRecord(meta) || typeof meta.title !== 'string' || !meta.title) {
      fail(`careers/${file}`, 'front matter needs a "title"');
      continue;
    }
    out.push({
      slug,
      title: meta.title,
      summary: typeof meta.summary === 'string' ? meta.summary : '',
      order: typeof meta.order === 'number' ? meta.order : 999,
      body: (m[2] ?? '').trim(),
    });
  }
  out.sort((a, b) => a.order - b.order);
  return out;
}

/* ---------------------------------------------------------------- manifest */

function readManifest(): Record<string, unknown> | undefined {
  const file = 'storage-manifest.json';
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(contentDir, file), 'utf8'));
  } catch (e) {
    fail(file, `cannot read/parse: ${(e as Error).message}`);
    return undefined;
  }
  if (
    !isRecord(raw) ||
    typeof raw.totalBytesUsed !== 'number' ||
    typeof raw.softCapBytes !== 'number' ||
    typeof raw.lastUpdated !== 'string'
  ) {
    fail(
      file,
      'must be { totalBytesUsed: number, softCapBytes: number, lastUpdated: string }',
    );
    return undefined;
  }
  return raw;
}

/* -------------------------------------------------------------------- main */

const subjects = readSubjects();
const lessons = readLessons(new Set(subjects.map((s) => s.id)));
const careers = readCareers();
const manifest = readManifest();

if (errors.length > 0) {
  console.error('\n✖ Content validation failed:\n');
  console.error(errors.join('\n'));
  console.error(
    `\n${errors.length} problem${errors.length === 1 ? '' : 's'} found. ` +
      'Fix the file(s) above (usually via the CMS at /admin) and rebuild.\n',
  );
  process.exit(1);
}

lessons.sort(
  (a, b) =>
    a.grade - b.grade ||
    a.subjectId.localeCompare(b.subjectId) ||
    a.term - b.term ||
    a.order - b.order,
);

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, 'curriculum.json'),
  JSON.stringify(
    { subjects, lessons, generatedAt: new Date().toISOString() },
    null,
    2,
  ),
);
writeFileSync(join(outDir, 'careers.json'), JSON.stringify(careers, null, 2));
writeFileSync(
  join(outDir, 'storage-manifest.json'),
  JSON.stringify(manifest, null, 2),
);

console.log(
  `✔ Content OK — ${lessons.length} lessons, ${subjects.length} subjects, ` +
    `${careers.length} career articles → public/curriculum.json`,
);
