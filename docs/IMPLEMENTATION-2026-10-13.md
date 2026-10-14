# Companion implementation record — 2026-10-13

## Current verified release status

The chronological records below preserve earlier review checkpoints. Their local-only and version-1 statements are historical. Following the user’s publication authorization, version 3 from `4c1a7bb904c817c277ed8c7790e53ade3aa64e41` succeeded at the unchanged public companion address. A fresh 76/76 aggregate run and live cloud-browser rechecks passed on October 13 at 23:09–23:10 UTC. The final checks confirmed immediate pastor-list updates without focus loss and immediate truthful download-history updates. No runtime edits followed those checks. See [RELEASE-2026-10-13.md](RELEASE-2026-10-13.md) and [LIVE-VERIFICATION-2026-10-13.md](LIVE-VERIFICATION-2026-10-13.md) for exact deployment IDs, evidence and still-open device/AT gates. These results do not release the native application or certify the entire acceptance matrix.

## Scope and source

This record tracks all twelve sections of the implementation assignment as they apply to the public web companion, alongside the native application’s separate implementation record. The journal is **My Journey With Christ**; the native application is **My Life With Christ**. The companion remains a local-first writing and file-transfer tool, with no account, backend, telemetry, automatic sync, or server copy of private writing.

- Authoritative companion source: the existing Sites source checkout.
- Starting commit: `81344cd471a2ec1f8be58b35e4bb2cd0bd92ec82`.
- Working branch: `improve/companion-integrity-transfer`.
- Initial authorization limited delivery to local commits. On October 13 the user subsequently authorized commit, push, integration and deployment to the existing companion address. See RELEASE-2026-10-13.md for that release boundary. DNS, a new domain/repository and native releases remain outside this action.
- Native app work is a separate change set in the sibling project. Companion tests alone do not verify an installed native build.
- `journal.prayersealed.org` is a proposed domain only. It is not configured or verified by this work.

The October 7 report in [verification.md](verification.md) is historical evidence for its tested source state. It is not evidence that the new work passes, and its native-app capability statements must not be used as a claim about a later installed build.

## Evidence vocabulary

- **Implemented:** the behavior exists in the reviewed source. This alone is not a test pass.
- **Automatically verified:** a named automated check passed against an identified source state. Node/jsdom checks are not rendered-browser, operating-system, or physical-device evidence.
- **Hardware/browser verified:** a person recorded the device, OS, browser/app versions, source/build, steps and result. No such result is claimed here yet.
- **Blocked:** a check was attempted but could not complete; record the actual blocker and what remains unknown.
- **Deferred:** deliberately outside this change set. Deferred work must not appear as a shipped capability.
- **Pending:** implementation or verification has not yet been signed off.

## Change-set acceptance ledger

The implementation below is review-ready locally. It is not a deployment or native release sign-off. The source had one clean `main` commit at discovery, no uncommitted changes, and no connected GitHub PR surface for this Sites repository. Applicable README, format specifications, reference importer, and historical verification were read before edits. Existing entry CAS, draft recovery, checked ZIP import, crypto, and QR code were extended rather than replaced.

