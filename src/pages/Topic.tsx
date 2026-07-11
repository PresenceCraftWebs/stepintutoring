import { useParams } from 'react-router';
import { getCurriculum, subjectById, topicsFor } from '@/content/curriculum';
import { progressStore } from '@/progress/IdbProgressStore';
import { useAsync } from '@/lib/useAsync';
import { useDownloads } from '@/downloads/useDownloads';
import { downloadManager } from '@/downloads/DownloadManager';
import { formatBytes, formatDuration, slugify } from '@/lib/format';
import {
  IconAlert,
  IconCheckCircle,
  IconDownload,
  IconGlobe,
  IconPlay,
} from '@/lib/icons';
import { CardLink, EmptyState, Screen } from '@/components/ui';

export function TopicPage() {
  const params = useParams<{
    grade: string;
    subjectId: string;
    term: string;
    topicSlug: string;
  }>();
  const grade = Number(params.grade);
  const term = Number(params.term);
  const subjectId = params.subjectId ?? '';
  useDownloads(); // re-render as download states change

  const { value } = useAsync(async () => {
    const [curriculum, completed] = await Promise.all([
      getCurriculum(),
      progressStore.getCompleted(),
    ]);
    return { curriculum, completed };
  }, []);

  if (!value) {
    return <div className="p-8 text-center text-ink-faint">Loading…</div>;
  }
  const { curriculum, completed } = value;
  const subject = subjectById(curriculum, subjectId);
  const group = topicsFor(curriculum, grade, subjectId, term).find(
    (t) => slugify(t.topic) === params.topicSlug,
  );

  if (!subject || !group) {
    return (
      <Screen title="Topic" back>
        <EmptyState title="Topic not found" />
      </Screen>
    );
  }

  return (
    <Screen title={group.topic} back narrow>
      <p className="mb-4 text-sm text-ink-faint">
        {subject.name} · Grade {grade} · Term {term}
      </p>
      <ol className="flex flex-col gap-3">
        {group.lessons.map((lesson, i) => {
          const isDone = completed.has(lesson.id);
          const isDownloaded = downloadManager.isDownloaded(lesson.id);
          return (
            <li key={lesson.id}>
              <CardLink to={`/lesson/${lesson.id}`}>
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full font-bold ${
                    isDone
                      ? 'bg-brand-700 text-white'
                      : 'bg-brand-50 text-brand-800'
                  }`}
                >
                  {isDone ? <IconCheckCircle size={20} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">
                    {lesson.title}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ink-faint">
                    <span>{formatDuration(lesson.durationMinutes)}</span>
                    {lesson.videoRemoved ? (
                      <span className="flex items-center gap-1 font-bold text-warn">
                        <IconAlert size={14} /> unavailable
                      </span>
                    ) : lesson.hostProvider === 'r2' ? (
                      <span className="flex items-center gap-1">
                        {isDownloaded ? (
                          <span className="flex items-center gap-1 font-bold text-good">
                            <IconCheckCircle size={14} /> offline
                          </span>
                        ) : (
                          <>
                            <IconDownload size={14} />
                            {formatBytes(lesson.r2FileSizeBytes ?? 0)}
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <IconGlobe size={14} /> online only
                      </span>
                    )}
                  </span>
                </span>
                <IconPlay size={18} className="shrink-0 text-brand-700" />
              </CardLink>
            </li>
          );
        })}
      </ol>
    </Screen>
  );
}
