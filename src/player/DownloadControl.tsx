import type { Lesson } from '@/content/types';
import { downloadManager } from '@/downloads/DownloadManager';
import { useDownloads } from '@/downloads/useDownloads';
import { formatBytes } from '@/lib/format';
import {
  IconCheck,
  IconDownload,
  IconSpinner,
  IconTrash,
  IconWifi,
} from '@/lib/icons';

/**
 * "Download for offline" control shown on R2-hosted lessons only.
 * Always states the file size BEFORE any data is spent (data-conscious rule).
 */
export function DownloadControl({ lesson }: { lesson: Lesson }) {
  const snapshot = useDownloads();
  if (lesson.hostProvider !== 'r2' || lesson.videoRemoved) return null;

  const item = snapshot.items.find((i) => i.lessonId === lesson.id);
  const size = formatBytes(lesson.r2FileSizeBytes ?? 0);

  if (!item || item.status === 'error') {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => downloadManager.enqueue(lesson)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 px-5 py-3 font-bold text-white active:bg-brand-800"
        >
          <IconDownload size={18} />
          Download for offline · {size}
        </button>
        {item?.status === 'error' && (
          <p className="text-center text-sm text-danger">
            Download failed — check your connection and try again.
          </p>
        )}
      </div>
    );
  }

  if (item.status === 'done') {
    return (
      <div className="flex items-center justify-between rounded-full bg-brand-50 px-5 py-2.5">
        <span className="flex items-center gap-2 font-bold text-brand-800">
          <IconCheck size={18} className="text-good" />
          Saved for offline · {formatBytes(item.sizeBytes ?? 0)}
        </span>
        <button
          type="button"
          onClick={() => void downloadManager.remove(lesson.id)}
          className="flex items-center gap-1 text-sm font-bold text-ink-faint"
          aria-label="Remove download"
        >
          <IconTrash size={16} />
          Remove
        </button>
      </div>
    );
  }

  if (item.status === 'waiting') {
    const reason =
      item.waitReason === 'wifi'
        ? 'Waiting for Wi-Fi'
        : item.waitReason === 'charging'
          ? 'Waiting for charger'
          : 'Waiting for a connection';
    return (
      <div className="flex items-center justify-between rounded-full bg-amber-50 px-5 py-2.5 text-warn">
        <span className="flex items-center gap-2 font-bold">
          <IconWifi size={18} />
          {reason} · {size}
        </span>
        <button
          type="button"
          onClick={() => downloadManager.cancel(lesson.id)}
          className="text-sm font-bold text-ink-faint"
        >
          Cancel
        </button>
      </div>
    );
  }

  // queued / downloading
  const pct = Math.round(item.progress * 100);
  return (
    <div className="rounded-2xl bg-brand-50 px-5 py-3">
      <div className="flex items-center justify-between text-sm font-bold text-brand-800">
        <span className="flex items-center gap-2">
          <IconSpinner size={16} />
          {item.status === 'queued' ? 'Queued…' : `Downloading… ${pct}%`}
        </span>
        {item.status === 'queued' && (
          <button
            type="button"
            onClick={() => downloadManager.cancel(lesson.id)}
            className="font-bold text-ink-faint"
          >
            Cancel
          </button>
        )}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
