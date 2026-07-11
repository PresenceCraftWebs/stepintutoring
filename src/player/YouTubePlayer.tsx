import { useEffect, useRef } from 'react';
import 'lite-youtube-embed';
import 'lite-youtube-embed/src/lite-yt-embed.css';
import { progressStore } from '@/progress/IdbProgressStore';

const YT_STATE_ENDED = 0;
const YT_STATE_PLAYING = 1;

/**
 * YouTube tier (overflow lessons): lite-youtube-embed facade — a static
 * thumbnail costing a few KB — which upgrades on tap to the real IFrame
 * player on youtube-nocookie.com. The js-api attribute lets us attach a
 * state listener so lesson completion still works, and the parent overlay
 * covers YouTube's related-videos end screen.
 */
export function YouTubePlayer({
  lessonId,
  youtubeId,
  onEnded,
}: {
  lessonId: string;
  youtubeId: string;
  onEnded: () => void;
}) {
  const ref = useRef<LiteYTEmbedElement>(null);
  const endedRef = useRef(onEnded);
  endedRef.current = onEnded;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let disposed = false;

    // getYTPlayer resolves once the facade is activated (first tap).
    void el.getYTPlayer?.().then((player) => {
      if (disposed || !player) return;
      player.addEventListener('onStateChange', (e) => {
        if (disposed) return;
        if (e.data === YT_STATE_PLAYING) {
          // Register activity for "Continue where you left off" + streaks.
          void progressStore.setLastViewed(lessonId, 0);
        }
        if (e.data === YT_STATE_ENDED) endedRef.current();
      });
    });

    return () => {
      disposed = true;
    };
  }, [lessonId, youtubeId]);

  if (!navigator.onLine) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-ink px-6 text-center text-white">
        <p className="font-bold">You&apos;re offline</p>
        <p className="text-sm text-white/80">
          This lesson streams from YouTube and needs a data connection. Lessons
          with a download button can be saved for offline instead.
        </p>
      </div>
    );
  }

  return (
    <lite-youtube
      ref={ref}
      videoid={youtubeId}
      js-api=""
      params="rel=0&modestbranding=1&playsinline=1"
      playlabel="Play lesson"
      className="block aspect-video w-full bg-black"
    />
  );
}
