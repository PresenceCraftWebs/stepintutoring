import { useRef, useState } from 'react';
import { getCurriculum, getStorageManifest } from '@/content/curriculum';
import { useAsync } from '@/lib/useAsync';
import {
  addOverflowLesson,
  notifyUploadComplete,
  requestUploadUrl,
  uploadRawVideo,
  type LessonMetadataInput,
} from '@/lib/adminApi';
import { formatBytes } from '@/lib/format';
import { IconCheckCircle, IconSpinner, IconUpload } from '@/lib/icons';
import { Screen } from '@/components/ui';
import {
  AdminGate,
  AdminTabs,
  MetadataFields,
  StorageBar,
  emptyMetadata,
  metadataProblems,
  type MetadataDraft,
} from './AdminShared';

type Phase =
  | { step: 'idle' }
  | { step: 'uploading'; fraction: number }
  | { step: 'finishing' }
  | { step: 'processing'; message: string }
  | { step: 'error'; message: string };

function toMetadataInput(
  d: MetadataDraft,
  youtubeId?: string,
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
    youtubeId,
  };
}

export function AdminUploadPage() {
  return (
    <Screen title="Tutor / admin tools" back>
      <AdminTabs />
      <AdminGate>
        <UploadInner />
      </AdminGate>
    </Screen>
  );
}

function UploadInner() {
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
        Couldn&apos;t load the storage manifest — check your connection. The
        upload screen needs it to know whether R2 has space.
      </p>
    );
  }
  if (!value) {
    return <div className="p-8 text-center text-ink-faint">Loading…</div>;
  }

  const { manifest, curriculum } = value;
  const atCap = manifest.totalBytesUsed >= manifest.softCapBytes;

  return (
    <div className="flex flex-col gap-4">
      <StorageBar
        usedBytes={manifest.totalBytesUsed}
        capBytes={manifest.softCapBytes}
      />
      {atCap ? (
        <OverflowForm subjects={curriculum.subjects} />
      ) : (
        <R2UploadForm subjects={curriculum.subjects} />
      )}
    </div>
  );
}

/* --------------------------------------------------- R2 (default) path */

function R2UploadForm({
  subjects,
}: {
  subjects: { id: string; name: string; icon: string; color: string }[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [meta, setMeta] = useState<MetadataDraft>(() =>
    emptyMetadata(subjects),
  );
  const [phase, setPhase] = useState<Phase>({ step: 'idle' });
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = phase.step === 'uploading' || phase.step === 'finishing';

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
      );
      setPhase({ step: 'processing', message: result.message });
    } catch (e) {
      setPhase({
        step: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (phase.step === 'processing') {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <IconCheckCircle size={36} className="mx-auto text-good" />
        <h2 className="mt-3 text-lg font-bold">
          Uploaded — now processing
        </h2>
        <p className="mt-2 text-sm text-ink-soft">{phase.message}</p>
        <p className="mt-2 text-sm text-ink-faint">
          Compression is not instant: expect roughly the video&apos;s own
          length. You can close the app — check back later. If it&apos;s still
          missing after a few hours, see &quot;stuck processing&quot; in the
          admin guide.
        </p>
        <button
          type="button"
          className="mt-4 rounded-full bg-brand-700 px-5 py-2.5 font-bold text-white"
          onClick={() => {
            setFile(null);
            setMeta(emptyMetadata(subjects));
            setPhase({ step: 'idle' });
          }}
        >
          Upload another lesson
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-bold">Upload a new lesson video</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Drop in the <strong>raw recording</strong> (straight from the camera
        or screen recorder — no need to compress it yourself). The pipeline
        shrinks it to ~480p automatically and publishes the lesson.
      </p>

      {/* File drop zone */}
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
              {formatBytes(file.size)} raw · will be ~40–70 MB per 15 min
              after compression
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
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="mt-2 rounded-full bg-brand-700 px-5 py-2.5 font-bold text-white"
            >
              Choose file
            </button>
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setFile(f);
          }}
        />
      </div>

      <MetadataFields value={meta} onChange={setMeta} subjects={subjects} />

      {phase.step === 'error' && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-danger">
          {phase.message}
        </p>
      )}

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
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 py-3 font-bold text-white disabled:opacity-50"
      >
        {busy ? (
          <>
            <IconSpinner size={18} />
            {phase.step === 'finishing'
              ? 'Starting the pipeline…'
              : 'Uploading…'}
          </>
        ) : (
          'Upload and publish'
        )}
      </button>
    </div>
  );
}

/* ------------------------------------------- YouTube overflow path */

function OverflowForm({
  subjects,
}: {
  subjects: { id: string; name: string; icon: string; color: string }[];
}) {
  const [meta, setMeta] = useState<MetadataDraft>(() =>
    emptyMetadata(subjects),
  );
  const [youtubeId, setYoutubeId] = useState('');
  const [phase, setPhase] = useState<Phase>({ step: 'idle' });

  async function submit(): Promise<void> {
    const problem = metadataProblems(meta);
    if (problem) {
      setPhase({ step: 'error', message: problem });
      return;
    }
    const id = youtubeId.trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
      setPhase({
        step: 'error',
        message:
          'Paste the 11-character video id — the part after "watch?v=" in ' +
          'the YouTube link (not the whole URL).',
      });
      return;
    }
    try {
      setPhase({ step: 'finishing' });
      const result = await addOverflowLesson(toMetadataInput(meta, id));
      setPhase({ step: 'processing', message: result.message });
    } catch (e) {
      setPhase({
        step: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (phase.step === 'processing') {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-center">
        <IconCheckCircle size={36} className="mx-auto text-good" />
        <h2 className="mt-3 text-lg font-bold">Lesson submitted</h2>
        <p className="mt-2 text-sm text-ink-soft">{phase.message}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-warn">
        R2 storage is nearly full, so this lesson should go to YouTube
        instead:
        <ol className="mt-1 list-decimal pl-5 font-normal">
          <li>
            Upload the video at{' '}
            <span className="font-bold">studio.youtube.com</span>
          </li>
          <li>
            Set visibility to <span className="font-bold">Unlisted</span>{' '}
            (NOT Private — Private videos won&apos;t play in the app)
          </li>
          <li>Paste the video id below</li>
        </ol>
        <p className="mt-1 font-normal">
          YouTube lessons stream online only — students can&apos;t download
          them. To free up space for downloadable lessons, use Manage videos.
        </p>
      </div>

      <label className="mt-3 mb-1 block text-sm font-bold text-ink-soft">
        YouTube video id
        <input
          className="w-full rounded-xl border border-line bg-paper px-4 py-3 outline-none focus:border-brand-500"
          value={youtubeId}
          onChange={(e) => setYoutubeId(e.target.value)}
          placeholder="e.g. aqz-KE-bpKQ"
        />
      </label>

      <MetadataFields value={meta} onChange={setMeta} subjects={subjects} />

      {phase.step === 'error' && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-danger">
          {phase.message}
        </p>
      )}

      <button
        type="button"
        disabled={phase.step === 'finishing'}
        onClick={() => void submit()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 py-3 font-bold text-white disabled:opacity-50"
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
