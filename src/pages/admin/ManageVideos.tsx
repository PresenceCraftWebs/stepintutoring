import { useState } from 'react';
import { Link } from 'react-router';
import {
  getCurriculum,
  getStorageManifest,
  lessonById,
} from '@/content/curriculum';
import type { Curriculum, Lesson } from '@/content/types';
import { useAsync } from '@/lib/useAsync';
import {
  deleteVideo,
  deleteYoutubeLesson,
  dismissOfflineRequest,
  getOfflineRequests,
  updateLesson,
  type OfflineRequest,
} from '@/lib/adminApi';
import { parseYoutubeInput } from '@/lib/youtube';
import { formatBytes } from '@/lib/format';
import {
  IconAlert,
  IconDownload,
  IconGlobe,
  IconSpinner,
  IconTrash,
} from '@/lib/icons';
import { Screen } from '@/components/ui';
import {
  AdminGate,
  AdminTabs,
  MetadataFields,
  StorageBar,
  draftFromLesson,
  metadataProblems,
  type MetadataDraft,
} from './AdminShared';

/*
 * "Manage lessons" — the curation hub. Shows learners' offline requests as
 * a priority queue, plus every lesson (both tiers) with edit and delete.
 */

type RowState =
  | { kind: 'idle' }
  | { kind: 'confirm-delete' }
  | { kind: 'busy' }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string };

