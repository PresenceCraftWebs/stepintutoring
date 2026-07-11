import { getCareers } from '@/content/curriculum';
import { useAsync } from '@/lib/useAsync';
import { IconChevronRight } from '@/lib/icons';
import { CardLink, EmptyState, Screen } from '@/components/ui';

export function CareersPage() {
  const { value: articles, error } = useAsync(() => getCareers(), []);

  return (
    <Screen title="Career Corner" back>
      <p className="mb-4 text-ink-soft">
        Guidance from your tutors on what comes after matric — bursaries,
        applications and how to study well.
      </p>
      {error && (
        <EmptyState
          title="Couldn't load articles"
          hint="Check your connection and try again."
        />
      )}
      {articles && articles.length === 0 && (
        <EmptyState title="No articles yet" hint="Check back soon." />
      )}
      <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3">
        {articles?.map((a) => (
          <CardLink key={a.slug} to={`/careers/${a.slug}`}>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{a.title}</span>
              <span className="mt-0.5 block text-sm text-ink-faint">
                {a.summary}
              </span>
            </span>
            <IconChevronRight size={20} className="shrink-0 text-ink-faint" />
          </CardLink>
        ))}
      </div>
    </Screen>
  );
}
