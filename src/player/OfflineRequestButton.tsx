import { useState } from 'react';
import { requestOfflineVersion } from '@/lib/adminApi';
import { WORKER_URL } from '@/lib/config';
import { IconCheck, IconDownload } from '@/lib/icons';

/*
 * Shown on YouTube-tier lessons: lets a learner tell the tutors "I need
 * this one offline". One tap per device (remembered locally); the counts
 * appear on the admin Manage screen as a priority queue for R2 re-hosting.
 */

const KEY_PREFIX = 'sit.offlineReq.';

function alreadyRequested(lessonId: string): boolean {
  try {
    return localStorage.getItem(KEY_PREFIX + lessonId) === '1';
  } catch {
    return false;
  }
}

export function OfflineRequestButton({ lessonId }: { lessonId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>(
    () => (alreadyRequested(lessonId) ? 'done' : 'idle'),
  );

  if (!WORKER_URL) return null;

  if (state === 'done') {
    return (
      <p className="mt-2 flex items-center gap-1.5 px-4 text-sm font-bold text-good md:px-0">
        <IconCheck size={16} />
        Requested — your tutors can see you need this lesson offline.
      </p>
    );
  }

  return (
    <div className="mt-2 px-4 md:px-0">
      <button
        type="button"
        disabled={state === 'sending'}
        onClick={() => {
          setState('sending');
          requestOfflineVersion(lessonId).then(
            () => {
              try {
                localStorage.setItem(KEY_PREFIX + lessonId, '1');
              } catch {
                /* remembering is best-effort */
              }
              setState('done');
            },
            () => setState('error'),
          );
        }}
        className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold text-ink-soft transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
      >
        <IconDownload size={16} />
        {state === 'sending' ? 'Sending…' : 'Request offline version'}
      </button>
      {state === 'error' && (
        <p className="mt-1 text-sm text-danger">
          Couldn&apos;t send right now — try again when you have signal.
        </p>
      )}
    </div>
  );
}
