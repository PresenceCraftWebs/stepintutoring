import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // WIRING: if the org ever registers a domain, keep this appId stable anyway —
  // changing it after students have installed the APK breaks in-place updates.
  appId: 'za.org.stepintutoring.app',
  appName: 'Step-In Tutoring',
  webDir: 'dist',
  android: {
    // Videos stream over https from R2/YouTube; no cleartext traffic needed.
    allowMixedContent: false,
  },
};

export default config;