| Area | Current evidence / intended behavior | Dependencies | Status, tests and remaining limitations |
| --- | --- | --- | --- |
| Protected v1 | Existing Web Crypto envelope retained; strict bounded canonical Base64, exact parameters, 11 MiB plaintext and 16 MiB envelope; original password bytes retained. | Web Crypto; receiving app supporting this envelope. | Implemented and automatically verified by `protected-format.test.mjs`: independent Node/OpenSSL fixture, fresh randomness, wrong passwords, metadata/salt/nonce/ciphertext tampering, Unicode/password whitespace, malformed input, large bounds. No independent security review or phone test. |
| Cancelled crypto dialogs | Confirmed delayed crypto could act after cancellation and affect a replacement dialog. | Dialog session token and bound form identity. | Implemented; deferred encrypt/decrypt cancel–reopen regressions pass. Old completions cannot download, preview, close the new dialog, or write into removed error elements. |
| Full-fidelity draft transfer | Unknown draft/form fields retained. Optional EntryLink labels normalized into required DraftForm rows; original links retained in companion provenance. | `journey-export` v1, current native importer. | Implemented; pinned native importer and draft-link regression pass. All three fixture SHA-256 hashes match the sibling app files. Current-app verification belongs to the sibling report. |
| Atomic imports | Confirmed repeated conflicting draft duplication and inaccurate draft counts repaired. Explicit keep-copies applies to both entries and drafts. | IndexedDB transactions; original IDs and full-content comparison. | Implemented and automatically verified: committed added/skipped/copied counts, repeat-safe conflicts, provenance retention, collision avoidance, immutable snapshots, abort rollback, and shared review/storage classification. Real full-storage/process-termination behavior unverified. |
| Concurrent saves | Confirmed silent pastor-draft overwrite and possible changed-draft deletion repaired. | Saved base snapshots, IndexedDB. | Implemented CAS for church drafts; entry save checks entry and draft in one transaction. Storage tests and DOM stale-save recovery pass. Actual multi-tab/process termination remains a browser gate. |
| Readable copies | Previously included prayer/reflection automatically. Now explicit field choices and preview; one or multiple selected entries. | Saved entries; readable Markdown is not a backup. | Implemented, core/DOM default exclusion and opt-in verified. Selection/date filter feeds multi-entry copies. Native printable book remains the recommended preservation tool. |
| Guided transfer | Separate entry/draft selection, inclusive date ranges, exact review, plain/protected files, receiving instructions, committed import receipts. | Private file transport; compatible receiving build. | Implemented and DOM verified including draft-only partial export and repeated/changed imports. Browser handoff is never represented as app receipt. Real OS/file write/handoff remains unverified. |
| Pastor drafts/templates | Reusable templates make independent drafts, separated from personal journal; recovery copies and validation. | Existing sermon-notes v1 and local pack store. | Implemented and DOM verified: template isolation, recipient preview, invalid-body error and recovery download. Templates/pastor drafts are explicitly excluded from journal backup; users download their recovery copies separately. |
| Storage/backup | Counts, persistence request/report, export stage/time/counts, isolated restore guidance. | Browser Storage API when available. | Implemented; unavailable/denied/granted/failed API states automatically tested. No claim of verified external backup, encrypted-at-rest storage, automatic sync, or offline installation. |
| Dashboard/accessibility | Fast continue/start/import/find/move/backup; live save state, labelled errors/dialogs, focus restoration, skip link, 44 px control styles, reduced motion and narrow layout rules. | Browser rendering and assistive technology. | Implemented; DOM labels/live status/focus/error checks pass. Source-computed contrast defects are repaired and 13 criterion-focused source/DOM checks pass; rendered reflow, keyboard/screen-reader sessions remain blocked or unverified, not AA certification. See the detailed accessibility assessment. |
| Church publishing/domain | Downloadable example/spec/guide, public HTTPS QR, accurate host/identity limits, safe old-origin export/import transition. | Church-owned HTTPS hosting; separate future release/domain authorization. | Implemented/documented; static link checks pass. QR generation does not publish. Actual hosting, phone scanning and DNS are not verified or changed. |

## Format decisions that must survive integration

The normative transfer details are in [transfer-format.md](transfer-format.md). Existing `journey-export` version 1 remains the journal format. A subset must be recognisable as partial, saved entries must not become drafts, and drafts must not become saved entries merely by transferring them. Preserve IDs, timestamps, provided material, personal fields and supported unknown fields according to the documented importer contract; use the shared metadata-preservation contract for the schema-3 native review code, while retaining original files when testing older installed editions.

