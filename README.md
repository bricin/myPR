# myPR

A minimal, mobile-first, offline-friendly weightlifting PR PWA. Direct entry of lift, total weight in pounds, sets, and reps. No workouts, ads, analytics, app accounts, paid services, dependencies, or build step. Google authorization is optional until you want Sheets sync.

## Run locally

Install Node.js 20 or newer, open a terminal in this directory, and run:

```sh
npm start
```

Open **http://localhost:5173**. Save a lift immediately; no credentials needed. The development server reloads the page automatically when app files change and restarts itself when server code changes. No manual npm restart is needed for normal edits. Unsaved form input resets on reload; saved lifts remain. Offline caching is disabled on localhost so changes appear immediately; test PWA offline behavior on an HTTPS deployment. Run `npm test` for calculation, validation, merge, backup, storage-failure, and mocked Sheets API checks. Stop the server with Control-C.

## GitHub Pages

Live app: **https://bricin.github.io/myPR/**

GitHub Pages publishes directly from the root of `main`. `.nojekyll` keeps this a plain static site. Pushes to `main` publish automatically; no build command or npm server is needed online.

For Google sync, add **`https://bricin.github.io`** (without `/myPR/`) to your OAuth client's Authorized JavaScript origins. Then enter your existing client ID in the hosted app's Settings. Browser storage is separate for the localhost preview and the hosted app; restore a backup or connect the same Google Sheet to bring your history across.

## Put it on your phone

Deploy the files in this directory to an HTTPS static host (for example GitHub Pages, Netlify, Cloudflare Pages, or an existing web server). No install or build command is needed. The publish directory is this directory, containing `index.html`. `tools/` and `tests/` are only for local development and can be omitted. Subdirectory hosting works. Do not open `index.html` as a `file://` URL.

The local server binds to your computer's loopback interface, so its localhost URL is for desktop preview. A phone needs the HTTPS deployment URL. Do not put personal backups in your hosted source directory.

Open the HTTPS URL once online. On iPhone, open in Safari and use Share → Add to Home Screen. On Android, use the browser's Install app / Add to Home screen menu. The app shell, calculations, history, and JSON backup/restore work offline after the service worker installs. Google authorization and sync require connectivity. Reload after the first visit before testing airplane mode.

## Google Sheets setup (optional)

Only a **public OAuth client ID** is needed. No client secret, API key, service account, shared password, Apps Script deployment, or access token needs to be sent to anyone.

