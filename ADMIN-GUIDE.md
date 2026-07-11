# Step-In Tutoring — Admin Guide

This guide is for the person who adds lessons and looks after content. No
technical background needed. If something here doesn't work, contact the
person who set up the system (there's a Troubleshooting section at the end).

---

## The one-minute overview

- Lesson **videos** live in cloud storage called **R2**. We get about
  **10 GB free** — roughly **150–250 lessons**. Lessons stored here can be
  **downloaded by students and watched offline**, which is the whole point of
  the app.
- When R2 gets close to full, new lessons go to **YouTube (Unlisted)**
  instead. YouTube lessons **stream online only** — students can't download
  them. That's the trade-off, and it's why R2 is the default.
- Lesson **details** (titles, notes, order) live in a content editor at
  **`/admin`** on the app's website.
- The **in-app admin tools** (open the app → scroll to the bottom of Home →
  "Tutor / admin tools") are where you upload videos and manage storage.

You'll need the **admin key** the first time you open the in-app tools — ask
your technical contact for it. Enter it once per device; it's remembered.

---

## Adding a lesson the normal way (R2)

**What to record/export:** the *raw* video — the file exactly as it comes
from your camera, phone, or screen recorder. Don't compress it, convert it,
or run it through WhatsApp first (WhatsApp destroys the quality). Big files
are fine — the system compresses automatically.

**Tip for better lessons:** record in **5–15 minute chunks**, one idea per
video. Students on phones finish short lessons far more often than one-hour
recordings, and shorter videos are cheaper for them to download.

**Steps:**

1. Open the app → Home → **Tutor / admin tools** → **Upload video**.
2. Check the storage bar at the top. Green/under ~80%: carry on. If it's
   full, the screen will switch to the YouTube path automatically (see
   below).
3. Choose the raw video file (or drag it in, on a computer).
4. Fill in the lesson details — title, topic (use the same topic names as
   the CAPS curriculum so lessons group nicely), grade, subject, term,
   length in minutes, optional notes and tags.
5. Tap **Upload and publish**. Keep the app open while the raw file uploads —
   a progress bar shows how far it is. On a slow connection a big file can
   take a while; uploading from a computer on Wi-Fi is easiest.
6. When you see **"Uploaded — now processing"**, you're done. Behind the
   scenes the system compresses the video and publishes the lesson.

**How long does processing take?** Roughly the length of the video itself —
a 15-minute lesson takes about 10–20 minutes to appear. It shows up in the
app automatically; students don't need to reinstall anything.

---

## When R2 is full: the YouTube path

When the storage bar reaches the cap, the Upload screen changes and asks you
to use YouTube instead:

1. Go to **studio.youtube.com** (sign in with the org's YouTube account).
2. Upload the video there.
3. Set visibility to **Unlisted**. ⚠️ **Not Private!** Private videos will
   not play in the app at all. Unlisted means "anyone with the link can
   watch, but it's not searchable" — that's what we want.
4. Copy the **video id** — the part of the link after `watch?v=`, eleven
   characters, e.g. in `youtube.com/watch?v=aqz-KE-bpKQ` the id is
   `aqz-KE-bpKQ`.
5. Back in the app, paste the id, fill in the same lesson details, submit.

The lesson appears in the app within a few minutes, labelled "streams online
only".

**Want to make room so future lessons stay downloadable?** Delete an older
video from R2 (next section), re-upload that one to YouTube, and give it its
YouTube id in the content editor. Good candidates: lessons for terms that
are long finished.

---

## Manage videos: freeing space

Open **Tutor / admin tools → Manage videos**. You'll see the storage bar and
every R2-hosted lesson with its size.

- Tap the bin icon → confirm. The video file is deleted from R2 immediately
  and the space is freed.
- The **lesson is not deleted** — it moves to a "Needs attention" list and
  shows as unavailable to students, with a friendly message. Fix it by
  either re-uploading the video (Upload screen) or adding a YouTube id to
  that lesson in the content editor at `/admin`.
- Seed/sample lessons that came with the app say "sample URL (not in R2)" —
  there's nothing to delete for those.

---

## Editing lesson details (the content editor at /admin)

Open `https://YOUR-SITE.pages.dev/admin` in a browser (computer is
comfortable, phone works). Sign in with GitHub when asked.

- **Lessons** are grouped in files like *grade-10-mathematics-term-1*. Open
  one to edit titles, notes, tags, or to **drag lessons into a new order**
  (after dragging, update each lesson's "order" number to match the new
  positions — the app sorts by that number).
- **Fixing a "needs attention" lesson with YouTube:** open the lesson, set
  *Video host* to YouTube, paste the *YouTube video id*, untick *Video
  removed*, save.
- **Subjects** (names, colours) and **Career Corner articles** have their own
  sections.
- Every save publishes automatically after a few minutes.

Don't change a lesson's **id** — students' progress and downloads are linked
to it.

---

## Troubleshooting

**A lesson has been "processing" for hours and never appeared.**
Usually the compression job failed partway. Tell your technical contact to
check the **GitHub Actions** page of the project — the failed run says
exactly what went wrong. It's safe to simply upload the same video again in
the meantime; a failed run publishes nothing, so you won't get duplicates.

**A YouTube lesson shows "This video isn't available."**
Nine times out of ten the video is set to **Private** instead of
**Unlisted**. Open studio.youtube.com → Content → find the video →
Visibility → change to Unlisted. The other cause: the video id was pasted
wrong (it must be exactly 11 characters, no extra spaces, not the whole URL).

**An R2 lesson shows "This video isn't available."**
Was the video deleted in Manage videos? It'll be under "Needs attention" —
re-upload it or give it a YouTube id. If not, check the phone actually has
internet (R2 lessons that aren't downloaded still need data to stream).

**The upload progress bar stalls or the app says the upload failed.**
Slow or dropped connection. Try again on solid Wi-Fi — nothing half-finished
is published, so retrying is always safe. Very large files (>5 GB) are
rejected; export the recording at a lower quality and upload that.

**The in-app admin tools say "Unauthorized" or "No admin key".**
The admin key on your device is missing or wrong. Get the current key from
your technical contact and enter it again (Home → Tutor / admin tools).

**The storage bar looks wrong (e.g. says full when it shouldn't be).**
The number lives in a small file the pipeline updates automatically. Your
technical contact can correct it at `/admin` → *Subjects & storage* →
*Storage manifest*.

**I deleted a video by mistake.**
The file itself is gone from R2, but nothing else broke: the lesson is
sitting in "Needs attention". Re-upload the original recording (you kept a
copy of raw footage, right? — always keep your recordings backed up, e.g. on
a hard drive or Google Drive) and it's as if nothing happened.

---

## Golden rules

1. **Keep your raw recordings backed up somewhere else.** R2 is hosting, not
   backup.
2. **Unlisted, never Private** on YouTube.
3. **Short videos win** — 5–15 minutes, one idea each.
4. **Don't change lesson ids.**
5. When in doubt, nothing you do in the admin tools can silently destroy a
   lesson — the system flags problems instead of hiding them.
