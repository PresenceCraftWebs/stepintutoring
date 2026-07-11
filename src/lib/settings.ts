import { Preferences } from '@capacitor/preferences';

/*
 * Tiny key-value settings (grade choice, download-condition toggles, admin
 * key). Capacitor Preferences is the right tool here — a handful of scalar
 * values — while structured progress data lives in IndexedDB.
 */

const KEYS = {
  grade: 'sit.grade',
  subjects: 'sit.subjects',
  wifiOnly: 'sit.downloads.wifiOnly',
  chargingOnly: 'sit.downloads.chargingOnly',
  adminKey: 'sit.admin.key',
} as const;

async function get(key: string): Promise<string | null> {
  return (await Preferences.get({ key })).value;
}

async function set(key: string, value: string): Promise<void> {
  await Preferences.set({ key, value });
}

export async function getSelectedGrade(): Promise<number | null> {
  const v = await get(KEYS.grade);
  return v ? Number(v) : null;
}

export async function setSelectedGrade(grade: number): Promise<void> {
  await set(KEYS.grade, String(grade));
}

/** The subjects the student takes (their package). null = never chosen. */
export async function getSelectedSubjects(): Promise<string[] | null> {
  const v = await get(KEYS.subjects);
  if (!v) return null;
  try {
    const parsed: unknown = JSON.parse(v);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === 'string')
      : null;
  } catch {
    return null;
  }
}

export async function setSelectedSubjects(ids: string[]): Promise<void> {
  await set(KEYS.subjects, JSON.stringify(ids));
}

export async function getWifiOnly(): Promise<boolean> {
  return (await get(KEYS.wifiOnly)) !== 'false'; // default ON — data safety
}

export async function setWifiOnly(on: boolean): Promise<void> {
  await set(KEYS.wifiOnly, String(on));
}

export async function getChargingOnly(): Promise<boolean> {
  return (await get(KEYS.chargingOnly)) === 'true'; // default OFF
}

export async function setChargingOnly(on: boolean): Promise<void> {
  await set(KEYS.chargingOnly, String(on));
}

/** Shared secret sent to the admin Worker as X-Admin-Key. Device-local. */
export async function getAdminKey(): Promise<string | null> {
  return get(KEYS.adminKey);
}

export async function setAdminKey(key: string): Promise<void> {
  await set(KEYS.adminKey, key);
}

export async function removeAdminKey(): Promise<void> {
  await Preferences.remove({ key: KEYS.adminKey });
}