const inputCls =
  'w-full rounded-xl border border-line bg-paper px-4 py-3 outline-none focus:border-brand-500';

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
    const [manifest, curriculum, requests] = await Promise.all([
      getStorageManifest(),
      getCurriculum(),
      getOfflineRequests().catch(() => ({ requests: [] })),
    ]);
    return { manifest, curriculum, requests: requests.requests };
  }, []);

  if (!value) {
    return <div className="p-8 text-center text-ink-faint">Loading…</div>;
  }
  const { manifest, curriculum, requests } = value;
  const lessons = [...curriculum.lessons].sort(
    (a, b) =>
      a.grade - b.grade ||
      a.subjectId.localeCompare(b.subjectId) ||
      a.term - b.term ||
      a.order - b.order,
  );

  return (
    <div className="flex flex-col gap-4">
      <StorageBar
        usedBytes={manifest.totalBytesUsed}
        capBytes={manifest.softCapBytes}
      />

      <RequestsPanel
        requests={requests}
        curriculum={curriculum}
        onChanged={reload}
      />

      <section>
        <h2 className="mb-2 font-bold">All lessons ({lessons.length})</h2>
        <p className="mb-2 px-1 text-sm text-ink-soft">
          Edit any lesson&apos;s details (changing grade/subject/term moves it
          to the right place). Deleting a downloadable lesson also frees its
          stored video; YouTube lessons just leave the app. Changes go live
          within a few minutes.
        </p>
        <div className="flex flex-col gap-2">
          {lessons.map((lesson) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              curriculum={curriculum}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

/* -------------------------------------------------- offline request queue */

function RequestsPanel({
  requests,
  curriculum,
  onChanged,
}: {
  requests: OfflineRequest[];
  curriculum: Curriculum;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const known = requests
    .map((r) => ({ ...r, lesson: lessonById(curriculum, r.lessonId) }))
    .filter((r) => r.lesson !== undefined);

  if (known.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 font-bold">
        <IconDownload size={18} className="text-brand-700" />
        Learners asked for these offline
      </h2>
      <p className="mb-2 px-1 text-sm text-ink-soft">
        Make a lesson downloadable only if it&apos;s <strong>our own
        recording</strong> — never download someone else&apos;s YouTube video.
        For public videos, record our own version or dismiss the request.
      </p>
      <div className="flex flex-col gap-2">
        {known.map(({ lessonId, count, lesson }) => (
          <div
            key={lessonId}
            className="rounded-2xl border border-brand-200 bg-brand-50 p-4"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">
                {count}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">
                  {lesson?.title}
                </span>
                <span className="block text-sm text-ink-faint">
                  Grade {lesson?.grade} · {lesson?.topic} ·{' '}
                  {count === 1 ? '1 request' : `${count} requests`}
                  {lesson?.attribution ? ` · video by ${lesson.attribution}` : ''}
                </span>
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              {lesson?.hostProvider === 'youtube' && !lesson.attribution && (
                <Link
                  to={`/admin-tools/upload?replace=${lessonId}`}
                  className="rounded-full bg-brand-700 px-4 py-2 text-sm font-bold text-white"
                >
                  Make downloadable
                </Link>
              )}
              <button
                type="button"
                disabled={busyId === lessonId}
                onClick={() => {
                  setBusyId(lessonId);
                  dismissOfflineRequest(lessonId).then(onChanged, onChanged);
                }}
                className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-bold text-ink-soft"
              >
                {busyId === lessonId ? 'Clearing…' : 'Dismiss'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ lesson row */

function LessonRow({
  lesson,
  curriculum,
}: {
  lesson: Lesson;
  curriculum: Curriculum;
}) {
  const [state, setState] = useState<RowState>({ kind: 'idle' });
  const [editing, setEditing] = useState(false);
  const isSample =
    lesson.hostProvider === 'r2' && /^https?:\/\//.test(lesson.r2VideoKey ?? '');

  async function remove(): Promise<void> {
    setState({ kind: 'busy' });
    try {
      const result =
        lesson.hostProvider === 'r2' && lesson.r2VideoKey
          ? await deleteVideo(lesson.id, lesson.r2VideoKey)
          : await deleteYoutubeLesson(lesson.id);
      setState({ kind: 'done', message: result.message });
    } catch (e) {
      setState({
        kind: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{lesson.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-faint">
            <span>
              Gr {lesson.grade} · T{lesson.term} · {lesson.topic}
            </span>
            {lesson.hostProvider === 'r2' ? (
              <span className="flex items-center gap-1">
                <IconDownload size={13} />
                {formatBytes(lesson.r2FileSizeBytes ?? 0)}
                {isSample && ' · sample'}
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <IconGlobe size={13} /> YouTube
              </span>
            )}
            {lesson.videoRemoved && (
              <span className="flex items-center gap-1 font-bold text-warn">
                <IconAlert size={13} /> video missing
              </span>
            )}
          </span>
        </span>
        {state.kind === 'idle' && (
          <>
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className="rounded-full border border-line px-3.5 py-1.5 text-sm font-bold text-ink-soft transition-colors hover:border-brand-300 hover:bg-brand-50"
            >
              {editing ? 'Close' : 'Edit'}
            </button>
            {!isSample && (
              <button
                type="button"
                aria-label={`Delete ${lesson.title}`}
                onClick={() => setState({ kind: 'confirm-delete' })}
                className="rounded-full p-2 text-ink-faint transition-colors hover:text-danger active:bg-line"
              >
                <IconTrash size={20} />
              </button>
            )}
          </>
        )}
        {state.kind === 'busy' && <IconSpinner size={20} />}
      </div>

      {state.kind === 'confirm-delete' && (
        <div className="mt-3 rounded-xl bg-red-50 p-3">
          <p className="text-sm font-bold text-danger">
            {lesson.hostProvider === 'r2'
              ? "Delete this lesson AND its stored video? This can't be undone."
              : 'Remove this lesson from the app? The video stays on YouTube.'}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void remove()}
              className="rounded-full bg-danger px-4 py-2 text-sm font-bold text-white"
            >
              Yes, delete
            </button>
            <button
              type="button"
              onClick={() => setState({ kind: 'idle' })}
              className="rounded-full border border-line px-4 py-2 text-sm font-bold text-ink-soft"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.kind === 'done' && (
        <p className="mt-2 text-sm font-bold text-good">{state.message}</p>
      )}
      {state.kind === 'error' && (
        <p className="mt-2 text-sm font-bold text-danger">{state.message}</p>
      )}

      {editing && state.kind === 'idle' && (
        <EditForm
          lesson={lesson}
          curriculum={curriculum}
          onSaved={() => setEditing(false)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------- edit form */

function EditForm({
  lesson,
  curriculum,
  onSaved,
}: {
  lesson: Lesson;
  curriculum: Curriculum;
  onSaved: () => void;
}) {
  const [meta, setMeta] = useState<MetadataDraft>(() =>
    draftFromLesson(lesson),
  );
  const [ytLink, setYtLink] = useState(lesson.youtubeId ?? '');
  const [attribution, setAttribution] = useState(lesson.attribution ?? '');
  const [phase, setPhase] = useState<
    { step: 'idle' } | { step: 'saving' } | { step: 'saved'; message: string } | { step: 'error'; message: string }
  >({ step: 'idle' });

  async function save(): Promise<void> {
    const problem = metadataProblems(meta);
    if (problem) {
      setPhase({ step: 'error', message: problem });
      return;
    }
    let youtubeId: string | undefined;
    if (lesson.hostProvider === 'youtube') {
      youtubeId = parseYoutubeInput(ytLink) ?? undefined;
      if (!youtubeId) {
        setPhase({
          step: 'error',
          message: 'Paste a valid YouTube link or 11-character video id.',
        });
        return;
      }
    }
    try {
      setPhase({ step: 'saving' });
      const result = await updateLesson(lesson.id, {
        title: meta.title.trim(),
        topic: meta.topic.trim(),
        grade: meta.grade,
        subjectId: meta.subjectId,
        term: meta.term,
        durationMinutes: Number(meta.durationMinutes),
        notes: meta.notes,
        tags: meta.tags,
        youtubeId,
        attribution: attribution.trim() || undefined,
      });
      setPhase({ step: 'saved', message: result.message });
      setTimeout(onSaved, 2500);
    } catch (e) {
      setPhase({
        step: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (phase.step === 'saved') {
    return (
      <p className="mt-3 rounded-xl bg-brand-50 px-4 py-3 text-sm font-bold text-brand-800">
        {phase.message}
      </p>
    );
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      {lesson.hostProvider === 'youtube' && (
        <>
          <label className="mb-1 block text-sm font-bold text-ink-soft">
            YouTube link or video id
            <input
              className={inputCls}
              value={ytLink}
              onChange={(e) => setYtLink(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <label className="mt-3 mb-1 block text-sm font-bold text-ink-soft">
            Attribution (public videos)
            <input
              className={inputCls}
              value={attribution}
              onChange={(e) => setAttribution(e.target.value)}
              placeholder="Leave empty for our own videos"
            />
          </label>
        </>
      )}

      <MetadataFields
        value={meta}
        onChange={setMeta}
        subjects={curriculum.subjects}
      />

      {phase.step === 'error' && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-danger">
          {phase.message}
        </p>
      )}

      <button
        type="button"
        disabled={phase.step === 'saving'}
        onClick={() => void save()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 py-3 font-bold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
      >
        {phase.step === 'saving' ? (
          <>
            <IconSpinner size={18} /> Saving…
          </>
        ) : (
          'Save changes'
        )}
      </button>
    </div>
  );
}