Protected transfer stays `lwc-companion-protected` version 1, using PBKDF2-SHA256 with 600,000 iterations and AES-256-GCM. Do not trim or normalize password text or silently accept altered parameters. The fixed fixture is synthetic test data, including its published test password; it is not a model for production randomness or a password to recommend to users. New files need fresh randomness.

Direct `.lwc` import is being integrated into native source separately. Until a particular installed version is checked, the documented fallback remains: unlock the file in the companion, review it, export app-compatible JSON, then review and import that JSON in the native app. That fallback makes an unencrypted copy; it is not equivalent to keeping the transfer encrypted throughout.

The public [sermon-notes v1 specification](../dist/sermon-notes-format.md) is unchanged. It has no pack-revision, replacement, authenticated-publisher or stable-identifier protocol. A title match is not proof of duplicate content, a checksum identifies file bytes rather than publisher identity, and a claimed church name is unverified metadata. Future stable IDs and revision semantics require a separate versioned design and compatibility review. Do not introduce them by inference.

## Verification run record

Earlier integrity checkpoint: `713d389`. Final full-scope runtime verification: `f18cf2ac5e261a829b684e4fdb88c24f0c42ecc4` (documentation-only completion follows). Starting source: `81344cd471a2ec1f8be58b35e4bb2cd0bd92ec82`.

- Earlier `npm test` checkpoint on 2026-10-13 (runtime commit `713d389`): **44 tests passed, 0 failed, 0 skipped**, exit 0. This includes the two deferred-crypto cancellation regressions and the normalized native draft-link regression. Node 24/jsdom/fake-indexeddb only.
- `node --check dist/app.js dist/core.js dist/storage.js dist/archive.js` (each file separately): passed. `tests/browser-qa.mjs` syntax also passed.
- Static verification: all referenced runtime and downloadable local assets resolve; CSP retains `connect-src 'none'`; handwritten runtime modules contain no fetch/XHR/WebSocket/EventSource/beacon API. Passed. This is not network-capture evidence.
- Shared fixture hashes match byte-for-byte with the sibling app's `src/export/test-fixtures/`:
  - `.journey.json`: `ce7082affa7efe4631a7593fad7c3c9826eb1d2ccb0636b6f5eda8c09459f23d`
  - `.lwc`: `5355253deb3647100c3e667185d788dae545bbcfbc2570168635023266727950`
  - `.metadata.json`: `eb5c5ab10e76d3876edd117d095b88b318a785418b0975b63dc3648f76849833`
- `git diff --check`: passed. No unrelated starting work was overwritten.
- Rendered browser attempt 1: installed Chromium fails before opening a page because the environment denies its required Unix socket (`Operation not permitted`), including an approved escalation retry.
- Rendered browser attempt 2: supported cloud browser is available, but cannot reach the retained staged-source HTTP server (`ERR_CONNECTION_REFUSED`). No supported cross-environment forwarding route is exposed. The temporary server/tab were closed. This is a staged-preview reachability blocker, not a claim that the cloud browser is unavailable.
- `tests/browser-qa.mjs`: prepared but not run successfully. No axe, screenshots, rendered reflow, or physical-device pass is claimed.
- Physical phone handoff/import, actual stream close/storage exhaustion, populated-device upgrade, OS share/document-provider, native App Lock and physical QR scan: not verified by this companion work; existing native release holds remain.
- Public Sites version 1 and its public audience remain unchanged. No push/deployment/domain changes or new backend. No PR was created for the private Sites source.

## Release gates and deliberate deferrals

Critical browser/device journeys remain unverified; the project is not declared finished. A local test pass does not authorize publication. Before any future release, obtain publication authorization, identify the source/build to publish, and complete the relevant [manual acceptance checks](manual-acceptance.md). In particular:

