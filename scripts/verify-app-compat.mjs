#!/usr/bin/env node
/**
 * Prove the companion still holds the native app's interchange contract.
 *
 * `compat/` carries byte-exact copies of native-app source. Companion tests
 * type-strip them and run the app's REAL importer as a compatibility oracle, so
 * if those copies go stale the companion proves compatibility with a version of
 * the app that no longer exists. That is exactly what had happened: the oracle
 * was 33 commits and 330 lines behind, and it was hiding a live defect in the
 * draft form the companion produced.
 *
 * This check is deliberately OFFLINE and deterministic, so ordinary CI cannot be
 * turned red by a GitHub outage. It answers three questions:
 *
 *   1. Are the copies still the bytes we recorded? (local tampering, bad merge)
 *   2. Do the recorded interchange versions still match what the runtime emits?
 *   3. Does the copied oracle actually load and behave?
 *
 * What it CANNOT answer is whether native main has moved on since. Nothing local
 * can. That is the job of the scheduled cross-repository drift workflow,
 * .github/workflows/native-drift.yml.
 *
 * Usage:
 *   npm run verify:app-compat
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = resolve(ROOT, 'compat/SOURCE.json');

/**
 * Strings that must appear in the copied material.
 *
 * A hash check proves a file is what we recorded; it cannot tell a real module
 * from a recorded empty file. These prove the copies still contain the
 * behaviour the oracle is supposed to supply.
 */
const SENTINELS = [
  { path: 'compat/src/export/migrate.ts', needle: 'DRAFT_FORM_FIELDS', why: 'the draft-form allow-list the companion must match' },
  { path: 'compat/src/export/migrate.ts', needle: '_unmigrated', why: 'unknown-field preservation' },
  { path: 'compat/src/export/migrate.ts', needle: 'CURRENT_VERSION', why: 'the journey-export version constant' },
  { path: 'compat/src/lib/entry-kinds.ts', needle: 'sermon', why: 'the entry kinds shared with the app' },
];

/** Below this, the manifest is not describing a real snapshot. */
const MINIMUM_FILES = 5;

const REQUIRED = ['MANIFEST_READ', 'SNAPSHOTS_EXACT', 'VERSIONS_AGREE', 'ORACLE_WORKS'];

