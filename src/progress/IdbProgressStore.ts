import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Lesson } from '@/content/types';
import type {
  LastViewed,
  ProgressStats,
  ProgressStore,
  SubjectCompletion,
} from './ProgressStore';

/*
 * IndexedDB implementation (chosen over Capacitor Preferences: structured
 * per-lesson records with real queries, identical behaviour in the Android
 * WebView and the web build, and no string-blob size limits — see README).
 */

interface LessonRecord {
  lessonId: string;
  completedAt?: string;
  positionSeconds: number;
  updatedAt: string;
}

interface ProgressDb extends DBSchema {
  lessons: { key: string; value: LessonRecord };
  /** One row per local calendar day with any study activity ("2026-07-11"). */
  activity: { key: string; value: { date: string } };
  meta: { key: string; value: LastViewed };
}

function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export class IdbProgressStore implements ProgressStore {
  private dbPromise: Promise<IDBPDatabase<ProgressDb>>;

  constructor(dbName = 'sit-progress') {
    this.dbPromise = openDB<ProgressDb>(dbName, 1, {
      upgrade(db) {
        db.createObjectStore('lessons', { keyPath: 'lessonId' });
        db.createObjectStore('activity', { keyPath: 'date' });
        db.createObjectStore('meta');
      },
    });
  }

  private async touchActivity(db: IDBPDatabase<ProgressDb>): Promise<void> {
    await db.put('activity', { date: localDateKey() });
  }

  async markComplete(lessonId: string): Promise<void> {
    const db = await this.dbPromise;
    const now = new Date().toISOString();
    const existing = await db.get('lessons', lessonId);
    await db.put('lessons', {
      lessonId,
      positionSeconds: existing?.positionSeconds ?? 0,
      completedAt: existing?.completedAt ?? now,
      updatedAt: now,
    });
    await this.touchActivity(db);
  }

  async unmarkComplete(lessonId: string): Promise<void> {
    const db = await this.dbPromise;
    const existing = await db.get('lessons', lessonId);
    if (!existing) return;
    delete existing.completedAt;
    existing.updatedAt = new Date().toISOString();
    await db.put('lessons', existing);
  }

  async getCompleted(): Promise<ReadonlySet<string>> {
    const db = await this.dbPromise;
    const all = await db.getAll('lessons');
    return new Set(
      all.filter((r) => r.completedAt !== undefined).map((r) => r.lessonId),
    );
  }

  async setLastViewed(
    lessonId: string,
    positionSeconds: number,
  ): Promise<void> {
    const db = await this.dbPromise;
    const now = new Date().toISOString();
    const existing = await db.get('lessons', lessonId);
    await db.put('lessons', {
      lessonId,
      completedAt: existing?.completedAt,
      positionSeconds,
      updatedAt: now,
    });
    await db.put(
      'meta',
      { lessonId, positionSeconds, viewedAt: now },
      'lastViewed',
    );
    await this.touchActivity(db);
  }

  async getLastViewed(): Promise<LastViewed | null> {
    const db = await this.dbPromise;
    return (await db.get('meta', 'lastViewed')) ?? null;
  }

  async getPositionSeconds(lessonId: string): Promise<number> {
    const db = await this.dbPromise;
    return (await db.get('lessons', lessonId))?.positionSeconds ?? 0;
  }

  async getStats(lessons: readonly Lesson[]): Promise<ProgressStats> {
    const db = await this.dbPromise;
    const completed = await this.getCompleted();

    const groups = new Map<string, SubjectCompletion>();
    for (const lesson of lessons) {
      const key = `${lesson.grade}:${lesson.subjectId}`;
      const g = groups.get(key) ?? {
        subjectId: lesson.subjectId,
        grade: lesson.grade,
        completed: 0,
        total: 0,
      };
      g.total += 1;
      if (completed.has(lesson.id)) g.completed += 1;
      groups.set(key, g);
    }

    const days = (await db.getAllKeys('activity')).sort();
    const daySet = new Set(days);
    const today = localDateKey();
    const studiedToday = daySet.has(today);

    // Current streak: walk backwards from today (or yesterday if today has no
    // activity yet — an untouched morning shouldn't read as a broken streak).
    let currentStreakDays = 0;
    const cursor = new Date();
    if (!studiedToday) cursor.setDate(cursor.getDate() - 1);
    while (daySet.has(localDateKey(cursor))) {
      currentStreakDays += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    let longestStreakDays = 0;
    let run = 0;
    let prev: Date | null = null;
    for (const key of days) {
      const [y, m, d] = key.split('-').map(Number);
      if (y === undefined || m === undefined || d === undefined) continue;
      const date = new Date(y, m - 1, d);
      run =
        prev !== null && date.getTime() - prev.getTime() === 86_400_000
          ? run + 1
          : 1;
      longestStreakDays = Math.max(longestStreakDays, run);
      prev = date;
    }

    return {
      totalCompleted: completed.size,
      bySubject: [...groups.values()].sort(
        (a, b) => a.grade - b.grade || a.subjectId.localeCompare(b.subjectId),
      ),
      currentStreakDays,
      longestStreakDays,
      studiedToday,
    };
  }
}

/** App-wide singleton — swap the implementation here if storage ever changes. */
export const progressStore: ProgressStore = new IdbProgressStore();
