import { useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  getCurriculum,
  getStorageManifest,
  lessonById,
} from '@/content/curriculum';
import type { Lesson, Subject } from '@/content/types';
import { useAsync } from '@/lib/useAsync';
import {
  addYoutubeLesson,
  notifyUploadComplete,
  requestUploadUrl,
  uploadRawVideo,
  type LessonMetadataInput,
} from '@/lib/adminApi';
import { parseYoutubeInput } from '@/lib/youtube';
import { formatBytes } from '@/lib/format';
import { IconCheckCircle, IconSpinner, IconUpload } from '@/lib/icons';
import { Screen } from '@/components/ui';
import {
  AdminGate,
  AdminTabs,
  MetadataFields,
  StorageBar,
  draftFromLesson,
  emptyMetadata,
  metadataProblems,
  type MetadataDraft,
} from './AdminShared';

/*
 * "Add lesson" — YouTube-first (curate what already exists; don't reinvent
 * the wheel), with R2 upload as the deliberate choice for the org's OWN
 * recordings that need offline access. ?replace=<lessonId> pre-fills the R2
 * form to convert an existing lesson (e.g. one learners requested offline)
 * to a downloadable copy, keeping its id and progress.
 */

type Phase =
  | { step: 'idle' }
  | { step: 'uploading'; fraction: number }
  | { step: 'finishing' }
  | { step: 'done'; message: string; heading: string }
  | { step: 'error'; message: string };

function toMetadataInput(
  d: MetadataDraft,
  extra?: { youtubeId?: string; attribution?: string },
): LessonMetadataInput {
  return {
    title: d.title.trim(),
    topic: d.topic.trim(),
    grade: d.grade,
    subjectId: d.subjectId,
    term: d.term,
    durationMinutes: Number(d.durationMinutes),
    notes: d.notes,
    tags: d.tags,
    youtubeId: extra?.youtubeId,
    attribution: extra?.attribution?.trim() || undefined,
  };
}

const inputCls =
  'w-full rounded-xl border border-line bg-paper px-4 py-3 outline-none focus:border-brand-500';

export function AdminUploadPage() {
  return (
    <Screen title="Tutor / admin tools" back narrow>
      <AdminTabs />
      <AdminGate>
        <AddLessonInner />
      </AdminGate>
    </Screen>
  );
}

function AddLessonInner() {
  const [params] = useSearchParams();
  const replaceId = params.get('replace');

  const { value, error } = useAsync(async () => {
    const [manifest, curriculum] = await Promise.all([
      getStorageManifest(),
      getCurriculum(),
    ]);
    return { manifest, curriculum };
  }, []);

  if (error) {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-warn">
        Couldn&apos;t load the storage manifest — check your connection and
        try again.
      </p>
    );
  }
  if (!value) {
    return <div className="p-8 text-center text-ink-faint">Loading…</div>;
  }

  const { manifest, curriculum } = value;
  const replaceLesson = replaceId
    ? lessonById(curriculum, replaceId)
    : undefined;

  return (
    <AddLessonForms
      manifest={manifest}
      subjects={curriculum.subjects}
      replaceLesson={replaceLesson}
    />
  );
}

