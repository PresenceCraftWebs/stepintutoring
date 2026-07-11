import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Network } from '@capacitor/network';
import type { Lesson } from '@/content/types';
import { videoUrl } from '@/lib/config';
import { isCharging, onChargingChange } from '@/lib/battery';
import { getChargingOnly, getWifiOnly } from '@/lib/settings';

/*
 * Foreground download queue for R2-hosted lessons.
 *
 * HONEST CAPABILITY NOTES (see README "Offline guarantees" for the full
 * story): downloads run while the app is open. Android keeps the WebView
 * alive briefly in the background but gives no guarantee; there is no
 * exact-clock-time scheduling on either platform. What we DO provide:
 * queued items persist across restarts and resume automatically when the
 * app is opened and the conditions (Wi-Fi / charging) are met.
 *
 * Downloads are serial — kinder to low-end devices and mobile networks.
 */

export type DownloadStatus =
  | 'queued'
  | 'waiting' // queued but conditions not met right now
  | 'downloading'
  | 'done'
  | 'error';

export type WaitReason = 'offline' | 'wifi' | 'charging';

export interface DownloadItem {
  lessonId: string;
  title: string;
  url: string;
  expectedBytes: number;
  status: DownloadStatus;
  /** 0..1 while downloading; 1 when done. */
  progress: number;
  /** Actual size on disk once finished. */
  sizeBytes?: number;
  downloadedAt?: string;
  waitReason?: WaitReason;
  error?: string;
}

export interface DownloadsSnapshot {
  items: readonly DownloadItem[];
  totalBytesUsed: number;
  /** True while any item is actively transferring. */
  busy: boolean;
}

const QUEUE_KEY = 'sit.downloads.queue.v1';
const DONE_KEY = 'sit.downloads.done.v1';
const VIDEO_DIR = 'videos';

interface PersistedQueued {
  lessonId: string;
  title: string;
  url: string;
  expectedBytes: number;
}
interface PersistedDone {
  lessonId: string;
  title: string;
  url: string;
  expectedBytes: number;
  sizeBytes: number;
  downloadedAt: string;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function videoPath(lessonId: string): string {
  return `${VIDEO_DIR}/${lessonId}.mp4`;
}

class DownloadManager {
  private items = new Map<string, DownloadItem>();
  private listeners = new Set<() => void>();
  private snapshot: DownloadsSnapshot = {
    items: [],
    totalBytesUsed: 0,
    busy: false,
  };
  private running = false;
  private conditionWatchersAttached = false;

  constructor() {
    for (const d of readJson<PersistedDone[]>(DONE_KEY, [])) {
      this.items.set(d.lessonId, {
        ...d,
        status: 'done',
        progress: 1,
      });
    }
    for (const q of readJson<PersistedQueued[]>(QUEUE_KEY, [])) {
      if (!this.items.has(q.lessonId)) {
        this.items.set(q.lessonId, { ...q, status: 'queued', progress: 0 });
      }
    }
    this.rebuildSnapshot();
    // Resume anything that was queued when the app last closed.
    void this.pump();
  }

  /* ------------------------------------------------------------ subscribe */

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getSnapshot = (): DownloadsSnapshot => this.snapshot;

  private emit(): void {
    this.rebuildSnapshot();
    this.persist();
    for (const cb of this.listeners) cb();
  }

  private rebuildSnapshot(): void {
    const items = [...this.items.values()];
    this.snapshot = {
      items,
      totalBytesUsed: items
        .filter((i) => i.status === 'done')
        .reduce((sum, i) => sum + (i.sizeBytes ?? i.expectedBytes), 0),
      busy: items.some((i) => i.status === 'downloading'),
    };
  }

