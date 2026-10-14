# My Life With Christ — Web Companion

A portable, browser-local writing companion for My Life With Christ. October 2026 improvements. Source integration and publication to the existing Sites address were authorized on October 13; see `docs/RELEASE-2026-10-13.md` and the final deployment evidence for publication state.

## What works

- Five entry kinds: sermon, Bible reading, prayer, reflection, letter.
- IndexedDB drafts, saved entries, local search, and explicit export.
- Separate provided notes, personal notes, reflection and prayer.
- Version 1 `journey-export` JSON downloads, compatible with the existing app importer.
- JSON and checked ZIP journal imports, with review before saving. Identical entries are skipped; changed entries can be retained as separate copies.
- Guided transfer with separate entry/draft selection, inclusive date ranges, complete content review, and plain JSON or locally encrypted `.lwc` files.
- Readable single/multiple-entry sharing copies with reflection/prayer excluded until explicitly selected.
- Full backups preserve unknown journal metadata, including empty journals; partial transfers exclude unrelated opaque metadata. Shared golden vectors align with the native schema-3 review code, not necessarily older installed editions.
- Atomic multi-store backup snapshots and settled autosave prevent premature save feedback and inconsistent entry/draft views.
- Accurate committed import receipts and repeat-safe conflict copies for saved entries and unfinished drafts.
- A church Sermon Pack builder using the app's existing v1 sermon-notes format, reusable local templates, draft recovery, preview, and a downloadable publishing guide.
- Local SVG QR generation for church-hosted HTTPS download links.
- Downloadable format specification and clearly labelled example pack.

## Run and verify

The deployed website is everything in `dist/`. It has no build step or backend.
Serve that folder with an HTTPS static host. Development dependencies are only needed for verification and updating the vendored QR generator.

```sh
npm ci
npm test
```

Tests use Node 24, Python 3, jsdom, and fake-indexeddb. The DOM tests are not rendered-browser tests. They exercise writing, draft recovery, saving, journal exports, the church form and QR generation. Core tests check compatibility with the app's actual importer, separate provided/personal content, cryptographic rejection, concurrency, deduplication and ZIP integrity.

`compat/` contains MIT-licensed reference modules from `systemslibrarian/my-life-with-christ` at commit `e69f961f20280da4d9ef5fec9571eb0e218c1afa`. These files are used by tests, never served. The app repository was read, not modified. Compatibility does not establish a successful physical-phone import; that remains a release check.

## Hosting and ownership

All public assets are relative paths, suitable for a domain root or a GitHub Pages project subpath. There are no ChatGPT runtime APIs or sign-in dependencies in the application.

**Intended host: GitHub Pages, at `https://journal.prayersealed.org/`.** [The Pages workflow](.github/workflows/pages.yml) runs the suite, the rendered-browser harness and the artifact validator, then publishes `dist/` on every push to `main` and on manual dispatch. `dist/CNAME` pins the domain, and `npm run validate:artifact` refuses an artifact whose CNAME is missing or wrong.

**That move is not finished.** Pages cannot be enabled while this repository is private on the organization's free plan — the API refuses with "Your current plan does not support GitHub Pages for this repository" — so there is no deployment, certificate or HTTPS at the new address yet. [docs/HOSTING-GITHUB-PAGES-2026-10-14.md](docs/HOSTING-GITHUB-PAGES-2026-10-14.md) is the current hosting instruction; it records the blocker, the exact GoDaddy record to change, and the order of operations.

**The existing site stays up:** <https://my-life-with-christ.systemslibrarian.chatgpt.site/>, served from an OpenAI Sites project. It is not redirected, disabled or retired, and its browser storage is untouched. A GitHub deployment does not update it.

When changing origins, existing IndexedDB data does not move automatically. Browser storage is per-origin, and a CNAME, custom domain or redirect does not carry it: a reader at the new address sees an empty journal until they import a file. Readers download a full backup at the old site and import it at the new one, keeping the old site available meanwhile. The procedure is in the hosting document above, and [tests/migration.test.mjs](tests/migration.test.mjs) checks it against a genuinely separate database — empty destination, destination that already holds writing, repeated import, changed-version conflict, malformed input, protected `.lwc` round trip, and opaque metadata.

