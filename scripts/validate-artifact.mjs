#!/usr/bin/env node
/**
 * Prove that `dist/` is the artifact we intend to publish.
 *
 * This runs before `upload-pages-artifact`, so a deploy cannot carry a broken
 * or mis-addressed site. Every check is shaped as "collect problems, assert the
 * list is empty", which an empty directory satisfies perfectly — so this also
 * asserts what it looked at. A gate that cannot tell an empty `dist/` from a
 * good one is not a gate.
 *
 * Usage:
 *   node scripts/validate-artifact.mjs
 *   EXPECTED_DOMAIN=journal.prayersealed.org node scripts/validate-artifact.mjs
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');

/** The permanent address this artifact is built for. */
const EXPECTED_DOMAIN = process.env.EXPECTED_DOMAIN ?? 'journal.prayersealed.org';

/**
 * Strings that must be present in any real build of this companion.
 *
 * A file count can be satisfied by the wrong files. These prove the validator
 * reached the content it claims to be checking.
 */
const SENTINELS = [
  { needle: 'My Life With Christ', why: 'the product name, in index.html' },
  { needle: "connect-src 'none'", why: 'the Content Security Policy that keeps writing local' },
  { needle: 'lwcReady', why: 'the application bootstrap the browser harness waits on' },
];

/** Below these, this is not a real artifact. */
const MINIMUM_FILES = 10;
const MINIMUM_BYTES = 100_000;

/** Runtime modules the application imports from one another. */
const REQUIRED_FILES = [
  'index.html',
  'app.js',
  'core.js',
  'storage.js',
  'archive.js',
  'transfer.js',
  'envelope-metadata.js',
  'save-queue.js',
  'style.css',
  'icon.svg',
  'vendor/qrcode.js',
  'CNAME',
];

/**
 * Which files this validator reads as text.
 *
 * `CNAME` is extensionless and was missed by an extension-only matcher, so the
 * domain check read an empty string and failed while the file was in fact
 * correct. Named explicitly rather than inferred.
 */
const TEXT = /(\.(html|js|mjs|css|json|md|svg|txt)|(^|\/)CNAME)$/i;

async function collect(dir) {
  const found = [];
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) found.push(...(await collect(path)));
    else found.push(path);
  }
  return found;
}

