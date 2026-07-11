import type { Lesson } from '@/content/types';

/*
 * All student progress lives on-device — there are no accounts and no server.
 * This interface is the only thing pages/players talk to; the IndexedDB
 * implementation (IdbProgressStore) can be swapped (e.g. for a
 * Capacitor-Preferences or SQLite version) without touching UI code.
 */

export interface LastViewed {
  lessonId: string;
  positionSeconds: number;
  viewedAt: string; // ISO
}

export interface SubjectCompletion {
  subjectId: string;
  grade: number;
  completed: number;
  total: number;
}

export interface ProgressStats {
  totalCompleted: number;
  /** Completion per (grade, subject) pair that has any lessons. */
  bySubject: SubjectCompletion[];
  /** Consecutive study days ending today (or yesterday, if today is untouched). */
  currentStreakDays: number;
  longestStreakDays: number;
  studiedToday: boolean;
}

export interface ProgressStore {
  markComplete(lessonId: string): Promise<void>;
  /** Un-mark, for accidental taps. */
  unmarkComplete(lessonId: string): Promise<void>;
  getCompleted(): Promise<ReadonlySet<string>>;

  /** Remember where the student is, for "Continue where you left off". */
  setLastViewed(lessonId: string, positionSeconds: number): Promise<void>;
  getLastViewed(): Promise<LastViewed | null>;
  /** Saved playback position for one lesson (0 if never watched). */
  getPositionSeconds(lessonId: string): Promise<number>;

  /** Stats need the lesson list to compute totals per subject. */
  getStats(lessons: readonly Lesson[]): Promise<ProgressStats>;
}