1. In [Google Cloud Console](https://console.cloud.google.com/), create/select a project and enable **Google Sheets API**.
2. Configure Google Auth Platform / OAuth consent: set an app name and your contact email. For personal development choose External / Testing and add your own Google email as a test user (or Internal if appropriate for your Workspace organization).
3. Add the scope `https://www.googleapis.com/auth/drive.file` under Data Access. This grants access to files this app creates or files explicitly granted to it, rather than every spreadsheet in your account.
4. Create an OAuth client with type **Web application**. Add your exact deployment origin to **Authorized JavaScript origins**, e.g. `https://example.com`. For local preview also add `http://localhost:5173`. An origin has no path; Google does not accept arbitrary non-localhost HTTP origins. The token popup flow does not require an app redirect endpoint.
5. Copy the client ID ending in `.apps.googleusercontent.com`. In myPR → Settings, paste it and save. Leave Spreadsheet ID empty for the first device.
6. Tap **Authorize Google & sync** and consent. If the Google library was still loading, tap again when prompted. The app creates a private spreadsheet named **myPR**, with a **PRs** tab and a seven-column header. It saves the spreadsheet ID in Settings. Open spreadsheet lets you inspect it directly.
7. On a second device use the **same OAuth client ID and same Google account**, then paste the first device's spreadsheet ID into Settings before authorizing. The ID is between `/d/` and `/edit` in its URL. It is not a secret. Pasting an arbitrary existing spreadsheet ID does not grant access under `drive.file`; use the spreadsheet this app created.

Google may require testing-user configuration, renewed consent, organization approval, or verification for broader distribution. Testing mode is suitable for personal setup; review Google's publishing requirements if you distribute your OAuth application. If authorization fails, verify the origin, test user, API enablement, and browser popup/content-blocking settings. 403/404 usually means missing API permission, wrong account/client, or an inaccessible spreadsheet.

The token stays in memory only, expires, and is discarded when the page closes. After expiry/relaunch, tap Authorize Google again. Saves automatically sync while the page is open, online, and authorized; reconnecting and returning to the app also triggers a sync. There is no unattended background sync or refresh-token server. Disconnect clears the in-memory token; revoke the app through your Google Account's third-party access settings to remove Google's grant entirely.

### Sheet schema and sync behavior

The `PRs!A:G` header is:

```text
id | lift | weight_lb | sets | reps | created_at | performed_on
```

Records have immutable UUIDs and UTC ISO creation timestamps. New entries also store `performed_on` as a local calendar date (`YYYY-MM-DD`), so a chosen date stays the same across time zones. Leave the optional Date field blank to use today on the device at save time. History and PR milestones use the lift date, so backdated entries appear in the right order. Existing six-column sheets are upgraded automatically by adding only the `performed_on` header in G1; legacy entries retain their original timestamp and remain compatible with old backups. Sync reads and validates all remote records, merges them into durable local storage, then appends locally missing IDs. Sheets writes use `RAW`, so lift names cannot execute as formulas. Local changes are saved before network calls. Failed or timed-out syncs can be retried; the next read checks IDs before uploading. Web Locks serialize saves and syncs among tabs on the same origin where supported. Use one tab on older browsers without Web Locks.

Two independent devices can still append the same imported ID concurrently, or a late response after a timeout can cause a duplicate physical row. Reads collapse identical IDs, so app history remains deduplicated; conflicting contents for the same ID stop sync rather than overwriting data. This is an append-only personal log, not a transactional multi-user database. Do not rename the tab/header or edit/delete existing record rows. A missing tab or malformed row stops sync with an error. A completely empty `PRs` tab is initialized automatically. Removing a row from Sheets does not delete it locally; it will be reuploaded. Entry editing/deletion is intentionally outside this minimal version.

New records added during sync schedule another pass. Records imported from Sheets are persisted locally before uploads. Records from different Google connections are not partitioned: changing the target spreadsheet intentionally syncs this device's entire history to the new target. Keep separate browser profiles for separate people's data. The sheet itself remains private unless you share it in Google.

## iCloud Drive backup and restore

Browser storage is **not** synced by iCloud. This PWA cannot access CloudKit or silently write iCloud Drive files. iCloud support here is a portable, manual file workflow:

1. Settings → **Save backup to Files**.
2. On iPhone/iPad, use the share sheet's **Save to Files**, then choose **iCloud Drive**. On desktop, choose an iCloud Drive folder in the save dialog. Browsers without file sharing/save dialogs download a JSON file; move it to iCloud Drive using Files/Finder.
3. On another device, Settings → **Restore backup**, browse iCloud Drive, and choose that JSON file.

Restore validates the entire backup, merges UUIDs, and does not duplicate existing entries. It does not replace or erase history. Canceling a save/share does not change records. The web app can report handing off a file but cannot verify that iCloud finished uploading it. Backups contain history only, not OAuth tokens or connection settings. Keep a separate copy before changing devices or clearing browser data. Native automatic iCloud sync would require an Apple developer/CloudKit setup or a native companion app; neither is needed here.

## Settings

Settings opens as its own screen at `#settings`, with a Back to lifts button and browser Back navigation. The lift form, headline, and history are hidden while settings is open.

## Headline

The welcome headline sits inside a shaded panel with a visible Dismiss button. Dismiss it to reclaim space. The choice is remembered on this device. Announcements have a version ID so a future announcement can appear independently of the dismissed welcome message.

## Calculations

- **Actual 1RM:** highest recorded weight with reps = 1, regardless of the sets field.
- **Estimated 1RM:** highest estimate among entries with 2–10 reps. Epley: `weight × (1 + reps / 30)`. Brzycki: `weight × 36 / (37 − reps)`. Sets do not affect the estimate.
- Entries with 11–100 reps remain in history, excluded from estimated PRs. A single is always its actual weight; estimates never inflate it.
- Actual and estimated PRs are tracked separately per case-insensitive, trimmed lift name. Changing formula recalculates all estimated milestones. A tied best is not a new PR. The first qualifying entry is a PR.
- Percentage chart uses the explicitly selected actual or estimated best, at 50–105% in 5% steps. Rounding is to nearest 2.5, 5, or 10 **total** pounds (not each side), with halfway values rounded up. Displayed estimates use one decimal; percentages use the unrounded estimate.

## Storage, privacy, and offline limits

History is stored in one atomic localStorage document. Writes merge the latest durable state and fail visibly when storage is unavailable/full; malformed stored records are not silently cleared. Browser persistence is requested after a save but is not guaranteed. Private browsing, clearing site data, OS eviction, changing origin, or removing an installed app can remove local history. A website and its installed PWA can have separate storage on some platforms: restore a backup or connect the same Sheet to reconcile them. History is plaintext on your device, in backups, and in your private Google Sheet, with Google tokens held only in memory. Use device/account security appropriate for your data.

The only external script is Google's authorization library, loaded when opening Settings or connecting. It is not cached for offline use. No Google API responses or bearer tokens are cached by the service worker. The app has no remote database other than your chosen Google Sheet and no telemetry. Serve over HTTPS; don't add untrusted scripts. OAuth client IDs belong in browser code; client secrets do not.

The service worker caches the static app shell. For updates, increment `CACHE` in `sw.js`, deploy all changed files together, then close all tabs/installed windows and reopen after the new worker installs. The old shell remains consistent until the waiting worker activates. Record storage uses a separate key and survives cache upgrades.

### Why no Apps Script endpoint?

Apps Script is convenient for scripts operating inside a spreadsheet, but an execute-as-owner web endpoint exposed to anonymous callers would grant outsiders a path to the owner's data unless authorization is implemented correctly. A password embedded in the PWA would not be private. Restricted deployments also add Google login/redirect/CORS considerations for a separate static PWA. This implementation uses Google's supported browser OAuth token model and authenticated Sheets REST calls instead. There is no unauthenticated write endpoint and no proxy owning your spreadsheet credentials.

Official references: [Google token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [OAuth client setup](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid), [Sheets scopes](https://developers.google.com/workspace/sheets/api/scopes), [Sheets values API](https://developers.google.com/workspace/sheets/api/guides/values), and [Apps Script web apps](https://developers.google.com/apps-script/guides/web).

## Verification

`npm test` covers formulas, rounding, invalid values, duplicate/conflicting imports, backup versions, durable merges, quota failures, corrupt storage, and mocked authenticated Sheets reads/writes and expiry. These tests do not prove live Google account consent or iCloud upload. Complete a live roundtrip after configuring your own OAuth client: save a lift → sync → see its row in Sheets → authorize on a second device → sync → see the same lift; test airplane-mode entry and reconnect as well. For backup, save to iCloud and restore the file on a second device.