  private persist(): void {
    const queued: PersistedQueued[] = [];
    const done: PersistedDone[] = [];
    for (const i of this.items.values()) {
      if (i.status === 'done') {
        done.push({
          lessonId: i.lessonId,
          title: i.title,
          url: i.url,
          expectedBytes: i.expectedBytes,
          sizeBytes: i.sizeBytes ?? i.expectedBytes,
          downloadedAt: i.downloadedAt ?? new Date().toISOString(),
        });
      } else if (i.status !== 'error') {
        queued.push({
          lessonId: i.lessonId,
          title: i.title,
          url: i.url,
          expectedBytes: i.expectedBytes,
        });
      }
    }
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queued));
      localStorage.setItem(DONE_KEY, JSON.stringify(done));
    } catch {
      /* non-fatal */
    }
  }

  /* -------------------------------------------------------------- queries */

  isDownloaded(lessonId: string): boolean {
    return this.items.get(lessonId)?.status === 'done';
  }

  item(lessonId: string): DownloadItem | undefined {
    return this.items.get(lessonId);
  }

  /**
   * Playable src for a downloaded lesson.
   * Native: a capacitor:// URL the <video> tag can stream directly.
   * Web: a blob: URL (web Filesystem stores files in IndexedDB).
   */
  async getLocalSrc(lessonId: string): Promise<string | null> {
    if (!this.isDownloaded(lessonId)) return null;
    try {
      if (Capacitor.getPlatform() === 'web') {
        const file = await Filesystem.readFile({
          path: videoPath(lessonId),
          directory: Directory.Data,
        });
        const data = file.data;
        const blob =
          data instanceof Blob
            ? data
            : await (
                await fetch(`data:video/mp4;base64,${data}`)
              ).blob();
        return URL.createObjectURL(blob);
      }
      const { uri } = await Filesystem.getUri({
        path: videoPath(lessonId),
        directory: Directory.Data,
      });
      return Capacitor.convertFileSrc(uri);
    } catch (e) {
      // File vanished (cleared storage?) — drop the stale registry entry.
      console.warn(`Downloaded file missing for lesson ${lessonId}`, e);
      this.items.delete(lessonId);
      this.emit();
      return null;
    }
  }

  /* ------------------------------------------------------------- commands */

  enqueue(lesson: Lesson): void {
    if (lesson.hostProvider !== 'r2' || !lesson.r2VideoKey) return;
    const existing = this.items.get(lesson.id);
    if (existing && existing.status !== 'error') return;
    this.items.set(lesson.id, {
      lessonId: lesson.id,
      title: lesson.title,
      url: videoUrl(lesson.r2VideoKey),
      expectedBytes: lesson.r2FileSizeBytes ?? 0,
      status: 'queued',
      progress: 0,
    });
    this.emit();
    void this.pump();
  }

  /** Cancel a queued/waiting item (does not stop an in-flight transfer). */
  cancel(lessonId: string): void {
    const item = this.items.get(lessonId);
    if (item && (item.status === 'queued' || item.status === 'waiting')) {
      this.items.delete(lessonId);
      this.emit();
    }
  }

  /** Delete a downloaded file and free its space. */
  async remove(lessonId: string): Promise<void> {
    this.items.delete(lessonId);
    this.emit();
    try {
      await Filesystem.deleteFile({
        path: videoPath(lessonId),
        directory: Directory.Data,
      });
    } catch {
      /* already gone */
    }
  }

  /** Re-check conditions and continue the queue (called by settings UI). */
  poke(): void {
    void this.pump();
  }

  /* ----------------------------------------------------------- conditions */

  private async conditionsMet(): Promise<WaitReason | null> {
    const status = await Network.getStatus();
    if (!status.connected) return 'offline';
    if ((await getWifiOnly()) && status.connectionType !== 'wifi')
      return 'wifi';
    if (await getChargingOnly()) {
      const charging = await isCharging();
      // 'unknown' (API unavailable) counts as satisfied — better to download
      // than to silently never download; the toggle UI explains this.
      if (charging === false) return 'charging';
    }
    return null;
  }

  private attachConditionWatchers(): void {
    if (this.conditionWatchersAttached) return;
    this.conditionWatchersAttached = true;
    void Network.addListener('networkStatusChange', () => void this.pump());
    onChargingChange(() => void this.pump());
  }

  /* ---------------------------------------------------------------- queue */

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (;;) {
        const next = [...this.items.values()].find(
          (i) => i.status === 'queued' || i.status === 'waiting',
        );
        if (!next) break;

        const blocked = await this.conditionsMet();
        if (blocked) {
          let changed = false;
          for (const i of this.items.values()) {
            if (i.status === 'queued' || i.status === 'waiting') {
              if (i.status !== 'waiting' || i.waitReason !== blocked)
                changed = true;
              i.status = 'waiting';
              i.waitReason = blocked;
            }
          }
          this.attachConditionWatchers();
          if (changed) this.emit();
          break;
        }

        next.status = 'downloading';
        next.waitReason = undefined;
        next.progress = 0;
        this.emit();
        try {
          await this.download(next);
          next.status = 'done';
          next.progress = 1;
          next.downloadedAt = new Date().toISOString();
        } catch (e) {
          next.status = 'error';
          next.error = e instanceof Error ? e.message : String(e);
          console.error(
            `Download failed for lesson ${next.lessonId}:`,
            next.error,
          );
        }
        this.emit();
      }
    } finally {
      this.running = false;
    }
  }

  private async download(item: DownloadItem): Promise<void> {
    const progressListener = await Filesystem.addListener(
      'progress',
      (p) => {
        const total = p.contentLength > 0 ? p.contentLength : item.expectedBytes;
        if (total > 0) {
          item.progress = Math.min(p.bytes / total, 0.999);
          this.emit();
        }
      },
    );
    try {
      await Filesystem.downloadFile({
        url: item.url,
        path: videoPath(item.lessonId),
        directory: Directory.Data,
        progress: true,
        recursive: true,
      });
      const stat = await Filesystem.stat({
        path: videoPath(item.lessonId),
        directory: Directory.Data,
      });
      item.sizeBytes = stat.size;
    } finally {
      await progressListener.remove();
    }
  }
}

/** App-wide singleton. */
export const downloadManager = new DownloadManager();