1. Verify backup recovery in an isolated browser profile/origin before users depend on the companion for real writing.
2. Verify actual supported phone download/open/import/export paths, conflict review and field separation.
3. Check stale HTML/JavaScript combinations and browser cache behavior during a hosted update. Verify recovery without clearing the user's journal.
4. Check offline behavior honestly. There is no service worker or guaranteed offline installation in this change set; a warm tab is not proof that a cold offline launch works.
5. Test the real church HTTPS download and a printed QR on actual phones after separately authorized hosting.
6. If the origin changes, retain the old origin until users can export, review and successfully restore their files at the new one. Changing a domain does not migrate IndexedDB.

Outside authorized product scope: account systems, backend storage, automatic sync, telemetry, private QR relay, automatic trust of publisher claims, and a church directory. Service-worker/offline installation is an assessed optional implementation gated on a safe update/compatibility design and real lifecycle verification; see HOSTING-TRANSITION.md. Sermon attachments and protocol-level revisions require a separately versioned design and old/new-reader compatibility testing. Domain changes and deployment require separate authorization. No hardware verification is implied by completing this ledger.


## Full assignment scope matrix after continuation

The attachment was reread in full (all 295 lines) against the earlier checkpoint. “Automatically verified” below is limited to Node, jsdom, fake-indexeddb, canonical fixtures, and source inspection. No row claims hardware verification.

