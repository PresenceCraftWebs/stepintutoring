import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  getCareers,
  getCurriculum,
  lessonById,
  lessonsFor,
} from '@/content/curriculum';
import type { Curriculum, Subject } from '@/content/types';
import { VALID_GRADES } from '@/content/types';
import { progressStore } from '@/progress/IdbProgressStore';
import type { LastViewed } from '@/progress/ProgressStore';
import {
  getSelectedGrade,
  getSelectedSubjects,
  setSelectedGrade,
  setSelectedSubjects,
} from '@/lib/settings';
import { useAsync } from '@/lib/useAsync';
import { useDownloads } from '@/downloads/useDownloads';
import { formatBytes } from '@/lib/format';
import {
  IconBriefcase,
  IconCheck,
  IconChevronRight,
  IconDownload,
  IconPlay,
} from '@/lib/icons';
import { EmptyState, ProgressRing, SubjectIcon } from '@/components/ui';

interface HomeData {
  curriculum: Curriculum;
  completed: ReadonlySet<string>;
  lastViewed: LastViewed | null;
  careersCount: number;
}

export function HomePage() {
  const [grade, setGrade] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<string[] | null>(null);
  const [editingSubjects, setEditingSubjects] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const downloads = useDownloads();

  const { value } = useAsync<HomeData>(async () => {
    const [curriculum, completed, lastViewed, careers] = await Promise.all([
      getCurriculum(),
      progressStore.getCompleted(),
      progressStore.getLastViewed(),
      getCareers().catch(() => []),
    ]);
    return { curriculum, completed, lastViewed, careersCount: careers.length };
  }, []);

  useEffect(() => {
    void Promise.all([getSelectedGrade(), getSelectedSubjects()]).then(
      ([g, s]) => {
        setGrade(g);
        setSubjects(s);
        setSettingsLoaded(true);
      },
    );
  }, []);

  const pickGrade = (g: number): void => {
    setGrade(g);
    void setSelectedGrade(g);
  };

  if (!value || !settingsLoaded) {
    return <div className="p-8 text-center text-ink-faint">Loading…</div>;
  }

  const { curriculum, completed, lastViewed } = value;
  const grades: readonly number[] = VALID_GRADES;
  const activeGrade = grade !== null && grades.includes(grade) ? grade : null;

  /* Step 1: pick a grade (remembered). */
  if (activeGrade === null) {
    return (
      <div className="mx-auto flex min-h-[70dvh] w-full max-w-lg flex-col justify-center px-6">
        <p className="text-sm font-bold tracking-wide text-brand-700 uppercase">
          Step-In Tutoring
        </p>
        <h1 className="mt-1 text-3xl font-bold">Which grade are you in?</h1>
        <p className="mt-2 text-ink-soft">
          We&apos;ll remember this — you can change it any time on the Home
          screen.
        </p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          {grades.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => pickGrade(g)}
              className="rounded-2xl border border-line bg-surface py-6 text-xl font-bold transition-colors hover:border-brand-500 hover:bg-brand-50 active:border-brand-700 active:bg-brand-50"
            >
              Grade {g}
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* Step 2: pick subjects (remembered, editable later). */
  if (subjects === null || subjects.length === 0 || editingSubjects) {
    return (
      <SubjectPicker
        allSubjects={curriculum.subjects}
        initial={subjects ?? []}
        onDone={(ids) => {
          setSubjects(ids);
          setEditingSubjects(false);
          void setSelectedSubjects(ids);
        }}
      />
    );
  }

  const mySubjects = curriculum.subjects.filter((s) =>
    subjects.includes(s.id),
  );
  const continueLesson = lastViewed
    ? lessonById(curriculum, lastViewed.lessonId)
    : undefined;
  const downloadedCount = downloads.items.filter(
    (i) => i.status === 'done',
  ).length;

  return (
    <div>
      <header className="pt-safe px-4 pt-4 lg:px-0 lg:pt-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold tracking-wide text-brand-700 uppercase">
              Step-In Tutoring
            </p>
            <h1 className="text-2xl font-bold">Hello! Ready to learn?</h1>
          </div>
          <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
            {grades.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => pickGrade(g)}
                className={`rounded-full px-3 py-1.5 text-sm font-bold transition-colors ${
                  g === activeGrade
                    ? 'bg-brand-700 text-white'
                    : 'text-ink-faint hover:text-brand-700'
                }`}
              >
                Gr {g}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-5 px-4 py-5 lg:px-0">
        {/* Continue where you left off */}
        {continueLesson && !continueLesson.videoRemoved && (
          <Link
            to={`/lesson/${continueLesson.id}`}
            className="flex items-center gap-4 rounded-2xl bg-brand-700 p-4 text-white transition-colors hover:bg-brand-800 active:bg-brand-800"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15">
              <IconPlay size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold tracking-wide text-brand-100 uppercase">
                Continue where you left off
              </span>
              <span className="block truncate font-bold">
                {continueLesson.title}
              </span>
              <span className="block truncate text-sm text-brand-100">
                {continueLesson.topic} · Grade {continueLesson.grade}
              </span>
            </span>
            <IconChevronRight size={20} className="shrink-0 text-brand-200" />
          </Link>
        )}

        {/* The student's chosen subjects */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">
              Your subjects{' '}
              <span className="font-bold text-brand-700">
                · Grade {activeGrade}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setEditingSubjects(true)}
              className="text-sm font-bold text-brand-700 hover:underline"
            >
              Edit
            </button>
          </div>
          {mySubjects.length === 0 ? (
            <EmptyState
              title="No subjects chosen"
              hint="Tap Edit to pick the subjects you take."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {mySubjects.map((s) => {
                const lessons = lessonsFor(curriculum, activeGrade, s.id);
                const done = lessons.filter((l) => completed.has(l.id)).length;
                return (
                  <Link
                    key={s.id}
                    to={`/g/${activeGrade}/s/${s.id}`}
                    className="rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand-200 hover:bg-brand-50 active:bg-brand-50"
                    style={{ borderBottom: `3px solid ${s.color}` }}
                  >
                    <div className="flex items-start justify-between">
                      <SubjectIcon
                        icon={s.icon}
                        name={s.name}
                        color={s.color}
                        size={30}
                      />
                      <ProgressRing
                        fraction={lessons.length ? done / lessons.length : 0}
                        color={s.color}
                        size={38}
                      >
                        <span className="text-[10px] font-bold text-ink-soft">
                          {done}/{lessons.length}
                        </span>
                      </ProgressRing>
                    </div>
                    <p className="mt-3 leading-tight font-bold">{s.name}</p>
                    <p className="mt-0.5 text-sm text-ink-faint">
                      {lessons.length === 0
                        ? `No Grade ${activeGrade} lessons yet`
                        : `${lessons.length} Grade ${activeGrade} lesson${lessons.length === 1 ? '' : 's'}`}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick-access cards (side by side on desktop) */}
        <div className="grid gap-3 lg:grid-cols-2">
          <Link
            to="/downloads"
            className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand-200 hover:bg-brand-50 active:bg-brand-50"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <IconDownload size={22} />
            </span>
            <span className="flex-1">
              <span className="block font-bold">Downloads</span>
              <span className="block text-sm text-ink-faint">
                {downloadedCount === 0
                  ? 'Save lessons for offline — watch without data'
                  : `${downloadedCount} lesson${downloadedCount === 1 ? '' : 's'} · ${formatBytes(downloads.totalBytesUsed)} on this device`}
              </span>
            </span>
            <IconChevronRight size={20} className="text-ink-faint" />
          </Link>

          <Link
            to="/careers"
            className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand-200 hover:bg-brand-50 active:bg-brand-50"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-50 text-warn">
              <IconBriefcase size={22} />
            </span>
            <span className="flex-1">
              <span className="block font-bold">Career Corner</span>
              <span className="block text-sm text-ink-faint">
                Bursaries, study paths and exam tips from your tutors
              </span>
            </span>
            <IconChevronRight size={20} className="text-ink-faint" />
          </Link>
        </div>

        <Link
          to="/admin-tools/upload"
          className="self-center py-2 text-xs font-bold text-ink-faint hover:text-brand-700 lg:hidden"
        >
          Tutor / admin tools
        </Link>
      </div>
    </div>
  );
}

/**
 * Multi-select subject picker — same remember-once pattern as the grade
 * picker. Shown on first run and via "Edit" on the Home screen.
 */
function SubjectPicker({
  allSubjects,
  initial,
  onDone,
}: {
  allSubjects: Subject[];
  initial: string[];
  onDone: (ids: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(initial);

  const toggle = (id: string): void =>
    setPicked((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );

  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-lg flex-col justify-center px-6 py-10">
      <p className="text-sm font-bold tracking-wide text-brand-700 uppercase">
        Step-In Tutoring
      </p>
      <h1 className="mt-1 text-3xl font-bold">Which subjects do you take?</h1>
      <p className="mt-2 text-ink-soft">
        Pick your subject package — your Home screen shows only these. You can
        change them any time with the Edit button.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {allSubjects.map((s) => {
          const active = picked.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              aria-pressed={active}
              className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                active
                  ? 'border-brand-700 bg-brand-50'
                  : 'border-line bg-surface hover:border-brand-300'
              }`}
            >
              <SubjectIcon
                icon={s.icon}
                name={s.name}
                color={s.color}
                size={26}
              />
              <span className="min-w-0 flex-1 text-sm leading-tight font-bold">
                {s.name}
              </span>
              {active && (
                <IconCheck size={18} className="shrink-0 text-brand-700" />
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={picked.length === 0}
        onClick={() => onDone(picked)}
        className="mt-6 w-full rounded-full bg-brand-700 py-3.5 font-bold text-white transition-colors hover:bg-brand-800 disabled:opacity-40"
      >
        {picked.length === 0
          ? 'Pick at least one subject'
          : `Continue with ${picked.length} subject${picked.length === 1 ? '' : 's'}`}
      </button>
    </div>
  );
}
