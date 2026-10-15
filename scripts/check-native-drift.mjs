#!/usr/bin/env node
/**
 * Has the native app moved ahead of the companion's compatibility snapshot?
 *
 * `npm run verify:app-compat` is offline and deterministic: it proves the local
 * copies are the bytes we recorded. It cannot possibly notice that the native
 * repository has changed since. This can — and it is deliberately NOT part of
 * ordinary CI, because a check that reaches across the network on every push
 * turns a GitHub outage into a format-incompatibility alarm, and an alarm that
 * cries wolf is how a real one gets ignored.
 *
 * So this runs on a schedule and on demand, and it is careful about the
 * difference between "we could not find out" and "they have diverged":
 *
 *   exit 0  in sync, or native moved but none of the tracked files changed
 *   exit 1  DRIFT — a tracked file differs. Loud, actionable, names both SHAs.
 *   exit 2  INCONCLUSIVE — network/API/auth problem. Not a compatibility claim.
 *
 * It reads only. It never copies native code into this repository: a human has
 * to look at what changed and decide, because the last drift was hiding a real
 * defect that needed a fix here rather than a blind re-copy.
 *
 * Usage:
 *   npm run check:native-drift
 *   GITHUB_TOKEN=... npm run check:native-drift
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXIT_DRIFT = 1;
const EXIT_INCONCLUSIVE = 2;

const TIMEOUT_MS = 20_000;

/** A reachability problem, as distinct from a compatibility finding. */
class Inconclusive extends Error {}

async function api(path, token, { raw = false } = {}) {
  const headers = {
    accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
    'user-agent': 'my-life-with-christ-web-drift-check',
  };
  if (token) headers.authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`https://api.github.com${path}`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new Inconclusive(`could not reach api.github.com${path}: ${error.message}`);
  }

  if (response.status === 403 || response.status === 429) {
    throw new Inconclusive(`rate-limited or forbidden on ${path} (HTTP ${response.status})`);
  }
  if (response.status >= 500) {
    throw new Inconclusive(`GitHub server error on ${path} (HTTP ${response.status})`);
  }
  if (response.status === 401) {
    throw new Inconclusive(`authentication rejected on ${path}; set GITHUB_TOKEN`);
  }
  if (!response.ok) {
    // 404 on a tracked path is a real finding: the native file moved or went
    // away, which is drift, not a network problem.
    return { ok: false, status: response.status };
  }
  const body = raw ? Buffer.from(await response.arrayBuffer()) : await response.json();
  return { ok: true, status: response.status, body };
}

async function main() {
  const manifest = JSON.parse(await readFile(resolve(ROOT, 'compat/SOURCE.json'), 'utf8'));
  const repo = manifest.nativeRepository;
  const recordedSha = manifest.nativeSourceSha;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  const tracked = (manifest.files ?? []).filter((file) => file.kind !== 'adapted');

  if (tracked.length === 0) {
    console.error('INCONCLUSIVE: the manifest tracks no exact files, so there is nothing to compare.');
    process.exitCode = EXIT_INCONCLUSIVE;
    return;
  }

  console.log(`Native drift check against ${repo}`);
  console.log(`  companion recorded SHA: ${recordedSha}`);

  const head = await api(`/repos/${repo}/commits/main`, token);
  if (!head.ok) {
    throw new Inconclusive(`could not read ${repo} main (HTTP ${head.status})`);
  }
  const currentSha = head.body.sha;
  console.log(`  native main SHA:        ${currentSha}`);

  if (currentSha === recordedSha) {
    console.log('\nIN SYNC — native main is exactly the recorded snapshot.');
    return;
  }

  console.log(`  native main has moved since the snapshot\n`);

  const drifted = [];
  let compared = 0;
  for (const file of tracked) {
    const got = await api(`/repos/${repo}/contents/${file.nativePath}?ref=${currentSha}`, token, { raw: true });
    if (!got.ok) {
      drifted.push({
        path: file.nativePath,
        reason: got.status === 404 ? 'no longer exists in the native repository' : `unreadable (HTTP ${got.status})`,
      });
      continue;
    }
    compared += 1;
    const actual = createHash('sha256').update(got.body).digest('hex');
    if (actual !== file.sha256) {
      drifted.push({
        path: file.nativePath,
        companionPath: file.companionPath,
        recorded: file.sha256,
        actual,
        reason: 'content changed',
      });
    }
  }

  /*
   * A floor, for the same reason every other check here has one: if the loop
   * compared nothing, "no drift found" would be a lie dressed as a pass.
   */
  if (compared === 0 && drifted.every((d) => d.reason !== 'content changed')) {
    throw new Inconclusive(`compared 0 of ${tracked.length} tracked files; treating as unknown rather than as agreement`);
  }

  if (drifted.length > 0) {
    console.error('DRIFT — the native app has changed material the companion copies.\n');
    console.error(`  companion compat snapshot: ${recordedSha}`);
    console.error(`  native main now:           ${currentSha}`);
    console.error(`  https://github.com/${repo}/compare/${recordedSha}...${currentSha}\n`);
    for (const item of drifted) {
      console.error(`  ${item.path} — ${item.reason}`);
      if (item.recorded) {
        console.error(`      recorded ${item.recorded}`);
        console.error(`      native   ${item.actual}`);
        console.error(`      companion copy: ${item.companionPath}`);
      }
    }
    console.error('\nWhat to do, in this order:');
    console.error('  1. Read the native diff above. Decide what changed behaviourally.');
    console.error('  2. Re-sync compat/, update compat/SOURCE.json, and run npm test.');
    console.error('  3. Expect companion tests to fail if the contract really moved —');
    console.error('     that failure is the point, and the last one was a live defect.');
    console.error('  Nothing is copied automatically, and nothing here is auto-merged.');
    process.exitCode = EXIT_DRIFT;
    return;
  }

  console.log(`IN SYNC — native main moved, but all ${compared} tracked files are unchanged.`);
  console.log('No companion action needed.');
}

main().catch((error) => {
  if (error instanceof Inconclusive) {
    // Deliberately not exit 1. This is "we could not find out", and reporting it
    // as incompatibility would make a transient outage look like a product bug.
    console.error(`\nINCONCLUSIVE — ${error.message}`);
    console.error('This is NOT a compatibility finding. Nothing can be concluded about drift.');
    process.exitCode = EXIT_INCONCLUSIVE;
    return;
  }
  console.error(error);
  process.exitCode = EXIT_INCONCLUSIVE;
});