async function main() {
  if (!existsSync(DIST)) {
    console.error(`No artifact at ${DIST}.`);
    process.exitCode = 1;
    return;
  }

  const files = await collect(DIST);
  const paths = files.map((file) => relative(DIST, file).split('\\').join('/'));
  const textFiles = files.filter((file) => TEXT.test(file));

  /** @type {Array<{assertion: string, detail: string}>} */
  const failures = [];
  /** @type {Map<string, string>} */
  const ran = new Map();

  let bytes = 0;
  for (const file of textFiles) bytes += (await stat(file)).size;

  // ---- 1. This is a real artifact. ----
  if (files.length < MINIMUM_FILES) {
    failures.push({
      assertion: 'ARTIFACT_WAS_READ',
      detail: `dist/ holds ${files.length} files, expected at least ${MINIMUM_FILES}`,
    });
  }
  if (bytes < MINIMUM_BYTES) {
    failures.push({
      assertion: 'ARTIFACT_WAS_READ',
      detail: `dist/ holds ${bytes} text bytes, expected at least ${MINIMUM_BYTES}`,
    });
  }

  const contents = new Map();
  const found = new Set();
  for (const file of textFiles) {
    const body = await readFile(file, 'utf8');
    contents.set(relative(DIST, file).split('\\').join('/'), body);
    for (const sentinel of SENTINELS) {
      if (body.includes(sentinel.needle)) found.add(sentinel.needle);
    }
  }
  for (const sentinel of SENTINELS) {
    if (!found.has(sentinel.needle)) {
      failures.push({
        assertion: 'ARTIFACT_WAS_READ',
        detail: `sentinel ${JSON.stringify(sentinel.needle)} (${sentinel.why}) was not found in dist/`,
      });
    }
  }
  ran.set(
    'ARTIFACT_WAS_READ',
    `${files.length} files, ${Math.round(bytes / 1024)}kB read, ${found.size}/${SENTINELS.length} sentinels found`,
  );

  // ---- 2. Everything the application needs is present. ----
  for (const required of REQUIRED_FILES) {
    if (!paths.includes(required)) {
      failures.push({ assertion: 'RUNTIME_COMPLETE', detail: `dist/${required} is missing` });
    }
  }
  ran.set('RUNTIME_COMPLETE', `all ${REQUIRED_FILES.length} required runtime files present`);

  // ---- 3. The custom domain travels with the artifact. ----
  /*
   * GitHub Pages reads CNAME from the published artifact. If it is absent the
   * site answers on <owner>.github.io/<repo>/ instead, where every relative
   * asset path in this app still resolves — so the site would look fine while
   * being at the wrong address. That is the failure mode worth a hard check.
   */
  const cname = (contents.get('CNAME') ?? '').trim();
  if (cname !== EXPECTED_DOMAIN) {
    failures.push({
      assertion: 'DOMAIN_PINNED',
      detail: `dist/CNAME is ${JSON.stringify(cname)}, expected ${JSON.stringify(EXPECTED_DOMAIN)}`,
    });
  }
  ran.set('DOMAIN_PINNED', `dist/CNAME names ${EXPECTED_DOMAIN}`);

  // ---- 4. Paths stay relative, so root and subpath hosting both work. ----
  const html = contents.get('index.html') ?? '';
  for (const [, attr, value] of html.matchAll(/\s(src|href)="([^"]+)"/g)) {
    if (value.startsWith('/') || /^[a-z]+:\/\//i.test(value)) {
      if (!value.startsWith('#')) {
        failures.push({
          assertion: 'PATHS_RELATIVE',
          detail: `index.html ${attr}="${value}" is absolute; this artifact must work at a domain root and a project subpath`,
        });
      }
    }
  }
  ran.set('PATHS_RELATIVE', 'no absolute or cross-origin asset paths in index.html');

  // ---- 5. The policy that keeps writing on the device is intact. ----
  if (!html.includes("connect-src 'none'")) {
    failures.push({
      assertion: 'CSP_INTACT',
      detail: "index.html no longer declares connect-src 'none'",
    });
  }
  if (!/Content-Security-Policy/i.test(html)) {
    failures.push({ assertion: 'CSP_INTACT', detail: 'index.html declares no Content Security Policy' });
  }
  ran.set('CSP_INTACT', "Content Security Policy present, with connect-src 'none'");

  // ---- 6. Nothing published that should not be. ----
  const maps = paths.filter((path) => extname(path) === '.map');
  for (const path of maps) {
    failures.push({
      assertion: 'NO_SOURCE_MAPS',
      detail: `${path} — a source map can publish the original module in full`,
    });
  }
  ran.set('NO_SOURCE_MAPS', `no .map files among ${paths.length} paths examined`);

  // ---- Report. Only assertions that ran may print a line. ----
  const REQUIRED_ASSERTIONS = [
    'ARTIFACT_WAS_READ',
    'RUNTIME_COMPLETE',
    'DOMAIN_PINNED',
    'PATHS_RELATIVE',
    'CSP_INTACT',
    'NO_SOURCE_MAPS',
  ];
  for (const assertion of REQUIRED_ASSERTIONS) {
    if (!ran.has(assertion)) {
      failures.push({
        assertion: 'ASSERTIONS_COMPLETE',
        detail: `${assertion} never ran, so this artifact has not been validated`,
      });
    }
  }

  console.log(`Validating ${relative(ROOT, DIST)}/ for ${EXPECTED_DOMAIN}`);
  console.log(`  ${files.length} files (${textFiles.length} text)\n`);

  if (failures.length > 0) {
    const grouped = new Map();
    for (const failure of failures) {
      if (!grouped.has(failure.assertion)) grouped.set(failure.assertion, []);
      grouped.get(failure.assertion).push(failure.detail);
    }
    console.error('FAILED — this artifact must not be published.\n');
    for (const [assertion, details] of grouped) {
      console.error(`  ${assertion} — ${details.length} problem${details.length === 1 ? '' : 's'}`);
      for (const detail of details) console.error(`      ${detail}`);
      console.error('');
    }
    process.exitCode = 1;
    return;
  }

  const width = Math.max(...REQUIRED_ASSERTIONS.map((name) => name.length)) + 2;
  console.log('PASS');
  for (const assertion of REQUIRED_ASSERTIONS) {
    console.log(`  ${assertion.padEnd(width)}${ran.get(assertion)}`);
  }
  console.log('\nThis artifact is publishable.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
