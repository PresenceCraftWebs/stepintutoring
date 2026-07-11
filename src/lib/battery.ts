/*
 * Battery Status API wrapper. Supported by Chrome/Android WebView; not part
 * of the TS DOM lib, hence the local typing. Where the API is unavailable
 * (e.g. iOS Safari) we report "unknown" and the charging-only download
 * condition is treated as satisfied — documented honestly in the UI/README.
 */

interface BatteryManagerLike extends EventTarget {
  charging: boolean;
}

type NavigatorWithBattery = Navigator & {
  getBattery?: () => Promise<BatteryManagerLike>;
};

export function batterySupported(): boolean {
  return typeof (navigator as NavigatorWithBattery).getBattery === 'function';
}

export async function isCharging(): Promise<boolean | 'unknown'> {
  const nav = navigator as NavigatorWithBattery;
  if (!nav.getBattery) return 'unknown';
  try {
    return (await nav.getBattery()).charging;
  } catch {
    return 'unknown';
  }
}

/** Fires `cb` whenever charging state changes; returns an unsubscribe fn. */
export function onChargingChange(cb: () => void): () => void {
  const nav = navigator as NavigatorWithBattery;
  if (!nav.getBattery) return () => undefined;
  let battery: BatteryManagerLike | undefined;
  let disposed = false;
  void nav.getBattery().then((b) => {
    if (disposed) return;
    battery = b;
    b.addEventListener('chargingchange', cb);
  });
  return () => {
    disposed = true;
    battery?.removeEventListener('chargingchange', cb);
  };
}
