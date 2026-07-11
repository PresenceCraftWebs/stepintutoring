import { useParams } from 'react-router';
import Markdown from 'react-markdown';
import { getCareers } from '@/content/curriculum';
import { useAsync } from '@/lib/useAsync';
import { EmptyState, Screen } from '@/components/ui';

export function CareerArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { value: articles } = useAsync(() => getCareers(), []);

  if (!articles) {
    return <div className="p-8 text-center text-ink-faint">Loading…</div>;
  }
  const article = articles.find((a) => a.slug === slug);
  if (!article) {
    return (
      <Screen title="Career Corner" back>
        <EmptyState title="Article not found" />
      </Screen>
    );
  }

  return (
    <Screen title={article.title} back narrow>
      <article className="prose-notes rounded-2xl border border-line bg-surface p-5">
        <Markdown>{article.body}</Markdown>
      </article>
    </Screen>
  );
}
