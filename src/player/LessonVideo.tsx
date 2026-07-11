import { useState } from 'react';
import type { Lesson } from '@/content/types';
import { progressStore } from '@/progress/IdbProgressStore';
import { IconGlobe } from '@/lib/icons';
import { usePlayerSource } from './usePlayerSource';
import { R2Player } from './R2Player';
import { YouTubePlayer } from './YouTubePlayer';
import { PlayerError } from './PlayerError';
import { CompletionOverlay } from './CompletionOverlay';

/**
 * The full video area for a lesson: routes to the right player (local file →
 * R2 stream → YouTube facade), marks completion, and renders the app-owned
 * completion overlay over either tier.
 */
export function LessonVideo({
  lesson,
  nextLesson,
}: {
  lesson: Lesson;
  nextLesson: Lesson | undefined;
}) {
  const source = usePlayerSource(lesson);
  const [completed, setCompleted] = useState(false);
  // Bumping the key remounts the player for "Watch again".
  const [replayKey, setReplayKey] = useState(0);

  const handleEnded = (): void => {
    setCompleted(true);
    void progressStore.markComplete(lesson.id);
  };

  return (
    <div>
      <div className="relative overflow-hidden md:rounded-2xl">
        {source.kind === 'loading' && (
          <div className="aspect-video w-full animate-pulse bg-ink/10" />
        )}
        {source.kind === 'unavailable' && (
          <PlayerError lessonId={lesson.id} />
        )}
        {(source.kind === 'local' || source.kind === 'r2-stream') && (
          <R2Player
            key={replayKey}
            lessonId={lesson.id}
            src={source.src}
            onEnded={handleEnded}
          />
        )}
        {source.kind === 'youtube' && (
          <YouTubePlayer
            key={replayKey}
            lessonId={lesson.id}
            youtubeId={source.youtubeId}
            onEnded={handleEnded}
          />
        )}
        {completed && (
          <CompletionOverlay
            nextLesson={nextLesson}
            onReplay={() => {
              setCompleted(false);
              setReplayKey((k) => k + 1);
            }}
          />
        )}
      </div>

      {source.kind === 'local' && (
        <p className="mt-2 px-4 text-sm font-bold text-good md:px-0">
          Playing from your downloads — no data used.
        </p>
      )}
      {source.kind === 'youtube' && (
        <p className="mt-2 flex items-center gap-1.5 px-4 text-sm font-bold text-ink-faint md:px-0">
          <IconGlobe size={16} />
          Streams online only — this lesson can&apos;t be downloaded.
        </p>
      )}
    </div>
  );
}
