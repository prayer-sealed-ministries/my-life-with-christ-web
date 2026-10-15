// Companion <-> native app interchange, driven through BOTH implementations.
//
// The companion's own tests prove the companion is self-consistent. These prove
// something harder: that data crossing between the two editions survives. The
// app side is its real importer — compat/src/export/migrate.ts, byte-exact from
// the native repository at the SHA in compat/SOURCE.json, type-stripped and run
// as the oracle. The companion side is the shipped dist/ modules and the real
// storage commit path, not a parser in isolation.
//
// The contract being pinned, in the words of the product: do not silently
// destroy data written by another or newer edition, and never let somebody
// else's words become the reader's own.
//
// Every string here is fictional and marked FICTIONAL-COMPAT.
import {test, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {indexedDB, IDBFactory} from 'fake-indexeddb';

import {
 newEntry, entryDraft, draftEntry, makeJourney, validateJourney, clone,
 protect, unprotect, sermonEntry, markdown,
} from '../dist/core.js';
import {prepareJournalExport} from '../dist/transfer.js';
import {metadataFromSettings} from '../dist/envelope-metadata.js';
import * as db from '../dist/storage.js';

globalThis.indexedDB = indexedDB;

// ---------------------------------------------------------------------------
// The app's real importer
// ---------------------------------------------------------------------------
const tmp = new URL('../.test-tmp/interop/', import.meta.url);
await mkdir(tmp, {recursive: true});
for (const [src, out] of [['lib/entry-kinds.ts','entry-kinds.mjs'],['export/migrate.ts','migrate.mjs']]) {
 const source = await readFile(new URL('../compat/src/' + src, import.meta.url), 'utf8');
 await writeFile(new URL(out, tmp), stripTypeScriptTypes(source).replace("'../lib/entry-kinds'", "'./entry-kinds.mjs'"));
}
/** The native app's journey-export importer, exactly as the app runs it. */
const {migrateExport: appImport} = await import(new URL('migrate.mjs', tmp).href);

const manifest = JSON.parse(await readFile(new URL('../compat/SOURCE.json', import.meta.url), 'utf8'));

/** Send a journal through the wire the way a file does: JSON and back. */
const overTheWire = (journal) => JSON.parse(JSON.stringify(journal));

beforeEach(async () => {
 const database = await db.openDB();
 await new Promise((resolve, reject) => {
  const t = database.transaction(['entries','drafts','settings'], 'readwrite');
  for (const name of ['entries','drafts','settings']) t.objectStore(name).clear();
  t.oncomplete = resolve;
  t.onabort = () => reject(t.error);
 });
});

// ---------------------------------------------------------------------------
// Phase 7 — golden fictional fixtures
// ---------------------------------------------------------------------------

/** An ordinary sermon entry with every privacy-separated field populated. */
function fictionalSermon() {
 const e = newEntry('sermon');
 e.title = 'FICTIONAL-COMPAT Sunday gathering';
 e.date = '2026-10-11';
 e.place = 'FICTIONAL-COMPAT Example Chapel';
 e.speaker = 'FICTIONAL-COMPAT Pastor';
 e.sermonSeries = 'FICTIONAL-COMPAT series';
 e.scriptureRefs = ['John 3:16', 'Romans 10:9-10'];
 e.notes = 'FICTIONAL-COMPAT my notes';
 e.reflection = 'FICTIONAL-COMPAT my reflection';
 e.prayer = 'FICTIONAL-COMPAT my prayer';
 e.links = [{url: 'https://example.org/fictional-compat', label: 'FICTIONAL-COMPAT link', capturedTitle: ''}];
 e.tags = ['fictional', 'compat'];
 e.forDescendants = true;
 return e;
}

/** One entry of each kind, so kind survival is checked across the whole set. */
function oneOfEachKind() {
 return ['sermon','reading','prayer','reflection','letter'].map((kind) => {
  const e = newEntry(kind);
  e.title = `FICTIONAL-COMPAT ${kind}`;
  e.notes = `FICTIONAL-COMPAT notes for ${kind}`;
  return e;
 });
}

/**
 * Unknown fields at every level the preservation contract covers, including
 * property names that would be dangerous if they were ever treated as anything
 * but inert data.
 */
function withUnknownFields(entry) {
 const e = clone(entry);
 e.futureEntryField = {keep: 'FICTIONAL-COMPAT top level'};
 e.links = [{
  url: 'https://example.org/fictional-compat',
  label: '',
  capturedTitle: '',
  futureLinkField: {keep: 'FICTIONAL-COMPAT nested link'},
 }];
 // sourceMaterial has a required shape on the companion side: body, filename,
 // importedAt and a format from a fixed set. An unknown field rides alongside.
 e.sourceMaterial = {
  body: 'FICTIONAL-COMPAT provided outline',
  filename: 'FICTIONAL-COMPAT-outline.json',
  importedAt: '2026-10-11T10:00:00.000Z',
  format: 'sermon-notes-json',
  futureSourceField: {keep: 'FICTIONAL-COMPAT nested source'},
 };
 return e;
}

// ---------------------------------------------------------------------------
// Phase 9 — app -> companion
// ---------------------------------------------------------------------------

test('an app-shaped journal imports into the companion with every field in its own place', async () => {
 const sermon = fictionalSermon();
 const draft = entryDraft(newEntry('prayer'));
 draft.form.title = 'FICTIONAL-COMPAT unfinished';
 draft.form.notes = 'FICTIONAL-COMPAT half a sentence';

 // Shaped by the app's importer first, so what the companion receives is what
 // the app would actually have written.
 const fromApp = appImport(overTheWire(makeJourney([sermon], [draft])));
 assert.deepEqual(fromApp.warnings, []);

 const result = await db.importJourney(makeJourney(fromApp.entries, fromApp.drafts));
 assert.equal(result.entriesAdded, 1);
 assert.equal(result.draftsAdded, 1);

 const [stored] = await db.all('entries');
 assert.equal(stored.kind, 'sermon');
 assert.equal(stored.notes, 'FICTIONAL-COMPAT my notes');
 assert.equal(stored.reflection, 'FICTIONAL-COMPAT my reflection');
 assert.equal(stored.prayer, 'FICTIONAL-COMPAT my prayer');
 assert.deepEqual(stored.scriptureRefs, ['John 3:16', 'Romans 10:9-10']);
 assert.equal(stored.speaker, 'FICTIONAL-COMPAT Pastor');
 assert.equal(stored.place, 'FICTIONAL-COMPAT Example Chapel');
 assert.equal(stored.sermonSeries, 'FICTIONAL-COMPAT series');
 assert.equal(stored.forDescendants, true);
 assert.deepEqual(stored.tags, ['fictional','compat']);

 // A draft must still be a draft. Transfer is not a save.
 const drafts = await db.all('drafts');
 assert.equal(drafts.length, 1);
 assert.equal(drafts[0].form.notes, 'FICTIONAL-COMPAT half a sentence');
 assert.equal((await db.all('entries')).length, 1, 'the draft must not have become an entry');
});

test('every entry kind survives the app importer unchanged', () => {
 const kinds = oneOfEachKind();
 const result = appImport(overTheWire(makeJourney(kinds)));
 assert.deepEqual(result.warnings, []);
 assert.deepEqual(result.entries.map((e) => e.kind), ['sermon','reading','prayer','reflection','letter']);
 assert.deepEqual(result.entries, kinds);
});

// ---------------------------------------------------------------------------
// Phase 10 — companion -> app
// ---------------------------------------------------------------------------

test('a journal the companion actually exported is accepted by the app with no warnings', async () => {
 await db.put('entries', fictionalSermon());
 const draft = entryDraft(newEntry('reflection'));
 await db.put('drafts', draft);

 const exported = prepareJournalExport(
  await db.all('entries'),
  await db.all('drafts'),
  {metadata: metadataFromSettings(await db.all('settings')), allowEmpty: true},
 );
 assert.equal(exported.format, 'journey-export');
 assert.equal(exported.version, manifest.interchange.journeyExport);

 const fromCompanion = appImport(overTheWire(exported));
 assert.deepEqual(fromCompanion.warnings, [], `the app warned about companion output: ${fromCompanion.warnings.join(' | ')}`);
 assert.equal(fromCompanion.entries.length, 1);
 assert.equal(fromCompanion.drafts.length, 1);
 assert.equal(fromCompanion.entries[0].reflection, 'FICTIONAL-COMPAT my reflection');
 assert.equal(fromCompanion.entries[0].prayer, 'FICTIONAL-COMPAT my prayer');
});

// ---------------------------------------------------------------------------
// Phase 11 — unknown/future field torture, both directions, repeatedly
// ---------------------------------------------------------------------------

test('unknown fields at every level survive a full companion -> app -> companion -> app circuit', async () => {
 const seeded = withUnknownFields(fictionalSermon());
 await db.put('entries', seeded);

 // 1. companion export
 const first = prepareJournalExport(await db.all('entries'), [], {allowEmpty: true});
 // 2. app import
 const intoApp = appImport(overTheWire(first));
 assert.deepEqual(intoApp.warnings.filter((w) => !/future/i.test(w)), [], 'only the deliberate unknown fields may be warned about');

 const appEntry = intoApp.entries[0];
 const preserved = JSON.stringify(appEntry);
 assert.match(preserved, /FICTIONAL-COMPAT top level/, 'top-level unknown field lost by the app');
 assert.match(preserved, /FICTIONAL-COMPAT nested link/, 'nested link unknown field lost by the app');
 assert.match(preserved, /FICTIONAL-COMPAT nested source/, 'nested sourceMaterial unknown field lost by the app');

 // 3. app export -> companion import, through real storage
 const appShaped = makeJourney(intoApp.entries, intoApp.drafts ?? []);
 const factory = globalThis.indexedDB;
 globalThis.indexedDB = new IDBFactory();
 const second = await import('../dist/storage.js?interop-circuit');
 await second.openDB();
 globalThis.indexedDB = factory;

 await second.importJourney(overTheWire(appShaped));
 const [roundTripped] = await second.all('entries');
 const afterCompanion = JSON.stringify(roundTripped);
 assert.match(afterCompanion, /FICTIONAL-COMPAT top level/, 'top-level unknown field lost by the companion');
 assert.match(afterCompanion, /FICTIONAL-COMPAT nested link/, 'nested link unknown field lost by the companion');
 assert.match(afterCompanion, /FICTIONAL-COMPAT nested source/, 'nested sourceMaterial unknown field lost by the companion');

 // 4. companion export again -> app import again. Two full laps, because a
 // preservation bug often only shows on the second trip.
 const third = prepareJournalExport(await second.all('entries'), [], {allowEmpty: true});
 const backIntoApp = appImport(overTheWire(third));
 const final = JSON.stringify(backIntoApp.entries[0]);
 for (const marker of ['FICTIONAL-COMPAT top level','FICTIONAL-COMPAT nested link','FICTIONAL-COMPAT nested source']) {
  assert.match(final, new RegExp(marker), `${marker} did not survive two full laps`);
 }
 // The reader's own words must be exactly as written, not merely present.
 assert.equal(backIntoApp.entries[0].notes, 'FICTIONAL-COMPAT my notes');
 assert.equal(backIntoApp.entries[0].reflection, 'FICTIONAL-COMPAT my reflection');
 assert.equal(backIntoApp.entries[0].prayer, 'FICTIONAL-COMPAT my prayer');
});

test('dangerous property names cross as inert data and never pollute a prototype', async () => {
 // Parsed rather than written as a literal: `{__proto__: ...}` in source is a
 // prototype assignment, not an own property, so a literal would test nothing.
 const entry = JSON.parse(
  JSON.stringify(fictionalSermon()).slice(0, -1) +
  ',"__proto__":{"polluted":true},"constructor":{"alsoPolluted":true},"futureField":{"keep":"FICTIONAL-COMPAT"}}',
 );
 const journal = makeJourney([entry]);
 assert.equal({}.polluted, undefined, 'companion export polluted Object.prototype');

 const intoApp = appImport(overTheWire(journal));
 assert.equal({}.polluted, undefined, 'app import polluted Object.prototype');
 assert.equal({}.alsoPolluted, undefined);
 assert.equal(({}).constructor, Object, 'constructor was overwritten');

 // The ordinary unknown field still has to survive all of that.
 assert.match(JSON.stringify(intoApp.entries[0]), /FICTIONAL-COMPAT/);

 await db.importJourney(overTheWire(journal));
 assert.equal({}.polluted, undefined, 'companion storage commit polluted Object.prototype');
 assert.equal((await db.all('entries')).length, 1);
});

// ---------------------------------------------------------------------------
// Phase 12 — drafts, independently of entries
// ---------------------------------------------------------------------------

test('an unfinished draft crosses to the app and back without becoming an entry', async () => {
 const draft = entryDraft(newEntry('letter'));
 draft.form.title = 'FICTIONAL-COMPAT for my family';
 draft.form.notes = 'FICTIONAL-COMPAT an unfinished sentence  ';
 draft.form.futureFormField = {keep: 'FICTIONAL-COMPAT draft form'};

 const intoApp = appImport(overTheWire(makeJourney([], [draft])));
 assert.equal(intoApp.entries.length, 0, 'a transferred draft must never arrive as a saved entry');
 assert.equal(intoApp.drafts.length, 1);
 // Trailing whitespace is half-typed state and must not be tidied away.
 assert.equal(intoApp.drafts[0].form.notes, 'FICTIONAL-COMPAT an unfinished sentence  ');
 assert.deepEqual(intoApp.drafts[0]._unmigrated.form.futureFormField, {keep: 'FICTIONAL-COMPAT draft form'});

 await db.importJourney(makeJourney(intoApp.entries, intoApp.drafts));
 assert.equal((await db.all('entries')).length, 0);
 assert.equal((await db.all('drafts')).length, 1);

 // And promoting it is still a deliberate act that keeps the writing.
 const promoted = draftEntry((await db.all('drafts'))[0]);
 assert.equal(promoted.notes, 'FICTIONAL-COMPAT an unfinished sentence  ');
 assert.equal(promoted.kind, 'letter');
});

test('repeated draft import does not multiply identical drafts', async () => {
 const draft = entryDraft(newEntry('prayer'));
 const journal = makeJourney([], [draft]);
 assert.equal((await db.importJourney(overTheWire(journal))).draftsAdded, 1);
 for (let i = 0; i < 3; i += 1) {
  assert.equal((await db.importJourney(overTheWire(journal))).draftsAdded, 0);
 }
 assert.equal((await db.all('drafts')).length, 1);
});

// ---------------------------------------------------------------------------
// Phase 8 — protected transfer, against the independent known-answer fixture
// ---------------------------------------------------------------------------

test('the app-compatible protected fixture unlocks in the companion and keeps its fields apart', async () => {
 const sealed = JSON.parse(await readFile(new URL('./fixtures/protected-v1.lwc', import.meta.url), 'utf8'));
 const meta = JSON.parse(await readFile(new URL('./fixtures/protected-v1.metadata.json', import.meta.url), 'utf8'));

 assert.equal(sealed.format, 'lwc-companion-protected');
 assert.equal(sealed.version, manifest.interchange.protectedTransfer);

 const opened = await unprotect(sealed, meta.password);
 validateJourney(opened);

 /*
  * This fixture was sealed by an older companion build, so its draft form still
  * carries the retired tags/visibility/updatedAt fields and it has deliberate
  * unknown fields of its own. That makes it a better test than a freshly sealed
  * one: it is literally "a file written by another edition", which is the case
  * the contract exists for. Re-sealing it with today's code would also make it
  * circular — the same code proving itself.
  *
  * So the requirement is not silence. It is that every warning is of the
  * non-destructive kind, and that the writing itself arrives intact.
  */
 const intoApp = appImport(overTheWire(opened));
 for (const warning of intoApp.warnings) {
  assert.match(warning, /preserved in _unmigrated|retained in its original location/,
   `a warning indicates something other than preservation: ${warning}`);
 }
 assert.ok(intoApp.entries.length >= 1);
 assert.equal(intoApp.entries.length, opened.entries.length, 'the app dropped an entry from the sealed journal');
 assert.equal((intoApp.drafts ?? []).length, (opened.drafts ?? []).length, 'the app dropped a draft from the sealed journal');
 // Nothing from the older edition was thrown away.
 assert.match(JSON.stringify(intoApp), /futureEntry/, 'an older edition\'s unknown entry field was lost');
 assert.match(JSON.stringify(intoApp), /futureDraft/, 'an older edition\'s unknown draft field was lost');
});

test('a companion-sealed journal opens, and a wrong password or a tampered byte yields nothing', async () => {
 const journal = makeJourney([fictionalSermon()]);
 const password = 'FICTIONAL-COMPAT transfer password 2026';
 const sealed = await protect(journal, password);

 // No plaintext may be readable in the sealed file.
 const asText = JSON.stringify(sealed);
 for (const secret of ['FICTIONAL-COMPAT my notes','FICTIONAL-COMPAT my reflection','FICTIONAL-COMPAT my prayer']) {
  assert.ok(!asText.includes(secret), `plaintext leaked into the protected file: ${secret}`);
 }

 const opened = await unprotect(sealed, password);
 assert.deepEqual(appImport(overTheWire(opened)).warnings, []);
 assert.equal(opened.entries[0].reflection, 'FICTIONAL-COMPAT my reflection');

 await assert.rejects(() => unprotect(sealed, 'FICTIONAL-COMPAT wrong password'));

 const bytes = Buffer.from(sealed.data, 'base64');
 bytes[0] ^= 1;
 await assert.rejects(() => unprotect({...sealed, data: bytes.toString('base64')}, password));
 await assert.rejects(() => unprotect({...sealed, iterations: 1}, password));
});

// ---------------------------------------------------------------------------
// Phase 13 — Sermon Pack, and the privacy rule that matters most
// ---------------------------------------------------------------------------

test("an imported Sermon Pack stays Provided notes and never becomes the reader's own words", async () => {
 const pack = JSON.parse(await readFile(new URL('../dist/example-sermon-notes.json', import.meta.url), 'utf8'));
 assert.equal(pack.format, 'my-life-with-christ-sermon-notes');
 assert.equal(pack.version, manifest.interchange.sermonNotes);

 const bytes = new TextEncoder().encode(JSON.stringify(pack));
 const entry = await sermonEntry(pack, 'FICTIONAL-COMPAT-outline.json', bytes);

 // The church's prose is provided material, with provenance.
 assert.equal(entry.sourceMaterial.body, pack.bodyMarkdown);
 assert.match(entry.sourceMaterial.sha256, /^[a-f0-9]{64}$/);

 // And the reader has not written anything yet.
 assert.equal(entry.notes, '', 'church prose leaked into My Notes');
 assert.equal(entry.reflection, '', 'church prose leaked into Reflection');
 assert.equal(entry.prayer, '', 'church prose leaked into Prayer');
 assert.ok(markdown(entry).includes('## Provided notes'));

 // It must still be provided material after a trip through the app.
 const intoApp = appImport(overTheWire(makeJourney([entry])));
 assert.deepEqual(intoApp.warnings, []);
 assert.equal(intoApp.entries[0].sourceMaterial.body, pack.bodyMarkdown);
 assert.equal(intoApp.entries[0].notes, '');
 assert.equal(intoApp.entries[0].reflection, '');
 assert.equal(intoApp.entries[0].prayer, '');
});

// ---------------------------------------------------------------------------
// Phase 10/J — duplicate and conflict semantics, end to end
// ---------------------------------------------------------------------------

test('duplicate and changed-entry imports follow the documented policy on both sides', async () => {
 const entry = fictionalSermon();
 await db.put('entries', entry);

 // Same bytes again: nothing added.
 const same = makeJourney([entry]);
 assert.equal((await db.importJourney(overTheWire(same))).entriesAdded, 0);
 assert.equal((await db.all('entries')).length, 1);

 // A changed version: kept as its own copy, original intact, never resolved by
 // clock. Shaped by the app first, so this is a genuine cross-edition edit.
 const edited = {...clone(entry), notes: 'FICTIONAL-COMPAT edited on the phone', updatedAt: '2026-10-12T09:00:00.000Z'};
 const fromApp = appImport(overTheWire(makeJourney([edited])));
 const result = await db.importJourney(makeJourney(fromApp.entries));
 assert.ok(result.entriesAdded >= 1 || result.copies >= 1);

 const rows = await db.all('entries');
 assert.ok(rows.some((r) => r.notes === 'FICTIONAL-COMPAT my notes'), 'the original reading was destroyed');
 assert.ok(rows.some((r) => r.notes === 'FICTIONAL-COMPAT edited on the phone'), 'the changed reading was dropped');
});

// ---------------------------------------------------------------------------
// Phase 11/G — envelope metadata
// ---------------------------------------------------------------------------

test('journal envelope metadata written by another edition survives a full circuit', async () => {
 const raw = {
  ...makeJourney([]),
  futureJournalMetadata: {owner: 'FICTIONAL-COMPAT reader', note: 'FICTIONAL-COMPAT opaque'},
 };
 assert.equal((await db.importJourney(raw)).metadataMapsAdded, 1);

 const exported = prepareJournalExport(
  await db.all('entries'),
  await db.all('drafts'),
  {metadata: metadataFromSettings(await db.all('settings')), allowEmpty: true},
 );
 assert.deepEqual(exported.futureJournalMetadata, raw.futureJournalMetadata);

 /*
  * The app's side of this is a different seam, deliberately. `migrateExport`
  * returns entries, drafts and warnings; journal-level extension data belongs to
  * the journal and lives in the app's own `envelopeMetadata` store (IndexedDB
  * schema 3 / SQLite schema 3), per docs/JOURNAL-ENVELOPE-PRESERVATION.md —
  * "including a journal with zero entries and zero drafts". Asserting on
  * migrateExport's return value here would be testing the wrong thing and would
  * read as an app defect when it is an architectural boundary.
  *
  * What IS checkable from here: the app importer accepts an envelope carrying
  * unknown journal metadata without complaint or loss of entries.
  */
 const intoApp = appImport(overTheWire(exported));
 assert.deepEqual(intoApp.warnings, [], 'unknown envelope metadata should not warn at the entry importer');
 assert.deepEqual(intoApp.entries, []);
});

// ---------------------------------------------------------------------------
// Phase 11/K/M — malformed input and the empty journal
// ---------------------------------------------------------------------------

test('malformed journals are refused by both sides and commit nothing', async () => {
 // Structurally broken input: both sides must refuse it.
 const bad = [
  {},
  {format: 'something-else', version: 1, entries: []},
  {format: 'journey-export', version: 1, entries: 'not an array'},
  {format: 'journey-export', version: 1},
  null,
 ];
 await db.put('entries', fictionalSermon());
 const before = await db.all('entries');

 for (const raw of bad) {
  assert.throws(() => validateJourney(raw), undefined, `companion accepted malformed input: ${JSON.stringify(raw)}`);
  assert.throws(() => appImport(clone(raw) ?? raw), undefined, `app accepted malformed input: ${JSON.stringify(raw)}`);
 }
 assert.deepEqual(await db.all('entries'), before, 'a refused import still changed storage');
});

test('a newer format version is refused by the companion and warned about by the app', () => {
 /*
  * A deliberate, documented asymmetry rather than a defect, and worth pinning
  * so nobody "fixes" either side into agreement:
  *
  *   companion  fails closed. "Choose a My Life With Christ journal export
  *              (version 1)." It will not act on a file it cannot fully
  *              understand.
  *   app        accepts it with a warning and preserves unrecognised fields,
  *              recording `migratedFrom`. Forward compatibility, so a newer
  *              export is not stranded.
  *
  * Neither silently destroys anything, which is the property that matters.
  */
 const future = {format: 'journey-export', version: 99, entries: []};

 assert.throws(() => validateJourney(future), /version 1/);

 const intoApp = appImport(clone(future));
 assert.equal(intoApp.migratedFrom, 99);
 assert.equal(intoApp.warnings.length, 1);
 assert.match(intoApp.warnings[0], /newer version/);
 assert.match(intoApp.warnings[0], /preserved, not discarded/);
});

test('an empty journal is valid on both sides and adds nothing', async () => {
 const empty = prepareJournalExport([], [], {allowEmpty: true});
 assert.deepEqual(validateJourney(empty).entries, []);
 const intoApp = appImport(overTheWire(empty));
 assert.deepEqual(intoApp.entries, []);
 assert.deepEqual(intoApp.warnings, []);
 const result = await db.importJourney(overTheWire(empty));
 assert.equal(result.entriesAdded, 0);
});

// ---------------------------------------------------------------------------
// Provided notes that came out of a Word document
// ---------------------------------------------------------------------------

test('provided notes from a Word document survive the round trip, named for what they are', async () => {
 /*
  The app learned to read a .docx handed out at church, and records that it
  did: SourceMaterial.format is `docx` rather than `txt`, because calling it
  text merely because extraction produced text would be a lie on the record
  about where somebody's words came from.

  That is an interchange change, and this is the check that the companion did
  not quietly become the reason it cannot be carried. Before this, the
  companion's validator rejected the format outright — a perfectly well-formed
  app export would have been refused with "Provided notes are malformed."
 */
 const sermon = fictionalSermon();
 sermon.sourceMaterial = {
  body: 'FICTIONAL-COMPAT handout read from a Word document',
  filename: 'FICTIONAL-COMPAT-handout.docx',
  importedAt: '2026-10-15T10:00:00.000Z',
  format: 'docx',
  parserVersion: 1,
  futureSourceField: {keep: 'FICTIONAL-COMPAT nested source'},
 };

 // The app's own importer first, so what the companion receives is what the
 // app would actually have written.
 const fromApp = appImport(overTheWire(makeJourney([sermon])));
 assert.deepEqual(fromApp.warnings, [], 'the app itself is content with the format');
 assert.equal(fromApp.entries[0].sourceMaterial.format, 'docx');

 const result = await db.importJourney(makeJourney(fromApp.entries, []));
 assert.equal(result.entriesAdded, 1, 'the companion accepts it');

 const [stored] = await db.all('entries');
 assert.equal(stored.sourceMaterial.format, 'docx', 'still named for what it is');
 assert.equal(stored.sourceMaterial.body, sermon.sourceMaterial.body, 'with its words intact');
 assert.equal(stored.sourceMaterial.filename, 'FICTIONAL-COMPAT-handout.docx');
 // Unknown fields ride along, as every other provided-note field does.
 assert.deepEqual(stored.sourceMaterial.futureSourceField, {
  keep: 'FICTIONAL-COMPAT nested source',
 });

 // And back out again without loss, into something the app accepts.
 const exported = prepareJournalExport(await db.all('entries'), [], {allowEmpty: true});
 const returned = appImport(overTheWire(exported));
 assert.deepEqual(returned.warnings, [], 'the app accepts what the companion returns');
 assert.equal(returned.entries[0].sourceMaterial.format, 'docx', 'the format survives both ways');
 assert.equal(returned.entries[0].sourceMaterial.body, sermon.sourceMaterial.body);
});
