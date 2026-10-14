# Hosting, origin transition, and offline assessment

> **Historical and preparatory.** Written before a host was chosen. The host has since been decided: GitHub Pages at `https://journal.prayersealed.org/`. The origin-move cautions below still apply in full and are the basis of the current procedure; the "proposed only" status of that address, and the generic static-host steps, are superseded by [HOSTING-GITHUB-PAGES-2026-10-14.md](HOSTING-GITHUB-PAGES-2026-10-14.md).

## Portable build and release preparation

The authoritative existing Sites source remains the source of this review branch. Serve the complete `dist/` directory as a static HTTPS site; there is no build step, runtime API, account, backend, remote font, or ChatGPT-specific browser dependency. Paths are relative so root or project-subpath hosting is possible. Keep the supplied Content Security Policy; scripts, modules, styles, downloaded guides, and the vendored QR generator must all resolve under the same deployment path.

For a separately authorized release:

1. Pin a reviewed commit, run `npm ci` and `npm test`, and retain the complete source plus test record. Development tools are not deployed.
2. Copy the entire `dist/` asset set atomically to an authorized static host. Configure correct UTF-8 HTML, JavaScript module, CSS, JSON, Markdown, and SVG content types. Verify HTTPS and subpath-relative navigation; do not assume existing host behavior.
3. Prefer revalidation for mutable HTML/module paths. This source does not use content-hashed immutable asset names; do not add long-lived immutable caching to these names. Test old tabs plus newly loaded tabs against the deployed asset set before recommending an update.
4. Confirm no writing leaves the browser and the host only receives requests necessary to serve the site. Host access logs remain the host's responsibility. Inspect all supported routes and downloadable files using fictional content.
5. Retain rollback assets and the prior address. A host rollback must not erase or downgrade browser journals. Record exact source, deployed artifact, response headers, URL, and test evidence.

These are preparatory instructions. No new repository, hosting account, deployment, domain, DNS, paid service, or native release was created by this work.

## Safe move to a new origin

`journal.prayersealed.org` is proposed only. A new origin has a separate IndexedDB database even when its pages look identical. Neither a redirect nor a domain mapping migrates writing.

Before any migration, keep the old origin available. At that old origin, settle pending saves, review a full backup including drafts and journal metadata, and verify the actual downloaded file. Export each church draft/template recovery copy separately. Retain untouched originals and passwords privately. At the new origin, review/import the files, check the committed receipt, open representative entries and drafts, and compare fields and metadata. Restore another copy in an isolated profile to test recovery without deleting the only journal. Repeated imports should skip identical data; explicit changed-version copies preserve originals. Only retire the old origin after separately authorized migration acceptance. Never route private journals through public QR links, URLs, logs, or query strings.

## Offline support assessment

The already-loaded application uses local IndexedDB and local computation. With its modules loaded, writing and file preparation do not require a runtime server connection. This is a source-level property and is not evidence of a tested cold offline relaunch. Browser eviction, reloads, host caches, and an incomplete initial load can prevent offline access. The current product accurately says there is no installed offline shell/service worker or guaranteed offline reload. The native application's existing offline journaling remains the appropriate established offline route.

A new service worker was assessed but was not safely implementable and verifiable in this environment: runtime asset names are mutable, host cache behavior is unverified, and the supported cloud browser cannot reach staged loopback preview. Chromium also cannot launch due its required socket denial. Adding interception now would introduce persistent, difficult-to-recover state without testing install/activation, stale asset mixtures, quota failures, rollback, or active-draft protection. This is a concrete lifecycle-verification gate, not a missing offline claim hidden by test counts.

Before implementing an offline shell, establish:

- A versioned immutable complete asset graph and an atomic cache-install step that fails without altering the last usable shell.
- A waiting update that never invokes `skipWaiting`/`clients.claim` to replace an active writing session. Offer a deliberate update only after drafts settle and recovery is available; do not force reload.
- Explicit old/new application and IndexedDB compatibility. Caches may contain public shell assets only, never journal content, import files, passwords, or decrypted data.
- Retention of an older usable shell until all controlled tabs have safely moved; handle cache quota/eviction and partial downloads without deleting IndexedDB.
- A visible version/update/recovery path, a tested rollback, and tests for old-tab/new-tab mixes, process termination, offline restart, multi-tab editing, failed installs, storage-full conditions, and browser data clearing in isolated profiles.
- Rendered and physical checks on supported Safari/iPhone, Chrome/Android, and desktop browsers. Node mocks cannot establish browser worker lifecycle behavior.

No update worker, automatic reload, cache deletion, or new storage migration was added. That optional implementation remains gated on the above compatibility design and real lifecycle validation. Offline assessment and accurate user guidance are complete; offline installation is not claimed complete.
