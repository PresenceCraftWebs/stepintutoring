import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { getCurriculum } from '@/content/curriculum';
import type { Lesson } from '@/content/types';
import { useAsync } from '@/lib/useAsync';
import { formatDuration } from '@/lib/format';
import { IconGlobe, IconSearch } from '@/lib/icons';
import { CardLink, Chip, EmptyState, Screen } from '@/components/ui';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<number | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const { value: curriculum } = useAsync(() => getCurriculum(), []);

  const fuse = useMemo(() => {
    if (!curriculum) return null;
    return new Fuse<Lesson>(curriculum.lessons, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'topic', weight: 1.5 },
        { name: 'tags', weight: 0.5 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
    });
  }, [curriculum]);

  if (!curriculum || !fuse) {
    return <div className="p-8 text-center text-ink-faint">Loading…</div>;
  }

  const grades = [...new Set(curriculum.lessons.map((l) => l.grade))].sort(
    (a, b) => a - b,
  );

  const results = (
    query.trim()
      ? fuse.search(query.trim()).map((r) => r.item)
      : curriculum.lessons
  ).filter(
    (l) =>
      (gradeFilter === null || l.grade === gradeFilter) &&
      (subjectFilter === null || l.subjectId === subjectFilter),
  );

  return (
    <Screen title="Search">
      <div className="relative">
        <IconSearch
          size={20}
          className="absolute top-1/2 left-4 -translate-y-1/2 text-ink-faint"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search lessons and topics…"
          className="w-full rounded-full border border-line bg-surface py-3 pr-4 pl-11 font-bold outline-none focus:border-brand-500"
          autoComplete="off"
        />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <Chip
          active={gradeFilter === null}
          onClick={() => setGradeFilter(null)}
        >
          All grades
        </Chip>
        {grades.map((g) => (
          <Chip
            key={g}
            active={gradeFilter === g}
            onClick={() => setGradeFilter(gradeFilter === g ? null : g)}
          >
            Grade {g}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        <Chip
          active={subjectFilter === null}
          onClick={() => setSubjectFilter(null)}
        >
          All subjects
        </Chip>
        {curriculum.subjects.map((s) => (
          <Chip
            key={s.id}
            active={subjectFilter === s.id}
            onClick={() =>
              setSubjectFilter(subjectFilter === s.id ? null : s.id)
            }
          >
            {s.name}
          </Chip>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3">
        {results.length === 0 ? (
          <EmptyState
            title="No lessons found"
            hint="Try a different word — e.g. the topic name from class."
          />
        ) : (
          results.slice(0, 50).map((lesson) => (
            <CardLink key={lesson.id} to={`/lesson/${lesson.id}`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">
                  {lesson.title}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-faint">
                  <span>
                    {lesson.topic} · Gr {lesson.grade} · T{lesson.term}
                  </span>
                  <span>{formatDuration(lesson.durationMinutes)}</span>
                  {lesson.hostProvider === 'youtube' && (
                    <span className="flex items-center gap-1">
                      <IconGlobe size={13} /> online only
                    </span>
                  )}
                </span>
              </span>
            </CardLink>
          ))
        )}
      </div>
    </Screen>
  );
}
