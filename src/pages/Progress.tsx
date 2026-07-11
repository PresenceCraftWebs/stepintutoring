import { getCurriculum, subjectById } from '@/content/curriculum';
import { progressStore } from '@/progress/IdbProgressStore';
import { useAsync } from '@/lib/useAsync';
import { IconCheckCircle, IconFlame } from '@/lib/icons';
import { EmptyState, ProgressRing, Screen, SubjectIcon } from '@/components/ui';

export function ProgressPage() {
  const { value } = useAsync(async () => {
    const curriculum = await getCurriculum();
    const stats = await progressStore.getStats(curriculum.lessons);
    return { curriculum, stats };
  }, []);

  if (!value) {
    return <div className="p-8 text-center text-ink-faint">Loading…</div>;
  }
  const { curriculum, stats } = value;
  const started = stats.bySubject.filter((s) => s.completed > 0);

  return (
    <Screen title="My Progress" narrow>
      <div className="flex flex-col gap-4">
        {/* Headline numbers */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-brand-700 p-4 text-white">
            <IconCheckCircle size={22} className="text-brand-200" />
            <p className="mt-2 text-3xl font-bold">{stats.totalCompleted}</p>
            <p className="text-sm text-brand-100">lessons completed</p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <IconFlame
              size={22}
              className={
                stats.currentStreakDays > 0 ? 'text-warn' : 'text-ink-faint'
              }
            />
            <p className="mt-2 text-3xl font-bold">
              {stats.currentStreakDays}
              <span className="text-base font-bold text-ink-faint">
                {' '}
                day{stats.currentStreakDays === 1 ? '' : 's'}
              </span>
            </p>
            <p className="text-sm text-ink-faint">
              study streak
              {stats.longestStreakDays > stats.currentStreakDays
                ? ` · best ${stats.longestStreakDays}`
                : ''}
            </p>
          </div>
        </div>

        {!stats.studiedToday && (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-warn">
            {stats.currentStreakDays > 0
              ? `Keep your ${stats.currentStreakDays}-day streak alive — watch one lesson today.`
              : 'Watch one lesson today to start a streak. Small daily steps beat weekend marathons.'}
          </p>
        )}

        {/* Per-subject completion */}
        <section>
          <h2 className="mb-2 font-bold">By subject</h2>
          {started.length === 0 ? (
            <EmptyState
              title="No lessons completed yet"
              hint="Finish your first lesson and your progress will show here."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {started.map((s) => {
                const subject = subjectById(curriculum, s.subjectId);
                if (!subject) return null;
                return (
                  <div
                    key={`${s.grade}-${s.subjectId}`}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4"
                  >
                    <SubjectIcon
                      icon={subject.icon}
                      name={subject.name}
                      color={subject.color}
                      size={26}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">
                        {subject.name}{' '}
                        <span className="text-sm font-bold text-ink-faint">
                          Grade {s.grade}
                        </span>
                      </span>
                      <span className="block text-sm text-ink-faint">
                        {s.completed} of {s.total} lessons
                      </span>
                    </span>
                    <ProgressRing
                      fraction={s.total ? s.completed / s.total : 0}
                      color={subject.color}
                      size={40}
                    >
                      <span className="text-[10px] font-bold text-ink-soft">
                        {Math.round((s.completed / Math.max(s.total, 1)) * 100)}
                        %
                      </span>
                    </ProgressRing>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="px-1 text-xs text-ink-faint">
          Your progress is stored only on this phone — no account needed.
          Clearing the app&apos;s data will reset it.
        </p>
      </div>
    </Screen>
  );
}
