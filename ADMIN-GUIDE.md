# Step-In-Tutoring — Admin Guide

This guide is for the person who adds lessons and looks after content. No
technical background needed. If something here doesn't work, contact the
person who set up the system (there's a Troubleshooting section at the end).

---

## The one-minute overview

- **Start on YouTube.** Lots of excellent CAPS-aligned lessons already exist
  on public channels — curate those instead of re-recording (credit the
  channel in the Attribution box). Our own recordings also go on YouTube by
  default, as **Unlisted** uploads. YouTube lessons stream online only.
- **Upload to R2 when offline matters.** R2 is our cloud storage (about
  **10 GB free** ≈ 150–250 lessons). R2 lessons can be **downloaded and
  watched offline** — reserve that space for our own recordings that
  learners really need offline.
- **Learners tell you what they need.** A "Request offline version" button
  on YouTube lessons feeds a counter you'll see in **Manage lessons** — use
  it to decide what earns R2 space.
- Lesson **details** are editable in the app (Manage lessons → Edit) or in
  the content editor at **`/admin`** on the website.
- The **in-app admin tools** (Home → "Tutor / admin tools") are where you
  add lessons, edit them, and manage storage.

**⚠️ The copyright rule (please never break it):** only **our own
recordings** may be uploaded to R2. Other people's YouTube videos are used
by *embedding* only — that's what YouTube allows. Never download someone
else's video and re-upload it, to R2 or anywhere. If learners request an
offline version of a public video: record our own version of that lesson, or
let it stay online-only.

You'll need the **admin key** the first time you open the in-app tools — ask
your technical contact for it. Enter it once per device; it's remembered.

---

## Adding a lesson from YouTube (the usual way)

1. Find the video: a good public lesson (search YouTube for the CAPS topic +
   grade — channels like Mindset run full curricula), or upload our own
   recording at **studio.youtube.com** with visibility **Unlisted**
   (⚠️ not Private — Private won't play in the app).
2. In the app: **Tutor / admin tools → Add lesson → From YouTube** (the
   default tab).
3. Paste the video **link** (the whole URL is fine — the app finds the id).
4. Public video? Put the channel name in **Attribution** — it shows as
   "Video: … (YouTube)" under the player. Our own video? Leave it empty.
5. Fill in the lesson details and submit. Live in a few minutes.

## Offline requests: hearing your learners

YouTube lessons show learners a **"Request offline version"** button. Each
tap adds to a counter you'll see at the top of **Manage lessons**, sorted by
demand. For each requested lesson you can:

- **Re-host on R2** (only offered for our own videos): jumps to the upload
  form pre-filled — upload our raw recording and the lesson becomes
  downloadable *in place*, keeping learners' progress.
- **Dismiss**: clears the counter (e.g. it's someone else's video and we're
  not recording our own version yet).

## Editing a lesson after it's published

**Manage lessons → Edit** on any lesson: change the title, topic, grade,
subject, term, length, tags, notes — and for YouTube lessons the video link
and attribution. Moving a lesson to another grade/subject/term is fine; it
slots in at the end of that term's list. Changes go live within a few
minutes. (The lesson's *id* never changes, so learner progress is safe.)

## Uploading a video to R2 (downloadable lessons)

**What to record/export:** the *raw* video — the file exactly as it comes
from your camera, phone, or screen recorder. Don't compress it, convert it,
or run it through WhatsApp first (WhatsApp destroys the quality). Big files
are fine — the system compresses automatically.

**Tip for better lessons:** record in **5–15 minute chunks**, one idea per
video. Students on phones finish short lessons far more often than one-hour
recordings, and shorter videos are cheaper for them to download.

**Steps:**

1. Open the app → Home → **Tutor / admin tools** → **Add lesson** → the
   **"Upload video (downloadable)"** tab.
2. Check the storage bar at the top. Green/under ~80%: carry on. If it's
   full, uploads pause — free space in Manage lessons or use YouTube.
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

## When R2 is full

When the storage bar reaches the cap, R2 uploads pause. Free space in
Manage lessons (delete old downloadable lessons — consider re-adding them as
YouTube lessons first), or simply keep adding lessons via the YouTube tab:

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

- Tap the bin icon → confirm. The video is deleted from storage immediately
  and the space is freed.
- **The lesson is deleted with it** — title, notes and all. It disappears
  from students' apps within a few minutes, so nobody ever sees a broken
  lesson. This cannot be undone, which is why golden rule #1 exists: keep
  your raw recordings backed up. To bring a lesson back, upload the
  recording again (or add it as a YouTube lesson).
- Seed/sample lessons that came with the app say "sample URL (not in R2)" —
  there's nothing to delete for those (remove them in the content editor at
  `/admin` instead).

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
The lesson and its video are gone from the app — deletion is permanent.
Re-upload the original recording through the Upload screen (you kept a copy
of your raw footage, right? — always keep recordings backed up, e.g. on a
hard drive or Google Drive) and fill in the details again; within about half
an hour it's back as if nothing happened.

---

## Golden rules

1. **Keep your raw recordings backed up somewhere else.** R2 is hosting, not
   backup.
2. **Unlisted, never Private** on YouTube.
3. **Short videos win** — 5–15 minutes, one idea each.
4. **Don't change lesson ids.**
5. When in doubt, nothing you do in the admin tools can silently destroy a
   lesson — the system flags problems instead of hiding them.
