# WIRING.md — connecting your real accounts

Everything in this repo ships with clearly-marked placeholders. This is the
one-time checklist (~20–30 minutes) to wire in the org's real **GitHub**,
**Cloudflare**, and **YouTube** accounts. Do the steps in order — later steps
use values from earlier ones.

Keep a scratch note while you go; you'll collect these values:

| Value                        | You get it in step | Example                                  |
| ---------------------------- | ------------------ | ---------------------------------------- |
| GitHub repo (`owner/name`)   | 1                  | `step-in-tutoring/app`                   |
| Cloudflare account id        | 2                  | `023e105f4ecef8ad9ca31a8372d0c353`       |
| R2 bucket name               | 2                  | `sit-videos`                             |
| R2 public URL                | 2                  | `https://pub-….r2.dev`                   |
| R2 API token key id + secret | 2                  | —                                        |
| Admin key (you invent it)    | 3                  | output of `openssl rand -hex 24`         |
| GitHub fine-grained PAT      | 3                  | `github_pat_…`                           |
| Worker URL                   | 3                  | `https://sit-admin.….workers.dev`        |
| Pages URL                    | 4                  | `https://step-in-tutoring.pages.dev`     |

---

## 1. GitHub repo

1. Create a **public** repo (public = unlimited free Actions minutes for the
   compression pipeline; the videos themselves are never in the repo).
2. Push this project to it:

   ```bash
   git remote add origin https://github.com/OWNER/REPO.git
   git push -u origin main
   ```

3. Repo → Settings → Actions → General → Workflow permissions →
   **Read and write permissions** (the pipeline commits lesson metadata).

## 2. Cloudflare R2 (video storage)

1. Cloudflare dashboard → **R2** → enable it (free plan) → **Create bucket**,
   name it `sit-videos` (or your own name — then also change `bucket_name` /
   `R2_BUCKET_NAME` in `worker/wrangler.toml`).
2. Bucket → **Settings → Public access → R2.dev subdomain → Allow**. Copy the
   `https://pub-….r2.dev` URL. (Optional but recommended later: connect a
   custom domain instead — r2.dev is rate-limited and fine for a small pilot,
   a custom domain is production-grade. Both stay free.)
3. Add a CORS policy so the app can stream and the admin can upload (bucket →
   Settings → CORS policy):

   ```json
   [
     {
       "AllowedOrigins": ["*"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 86400
     }
   ]
   ```

4. R2 → **API tokens** (Manage API tokens) → Create token →
   **Object Read & Write**, scoped to your bucket. Copy the **Access Key ID**
   and **Secret Access Key**.
5. Your **account id** is in the dashboard's right sidebar (or the URL).

Now set the four **GitHub repo secrets** (repo → Settings → Secrets and
variables → Actions → New repository secret):

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

## 3. The admin Worker

1. Create a **fine-grained GitHub PAT** (GitHub → Settings → Developer
   settings → Fine-grained tokens): repository access = only your repo;
   permissions = **Actions: Read and write**. Copy it.
2. Invent the **admin key**: `openssl rand -hex 24` (or any long random
   string). This is what the admin types into the app once.
3. Edit `worker/wrangler.toml` — replace `R2_ACCOUNT_ID`, `GITHUB_REPO`, and
   (if renamed) the bucket name.
4. Deploy:

   ```bash
   cd worker
   npm install
   npx wrangler login
   npx wrangler secret put ADMIN_KEY            # paste the admin key
   npx wrangler secret put R2_ACCESS_KEY_ID     # from step 2
   npx wrangler secret put R2_SECRET_ACCESS_KEY # from step 2
   npx wrangler secret put GITHUB_TOKEN         # the PAT from step 3.1
   npx wrangler deploy
   ```

   Note the deployed URL, e.g. `https://sit-admin.YOUR-SUBDOMAIN.workers.dev`.
   Check it's alive: `curl https://…workers.dev/health` → `{"ok":true}`.

## 4. Cloudflare Pages (web build + content refresh for the APK)

1. Dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick
   your repo.
2. Build settings: build command `npm run build`, output directory `dist`.
3. Environment variables (Production): the three `VITE_…` values below.
4. Deploy → note the URL, e.g. `https://step-in-tutoring.pages.dev`.

## 5. App environment (.env.production)

Create `.env.production` in the repo root (and set the same three values in
the Pages build environment):

```bash
VITE_R2_PUBLIC_URL=https://pub-XXXX.r2.dev          # step 2
VITE_WORKER_URL=https://sit-admin.XXXX.workers.dev  # step 3
VITE_CONTENT_BASE_URL=https://step-in-tutoring.pages.dev  # step 4
```

`VITE_CONTENT_BASE_URL` is what lets sideloaded APKs pick up new lessons
without a reinstall — the app refreshes `curriculum.json` from there.

Rebuild + resync Android after setting these (`npm run build && npx cap sync
android`), then build the release APK (README).

## 6. CMS sign-in (Sveltia)

1. Deploy Sveltia's tiny OAuth Worker once:
   <https://github.com/sveltia/sveltia-cms-auth> (Deploy-to-Cloudflare
   button). It needs a **GitHub OAuth App** (GitHub → Settings → Developer
   settings → OAuth Apps → New):
   - Homepage URL: your Pages URL
   - Callback URL: `https://YOUR-sveltia-cms-auth.workers.dev/callback`
   - Put the app's Client ID/Secret into the auth Worker's variables (its
     README shows the two `wrangler secret put` commands).
2. Edit `public/admin/config.yml`: set `backend.repo` and
   `backend.base_url` (the auth Worker URL).
3. Commit, push, wait for Pages to rebuild → open
   `https://YOUR-PAGES-URL/admin` → Sign in with GitHub.

## 7. YouTube (overflow tier — no code wiring)

Nothing to configure in code. Make sure the org has a YouTube channel it
controls, and that whoever does uploads can sign in to
**studio.youtube.com**. Videos must be **Unlisted** (ADMIN-GUIDE.md explains
this to the admin).

## 8. Smoke test the whole pipeline

1. Open the deployed Pages site → bottom of Home → **Tutor / admin tools** →
   enter the admin key.
2. Upload a *small* test video (e.g. 30 seconds) with dummy metadata.
3. Watch: repo → **Actions** → "Compress video" run goes green in a few
   minutes → a commit appears → Pages rebuilds → the lesson shows in the app,
   streams, and downloads.
4. **Manage videos** → delete the test video → "Content maintenance" run goes
   green → the lesson shows under "Needs attention".
5. Delete the test lesson entry entirely at `/admin` (CMS) if you like.

## Pointing seeds at real content

The seed lessons in `content/lessons/*.yml` use full sample-video URLs in
`r2VideoKey` (an escape hatch the player honours). Real lessons use R2 object
keys (`videos/….mp4`) written by the pipeline. When you're ready:

- delete the seed files (or edit them in the CMS) and upload real lessons
  through the app, **or**
- keep any seed lesson by re-uploading its video through the Upload screen
  and deleting the old entry.

Also replace `content/careers/*.md` with the org's real career-advice
articles (editable at `/admin`), and update `subjects.json` colours/names if
desired.
