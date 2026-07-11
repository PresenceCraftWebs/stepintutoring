import { useEffect, useState } from 'react';
import type { Lesson } from '@/content/types';
import { videoUrl } from '@/lib/config';
import { downloadManager } from '@/downloads/DownloadManager';
import { useDownloads } from '@/downloads/useDownloads';

/*
 * The core routing rule of the whole app (spec: VIDEO ROUTING):
 *   1. downloaded locally           → play the local file (fully offline)
 *   2. hostProvider 'r2'            → stream progressively from R2
 *   3. hostProvider 'youtube'       → lite-youtube-embed facade
 * Plus the "video removed by admin" state, which must fail kindly.
 */

export type PlayerSource =
  | { kind: 'loading' }
  | { kind: 'local'; src: string }
  | { kind: 'r2-stream'; src: string }
  | { kind: 'youtube'; youtubeId: string }
  | { kind: 'unavailable' };

export function usePlayerSource(lesson: Lesson): PlayerSource {
  const [source, setSource] = useState<PlayerSource>({ kind: 'loading' });
  const { items } = useDownloads();
  const downloaded = downloadManager.isDownloaded(lesson.id);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function resolve(): Promise<void> {
      if (lesson.videoRemoved) {
        setSource({ kind: 'unavailable' });
        return;
      }
      // Priority 1: local file.
      if (lesson.hostProvider === 'r2' && downloaded) {
        const src = await downloadManager.getLocalSrc(lesson.id);
        if (cancelled) return;
        if (src) {
          if (src.startsWith('blob:')) objectUrl = src;
          setSource({ kind: 'local', src });
          return;
        }
        // Registry said downloaded but file is gone — fall through to stream.
      }
      // Priority 2: R2 progressive stream.
      if (lesson.hostProvider === 'r2') {
        if (lesson.r2VideoKey) {
          setSource({ kind: 'r2-stream', src: videoUrl(lesson.r2VideoKey) });
        } else {
          setSource({ kind: 'unavailable' });
        }
        return;
      }
      // Priority 3: YouTube facade.
      if (lesson.youtubeId) {
        setSource({ kind: 'youtube', youtubeId: lesson.youtubeId });
      } else {
        setSource({ kind: 'unavailable' });
      }
    }

    setSource({ kind: 'loading' });
    void resolve();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // `items` is in deps so finishing a download upgrades stream → local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id, lesson.videoRemoved, downloaded, items]);

  return source;
}