function AddLessonForms({
  manifest,
  subjects,
  replaceLesson,
}: {
  manifest: { totalBytesUsed: number; softCapBytes: number };
  subjects: Subject[];
  replaceLesson: Lesson | undefined;
}) {
  const [mode, setMode] = useState<'youtube' | 'r2'>(
    replaceLesson ? 'r2' : 'youtube',
  );
  const atCap = manifest.totalBytesUsed >= manifest.softCapBytes;

  const modeBtn = (active: boolean) =>
    `flex-1 rounded-full py-2.5 text-sm font-bold transition-colors ${
      active ? 'bg-brand-700 text-white' : 'text-ink-faint hover:text-brand-700'
    }`;

  return (
    <div className="flex flex-col gap-4">
      <StorageBar
        usedBytes={manifest.totalBytesUsed}
        capBytes={manifest.softCapBytes}
      />

      {!replaceLesson && (
        <div className="flex gap-1 rounded-full border border-line bg-surface p-1">
          <button
            type="button"
            className={modeBtn(mode === 'youtube')}
            onClick={() => setMode('youtube')}
          >
            From YouTube
          </button>
          <button
            type="button"
            className={modeBtn(mode === 'r2')}
            onClick={() => setMode('r2')}
          >
            Upload video (downloadable)
          </button>
        </div>
      )}

      {mode === 'youtube' ? (
        <YouTubeForm subjects={subjects} />
      ) : (
        <R2UploadForm
          subjects={subjects}
          atCap={atCap}
          replaceLesson={replaceLesson}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------ YouTube (default) mode */

function YouTubeForm({ subjects }: { subjects: Subject[] }) {
  const [meta, setMeta] = useState<MetadataDraft>(() =>
    emptyMetadata(subjects),
  );
  const [link, setLink] = useState('');
  const [attribution, setAttribution] = useState('');
  const [phase, setPhase] = useState<Phase>({ step: 'idle' });

  async function submit(): Promise<void> {
    const youtubeId = parseYoutubeInput(link);
    if (!youtubeId) {
      setPhase({
        step: 'error',
        message:
          "That doesn't look like a YouTube link or video id. Paste the " +
          'full URL (youtube.com/watch?v=… or youtu.be/…) or the 11-character id.',
      });
      return;
    }
    const problem = metadataProblems(meta);
    if (problem) {
      setPhase({ step: 'error', message: problem });
      return;
    }
    try {
      setPhase({ step: 'finishing' });
      const result = await addYoutubeLesson(
        toMetadataInput(meta, { youtubeId, attribution }),
      );
      setPhase({
        step: 'done',
        heading: 'Lesson submitted',
        message: result.message,
      });
    } catch (e) {
      setPhase({
        step: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (phase.step === 'done') {
    return (
      <DonePanel
        heading={phase.heading}
        message={phase.message}
        onAgain={() => {
          setMeta(emptyMetadata(subjects));
          setLink('');
          setAttribution('');
          setPhase({ step: 'idle' });
        }}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-bold">Add a YouTube lesson</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Lots of great CAPS-aligned lessons already exist — curate them instead
        of re-recording. Paste a <strong>public video</strong> (credit the
        channel below) or one of <strong>our own Unlisted uploads</strong>.
        YouTube lessons stream online only; learners can request an offline
        version if they need one.
      </p>

      <label className="mt-3 mb-1 block text-sm font-bold text-ink-soft">
        YouTube link or video id
        <input
          className={inputCls}
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <label className="mt-3 mb-1 block text-sm font-bold text-ink-soft">
        Attribution (public videos — credit the channel)
        <input
          className={inputCls}
          value={attribution}
          onChange={(e) => setAttribution(e.target.value)}
          placeholder='e.g. "Mindset Learn" — leave empty for our own videos'
        />
      </label>

      <MetadataFields value={meta} onChange={setMeta} subjects={subjects} />

      {phase.step === 'error' && <ErrorNote message={phase.message} />}

      <button
        type="button"
        disabled={phase.step === 'finishing'}
        onClick={() => void submit()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 py-3 font-bold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
      >
        {phase.step === 'finishing' ? (
          <>
            <IconSpinner size={18} /> Submitting…
          </>
        ) : (
          'Add YouTube lesson'
        )}
      </button>
    </div>
  );
}

/* ----------------------------------------------------- R2 (upload) mode */

function R2UploadForm({
  subjects,
  atCap,
  replaceLesson,
}: {
  subjects: Subject[];
  atCap: boolean;
  replaceLesson: Lesson | undefined;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<MetadataDraft>(() =>
    replaceLesson ? draftFromLesson(replaceLesson) : emptyMetadata(subjects),
  );
  const [phase, setPhase] = useState<Phase>({ step: 'idle' });
  const [dragOver, setDragOver] = useState(false);

  const busy = phase.step === 'uploading' || phase.step === 'finishing';

  if (atCap) {
    return (
      <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-warn">
        R2 storage is at its cap, so new uploads are paused. Add this one as a
        YouTube lesson instead (our own videos go up as Unlisted), or free
        space in Manage lessons first.
      </div>
    );
  }

  async function submit(): Promise<void> {
    if (!file) {
      setPhase({ step: 'error', message: 'Choose the raw video file first.' });
      return;
    }
    const problem = metadataProblems(meta);
    if (problem) {
      setPhase({ step: 'error', message: problem });
      return;
    }
    try {
      setPhase({ step: 'uploading', fraction: 0 });
      const ticket = await requestUploadUrl(file.name, file.size);
      await uploadRawVideo(ticket.uploadUrl, file, (fraction) =>
        setPhase({ step: 'uploading', fraction }),
      );
      setPhase({ step: 'finishing' });
      const result = await notifyUploadComplete(
        ticket.objectKey,
        toMetadataInput(meta),
        replaceLesson?.id,
      );
      setPhase({
        step: 'done',
        heading: 'Uploaded — now processing',
        message: result.message,
      });
    } catch (e) {
      setPhase({
        step: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (phase.step === 'done') {
    return (
      <DonePanel
        heading={phase.heading}
        message={`${phase.message} Compression is not instant: expect roughly the video's own length.`}
        onAgain={() => {
          setFile(null);
          setMeta(emptyMetadata(subjects));
          setPhase({ step: 'idle' });
        }}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      {replaceLesson ? (
        <div className="mb-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-bold text-brand-800">
          Re-hosting &quot;{replaceLesson.title}&quot; as a downloadable
          lesson. Upload OUR OWN recording of it — never download someone
          else&apos;s YouTube video. The lesson keeps its place and learners
          keep their progress.
        </div>
      ) : (
        <>
          <h2 className="font-bold">Upload a lesson video (downloadable)</h2>
          <p className="mt-1 text-sm text-ink-soft">
            For <strong>our own recordings</strong> that learners need
            offline. Drop in the raw file — the pipeline compresses it to
            ~480p automatically.
          </p>
        </>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) setFile(f);
        }}
        className={`mt-3 rounded-2xl border-2 border-dashed p-6 text-center ${
          dragOver ? 'border-brand-500 bg-brand-50' : 'border-line'
        }`}
      >
        {file ? (
          <>
            <p className="font-bold break-all">{file.name}</p>
            <p className="mt-1 text-sm text-ink-faint">
              {formatBytes(file.size)} raw · ~40–70 MB per 15 min after
              compression
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => setFile(null)}
              className="mt-2 text-sm font-bold text-ink-faint underline"
            >
              Choose a different file
            </button>
          </>
        ) : (
          <>
            <IconUpload size={28} className="mx-auto text-ink-faint" />
            <p className="mt-2 text-sm text-ink-soft">
              Drag the video here, or
            </p>
            <label className="mt-2 inline-block cursor-pointer rounded-full bg-brand-700 px-5 py-2.5 font-bold text-white">
              Choose file
              <input
                type="file"
                accept="video/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setFile(f);
                }}
              />
            </label>
          </>
        )}
      </div>

      <MetadataFields value={meta} onChange={setMeta} subjects={subjects} />

      {phase.step === 'error' && <ErrorNote message={phase.message} />}

      {phase.step === 'uploading' && (
        <div className="mt-3">
          <p className="text-sm font-bold text-ink-soft">
            Uploading raw file… {Math.round(phase.fraction * 100)}% — keep the
            app open
          </p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-50">
            <div
              className="h-full rounded-full bg-brand-600 transition-[width]"
              style={{ width: `${Math.round(phase.fraction * 100)}%` }}
            />
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => void submit()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 py-3 font-bold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
      >
        {busy ? (
          <>
            <IconSpinner size={18} />
            {phase.step === 'finishing'
              ? 'Starting the pipeline…'
              : 'Uploading…'}
          </>
        ) : replaceLesson ? (
          'Upload and re-host this lesson'
        ) : (
          'Upload and publish'
        )}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------- shared UI */

function DonePanel({
  heading,
  message,
  onAgain,
}: {
  heading: string;
  message: string;
  onAgain: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 text-center">
      <IconCheckCircle size={36} className="mx-auto text-good" />
      <h2 className="mt-3 text-lg font-bold">{heading}</h2>
      <p className="mt-2 text-sm text-ink-soft">{message}</p>
      <button
        type="button"
        className="mt-4 rounded-full bg-brand-700 px-5 py-2.5 font-bold text-white"
        onClick={onAgain}
      >
        Add another lesson
      </button>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-danger">
      {message}
    </p>
  );
}
