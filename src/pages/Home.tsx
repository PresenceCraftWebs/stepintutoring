import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  getCareers,
  getCurriculum,
  gradesWithContent,
  lessonById,
  lessonsFor,
  subjectsForGrade,
} from '@/content/curriculum';
import type { Curriculum } from '@/content/types';
import { progressStore } from '@/progress/IdbProgressStore';
import type { LastViewed } from '@/progress/ProgressStore';
import { getSelectedGrade, setSelectedGrade } from '@/lib/settings';
import { useAsync } from '@/lib/useAsync';
import { useDownloads } from '@/downloads/useDownloads';
import { formatBytes } from '@/lib/format';
import {
  IconBriefcase,
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
  const [gradeLoaded, setGradeLoaded] = useState(false);
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
    void getSelectedGrade().then((g) => {
      setGrade(g);
      setGradeLoaded(true);
    });
  }, []);

  const pickGrade = (g: number): void => {
    setGrade(g);
    void setSelectedGrade(g);
  };

  if (!value || !gradeLoaded) {
    return <div className="p-8 text-center text-ink-faint">Loading…</div>;
  }

  const { curriculum, completed, lastViewed } = value;
  const grades = gradesWithContent(curriculum);
  const activeGrade = grade !== null && grades.includes(grade) ? grade : null;
  const continueLesson = lastViewed
    ? lessonById(curriculum, lastViewed.lessonId)
    : undefined;
  const downloadedCount = downloads.items.filter(
    (i) => i.status === 'done',
  ).length;

  /* First run: pick a grade. */
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
        <div className="mt-6 grid grid-cols-2 gap-3">
          {grades.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => pickGrade(g)}
              className="rounded-2xl border border-line bg-surface py-6 text-xl font-bold active:border-brand-700 active:bg-brand-50"
            >
              Grade {g}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const subjects = subjectsForGrade(curriculum, activeGrade);

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
                className={`rounded-full px-3 py-1.5 text-sm font-bold ${
                  g === activeGrade
                    ? 'bg-brand-700 text-white'
                    : 'text-ink-faint'
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

        {/* Subjects */}
        <section>
          <h2 className="mb-3 text-lg font-bold">Your subjects</h2>
          {subjects.length === 0 ? (
            <EmptyState
              title={`No Grade ${activeGrade} lessons yet`}
              hint="Your tutors are adding content — check back soon."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {subjects.map((s) => {
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
                      {lessons.length} lesson{lessons.length === 1 ? '' : 's'}
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

        {/* Career corner */}
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
