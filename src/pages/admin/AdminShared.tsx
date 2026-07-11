import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import type { Subject } from '@/content/types';
import { VALID_GRADES, VALID_TAGS, VALID_TERMS } from '@/content/types';
import { verifyAdminKey } from '@/lib/adminApi';
import { getAdminKey, removeAdminKey, setAdminKey } from '@/lib/settings';
import { IconEye, IconEyeOff, IconSpinner } from '@/lib/icons';

/*
 * Shared pieces for the two in-app admin screens. The Worker enforces the
 * X-Admin-Key secret on every call; this gate additionally VERIFIES a key
 * against the Worker (GET /auth-check) before storing it, so a wrong key is
 * rejected at the door rather than failing later on the first real action.
 */

type GateState =
  | { step: 'loading' }
  | { step: 'need-key'; error?: string }
  | { step: 'verifying' }
  | { step: 'unconfigured' }
  | { step: 'ready' };

export function AdminGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ step: 'loading' });
  const [draft, setDraft] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Re-verify the stored key on mount — a stale/revoked key must not pass.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await getAdminKey();
      if (!stored) {
        const probe = await verifyAdminKey('');
        if (!cancelled) {
          setState(
            probe === 'unconfigured'
              ? { step: 'unconfigured' }
              : { step: 'need-key' },
          );
        }
        return;
      }
      const result = await verifyAdminKey(stored);
      if (cancelled) return;
      if (result === 'ok') setState({ step: 'ready' });
      else if (result === 'unconfigured') setState({ step: 'unconfigured' });
      else if (result === 'unauthorized') {
        await removeAdminKey();
        setState({
          step: 'need-key',
          error:
            'The key saved on this device is no longer valid — enter the current one.',
        });
      } else {
        setState({
          step: 'need-key',
          error:
            "Couldn't reach the admin service to check your key — check your connection and try again.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (): Promise<void> => {
    const candidate = draft.trim();
    setState({ step: 'verifying' });
    const result = await verifyAdminKey(candidate);
    if (result === 'ok') {
      await setAdminKey(candidate);
      setState({ step: 'ready' });
    } else if (result === 'unauthorized') {
      setState({
        step: 'need-key',
        error:
          "That key is wrong — it doesn't match the one set on the server. Check with your technical contact.",
      });
    } else if (result === 'unconfigured') {
      setState({ step: 'unconfigured' });
    } else {
      setState({
        step: 'need-key',
        error:
          "Couldn't reach the admin service — check your connection and try again.",
      });
    }
  };

  if (state.step === 'loading') {
    return <div className="p-8 text-center text-ink-faint">Loading…</div>;
  }

  if (state.step === 'unconfigured') {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-bold">Admin tools not wired up yet</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The admin Worker URL (<code>VITE_WORKER_URL</code>) isn&apos;t
          configured in this build, so uploads, deletion and key verification
          can&apos;t work. Follow WIRING.md steps 3 and 5, rebuild, and this
          screen unlocks. Lesson metadata can still be edited at{' '}
          <code>/admin</code> (the CMS) in the meantime.
        </p>
      </div>
    );
  }

  if (state.step === 'need-key' || state.step === 'verifying') {
    const verifying = state.step === 'verifying';
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-bold">Admin access</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Paste the admin key for this app. It&apos;s the same value that was
          set on the Cloudflare Worker (<code>ADMIN_KEY</code>) — ask the
          person who set up the system, or see WIRING.md.
        </p>
        <div className="relative mt-3">
          <input
            type={showKey ? 'text' : 'password'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Admin key"
            disabled={verifying}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-xl border border-line bg-paper py-3 pr-12 pl-4 outline-none focus:border-brand-500"
          />
          <button
            type="button"
            onClick={() => setShowKey((s) => !s)}
            aria-label={showKey ? 'Hide key' : 'Show key'}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1.5 text-ink-faint transition-colors hover:text-brand-700"
          >
            {showKey ? <IconEyeOff size={20} /> : <IconEye size={20} />}
          </button>
        </div>
        {state.step === 'need-key' && state.error && (
          <p className="mt-2 rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-danger">
            {state.error}
          </p>
        )}
        <button
          type="button"
          disabled={verifying || draft.trim().length < 8}
          onClick={() => void submit()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-brand-700 py-3 font-bold text-white transition-colors hover:bg-brand-800 disabled:opacity-40"
        >
          {verifying ? (
            <>
              <IconSpinner size={18} /> Checking key…
            </>
          ) : (
            'Verify and save key'
          )}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

export function AdminTabs() {
  const base =
    'flex-1 rounded-full py-2 text-center text-sm font-bold transition-colors';
  return (
    <div className="mb-4 flex gap-1 rounded-full border border-line bg-surface p-1">
      <NavLink
        to="/admin-tools/upload"
        className={({ isActive }) =>
          `${base} ${isActive ? 'bg-brand-700 text-white' : 'text-ink-faint'}`
        }
      >
        Upload video
      </NavLink>
      <NavLink
        to="/admin-tools/manage"
        className={({ isActive }) =>
          `${base} ${isActive ? 'bg-brand-700 text-white' : 'text-ink-faint'}`
        }
      >
        Manage videos
      </NavLink>
    </div>
  );
}

/* ------------------------------------------------------- metadata form */

export interface MetadataDraft {
  title: string;
  topic: string;
  grade: number;
  subjectId: string;
  term: number;
  durationMinutes: string; // keep as text while typing
  notes: string;
  tags: string[];
}

export function emptyMetadata(subjects: Subject[]): MetadataDraft {
  return {
    title: '',
    topic: '',
    grade: 10,
    subjectId: subjects[0]?.id ?? '',
    term: 1,
    durationMinutes: '',
    notes: '',
    tags: [],
  };
}

export function metadataProblems(d: MetadataDraft): string | null {
  if (!d.title.trim()) return 'Give the lesson a title.';
  if (!d.topic.trim()) return 'Fill in the topic (as used in class).';
  if (!d.subjectId) return 'Pick a subject.';
  const dur = Number(d.durationMinutes);
  if (!Number.isFinite(dur) || dur <= 0)
    return 'Duration must be a number of minutes, e.g. 15.';
  return null;
}

const inputCls =
  'w-full rounded-xl border border-line bg-paper px-4 py-3 outline-none focus:border-brand-500';
const labelCls = 'block text-sm font-bold text-ink-soft mb-1 mt-3';

const TAG_LABELS: Record<string, string> = {
  'exam-prep': 'Exam prep',
  'past-paper': 'Past paper',
  revision: 'Revision',
};

export function MetadataFields({
  value,
  onChange,
  subjects,
}: {
  value: MetadataDraft;
  onChange: (v: MetadataDraft) => void;
  subjects: Subject[];
}) {
  const set = <K extends keyof MetadataDraft>(
    key: K,
    v: MetadataDraft[K],
  ): void => onChange({ ...value, [key]: v });

  return (
    <div>
      <label className={labelCls}>
        Lesson title
        <input
          className={inputCls}
          value={value.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="e.g. Laws of exponents"
        />
      </label>
      <label className={labelCls}>
        Topic
        <input
          className={inputCls}
          value={value.topic}
          onChange={(e) => set('topic', e.target.value)}
          placeholder="e.g. Exponents"
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className={labelCls}>
          Grade
          <select
            className={inputCls}
            value={value.grade}
            onChange={(e) => set('grade', Number(e.target.value))}
          >
            {VALID_GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
        <label className={`${labelCls} col-span-2`}>
          Subject
          <select
            className={inputCls}
            value={value.subjectId}
            onChange={(e) => set('subjectId', e.target.value)}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className={labelCls}>
          Term
          <select
            className={inputCls}
            value={value.term}
            onChange={(e) => set('term', Number(e.target.value))}
          >
            {VALID_TERMS.map((t) => (
              <option key={t} value={t}>
                Term {t}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Length (minutes)
          <input
            className={inputCls}
            inputMode="numeric"
            value={value.durationMinutes}
            onChange={(e) => set('durationMinutes', e.target.value)}
            placeholder="15"
          />
        </label>
      </div>
      <label className={labelCls}>
        Study notes (optional, Markdown)
        <textarea
          className={`${inputCls} min-h-24`}
          value={value.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Key points students should remember…"
        />
      </label>
      <p className={labelCls}>Tags</p>
      <div className="flex gap-2">
        {VALID_TAGS.map((tag) => {
          const active = value.tags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() =>
                set(
                  'tags',
                  active
                    ? value.tags.filter((t) => t !== tag)
                    : [...value.tags, tag],
                )
              }
              className={`rounded-full border px-3.5 py-1.5 text-sm font-bold ${
                active
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-line bg-surface text-ink-soft'
              }`}
            >
              {TAG_LABELS[tag]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Usage-vs-cap progress bar shown on both admin screens. */
export function StorageBar({
  usedBytes,
  capBytes,
}: {
  usedBytes: number;
  capBytes: number;
}) {
  const fraction = capBytes > 0 ? Math.min(usedBytes / capBytes, 1) : 0;
  const pct = Math.round(fraction * 100);
  const tone =
    fraction >= 1 ? 'bg-danger' : fraction > 0.8 ? 'bg-warn' : 'bg-brand-600';
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <p className="font-bold">Video storage (Cloudflare R2)</p>
        <p className="text-sm font-bold text-ink-faint">{pct}% of free space</p>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-brand-50">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-ink-faint">
        {(usedBytes / 1e9).toFixed(2)} GB used of{' '}
        {(capBytes / 1e9).toFixed(1)} GB soft cap
      </p>
    </div>
  );
}
