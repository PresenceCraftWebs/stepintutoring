import { Link, useParams } from 'react-router';
import Markdown from 'react-markdown';
import {
  getCurriculum,
  lessonById,
  lessonSiblings,
  subjectById,
} from '@/content/curriculum';
import { useAsync } from '@/lib/useAsync';
import { formatDuration } from '@/lib/format';
import {
  IconArrowLeft,
  IconChevronRight,
  IconFileText,
} from '@/lib/icons';
import { EmptyState, Screen } from '@/components/ui';
import { LessonVideo } from '@/player/LessonVideo';
import { DownloadControl } from '@/player/DownloadControl';

const TAG_LABELS: Record<string, string> = {
  'exam-prep': 'Exam prep',
  'past-paper': 'Past paper',
  revision: 'Revision',
};

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { value: curriculum } = useAsync(() => getCurriculum(), []);

  if (!curriculum) {
    return <div className="p-8 text-center text-ink-faint">Loading…</div>;
  }
  const lesson = lessonId ? lessonById(curriculum, lessonId) : undefined;
  if (!lesson) {
    return (
      <Screen title="Lesson" back>
        <EmptyState
          title="Lesson not found"
          hint="It may have been moved — go back and try again."
        />
      </Screen>
    );
  }

  const subject = subjectById(curriculum, lesson.subjectId);
  const { prev, next } = lessonSiblings(curriculum, lesson);

  return (
    <Screen title={lesson.title} back narrow>
      <div className="-mx-4 md:mx-0">
        <LessonVideo lesson={lesson} nextLesson={next} />
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <div>
          <p className="text-sm font-bold" style={{ color: subject?.color }}>
            {subject?.name} · Grade {lesson.grade} · Term {lesson.term}
          </p>
          <h2 className="mt-1 text-xl leading-snug font-bold">
            {lesson.title}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-faint">
            <span>{lesson.topic}</span>
            <span>·</span>
            <span>{formatDuration(lesson.durationMinutes)}</span>
            {lesson.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-800"
              >
                {TAG_LABELS[t] ?? t}
              </span>
            ))}
          </p>
        </div>

        <DownloadControl lesson={lesson} />

        {lesson.worksheet && (
          <a
            href={lesson.worksheet}
            download
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 active:bg-brand-50"
          >
            <IconFileText size={22} className="text-brand-700" />
            <span className="flex-1 font-bold">Worksheet (PDF)</span>
            <span className="text-sm text-ink-faint">Open</span>
          </a>
        )}

        {lesson.notes && (
          <section className="rounded-2xl border border-line bg-surface p-4">
            <div className="prose-notes">
              <Markdown>{lesson.notes}</Markdown>
            </div>
          </section>
        )}

        {/* Prev / next navigation */}
        <nav className="mt-2 flex gap-3">
          {prev ? (
            <Link
              to={`/lesson/${prev.id}`}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line bg-surface p-3 active:bg-brand-50"
            >
              <IconArrowLeft size={18} className="shrink-0 text-ink-faint" />
              <span className="min-w-0">
                <span className="block text-xs text-ink-faint">Previous</span>
                <span className="block truncate text-sm font-bold">
                  {prev.title}
                </span>
              </span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {next ? (
            <Link
              to={`/lesson/${next.id}`}
              className="flex min-w-0 flex-1 items-center justify-end gap-2 rounded-2xl border border-line bg-surface p-3 text-right active:bg-brand-50"
            >
              <span className="min-w-0">
                <span className="block text-xs text-ink-faint">Next</span>
                <span className="block truncate text-sm font-bold">
                  {next.title}
                </span>
              </span>
              <IconChevronRight size={18} className="shrink-0 text-ink-faint" />
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </nav>
      </div>
    </Screen>
  );
}
