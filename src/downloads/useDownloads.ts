import { useSyncExternalStore } from 'react';
import {
  downloadManager,
  type DownloadsSnapshot,
} from './DownloadManager';

/** Live view of the download queue/registry for React components. */
export function useDownloads(): DownloadsSnapshot {
  return useSyncExternalStore(
    downloadManager.subscribe,
    downloadManager.getSnapshot,
  );
}
