import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { downloadManager } from '@/downloads/DownloadManager';
import { useDownloads } from '@/downloads/useDownloads';
import { batterySupported } from '@/lib/battery';
import { formatBytes } from '@/lib/format';
import {
  getChargingOnly,
  getWifiOnly,
  setChargingOnly,
  setWifiOnly,
} from '@/lib/settings';
import {
  IconBattery,
  IconSpinner,
  IconTrash,
  IconWifi,
  IconX,
} from '@/lib/icons';
import { EmptyState, Screen } from '@/components/ui';

function Toggle({
  checked,
  onChange,
  label,
  hint,
  icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
      <span className="text-brand-700">{icon}</span>
      <span className="flex-1">
        <span className="block font-bold">{label}</span>
        <span className="block text-sm text-ink-faint">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-6 accent-brand-700"
      />
    </label>
  );
}

export function DownloadsPage() {
  const snapshot = useDownloads();
  const [wifiOnly, setWifi] = useState(true);
  const [chargingOnly, setCharging] = useState(false);

  useEffect(() => {
    void getWifiOnly().then(setWifi);
    void getChargingOnly().then(setCharging);
  }, []);

  const done = snapshot.items.filter((i) => i.status === 'done');
  const active = snapshot.items.filter(
    (i) => i.status !== 'done' && i.status !== 'error',
  );
  const failed = snapshot.items.filter((i) => i.status === 'error');

  return (
    <Screen title="Downloads">
      <div className="flex flex-col gap-4">
        {/* Storage summary */}
        <div className="rounded-2xl bg-brand-700 p-4 text-white">
          <p className="text-sm font-bold text-brand-100">
            Storage used on this device
          </p>
          <p className="text-3xl font-bold">
            {formatBytes(snapshot.totalBytesUsed)}
          </p>
          <p className="mt-1 text-sm text-brand-100">
            {done.length} lesson{done.length === 1 ? '' : 's'} saved for
            offline
          </p>
        </div>

        {/* Condition toggles */}
        <section className="flex flex-col gap-2">
          <Toggle
            checked={wifiOnly}
            onChange={(v) => {
              setWifi(v);
              void setWifiOnly(v).then(() => downloadManager.poke());
            }}
            label="Wi-Fi only"
            hint="Never use mobile data for downloads"
            icon={<IconWifi size={22} />}
          />
          <Toggle
            checked={chargingOnly}
            onChange={(v) => {
              setCharging(v);
              void setChargingOnly(v).then(() => downloadManager.poke());
            }}
            label="Only while charging"
            hint={
              batterySupported()
                ? 'Wait until the phone is plugged in'
                : 'Not supported on this device — downloads run regardless'
            }
            icon={<IconBattery size={22} />}
          />
          <p className="px-1 text-xs text-ink-faint">
            Downloads run while the app is open and pick up automatically when
            you come back. Queued items wait for the conditions above — there
            is no fixed download time.
          </p>
        </section>

        {/* Active queue */}
        {active.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold">Downloading</h2>
            <div className="flex flex-col gap-2">
              {active.map((item) => (
                <div
                  key={item.lessonId}
                  className="rounded-2xl border border-line bg-surface p-4"
                >
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {item.title}
                    </span>
                    {item.status !== 'downloading' && (
                      <button
                        type="button"
                        aria-label="Cancel download"
                        onClick={() => downloadManager.cancel(item.lessonId)}
                        className="rounded-full p-1.5 text-ink-faint active:bg-line"
                      >
                        <IconX size={18} />
                      </button>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-ink-faint">
                    {item.status === 'downloading' && (
                      <>
                        <IconSpinner size={14} />
                        {Math.round(item.progress * 100)}% of{' '}
                        {formatBytes(item.expectedBytes)}
                      </>
                    )}
                    {item.status === 'queued' && 'Waiting in the queue…'}
                    {item.status === 'waiting' &&
                      (item.waitReason === 'wifi'
                        ? 'Waiting for Wi-Fi'
                        : item.waitReason === 'charging'
                          ? 'Waiting for the charger'
                          : 'Waiting for a connection')}
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-50">
                    <div
                      className="h-full rounded-full bg-brand-600 transition-[width]"
                      style={{ width: `${Math.round(item.progress * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {failed.length > 0 && (
          <section>
            <h2 className="mb-2 font-bold text-danger">Failed</h2>
            <div className="flex flex-col gap-2">
              {failed.map((item) => (
                <div
                  key={item.lessonId}
                  className="flex items-center gap-3 rounded-2xl border border-danger/30 bg-surface p-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">
                      {item.title}
                    </span>
                    <span className="block text-sm text-ink-faint">
                      Download failed — open the lesson to retry
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => downloadManager.cancel(item.lessonId)}
                    className="rounded-full p-1.5 text-ink-faint active:bg-line"
                  >
                    <IconX size={18} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Saved lessons */}
        <section>
          <h2 className="mb-2 font-bold">Saved for offline</h2>
          {done.length === 0 ? (
            <EmptyState
              title="Nothing saved yet"
              hint="Open any lesson with a download button and save it — then watch with no data, anywhere."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {done.map((item) => (
                <div
                  key={item.lessonId}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4"
                >
                  <Link
                    to={`/lesson/${item.lessonId}`}
                    className="min-w-0 flex-1"
                  >
                    <span className="block truncate font-bold">
                      {item.title}
                    </span>
                    <span className="block text-sm text-ink-faint">
                      {formatBytes(item.sizeBytes ?? item.expectedBytes)}
                    </span>
                  </Link>
                  <button
                    type="button"
                    aria-label={`Delete ${item.title}`}
                    onClick={() => void downloadManager.remove(item.lessonId)}
                    className="rounded-full p-2 text-ink-faint active:bg-line active:text-danger"
                  >
                    <IconTrash size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Screen>
  );
}
