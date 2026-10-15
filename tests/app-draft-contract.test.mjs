// The draft-form contract shared with the native app.
//
// A companion draft travels to the app inside a `journey-export`, and the app
// validates `form` against its own `DraftForm` shape. That shape deliberately
// carries `tagsText` — the raw string as typed, "not split into tags until a
// save asks for that" — and has no `tags`, `visibility` or `updatedAt`, which
// are entry-level state rather than half-typed form state.
//
// The companion used to build `form` by spreading the whole entry, so every
// draft it produced carried those three extra fields. The app preserved them
// (into `_unmigrated.form`) and warned about each one, so nothing was lost —
// but every single companion draft import produced three warnings, and the two
// draft shapes had quietly diverged. Noise today is a loss waiting for the day
// a newer edition stops preserving.
//
// These tests pin the agreement in both directions: the form the companion
// emits, and what the app's own importer says about it.
//
// All content here is fictional.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';

import {newEntry, entryDraft, draftEntry, makeJourney} from '../dist/core.js';

/**
 * The app's recognised draft-form fields, from src/export/migrate.ts
 * (DRAFT_FORM_FIELDS) and src/types/index.ts (DraftForm) in the native
 * repository. Mirrored here so a change on either side shows up as a failure
 * rather than as drift nobody notices.
 */
const APP_DRAFT_FORM_FIELDS = [
 'kind','title','date','place','speaker','sermonSeries','notes','reflection',
 'prayer','tagsText','links','anchors','forDescendants','scriptureRefs','sourceMaterial',
];

/** Entry-level fields that must never appear inside a draft form. */
const NOT_FORM_FIELDS = ['tags','visibility','updatedAt','id','createdAt'];

// The app's actual importer, type-stripped the same way core.test.mjs does it.
const tmp = new URL('../.test-tmp/draft-contract/', import.meta.url);
await mkdir(tmp, {recursive: true});
for (const [src, out] of [['lib/entry-kinds.ts','entry-kinds.mjs'],['export/migrate.ts','migrate.mjs']]) {
 const source = await readFile(new URL('../compat/src/' + src, import.meta.url), 'utf8');
 await writeFile(new URL(out, tmp), stripTypeScriptTypes(source).replace("'../lib/entry-kinds'", "'./entry-kinds.mjs'"));
}
const {migrateExport} = await import(new URL('migrate.mjs', tmp).href);

function fictionalEntry() {
 const e = newEntry('sermon');
 e.title = 'FICTIONAL-COMPAT draft contract';
 e.notes = 'FICTIONAL-COMPAT my notes';
 e.reflection = 'FICTIONAL-COMPAT my reflection';
 e.prayer = 'FICTIONAL-COMPAT my prayer';
 e.tags = ['fictional', 'compat'];
 e.links = [{url: 'https://example.org/fictional-compat'}];
 return e;
}

test('a companion draft form carries only fields the app recognises', () => {
 const draft = entryDraft(fictionalEntry());
 const extra = Object.keys(draft.form).filter((k) => !APP_DRAFT_FORM_FIELDS.includes(k));
 assert.deepEqual(extra, [], `draft form carries fields the app does not recognise: ${extra.join(', ')}`);
 for (const field of NOT_FORM_FIELDS) {
  assert.equal(Object.hasOwn(draft.form, field), false, `${field} is entry-level and must not be in form`);
 }
});

test('tags reach the app as tagsText, exactly as typed, and are not lost', () => {
 const entry = fictionalEntry();
 const draft = entryDraft(entry);
 assert.equal(draft.form.tagsText, 'fictional, compat');
 // The full entry is still preserved verbatim, so nothing is thrown away by
 // keeping the form to its contract.
 assert.deepEqual(draft._unmigrated.companionEntry.tags, entry.tags);
 assert.equal(draft._unmigrated.companionEntry.visibility, entry.visibility);
});

test('the app imports a companion draft with no warnings at all', () => {
 const draft = entryDraft(fictionalEntry());
 const result = migrateExport(JSON.parse(JSON.stringify(makeJourney([], [draft]))));
 assert.deepEqual(result.warnings, [], `app warned about a companion draft: ${result.warnings.join(' | ')}`);
 assert.equal(result.drafts.length, 1);
});

test('an unknown nested link field still survives the app importer', () => {
 const entry = fictionalEntry();
 entry.links = [{url: 'https://example.org/fictional-compat', futureLink: {keep: true}}];
 const draft = entryDraft(entry);
 assert.deepEqual(draft.form.links[0].futureLink, {keep: true});

 const result = migrateExport(JSON.parse(JSON.stringify(makeJourney([], [draft]))));
 assert.deepEqual(result.warnings, []);
 assert.deepEqual(result.drafts[0].form.links[0].futureLink, {keep: true});
 assert.equal(result.drafts[0].form.links[0].label, '');
 assert.equal(result.drafts[0].form.links[0].capturedTitle, '');
});

test('an unknown draft-form field is still preserved, and is the only thing warned about', () => {
 // Keeping the form to its contract must not become a whitelist that destroys
 // what a newer edition wrote. An unknown field still rides along.
 const draft = entryDraft(fictionalEntry());
 draft.form.futureFormField = {keep: 'FICTIONAL-COMPAT'};

 const result = migrateExport(JSON.parse(JSON.stringify(makeJourney([], [draft]))));
 assert.equal(result.warnings.length, 1, `expected only the deliberate unknown field: ${result.warnings.join(' | ')}`);
 assert.match(result.warnings[0], /futureFormField/);
 assert.deepEqual(result.drafts[0]._unmigrated.form.futureFormField, {keep: 'FICTIONAL-COMPAT'});
});

test('an older draft whose form carries the retired fields is cleaned when continued', () => {
 // Drafts already written by an earlier companion build have tags/visibility/
 // updatedAt in their form. Continuing one must not carry them forward, or the
 // warnings would outlive the fix.
 const entry = fictionalEntry();
 const stale = entryDraft(entry);
 stale.form.tags = ['fictional'];
 stale.form.visibility = 'private';
 stale.form.updatedAt = '2026-10-01T00:00:00.000Z';

 const continued = entryDraft(entry, stale);
 for (const field of ['tags', 'visibility', 'updatedAt']) {
  assert.equal(Object.hasOwn(continued.form, field), false, `${field} survived into a continued draft`);
 }
 const result = migrateExport(JSON.parse(JSON.stringify(makeJourney([], [continued]))));
 assert.deepEqual(result.warnings, []);
});

test('promoting a draft back to an entry still restores tags and visibility', () => {
 // The repair removes fields from `form`, so prove the save path still has
 // everything it needs to rebuild a complete entry.
 const entry = fictionalEntry();
 const draft = entryDraft(entry);
 const promoted = draftEntry(draft);
 assert.deepEqual(promoted.tags, entry.tags);
 assert.equal(promoted.visibility, entry.visibility);
 assert.equal(promoted.notes, entry.notes);
 assert.equal(promoted.reflection, entry.reflection);
 assert.equal(promoted.prayer, entry.prayer);
});
