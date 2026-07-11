import { useState } from 'react';
import { useParams } from 'react-router';
import {
  getCurriculum,
  subjectById,
  topicsFor,
} from '@/content/curriculum';
import { VALID_TERMS, type LessonTag } from '@/content/types';
import { progressStore } from '@/progress/IdbProgressStore';
import { useAsync } from '@/lib/useAsync';
import { formatDuration, slugify, termLabel } from '@/lib/format';
import { IconChevronRight } from '@/lib/icons';
import {
  CardLink,
  Chip,
  EmptyState,
  ProgressRing,
  Screen,
  SubjectIcon,
} from '@/components/ui';

const TAG_FILTERS: { tag: LessonTag; label: string }[] = [
  { tag: 'exam-prep', label: 'Exam prep' },
  { tag: 'past-paper', label: 'Past papers' },
  { tag: 'revision', label: 'Revision' },
];

export function SubjectPage() {
  const params = useParams<{ grade: string; subjectId: string }>();
  const grade = Number(params.grade);
  const subjectId = params.subjectId ?? '';
  const [term, setTerm] = useState<number>(1);
  const [tagFilter, setTagFilter] = useState<LessonTag | null>(null);

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
  if (!subject || !Number.isFinite(grade)) {
    return (
      <Screen title="Subject" back>
        <EmptyState title="Subject not found" />
      </Screen>
    );
  }

  const topics = topicsFor(curriculum, grade, subjectId, term)
    .map(({ topic, lessons }) => ({
      topic,
      lessons: tagFilter
        ? lessons.filter((l) => l.tags.includes(tagFilter))
        : lessons,
    }))
    .filter((t) => t.lessons.length > 0);

  return (
    <Screen
      title={`${subject.name} · Grade ${grade}`}
      back
      actions={
        <SubjectIcon
          icon={subject.icon}
          name={subject.name}
          color={subject.color}
          size={26}
        />
      }
    >
      {/* Term tabs */}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {VALID_TERMS.map((t) => (
          <Chip key={t} active={t === term} onClick={() => setTerm(t)}>
            {termLabel(t)}
          </Chip>
        ))}
      </div>

      {/* Tag filter chips */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <Chip active={tagFilter === null} onClick={() => setTagFilter(null)}>
          All lessons
        </Chip>
        {TAG_FILTERS.map(({ tag, label }) => (
          <Chip
            key={tag}
            active={tagFilter === tag}
            onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
          >
            {label}
          </Chip>
        ))}
      </div>

      {topics.length === 0 ? (
        <EmptyState
          title={`Nothing in ${termLabel(term)} yet`}
          hint={
            tagFilter
              ? 'Try removing the filter, or check another term.'
              : 'Your tutors are adding content — check back soon.'
          }
        />
      ) : (
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
          {topics.map(({ topic, lessons }) => {
            const done = lessons.filter((l) => completed.has(l.id)).length;
            const minutes = lessons.reduce(
              (sum, l) => sum + l.durationMinutes,
              0,
            );
            return (
              <CardLink
                key={topic}
                to={`/g/${grade}/s/${subjectId}/t/${term}/topic/${slugify(topic)}`}
              >
                <ProgressRing
                  fraction={lessons.length ? done / lessons.length : 0}
                  color={subject.color}
                  size={42}
                >
                  <span className="text-[10px] font-bold text-ink-soft">
                    {done}/{lessons.length}
                  </span>
                </ProgressRing>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{topic}</span>
                  <span className="block text-sm text-ink-faint">
                    {lessons.length} lesson{lessons.length === 1 ? '' : 's'} ·{' '}
                    {formatDuration(minutes)}
                  </span>
                </span>
                <IconChevronRight size={20} className="text-ink-faint" />
              </CardLink>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