## Limits stated in the product

- Local data is not encrypted at rest and is not a backup.
- Private transfers use files. There is no automatic sync or device pairing.
- Direct `.lwc` import is being added to the native app review branch; it is not a claim about an installed or released build. Use a compatible build through Your journal → Journal file to read. Otherwise unlock it in the companion, then download/import unencrypted journal JSON. OS tap/Open In and share-to-app routes are for church handouts, not journal imports.
- Current native review code and this companion preserve changed imports as separate copies rather than choosing by clock. Review conflicts and the resulting receipt before removing an original. Older installed versions must be checked separately.
- Sermon Packs are JSON text, without attachments or revision tracking in this version.
- PDF and DOCX import remain functions of the installed app.
- Journal inputs are capped at 16 MB. ZIP output is bounded to 64 MB total and 16 MB per member. Protected transfer plaintext is capped at 11 MB to leave room for its encoded envelope.
- The website has to load from its host; there is no offline installation/service worker yet.

## Privacy and source safety

No writing is uploaded. A restrictive Content Security Policy disables runtime network connections. Scripts, styles and the QR library are served locally. Hosting access logs remain the host's responsibility.

Never put real journals, user exports, passwords, or church materials without distribution rights in source or fixtures. The bundled Sermon Pack is explicitly fictional example content. The shipped pages contain no full Bible corpus or licensed outlines.

See `docs/IMPLEMENTATION-2026-10-13.md` for current evidence, `docs/manual-acceptance.md` for pending browser/device gates, `docs/transfer-format.md` for the protocol, and `dist/publishing-guide.md` for church publishing. `docs/verification.md` is historical October 7 evidence. See `docs/ACCESSIBILITY-ASSESSMENT.md` for criterion-level source/DOM checks, and `docs/HOSTING-TRANSITION.md` for portable hosting and safe offline/update prerequisites.

Code: MIT, copyright Paul Clark. QR generator: MIT, copyright Kazuhiko Arase (notice retained in the vendored file).

## Rendered-browser QA

```sh
npm run test:browser
```

`tests/browser-qa.mjs` starts an isolated loopback-only static preview and drives it with Playwright + `@axe-core/playwright`, both now pinned devDependencies, so the harness no longer depends on packages borrowed from elsewhere. It does not contact the public deployment. `CHROMIUM_PATH` overrides the browser; by default it uses the Chromium Playwright installs for this package (`npx playwright install chromium`). Test artifacts are fictional and written under ignored `.test-tmp/browser/`. The Pages workflow runs this on every push, so it cannot quietly go unverified again.

**First verified on 14 October 2026: 10 consecutive passes, Chromium 153.0.8010.12, zero axe violations across all nine routes**, plus reflow at 1280/390/320 CSS px, dialog Escape/focus restoration, the import and protected-unlock flows, no page errors and no external runtime requests. Evidence: [docs/evidence/browser-qa-2026-10-14.json](docs/evidence/browser-qa-2026-10-14.json).

The earlier blocker is resolved, and the cause was infrastructure rather than the application or the harness logic. The October 13 environment could not launch Chromium because its required Unix socket was denied (`Operation not permitted`), and the cloud browser could not reach the retained preview server (`ERR_CONNECTION_REFUSED`). On top of that the harness launched a hardcoded `/usr/bin/chromium`, which exists on neither macOS nor a GitHub runner; it now defaults to Playwright's own Chromium and rethrows an actionable error if no browser can start, so an unavailable browser fails loudly instead of reading as a pass.

This is a headless-Chromium axe result, not a conformance claim. Firefox, Safari/WebKit, real screen readers, physical devices, printed QR, OS high-contrast and reduced-motion checks remain open — see [docs/manual-acceptance.md](docs/manual-acceptance.md) and [docs/ACCESSIBILITY-ASSESSMENT.md](docs/ACCESSIBILITY-ASSESSMENT.md). Node/jsdom tests remain separate evidence.
