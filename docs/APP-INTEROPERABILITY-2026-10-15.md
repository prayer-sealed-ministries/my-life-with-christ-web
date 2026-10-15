# App ↔ web companion interoperability — 15 October 2026

What the two editions can exchange, what was proven, and what was not. Written
after the code and tests established it, not before.

**Verdict: interoperability verified in code and in the browser. Physical and
emulator device acceptance remains pending.** No claim of "fully synchronized"
is made here, because no native build was exercised on a device or emulator in
this lane.

## The two editions

| | Native app | Web companion |
| --- | --- | --- |
| Repository | `prayer-sealed-ministries/my-life-with-christ` | `prayer-sealed-ministries/my-life-with-christ-web` |
| SHA at verification | `700b89d6d3b293d2dcaf30cc778883c2347abde7` | `63ca898f7f9b051cb4e643fc0d050fa51b4337da` |
| Surface | Capacitor iOS/Android, Dexie + SQLite | static `dist/`, IndexedDB, no backend |
| Live | unreleased | <https://journal.prayersealed.org/> |

## Interchange formats, and their versions

All three are **version 1** on both sides, unchanged by this work.

| Format | Version | Companion | App | Direction |
| --- | --- | --- | --- | --- |
| `journey-export` | 1 | produces and consumes | produces and consumes | **bidirectional** |
| `lwc-companion-protected` (`.lwc`) | 1 | produces and consumes | consumes | companion → app, plus companion round trip |
| `my-life-with-christ-sermon-notes` | 1 | produces and consumes | consumes | companion → app |
| canonical ZIP archive + `MANIFEST.txt` | — | **consumes only** | produces and consumes | app → companion |

### Known capability differences — intentional, not defects

1. **The companion does not produce the canonical ZIP archive.** `dist/archive.js`
   exports `readJournalFile` and nothing else: it verifies a native archive's
   manifest, checksums and member sizes, and refuses an altered member, but it
   writes journal transfers as `journey-export` JSON or a protected `.lwc`. The
   archive is the native edition's artefact.

2. **A newer format version is treated differently on purpose.** The companion
   fails closed — *"Choose a My Life With Christ journal export (version 1)."*
   The app accepts it with a warning, records `migratedFrom`, and preserves
   unrecognised fields. Neither silently destroys anything, which is the
   property that matters, so both are pinned by test rather than reconciled.

3. **Journal envelope metadata crosses at a different seam on each side.** The
   app keeps it in its own `envelopeMetadata` store (IndexedDB schema 3 /
   SQLite schema 3) per `JOURNAL-ENVELOPE-PRESERVATION.md`; `migrateExport`
   returns only entries, drafts and warnings. The companion keeps it in
   settings via `envelope-metadata.js`. Both preserve it; neither exposes it
   through the entry importer.

## The defect this lane found and fixed

`entryDraft()` built a draft form by spreading the whole entry, so every
companion draft carried `tags`, `visibility` and `updatedAt` inside `form`. The
app's `DraftForm` has none of those — it has `tagsText`, the raw string as
typed — so the app preserved all three into `_unmigrated.form` and warned about
each one, on every draft that crossed.

Nothing was ever lost. But the two draft shapes had diverged, and noise today is
a loss waiting for the day a newer edition stops preserving. Repaired by
omitting those three named fields and stripping them from a continued draft.
Unknown fields are deliberately **not** filtered: an allow-list there would
destroy exactly what the preservation contract promises to keep.

**Why it was invisible:** `compat/` carries byte-exact native source that the
tests type-strip and run as the app's real importer, and it was pinned at
`e69f961` — 33 commits behind. The companion was proving compatibility with a
version of the app that no longer existed. Five of the six copied files turned
out to be semantically identical already; `src/export/migrate.ts` was the one
that had genuinely moved.

## Protected transfer parameters, agreed by both sides

Format `lwc-companion-protected`, version 1. PBKDF2-SHA256 at 600,000
iterations, AES-256-GCM, 16-byte salt, 12-byte IV, 16-byte tag, canonical padded
Base64, UTF-8 passwords with no trimming and no Unicode normalisation.

Proven by test: the independent known-answer fixture opens in the companion and
its contents are accepted by the app's importer; a companion-sealed journal
round-trips; a wrong password, a single flipped byte, and altered iterations each
yield nothing; no plaintext appears in the sealed file. The known-answer fixture
is **not** regenerated — re-sealing it with the code under test would make it
circular. It predates the draft repair, which makes it a genuine
"written by an older edition" case.

## Enforcement against future drift

| Mechanism | Runs | Answers |
| --- | --- | --- |
| `compat/SOURCE.json` | — | which native files are copied, from which SHA, with hashes, and the three interchange versions |
| `npm run verify:app-compat` | **required CI** | are the copies still those bytes, do the recorded versions match the literals the runtime emits, does the app's importer still run clean against ordinary companion output |
| `npm run check:native-drift` | **weekly + dispatch** | has native main changed any copied file |

The drift check is deliberately **not** in required CI. A network call on every
push would let a GitHub outage present itself as a format incompatibility, and a
check that cries wolf is how a real alarm gets ignored. It separates drift
(exit 1 — loud, names both SHAs and a compare link) from inconclusive (exit 2 —
warning only). Nothing is copied between repositories automatically and nothing
is auto-merged: the last drift needed a fix on the companion side, not a blind
re-copy.

Every one of those assertions was mutation-proved. Corrupting a copied file,
truncating the oracle, bumping a runtime format version, and reintroducing the
draft defect each make `verify:app-compat` fail; an unreachable API yields
inconclusive rather than drift.

## Evidence

`tests/app-interop.test.mjs` (15 cases) and `tests/app-draft-contract.test.mjs`
(7 cases) drive the app's real importer against the companion's shipped modules
and its real storage commit path — not parsers in isolation. Companion suite:
**106 passed, 0 failed, 0 skipped**. Native suite at `700b89d`: **2,354 passed**,
all gates green, and no native change was required.

Live deployment, checked against the running site rather than the repository:
all nine routes render with **0 axe violations** under WCAG 2.1/2.2 AA tags, no
horizontal overflow at 1280/390/320 CSS px, no page errors, no request to any
other host, no published source maps, CSP `connect-src 'none'` intact. A
fictional entry was written, autosaved, saved and exported from the live site,
and **those exact exported bytes were then imported by the app's real importer
with zero warnings and all three privacy-separated fields intact**. A Sermon
Pack created on the live site imported back with notes, reflection and prayer
all empty.

## What was NOT verified

- **No emulator or physical-device acceptance.** No Android emulator is
  installed on this machine (`adb` present, 0 devices; `emulator` absent) and no
  native build was run on an iOS simulator in this lane. The physical Galaxy A17
  was deliberately untouched: it holds real journal data, and nothing here
  uninstalled from it, cleared its storage, read its prose or touched its
  SQLite.
- **No real journal data was used anywhere.** Every string is fictional and
  marked `FICTIONAL-COMPAT`.
- The app's envelope-metadata store and archive production were reasoned about
  from their own tests and documentation, not exercised from the companion.
- Screen readers, other browsers, printed QR, and cold-offline relaunch remain
  open in [manual acceptance](manual-acceptance.md).

## Honest summary

Code and browser interoperability is verified in both directions, with
preservation of unknown fields proven across two full laps and the provided-notes
privacy rule proven on the live site. Physical Android and iOS acceptance is a
later item and is not claimed here.
