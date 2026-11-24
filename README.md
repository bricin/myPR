# myPR

A minimal, mobile-first, offline-friendly lifting PR tracker. Direct entry of lift, weight in pounds, sets, reps, and an optional date. No workouts, ads, analytics, accounts, cloud integrations, dependencies, or build step. History stays on the device; JSON files provide portable backups.

## Run locally

Use Node.js 20 or newer, then run:

```sh
npm start
```

Open **http://localhost:5173**. Changes to app files reload the preview automatically; server changes restart it. Unsaved form input resets on reload, while saved lifts remain. Offline caching is disabled on localhost so changes appear immediately. Run `npm test` for calculation, date, recent-window, merge, backup, and storage-failure checks. Stop the server with Control-C.

## Hosting and installation

Live app: **https://bricin.github.io/myPR/**

GitHub Pages publishes from the root of `main`. `.nojekyll` makes it a plain static site, with no build step or online npm server. Pushes to `main` publish automatically. Other HTTPS static hosts work too; deploy the root app files. `tools/` and `tests/` are only for development. Subdirectory hosting is supported. Never publish personal backup files.

The local preview is accessible only from your computer. A phone needs the HTTPS URL. Open it once online, then install through Safari → Share → Add to Home Screen on iPhone, or the browser's Install app menu on Android. The installed app works offline after its initial cache completes. Do not open index.html through a file:// URL.

Localhost and the hosted app have separate browser storage. Move history with a backup. An installed PWA and a browser tab can also have separate storage on some platforms.

## Settings and welcome panel

Settings has its own screen at `#settings`, with Back to lifts and browser Back navigation. The shaded welcome panel has a Dismiss button, remembered on this device. Future announcements can use a new announcement ID without restoring a dismissed welcome message.

## Recent records

Settings → Recent records → Recent window controls a rolling calendar-day window, default **365 days**. Allowed values are 1–3,650 whole days; the preference is stored on each device. A 365-day window includes today and the preceding 364 dates. Future-dated entries are excluded from recent metrics. The performed-on date is used, with the local creation date as the fallback for old entries.

The record book shows **Recent 1RM** (the highest actual single or Epley/Brzycki estimate from 2–10 reps in that window) and **Recent PR** (the heaviest performed lift at the selected rep count). Each number shows its source lift/date. Select the PR rep count independently for each lift; when first shown it defaults to the lowest recent rep count. Higher-rep performances can earn rep PRs without contributing a 1RM estimate. Ties use the most recent lift date. Missing recent data shows an empty state, never an old all-time fallback. The history filter applies to recent summaries too.

The percentage chart defaults to Recent 1RM for a new installation, with all-time actual and estimated alternatives. An existing saved basis choice remains selected. Changing formula or the recent window recalculates derived values without changing stored lift records. All-time PR badges remain separate. Recent windows are a product preference, not a physiological decay model; estimates assume an effort representative of capacity.

## Calculations

- **Actual 1RM:** highest recorded weight with reps = 1, regardless of the sets field.
- **Estimated 1RM:** highest estimate among entries with 2–10 reps. Epley: `weight × (1 + reps / 30)`. Brzycki: `weight × 36 / (37 − reps)`. Sets do not affect the estimate.
- Entries with 11–100 reps remain in history, excluded from estimated PRs. A single is always its actual weight; estimates never inflate it.
- Actual and estimated PRs are tracked separately per case-insensitive, trimmed lift name. Changing formula recalculates all estimated milestones. A tied best is not a new PR. The first qualifying entry is a PR.
- Percentage chart uses the explicitly selected actual or estimated best, at 50–105% in 5% steps. Rounding is to nearest 2.5, 5, or 10 **total** pounds (not each side), with halfway values rounded up. Displayed estimates use one decimal; percentages use the unrounded estimate.

## Data and backups

Records use immutable UUIDs and UTC creation timestamps. The optional lift date is stored as a calendar date, unchanged across time zones; blank means today on the device at save time. Old backups without a lift date continue to work. History and milestones use the lift date. Entries are currently append-only; editing/deletion is outside this version.

Settings → Save backup to Files exports a JSON file. Choose **iCloud Drive** in Files/Finder if you want that file stored in iCloud. Browsers without a share/save dialog download it; move the file yourself. This is manual backup, not automatic iCloud syncing. The app cannot verify whether iCloud has finished uploading a shared file.

Restore backup validates the complete file and merges records without duplicates or erasing history. Conflicting contents for the same ID stop the import. The internal backup format remains `pr-pocket` version 1 for compatibility with earlier exports; the product is named myPR. Preferences are device-local and aren't included in backups.

## Storage, privacy, and updates

History is stored in one atomic localStorage document. Web Locks serialize saves across tabs where supported; use one tab on older browsers. Storage/quota failures are shown, and unreadable stored history is never silently cleared. Browser persistence is requested after saves but is not guaranteed. Clearing browser data, private browsing, device eviction, changing origin, or removing the installed app may remove local history. Keep backups.

History and backup files are plaintext. There are no external scripts, account connections, remote data writes, or telemetry. Serve over HTTPS. Cloud storage decisions are deferred while the UI is developed.

The service worker caches the app shell. Increment CACHE in sw.js for changes and publish files together. After a new worker installs, close all app windows/tabs and reopen to activate it. Updating the app shell doesn't clear saved history.

## Verification

Automated checks cover formulas, rounding, dates, recent-window boundaries, future dates, rep PRs, tie handling, duplicate/conflicting imports, backup compatibility, durable merges, quota failures, and corrupt storage. Test installed offline behavior on the HTTPS deployment. File backup and restore should be tested on the intended phone; iCloud upload is handled by the operating system.
