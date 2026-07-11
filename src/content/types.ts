/*
 * Content model shared by the app, the build:content script, and (shape-wise)
 * the Sveltia CMS config and GitHub Actions pipeline. If you change anything
 * here, update scripts/build-content.ts validation and admin/config.yml too.
 */

export type HostProvider = 'r2' | 'youtube';

/** FET phase only — Grades 10–12 (languages and Life Orientation excluded). */
export const VALID_GRADES = [10, 11, 12] as const;
export const VALID_TERMS = [1, 2, 3, 4] as const;
export const VALID_TAGS = ['exam-prep', 'past-paper', 'revision'] as const;

export type Grade = (typeof VALID_GRADES)[number];
export type Term = (typeof VALID_TERMS)[number];
export type LessonTag = (typeof VALID_TAGS)[number];

export interface Subject {
  id: string;
  name: string;
  /** Key into the SubjectIcon glyph map; unknown keys fall back to a letter. */
  icon: string;
  /** Accent colour (hex) used for cards, rings and chips. */
  color: string;
}

export interface Lesson {
  id: string;
  title: string;
  topic: string;
  /** Position within its (grade, subject, term) file; drives play order. */
  order: number;
  hostProvider: HostProvider;
  /**
   * R2 object key under videos/ (e.g. "videos/g10-math-t1-01.mp4").
   * Seed-data escape hatch: a full http(s) URL is used verbatim so placeholder
   * lessons can point at openly-licensed sample MP4s before R2 is wired in.
   */
  r2VideoKey?: string;
  r2FileSizeBytes?: number;
  /** YouTube video id (11 chars) when hostProvider is 'youtube'. */
  youtubeId?: string;
  durationMinutes: number;
  /** Markdown study notes shown under the player. */
  notes: string;
  /** Optional worksheet path (PDF under /public/worksheets) or full URL. */
  worksheet?: string;
  tags: LessonTag[];
  /**
   * Set by the content-maintenance workflow when an admin deletes this
   * lesson's R2 video: the lesson needs attention (re-upload or a YouTube id)
   * and the player shows a friendly error instead of a broken stream.
   */
  videoRemoved?: boolean;

  /* Injected by build:content from the file name — not present in the YAML. */
  grade: Grade;
  subjectId: string;
  term: Term;
}

export interface Curriculum {
  subjects: Subject[];
  lessons: Lesson[];
  generatedAt: string;
}

/** content/storage-manifest.json — maintained by the GitHub Actions pipeline. */
export interface StorageManifest {
  totalBytesUsed: number;
  softCapBytes: number;
  lastUpdated: string;
}

export interface CareerArticle {
  slug: string;
  title: string;
  summary: string;
  order: number;
  /** Markdown body. */
  body: string;
}