| Assignment section | Companion work completed and evidence | Dependency or real remaining boundary |
| --- | --- | --- |
| 1. Discovery | Located and opened the authoritative Sites source with the supported helper; clean starting commit and branch recorded; read local guidance/specs/history and native importer contracts. Extended existing storage/crypto/ZIP/QR rather than recreating the app. | Native branch/PR discovery is recorded in the sibling app record. Public site remains the existing version 1; no source push or deployment. |
| 2. Principles | Local-first runtime with CSP connection denial, local assets, no accounts/analytics/AI writing/gamification. Provided material, notes, reflection, prayer remain separate. Readable sharing privately excludes reflection/prayer until selected. Existing identifiers remain. | Source/DOM privacy evidence is not a network capture. Native offline operation and App Lock physical checks remain the sibling release gates. |
| 3. Evidence plan | This durable record, per-area table, full matrix, protocol, accessibility assessment, host/update assessment, and concise manual script identify actual evidence and gaps. | Final cross-component Sunday harness evidence is owned by the app integration review; physical evidence cannot be substituted by its test count. |
| 4. Integrity | CAS drafts/pastor drafts; atomic entry-save+draft-delete; repeat-safe imports and truthful receipts; collision reservation; abort rollback; immutable queued snapshots; stale-crypto and async-file-read cancellation fences. Added settled save queue so intermediate commits never announce all writing saved; navigation drains writes queued during a read. Backups read all related stores in one transaction. Regression tests cover confirmed failures. | Process termination, real quota exhaustion/browser restart, actual downloaded-file/stream close, populated-device migration, Android App Lock and document-provider/sharing need the listed browser/device matrix. Existing native HOLD is preserved. |
| 5. Guided move | Independent entry/draft choices, inclusive dates, full content/metadata review, partial marker and omission notice, plain/protected files, exact receiving-screen guidance and committed receipt. Shared protected fixture and eight shared envelope vectors; full preservation including empty journals, conflict maps and unknown fields. | Native schema-3/protected support is review code, not a released-edition promise. Older-build fallback produces plain JSON; keep originals. Real OS transport/import remains unverified. Private QR pairing is outside this milestone. |
| 6. Pastor workflow | Existing v1 parser/spec preserved; editor/preview/actionable validation, fictional example, publishing guide, independent templates, local drafts, incomplete draft recovery download AND reviewed restore-as-new. Public HTTPS QR download does not upload or verify a host. Import church notes is discoverable and starts separate personal fields. | Revision IDs assessed: v1 does not define identity/replacement; new protocol needs versioning and old/new-reader tests. No title-based replacement. Host publishing and physical QR scan require authorization/actual phones. |
| 7. Dashboard | Continue draft, start sermon, import church notes, find writing, guided move and full backup are direct actions. Search count and save/error feedback are live-labelled. Defaults and optional entry details retained. Failed saves retain the editor and recovery download. | Optional revisit prompts were considered; current deliberate search/recent/continue paths provide revisiting without inferred spiritual progress or unsolicited pressure. No automatic prompt/score feature is required or added. Rendered fast-capture usability remains a browser/pilot check. |
| 8. Preservation | Uses native `journey-export` and checked My Journey With Christ ZIP input; directs users to native archive/printable-book tools instead of inventing a competing archive. Date/field selection and readable preview implemented. Counts, persistence states, honest export history and isolated recovery guidance. Full backup includes journal metadata; partial sharing cannot leak unrelated opaque root maps. | Browser download does not prove file write or restore. Actual isolated-browser restore/physical archive verification remains pending. Pastor drafts/templates are explicitly separate and have their own recovery files. |
| 9. Accessibility/offline | 13 source/DOM checks cover 17 routes, six dialogs, labels/errors/status, focus return and initial review heading. Contrast defects repaired; wrap, scroll, focus, reduced-motion and target styles improved. 1,000-entry/30-draft and long-title tests pass. Offline/update safety assessed in detail. | Rendered keyboard/AT/reflow/zoom/touch and real network/offline/cache lifecycle remain blocked by staged-preview reachability and unavailable physical runs. No WCAG conformance certification. A new service worker without that lifecycle evidence would add risk; prerequisites are explicit, not an unexamined omission. |
| 10. Hosting | Buildless static HTTPS deployment instructions, complete relative asset set, cache/version cautions, rollback and old-origin-retention plan documented. Full export/import plus separate pastor recovery prepares migration. | Proposed domain is not live/configured/verified. DNS/HTTPS/routing/deployment have not been changed; those require applicable authorization and separate acceptance. |
| 11. Sunday validation | Fictional pastor generation/import, personal field separation, navigation recovery, duplicate/conflict receipts and private readable selections run in DOM tests. Shared app importer/crypto vectors and isolated fake-indexeddb full restore preserve entries, drafts and metadata; repeated cycles tested. Pilot script covers technical-comfort roles and all twelve steps. | No test host publication, physical QR scan, physical phone handoff, real relaunch or screen-reader pass is claimed. Independent cross-component review completes software integration evidence, not hardware proof. |
| 12. Delivery | Focused local commits, test/source package, protocol/compatibility notes, change record, manual checklist and next release gates. Runtime frozen for independent review at the exact SHA below. | No companion PR exists because Sites source was kept local as authorized. Critical browser/device journeys remain unverified; project is not declared finished. |

## Full-scope continuation verification

- Frozen runtime: `f18cf2ac5e261a829b684e4fdb88c24f0c42ecc4`. Includes preceding accessibility source/test commit `8b67440`.
- `npm test`: **75 passed, 0 failed, 0 skipped**, exit 0 on 2026-10-13. Includes pastor recovery re-import, all metadata golden vectors, metadata-only empty backups, private partial selections, 20-cycle deduplication, full isolated restore, atomic backup snapshots, deferred save/read/cancel regressions, and accessibility source/DOM checks.
- `node --check` for every `dist/*.js`: passed. `git diff --check`: passed.
- `cmp tests/fixtures/envelope-metadata-v1.json ../my-life-with-christ-implementation/src/export/test-fixtures/envelope-metadata-v1.json`: identical against native metadata implementation `3525807`.
- Large-journal test: 1,000 fictional saved entries plus 30 drafts, 400,993-byte full JSON, repeat import skips all records, search isolates one long-title result, date selection selects exactly 500 entries, complete backup preserves counts and root metadata. One aggregate run measured import 38 ms, list DOM 589 ms, search DOM 88 ms, backup generation 9 ms. These are bounded local Node/jsdom timings, not a browser/phone performance guarantee. No timing threshold is used to manufacture a pass.
- File limits are explicit in UI/docs: up to 5,000 entries and 5,000 drafts, 16 MiB JSON, 11 MiB protected plaintext, with rejection regressions beyond bounds. Large visual/AT usability still needs manual testing.
- Journal metadata uses the shared reversible carrier contract, preserving original unknown paths where unambiguous, conflicts and literal prototype-looking keys. Native schema-3 support remains version-qualified review code; older installed editions must retain original files.
- No runtime edits will be made while the independent Sunday harness checks this frozen source. Documentation-only changes may follow without altering the tested program.

