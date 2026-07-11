# Step-In-Tutoring

Offline-first tutoring app for South African high-school students
(CAPS-aligned), built for [Step-In-Tutoring](https://www.facebook.com/stepintutoringza/).
Every lesson video can be **streamed and downloaded for fully offline
playback**; all infrastructure runs on free tiers; there is no database and
there are no student accounts.

```
Student device (Capacitor app, Android first; web build for everyone else)
   ├─ React UI: grade / subject / term / topic browsing + search + progress
   ├─ Player priority: local file → R2 stream → YouTube embed
   ├─ @capacitor/filesystem      offline video storage
   ├─ IndexedDB (idb)            local progress, streaks (no accounts)
   └─ Foreground download queue  Wi-Fi-only / charging-only conditions
        │
YouTube (embeds)     default lesson tier — curated public videos (with
                     attribution) + the org's own Unlisted uploads
Cloudflare R2        downloadable tier: the org's OWN recordings that need
                     offline access (learners request these in-app)
Cloudflare Worker    signed uploads · lesson edit/delete · offline-request
                     counters (KV) · triggers workflows              (worker/)
GitHub Actions       ffmpeg compression pipeline · content commits     (.github/workflows/)
YouTube (Unlisted)   manual overflow once R2 nears its free cap
GitHub repo          lesson metadata + storage manifest, edited via Sveltia CMS at /admin
Cloudflare Pages     web build (admin access + iOS/browser fallback)
```

Key docs:

- **[WIRING.md](./WIRING.md)** — one-time checklist to connect your real
  Cloudflare / GitHub / YouTube accounts (everything ships with placeholders).
- **[ADMIN-GUIDE.md](./ADMIN-GUIDE.md)** — for the non-technical person who
  runs content day-to-day.

---

## Local development

```bash
npm install
npm run dev            # compiles content, starts Vite at http://localhost:5173
```

`npm run build:content` compiles `/content/**` into `public/curriculum.json`,
`public/careers.json` and `public/storage-manifest.json`, validating
everything (unique ids, valid grade/subject/term, provider-specific fields).
It **fails the build loudly** on bad content — a broken CMS edit can't ship.

The seed content (Grades 10–11, Mathematics + Physical Sciences, Terms 1–2)
points at small openly-licensed sample MP4s so every flow — streaming,
seeking, downloading, offline playback, the YouTube tier — works before any
wiring. See "Pointing at real content" in WIRING.md.

### Scripts

| Command                 | What it does                                      |
| ----------------------- | ------------------------------------------------- |
| `npm run dev`           | dev server (web)                                  |
| `npm run build`         | content build + typecheck + production web build  |
| `npm run build:content` | compile + validate `/content` only                |
| `npx cap sync android`  | copy web build + plugins into the Android project |
| `npx cap run android`   | build & run on a connected device/emulator        |

---

## Android

The `android/` project is committed (generated with `npx cap add android`).
You need **Android Studio** (bundles the required JDK 21) or a standalone
JDK + Android SDK.

### Debug on a device

```bash
npm run build
npx cap sync android
npx cap run android        # or open in Android Studio: npx cap open android
```

### Building a signed release APK (sideload distribution)

1. **Create a signing key — once.** Keep it safe forever; losing it means
   future updates can't install over existing copies of the app.

   ```bash
   keytool -genkeypair -v -keystore stepintutoring-release.keystore \
     -alias stepintutoring -keyalg RSA -keysize 2048 -validity 10000
   ```

   Back the file up in at least two places (password manager + offline
   drive). Do **not** commit it.

2. **Tell Gradle about it.** Create `android/keystore.properties`
   (git-ignored):

   ```properties
   storeFile=/absolute/path/to/stepintutoring-release.keystore
   storePassword=YOUR_STORE_PASSWORD
   keyAlias=stepintutoring
   keyPassword=YOUR_KEY_PASSWORD
   ```

   The signing config in `android/app/build.gradle` picks this file up
   automatically (falls back to an unsigned build when it's absent).

3. **Build:**

   ```bash
   npm run build && npx cap sync android
   cd android && ./gradlew assembleRelease
   ```

   The signed APK lands at
   `android/app/build/outputs/apk/release/app-release.apk`.

4. **Distribute:** host the APK anywhere students can reach — a direct link
   (e.g. in the org's WhatsApp/Facebook), or a page on the Pages site.
   Students must allow "install from unknown sources" when prompted. Later,
   the same signed APK can go to the Play Store (one-time $25) without
   changes.

### iOS (deferred)

The code is platform-agnostic (Capacitor). When budget allows the $99/year
Apple fee: `npx cap add ios`, then the same build/sync flow via Xcode. Until
then, iPhone users use the web build on Cloudflare Pages — streaming works
for both tiers; true offline download is a known gap on the web (see
"Offline guarantees" below).

---

## Cloudflare Worker (admin API)

Full source in `worker/`. Endpoints: signed R2 upload URLs, upload-complete
(triggers compression), video deletion, YouTube overflow lessons. Auth is a
shared secret sent as `X-Admin-Key` — simple and adequate for one admin; for
a bigger team, put the Worker behind Cloudflare Access instead.

```bash
cd worker
npm install
npx wrangler login
# fill in wrangler.toml placeholders first (see WIRING.md), then:
npx wrangler secret put ADMIN_KEY
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

Local testing: `npx wrangler dev` (uses `.dev.vars` for fake secrets).

## GitHub Actions pipeline

Two workflows (fully commented):

- `.github/workflows/compress-video.yml` — pulls the raw upload from R2
  `incoming/`, compresses with ffmpeg (~480p, CRF 27, 550 kbps cap, mono
  64 kbps AAC, `+faststart`; ≈40–70 MB per 15 min), uploads to R2 `videos/`,
  writes the lesson entry + storage manifest, commits, deletes the raw file.
- `.github/workflows/content-maintenance.yml` — flags lessons whose video an
  admin deleted; commits YouTube overflow lessons.

Required **repo** secrets (Settings → Secrets and variables → Actions):
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET_NAME`. Repo pushes from the workflows use the built-in
`GITHUB_TOKEN` — no extra secret needed.

Both workflows share a `concurrency: content-writes` group so simultaneous
uploads can't race on the manifest.

## R2 bucket setup / Cloudflare Pages

See WIRING.md — it's a checklist, ~20 minutes end to end.

---

## Design decisions worth knowing

- **Progress storage: IndexedDB via `idb`** (behind the `ProgressStore`
  interface in `src/progress/`). Chosen over Capacitor Preferences because
  progress is structured per-lesson data (completions, positions,
  activity days for streaks) that we query — Preferences is a string-blob
  store and would force manual serialization of everything. IndexedDB
  behaves identically in the Android WebView and the web build. The
  interface is deliberately small, so swapping the implementation (e.g. for
  SQLite) touches one file.
- **The APK fetches fresh `curriculum.json` from the Pages URL** when online
  (falling back to a cached, then bundled copy), so new lessons reach
  students without reinstalling the app.
- **The Worker never writes to git** — all repo writes happen in GitHub
  Actions, so there's exactly one writer and no custom git code.

## Offline guarantees — the honest section

What "background download" really means per platform:

- **Android (native APK):** downloads run while the app is open (foreground
  or recently backgrounded — Android keeps the WebView alive for a short,
  OS-decided window). Queued items **persist across restarts** and resume
  automatically next time the app opens and the conditions are met. Wi-Fi
  detection uses the Network plugin; charging detection uses the WebView's
  Battery Status API. **There is no guaranteed exact-clock-time scheduling
  on Android** (Doze/App Standby decide, not us) — "download at 02:00" is
  not a promise any app can honestly make without a foreground service, so
  this app doesn't pretend to. The honest recipe for students: plug the
  phone in on Wi-Fi, open the app, queue the week's lessons, leave it open
  until the queue finishes.
- **Android playback:** fully offline once downloaded — files live in app
  storage (`Directory.Data`), no permissions needed, survive reboots,
  removed on uninstall.
- **Web build (any platform, incl. iOS Safari):** "downloads" are stored via
  the Filesystem plugin's IndexedDB fallback. This works for testing but
  browsers may evict the data under storage pressure, iOS Safari caps it
  aggressively, and large files are memory-hungry (base64). Treat web
  downloads as best-effort caching, not offline guarantees. Real iOS
  offline support needs the native iOS app.
- **YouTube-tier lessons never download anywhere** — that's the documented
  trade-off of the overflow tier, and the UI labels it clearly.
