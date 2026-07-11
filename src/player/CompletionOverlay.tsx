import { Link } from 'react-router';
import type { Lesson } from '@/content/types';
import { IconCheckCircle, IconPlay } from '@/lib/icons';

/**
 * App-owned end-of-lesson overlay. Rendered over the player for BOTH tiers —
 * in the YouTube case it deliberately covers YouTube's own end screen
 * (related-video wall) with our calm "what's next" instead.
 */
export function CompletionOverlay({
  nextLesson,
  onReplay,
}: {
  nextLesson: Lesson | undefined;
  onReplay: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-brand-900/95 px-6 text-center text-white">
      <IconCheckCircle size={40} className="text-brand-200" />
      <p className="text-xl font-bold">Lesson complete!</p>
      {nextLesson ? (
        <Link
          to={`/lesson/${nextLesson.id}`}
          className="flex items-center gap-2 rounded-full bg-white px-5 py-3 font-bold text-brand-800"
        >
          <IconPlay size={18} />
          Next: {nextLesson.title}
        </Link>
      ) : (
        <p className="text-sm text-white/80">
          That was the last lesson in this term. Great work!
        </p>
      )}
      <button
        type="button"
        onClick={onReplay}
        className="text-sm font-bold text-white/70 underline underline-offset-4"
      >
        Watch again
      </button>
    </div>
  );
}
