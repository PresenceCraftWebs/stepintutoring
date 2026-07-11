import { useState } from 'react';
import {
  getCurriculum,
  getStorageManifest,
  r2Lessons,
} from '@/content/curriculum';
import type { Lesson } from '@/content/types';
import { useAsync } from '@/lib/useAsync';
import { deleteVideo } from '@/lib/adminApi';
import { formatBytes } from '@/lib/format';
import { IconAlert, IconSpinner, IconTrash } from '@/lib/icons';
import { EmptyState, Screen } from '@/components/ui';
import { AdminGate, AdminTabs, StorageBar } from './AdminShared';

type RowState = 'idle' | 'confirm' | 'deleting' | 'deleted' | 'error';

export function AdminManageVideosPage() {
  return (
    <Screen title="Tutor / admin tools" back narrow>
      <AdminTabs />
      <AdminGate>
        <ManageInner />
      </AdminGate>
    </Screen>
  );
}

function ManageInner() {
  const { value, reload } = useAsync(async () => {
    const [manifest, curriculum] = await Promise.all([
      getStorageManifest(),
      getCurriculum(),
    ]);
    return { manifest, curriculum };
  }, []);
  const [rows, setRows] = useState<Record<string, { state: RowState; message?: string }>>({});

  if (!value) {
    return <div className="p-8 text-center text-ink-faint">Loading…</div>;
  }
  const { manifest, curriculum } = value;
  const hosted = r2Lessons(curriculum).filter((l) => !l.videoRemoved);
  const needsAttention = curriculum.lessons.filter((l) => l.videoRemoved);

  const setRow = (id: string, state: RowState, message?: string): void =>
    setRows((r) => ({ ...r, [id]: { state, message } }));

  async function remove(lesson: Lesson): Promise<void> {
    if (!lesson.r2VideoKey) return;
    setRow(lesson.id, 'deleting');
    try {
      const result = await deleteVideo(lesson.id, lesson.r2VideoKey);
      setRow(lesson.id, 'deleted', result.message);
    } catch (e) {
      setRow(lesson.id, 'error', e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <StorageBar
        usedBytes={manifest.totalBytesUsed}
        capBytes={manifest.softCapBytes}
      />
      <p className="px-1 text-sm text-ink-soft">
        Deleting here removes the video from storage <strong>and</strong> the
        lesson from the app, so students never see a broken lesson. Keep your
        raw recording backed up — to bring a lesson back, upload it again (or
        add it as a YouTube lesson).
      </p>

      {/* Only appears if a lesson was flagged manually in the CMS
          (videoRemoved: true) — normal deletion removes lessons outright. */}
      {needsAttention.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-bold text-warn">
            <IconAlert size={18} /> Needs attention
          </h2>
          <div className="flex flex-col gap-2">
            {needsAttention.map((l) => (
              <div
                key={l.id}
                className="rounded-2xl border border-warn/40 bg-amber-50 p-4"
              >
                <p className="font-bold">{l.title}</p>
                <p className="text-sm text-ink-soft">
                  Grade {l.grade} · {l.topic} — marked as missing its video.
                  Re-upload it, add a youtubeId in the CMS, or delete the
                  entry there.
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-bold">
          R2-hosted lessons ({hosted.length})
        </h2>
        {hosted.length === 0 ? (
          <EmptyState title="No R2-hosted lessons" />
        ) : (
          <div className="flex flex-col gap-2">
            {hosted.map((lesson) => {
              const row = rows[lesson.id] ?? { state: 'idle' as RowState };
              const isSample = /^https?:\/\//.test(lesson.r2VideoKey ?? '');
              return (
                <div
                  key={lesson.id}
                  className="rounded-2xl border border-line bg-surface p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">
                        {lesson.title}
                      </span>
                      <span className="block text-sm text-ink-faint">
                        Grade {lesson.grade} · Term {lesson.term} ·{' '}
                        {formatBytes(lesson.r2FileSizeBytes ?? 0)}
                        {isSample && ' · sample URL (not in R2)'}
                      </span>
                    </span>
                    {row.state === 'idle' && !isSample && (
                      <button
                        type="button"
                        aria-label={`Delete video for ${lesson.title}`}
                        onClick={() => setRow(lesson.id, 'confirm')}
                        className="rounded-full p-2 text-ink-faint active:bg-line active:text-danger"
                      >
                        <IconTrash size={20} />
                      </button>
                    )}
                    {row.state === 'deleting' && <IconSpinner size={20} />}
                  </div>

                  {row.state === 'confirm' && (
                    <div className="mt-3 rounded-xl bg-red-50 p-3">
                      <p className="text-sm font-bold text-danger">
                        Delete this lesson AND its video? It disappears from
                        the app for students. Notes and details are deleted
                        too — this can&apos;t be undone.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void remove(lesson)}
                          className="rounded-full bg-danger px-4 py-2 text-sm font-bold text-white"
                        >
                          Yes, delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setRow(lesson.id, 'idle')}
                          className="rounded-full border border-line px-4 py-2 text-sm font-bold text-ink-soft"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {row.state === 'deleted' && (
                    <p className="mt-2 text-sm font-bold text-good">
                      {row.message ?? 'Deleted — lesson removed.'}{' '}
                      <button
                        type="button"
                        className="underline"
                        onClick={reload}
                      >
                        Refresh list
                      </button>
                    </p>
                  )}
                  {row.state === 'error' && (
                    <p className="mt-2 text-sm font-bold text-danger">
                      {row.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
