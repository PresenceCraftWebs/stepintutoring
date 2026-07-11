# Iteration 2 — YouTube-first curation, offline requests, lesson editing

Status: PLANNED (not yet implemented). Next Claude session: implement top to
bottom, checking items off. Everything stays free-tier, no accounts, no DB.

## Philosophy shift

YouTube becomes the **default tier**, not the overflow. Tons of good
CAPS-aligned lessons already exist (public channels) — curate those instead
of re-recording. R2 uploads are reserved for (a) the org's own recordings
and (b) lessons that genuinely need offline access. Learners signal which
lessons they need offline; admins use that queue to decide what earns R2
space.

**Copyright rule (hard constraint, must be stated in ADMIN-GUIDE):** only
the org's OWN recordings may be uploaded to R2. Public YouTube videos are
used via embedding only (that's what the YouTube embed licence allows) —
never downloaded/re-hosted. "Request offline" on someone else's public video
means: record/upload the org's own version, or accept it stays online-only.

## 1. Content model (`src/content/types.ts`, build script, CMS)

- `Lesson` gains optional `attribution?: string` — channel/author credit
  shown under the player for curated public videos (e.g. "Video: Mindset
  Learn"). Validation: optional string; CMS: optional text field.
- No other schema change: `hostProvider: 'youtube'` already covers public
  and own-unlisted identically (same embed). Public-vs-own is bookkeeping,
  not behaviour → keep it out of the schema; attribution presence implies
  "not ours".

## 2. Worker (`worker/src/index.ts`, wrangler.toml)

- New **KV namespace binding `OFFLINE_REQUESTS`** (free tier: 1k writes/day,
  100k reads/day — plenty; note in WIRING.md: `npx wrangler kv namespace
  create OFFLINE_REQUESTS` + paste id into wrangler.toml).
- `POST /offline-request` — **public, no admin key** (learners call it).
  Body `{ lessonId }`. Validates id shape (`^[a-z0-9-]+$`, ≤80 chars), then
  read-increment-write `req:<lessonId>` counter (races lose a count — fine).
  Best-effort abuse guard: skip if id malformed; client dedupes per device.
- `GET /offline-requests` — admin-key gated; returns `{ lessonId: count }`
  map (KV list + gets).
- `DELETE /offline-request` — admin-key gated; body `{ lessonId }`; clears a
  counter (admin "done/dismiss").
- `POST /update-lesson` — admin-key gated; body `{ lessonId, fields }` where
  fields ⊆ { title, topic, grade, subjectId, term, durationMinutes, notes,
  tags, youtubeId, attribution }. Validates like parseMetadata, dispatches
  content-maintenance `action: update-lesson`.
- `DELETE /lesson` — admin-key gated; removes a **YouTube-tier** lesson
  entry (no R2 object involved) via content-maintenance `delete-lesson`.
  (Existing `DELETE /video` keeps handling the R2 tier: object + entry.)
- `POST /upload-complete` accepts optional `replaceLessonId` — passed to the
  compress workflow so an existing (usually YouTube) lesson is **converted
  to R2 in place**, keeping its id, order, notes and progress.

## 3. Pipeline scripts (`scripts/pipeline/`)

- `maintenance.mjs` new actions:
  - `update-lesson`: find lesson by id across files; apply field changes.
    If grade/subject/term changed → remove from old file, append to the
    correct file (order = nextOrder there). Keep id unchanged.
  - `delete-lesson`: remove entry by id (YouTube tier; no manifest change).
- `add-lesson.mjs`: when `REPLACE_LESSON_ID` env is set, replace that
  lesson's video fields in place (set hostProvider r2 + key + size, drop
  youtubeId, keep id/order/title/notes unless new metadata provided) instead
  of appending; manifest bumped as usual.
- `compress-video.yml`: pass through the new optional input.

## 4. Learner app

- **YouTube lesson player** (`LessonVideo.tsx`): under "Streams online
  only", add a **"Request offline version"** button → POST /offline-request.
  localStorage flag `sit.offlineReq.<lessonId>` so each device sends once;
  after tap: "Requested — your tutors can see this ✓" (state persists).
  Show `attribution` line when present.
- Topic/search rows: unchanged (YouTube badge already exists).

## 5. Admin app

- **Upload screen → "Add lesson"** with mode toggle, **YouTube first**:
  - Mode A "From YouTube" (default): paste full URL *or* id (parse
    `watch?v=`, `youtu.be/`, `shorts/`), plus metadata + attribution field.
    Works regardless of storage cap. Hint text: reuse good existing lessons;
    use Unlisted for own uploads; public videos need attribution.
  - Mode B "Upload video (downloadable)": existing R2 flow + storage bar +
    cap gating unchanged. Copy explains R2 is for own recordings that need
    offline access.
- **Manage screen** becomes the curation hub:
  - Lists ALL lessons (both tiers): R2 rows show size + delete
    (video+lesson, existing flow); YouTube rows show YT badge + delete
    (entry only, new endpoint).
  - **Offline requests panel** at top: lessons sorted by request count desc
    (join counts with curriculum; unknown ids ignored). Per row: count,
    "Re-host on R2" (only meaningful for own videos — jumps to Add lesson
    Mode B prefilled with the lesson's metadata + replaceLessonId), and
    "Dismiss" (clears counter). Copyright reminder shown.
  - **Edit** button per lesson → form prefilled (title, topic, grade,
    subject, term, duration, tags, notes, youtubeId/attribution when YT) →
    POST /update-lesson → "Saved — live in a few minutes."
- Storage bar stays on both screens.

## 6. CMS (`public/admin/config.yml`)

- Add optional `attribution` string field to the lesson list widget.

## 7. Docs

- **ADMIN-GUIDE.md**: new "Finding lessons on YouTube" section (curate
  public content, attribution, Unlisted for own videos, the copyright rule
  in plain language); "Offline requests" section (what the counts mean, how
  to act on them); editing lessons in-app; updated upload philosophy
  (YouTube first, R2 when offline matters).
- **WIRING.md**: KV namespace creation step.
- **README**: updated architecture note (YouTube-first, KV for request
  counts — still no traditional DB).

## Build order

types/validation → worker (KV + new endpoints; deploy) → pipeline scripts +
workflow input (test locally like before) → learner request button →
Add-lesson screen rework → Manage/curation screen + edit form → CMS field →
docs → end-to-end: add public YT lesson via URL → request offline from a
second browser profile → see count in Manage → edit its grade → verify file
move → delete it.

## Verification checklist

- `npm run build` clean; worker tsc clean; maintenance actions tested
  locally against real content files (update with file-move, delete-lesson,
  replace-mode add-lesson) with git-restore after.
- Live: /offline-request without admin key works (and only that route);
  counters visible in Manage; update-lesson run green in Actions; edited
  lesson moves file correctly and survives `build:content` validation.