async function main() {
  /** @type {Array<{assertion:string,detail:string}>} */
  const failures = [];
  /** @type {Map<string,string>} */
  const ran = new Map();

  if (!existsSync(MANIFEST)) {
    console.error(`No compatibility manifest at ${MANIFEST}.`);
    process.exitCode = 1;
    return;
  }
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const files = Array.isArray(manifest.files) ? manifest.files : [];

  console.log(`Verifying companion against native ${manifest.nativeRepository}`);
  console.log(`  recorded native SHA: ${manifest.nativeSourceSha}`);
  console.log(`  ${files.length} compat files\n`);

  // ---- 1. The manifest describes a real snapshot. ----
  if (files.length < MINIMUM_FILES) {
    failures.push({
      assertion: 'MANIFEST_READ',
      detail: `manifest lists ${files.length} files, expected at least ${MINIMUM_FILES}`,
    });
  }
  if (!/^[0-9a-f]{40}$/.test(manifest.nativeSourceSha ?? '')) {
    failures.push({
      assertion: 'MANIFEST_READ',
      detail: `nativeSourceSha ${JSON.stringify(manifest.nativeSourceSha)} is not a full commit SHA`,
    });
  }
  for (const sentinel of SENTINELS) {
    const path = resolve(ROOT, sentinel.path);
    const body = existsSync(path) ? await readFile(path, 'utf8') : '';
    if (!body.includes(sentinel.needle)) {
      failures.push({
        assertion: 'MANIFEST_READ',
        detail: `${sentinel.path} no longer contains ${JSON.stringify(sentinel.needle)} (${sentinel.why})`,
      });
    }
  }
  ran.set('MANIFEST_READ', `${files.length} files declared, ${SENTINELS.length} sentinels found`);

  // ---- 2. Exact snapshots are still exactly what was recorded. ----
  let exact = 0;
  let adapted = 0;
  for (const entry of files) {
    const path = resolve(ROOT, entry.companionPath);
    if (!existsSync(path)) {
      failures.push({ assertion: 'SNAPSHOTS_EXACT', detail: `${entry.companionPath} is missing` });
      continue;
    }
    if (entry.kind === 'adapted') {
      // An adapted copy cannot be checked by hash; its behaviour tests are the
      // contract. Counted so the summary cannot imply more than was checked.
      adapted += 1;
      continue;
    }
    exact += 1;
    const actual = createHash('sha256').update(await readFile(path)).digest('hex');
    if (actual !== entry.sha256) {
      failures.push({
        assertion: 'SNAPSHOTS_EXACT',
        detail:
          `${entry.companionPath} no longer matches the recorded snapshot of ${entry.nativePath}\n` +
          `          recorded ${entry.sha256}\n` +
          `          actual   ${actual}\n` +
          `          If this change is intended, re-sync from ${manifest.nativeRepository} and update compat/SOURCE.json.`,
      });
    }
  }
  ran.set('SNAPSHOTS_EXACT', `${exact} exact copies hash-verified${adapted ? `, ${adapted} adapted (behaviour-tested)` : ''}`);

  // ---- 3. The recorded interchange versions match the shipped runtime. ----
  /*
   * The manifest is only worth having if it cannot drift from the code. These
   * read the literals the companion actually emits, so bumping a format version
   * without updating the manifest fails here rather than in the field.
   */
  const core = await readFile(resolve(ROOT, 'dist/core.js'), 'utf8');
  const expectations = [
    { name: 'journeyExport', pattern: /format:'journey-export',version:(\d+)/ },
    { name: 'protectedTransfer', pattern: /format:'lwc-companion-protected',version:(\d+)/ },
    // validateSermon is the gate a Sermon Pack passes through, so the version it
    // insists on is the one that actually matters. Checked rather than printed:
    // the summary line below names all three, and a line nobody verified is the
    // kind of decoration this repository keeps learning not to trust.
    { name: 'sermonNotes', pattern: /raw\.version!==(\d+)\)throw Error\('Choose a sermon-notes file in version/ },
  ];
  for (const { name, pattern } of expectations) {
    const found = core.match(pattern);
    if (!found) {
      failures.push({
        assertion: 'VERSIONS_AGREE',
        detail: `could not find the ${name} version literal in dist/core.js; this check has stopped checking anything`,
      });
      continue;
    }
    const actual = Number(found[1]);
    const recorded = manifest.interchange?.[name];
    if (actual !== recorded) {
      failures.push({
        assertion: 'VERSIONS_AGREE',
        detail: `${name}: runtime emits version ${actual}, manifest records ${recorded}`,
      });
    }
  }
  // The app's own constant has to agree too, or the two sides disagree about
  // what "version 1" means.
  const oracleSource = await readFile(resolve(ROOT, 'compat/src/export/migrate.ts'), 'utf8');
  const appVersion = oracleSource.match(/CURRENT_VERSION\s*=\s*(\d+)/);
  if (!appVersion) {
    failures.push({ assertion: 'VERSIONS_AGREE', detail: 'CURRENT_VERSION not found in the copied app importer' });
  } else if (Number(appVersion[1]) !== manifest.interchange?.journeyExport) {
    failures.push({
      assertion: 'VERSIONS_AGREE',
      detail: `app CURRENT_VERSION is ${appVersion[1]}, manifest records journeyExport ${manifest.interchange?.journeyExport}`,
    });
  }
  ran.set(
    'VERSIONS_AGREE',
    `journey-export ${manifest.interchange?.journeyExport}, protected-transfer ${manifest.interchange?.protectedTransfer}, sermon-notes ${manifest.interchange?.sermonNotes}`,
  );

  // ---- 4. The oracle loads and behaves. ----
  /*
   * Hash equality proves provenance, not usability. If the app's importer cannot
   * be type-stripped and run any more, every compatibility test in this
   * repository is silently testing nothing.
   */
  try {
    const tmp = resolve(ROOT, '.test-tmp/app-compat');
    await mkdir(tmp, { recursive: true });
    for (const [src, out] of [['lib/entry-kinds.ts', 'entry-kinds.mjs'], ['export/migrate.ts', 'migrate.mjs']]) {
      const source = await readFile(resolve(ROOT, 'compat/src', src), 'utf8');
      await writeFile(
        resolve(tmp, out),
        stripTypeScriptTypes(source).replace("'../lib/entry-kinds'", "'./entry-kinds.mjs'"),
      );
    }
    const { migrateExport } = await import(`file://${resolve(tmp, 'migrate.mjs')}`);
    const { newEntry, makeJourney, entryDraft } = await import(`file://${resolve(ROOT, 'dist/core.js')}`);

    const entry = newEntry('sermon');
    entry.title = 'FICTIONAL-COMPAT verify';
    const draft = entryDraft(entry);
    const result = migrateExport(JSON.parse(JSON.stringify(makeJourney([entry], [draft]))));

    if (result.entries.length !== 1) {
      failures.push({ assertion: 'ORACLE_WORKS', detail: `app importer returned ${result.entries.length} entries, expected 1` });
    }
    if (result.drafts.length !== 1) {
      failures.push({ assertion: 'ORACLE_WORKS', detail: `app importer returned ${result.drafts.length} drafts, expected 1` });
    }
    if (result.warnings.length !== 0) {
      failures.push({
        assertion: 'ORACLE_WORKS',
        detail: `the app warns about ordinary companion output, so the two draft shapes have diverged:\n          ${result.warnings.join('\n          ')}`,
      });
    }
    ran.set('ORACLE_WORKS', `app importer ran: 1 entry, 1 draft, ${result.warnings.length} warnings`);
  } catch (error) {
    failures.push({ assertion: 'ORACLE_WORKS', detail: `the copied app importer could not run: ${error.message}` });
  }

  // ---- Report. Only an assertion that ran may print a line. ----
  for (const name of REQUIRED) {
    if (!ran.has(name)) {
      failures.push({
        assertion: 'ASSERTIONS_COMPLETE',
        detail: `${name} never ran, so compatibility has not been verified`,
      });
    }
  }

  if (failures.length > 0) {
    const grouped = new Map();
    for (const failure of failures) {
      if (!grouped.has(failure.assertion)) grouped.set(failure.assertion, []);
      grouped.get(failure.assertion).push(failure.detail);
    }
    console.error('FAILED — the companion no longer matches the recorded native contract.\n');
    for (const [assertion, details] of grouped) {
      console.error(`  ${assertion} — ${details.length} problem${details.length === 1 ? '' : 's'}`);
      for (const detail of details) console.error(`      ${detail}`);
      console.error('');
    }
    process.exitCode = 1;
    return;
  }

  const width = Math.max(...REQUIRED.map((n) => n.length)) + 2;
  console.log('PASS');
  for (const name of REQUIRED) console.log(`  ${name.padEnd(width)}${ran.get(name)}`);
  console.log('\nThe companion matches the recorded native interchange contract.');
  console.log('This is a local check. Whether native main has moved is answered by');
  console.log('.github/workflows/native-drift.yml.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