## Independent cross-component Sunday integration

An independent reviewer completed **16 of 16 stages** on 2026-10-13 at 22:07 UTC, with no new blocking findings. Structured evidence is committed in [evidence/sunday-integration.json](evidence/sunday-integration.json).

The run used the actual companion runtime at documentation HEAD `ba387031f57e09d013f83aa04d5abc7a3851d76c` (same tested runtime as `f18cf2a`) and actual native importer/provider/archive source. Its fingerprint covers 11 companion production files: `e406b4bce22025d189f5b55e92dfd4d058e11e23a09994a79e8da9607f8ab313`. The native source subset fingerprint is `7790ea3f7bf9fe65911777d242d845113e03d89578dce87cc969fd778dc58894` across 109 examined files at commit `c9b5353`, with local changes explicitly recorded in the evidence; this is not an assertion that the entire native worktree was committed or verified.

Passed software integration includes pastor validation/preview/offered JSON, local QR generation, recipient review, separate personal writing, logical autosave/navigation/reopen, sharing choices, actual plain/protected writers and app readers, metadata in both directions, partial metadata privacy, equal-clock conflicts and repeat-safe receipts, stale-confirm rejection, actual archive/manifest handling, tampered-member rejection, empty metadata-only journals, and exact isolated restore back into the companion. The harness observed zero simulated network calls and zero unhandled errors; examined module bytes did not change during the run.

Evidence boundaries remain explicit: controls ran in jsdom, IndexedDB in fake-indexeddb, and file offers were captured Blobs. No actual browser download write, public hosting, QR camera scan, phone import, SQLite durability, native picker, rendered accessibility or physical relaunch was established. The full application’s hardware release HOLD and the companion browser gates remain unresolved. The next recommended action is the documented authorized staged-browser and physical-device acceptance matrix, not automatic publication.

## Subsequent publication authorization

After the review checkpoint, the user authorized merging and deploying the changes at the existing Sites address. The earlier statements that public version 1 remained unchanged describe that checkpoint, not a prohibition that survives the later instruction. Source-only review-branch push was first assessed and blocked because the documented helper only targets the configured source branch; the subsequent authorization permits that configured branch and the standard Sites publication workflow. Existing journals are preserved: the IndexedDB name/version and stores stay unchanged, no reset or destructive migration is added. The intended future GitHub move remains preparatory only.

## Live deployment and browser smoke evidence

The authorized existing-origin publication succeeded as version 2 from `39d8067` on 2026-10-13 at 22:19 UTC. Real cloud-Chrome smoke checks then exercised an initially empty browser profile with fictional data, including draft persistence across page reload, separate fields, sharing defaults/opt-in, modal Escape/focus return, transfer review/offer, and pastor preview/QR. See LIVE-VERIFICATION-2026-10-13.md for exact observed evidence and remaining limits. Those observations replace the earlier blanket “no rendered browser result” for the listed desktop subset only; they do not complete the wider browser/phone/AT acceptance matrix.

The live check found two stale display details, corrected with a regression: successful pastor draft saves now update the current list without rebuilding the form, and export-history recording updates the transfer line immediately. A failure to record export history retains its warning. No journal schema, origin, crypto format or storage reset is introduced by this polish correction.
