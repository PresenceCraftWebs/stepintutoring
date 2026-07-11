import { useEffect, useRef, useState } from 'react';
import { progressStore } from '@/progress/IdbProgressStore';
import { PlayerError } from './PlayerError';

const SAVE_INTERVAL_S = 5;

/**
 * HTML5 player for both local files and progressive R2 streams.
 * Seeking over the network relies on HTTP range requests, which the <video>
 * element issues natively and R2 serves — no custom code needed.
 * No autoplay (data-conscious); playback position is saved every few seconds
 * so an interrupted session resumes where it stopped.
 */
export function R2Player({
  lessonId,
  src,
  onEnded,
}: {
  lessonId: string;
  src: string;
  onEnded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedRef = useRef(0);
  const [failed, setFailed] = useState(false);

  // Resume from the saved position once metadata is available.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    const onLoaded = () => {
      void progressStore.getPositionSeconds(lessonId).then((pos) => {
        if (cancelled || !videoRef.current) return;
        const duration = videoRef.current.duration;
        if (pos > 5 && Number.isFinite(duration) && pos < duration - 15) {
          videoRef.current.currentTime = pos;
        }
      });
    };
    video.addEventListener('loadedmetadata', onLoaded);
    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [lessonId, src]);

  if (failed) {
    return <PlayerError lessonId={lessonId} />;
  }

  return (
    <video
      ref={videoRef}
      src={src}
      controls
      playsInline
      preload="metadata"
      controlsList="nodownload"
      className="aspect-video w-full bg-black"
      onTimeUpdate={(e) => {
        const t = e.currentTarget.currentTime;
        if (Math.abs(t - lastSavedRef.current) >= SAVE_INTERVAL_S) {
          lastSavedRef.current = t;
          void progressStore.setLastViewed(lessonId, t);
        }
      }}
      onEnded={() => {
        void progressStore.setLastViewed(lessonId, 0);
        onEnded();
      }}
      onError={() => {
        // Spec: log the lesson id so a tutor can report it precisely.
        console.error(
          `Video playback failed for lesson "${lessonId}" (src: ${src})`,
          videoRef.current?.error,
        );
        setFailed(true);
      }}
    />
  );
}
