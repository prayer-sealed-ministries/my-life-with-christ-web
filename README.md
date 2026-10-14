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

A future move to a user-chosen GitHub repository is intended. Preserve this Git history, tests, guides and static assets when choosing that repository; no particular organization or repository has been created or selected by this work. `dist/` can be hosted on GitHub Pages or another static host under a ministry-controlled domain.

The optional GitHub Pages workflow is manual. On GitHub, enable Pages with GitHub Actions as the source, then run the workflow. Public repositories can use GitHub Free Pages; private-repository availability depends on the GitHub plan. No permanent domain is assumed or configured.

When changing origins, existing IndexedDB data does not move automatically. Ask readers to download their journal from the old site and import it at the new one before closing the old site. Domain choices should be settled before a broad launch.

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

## Optional rendered-browser QA

`tests/browser-qa.mjs` starts an isolated loopback-only static preview and uses installed Playwright + `@axe-core/playwright`, plus an installed Chromium. It does not contact the public deployment. Run with `node tests/browser-qa.mjs` when those packages are installed here, or point `LWC_QA_PACKAGE_ROOT` at an existing package root that provides them. `CHROMIUM_PATH` can override `/usr/bin/chromium`. Test artifacts are fictional and written under ignored `.test-tmp/browser/`.

The October 13 environment could not launch Chromium because its required Unix socket was denied (`Operation not permitted`), including an approved escalation retry. The supported cloud browser was also checked, but could not reach the retained preview server (`ERR_CONNECTION_REFUSED`); no cross-environment forwarding route was available. The harness is prepared but not verified; no rendered browser, axe, screenshot, or hardware result is claimed from it. Node/jsdom tests remain separate evidence.
