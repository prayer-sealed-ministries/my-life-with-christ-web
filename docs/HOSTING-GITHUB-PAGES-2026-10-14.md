# Current hosting: GitHub Pages at journal.prayersealed.org — 14 October 2026

**This is the current hosting instruction.** It supersedes the OpenAI Sites
arrangement described in [the source handoff](GITHUB-SOURCE-HANDOFF-2026-10-14.md)
and the preparatory plan in [the hosting transition](HOSTING-TRANSITION.md).
Those remain accurate records of what was true before today and are kept as
history, not as instructions.

**Status: prepared and verified in CI; publication is BLOCKED on the GitHub
plan.** Nothing has been deployed to GitHub Pages, and the permanent address
does not serve the companion yet. The existing site is untouched and still live.

## What changed

The companion's intended permanent address is `https://journal.prayersealed.org/`,
served by GitHub Pages from this repository's `dist/` directory, built and
published by [the Pages workflow](../.github/workflows/pages.yml) on every push
to `main` and on manual dispatch.

The repository was also renamed from `my-life-with-christ-web.` (with a trailing
period, which was accidental) to `my-life-with-christ-web`. Repository ID
`1418079428` is unchanged, so history, issues and visibility are unaffected, and
GitHub redirects the old name.

## The blocker

GitHub Pages cannot be enabled on this repository as it stands. Refused by the
API directly:

```
POST /repos/prayer-sealed-ministries/my-life-with-christ-web/pages
422 Your current plan does not support GitHub Pages for this repository.
```

and again inside the workflow, on run
[38562261022](https://github.com/prayer-sealed-ministries/my-life-with-christ-web/actions/runs/38562261022):

```
Run actions/configure-pages@v5
Get Pages site failed. Please verify that the repository has Pages enabled and
configured to build using GitHub Actions ...
HttpError: Not Found
```

Every check in that same run passed first — 84 tests, the rendered-browser
harness on Linux Chromium, and the artifact validator — so the failure is the
plan and nothing else. The workflow now isolates it in its own `package` job so
a blocked publication cannot be mistaken for a broken companion.

The `prayer-sealed-ministries` organization is on the **free** plan, and this
repository is **private**. GitHub Pages is available for private repositories
only on a paid plan. Both the Actions-source and legacy-branch routes were
attempted and both returned the same refusal.

The organization's other repository, `prayersealed.org`, is **public**, which is
why its Pages site works on the same free plan.

Two ways forward, both decisions for the owner rather than defaults to take:

1. Upgrade the organization to a plan that includes Pages for private
   repositories.
2. Make this repository public. The repository holds no journals, no real
   personal writing and no licensed material — its fixtures and the bundled
   Sermon Pack are explicitly fictional — but this is still a visibility change
   that was explicitly withheld, and the audience of the site is a separate
   question from the visibility of its source.

Until one of those happens, the workflow, the artifact and the DNS plan below
are complete and waiting; nothing else in this document can be completed.

## DNS

The registrar is GoDaddy (`ns77.domaincontrol.com`, `ns78.domaincontrol.com`).
`journal.prayersealed.org` already exists and already points at GitHub Pages,
but at the wrong account.

Observed on 14 October 2026:

| Host | Type | Current value | Action |
| --- | --- | --- | --- |
| `journal` | CNAME | `systemslibrarian.github.io` | **Replace** with `prayer-sealed-ministries.github.io` |
| `@` | A | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` | **Leave alone** — serves the public `prayersealed.org` site |
| `www` | CNAME | `prayersealed.org` | **Leave alone** |

The one change required, stated exactly:

```
Type:  CNAME
Host:  journal
Value: prayer-sealed-ministries.github.io
TTL:   1 hour (the default is fine)
```

This replaces the existing `journal` CNAME. A custom domain on a
repository owned by an organization must point at `<organization>.github.io`;
the present value names a user account, which is why the hostname currently
answers with GitHub's 404 and has no certificate for it. No other record on
`prayersealed.org` needs to change, and no unrelated subdomain is affected —
`mail`, `app`, `api`, `docs` and `blog` have no records at all today.

**Domain verification (recommended, not required).** Verifying the domain for
the organization prevents another account claiming the hostname later. The
required record is a TXT entry named
`_github-pages-challenge-prayer-sealed-ministries` whose value is a token
**GitHub generates**. No such record exists today. That token is not derivable
and is deliberately not guessed here: read it from GitHub under
*Organization settings → Pages → Add a domain*, then add it at GoDaddy.

## Order of operations

1. Resolve the plan blocker above.
2. Enable Pages with **GitHub Actions** as the source.
3. Set the custom domain to `journal.prayersealed.org`. The artifact already
   carries `dist/CNAME`, and the workflow refuses to publish without it, so
   this should match rather than fight the repository.
4. Replace the GoDaddy `journal` CNAME as above and wait for propagation.
5. Let GitHub issue the certificate, then enable **Enforce HTTPS**. It only
   becomes available once the certificate is issued.
6. Confirm `https://journal.prayersealed.org/` serves the companion over valid
   HTTPS before telling anyone to use it.

## Keeping the old site

`https://my-life-with-christ.systemslibrarian.chatgpt.site/` **stays up and
stays usable.** It is not redirected, not disabled, not retired, and its browser
storage is not touched.

That is not politeness; it is the only route a reader's journal can take.
Browser storage is per-origin: IndexedDB at the Sites address is invisible to
`journal.prayersealed.org`, and a CNAME, a custom domain or a redirect does not
move it. A reader who opens the new address will see an empty journal until they
import a file. Redirecting the old origin would strand every existing journal
behind a hostname that no longer answers.

Updating the old site's own wording to point readers at the new address needs
the OpenAI Sites tooling for project
`appgprj_6ac621170d0081918c34b68a6fe97f90`, which is not available here. A
GitHub Pages deployment does **not** update that site. If the old origin should
carry a migration notice, that is a separate change made through Sites.

## Moving a journal between the two addresses

The procedure, for a reader:

1. **At the old address**, open *Your journal → move or back up* and download a
   full backup. Let autosave settle first; the page says when a draft is saved.
2. Keep that file. It is the only copy that crosses the gap, and it is worth
   keeping as a backup afterwards regardless.
3. **At the new address**, open *Import* and choose that file. Review what it
   says it will do before confirming.
4. Check the receipt, then open a couple of entries and an unfinished draft and
   confirm the fields read correctly — notes, reflection and prayer are separate
   fields and should stay separate.
5. Only then stop using the old address. Do not clear its storage; leaving it
   intact costs nothing and is a second copy.

What the format carries, and what the tests below prove: entries, unfinished
drafts, the separate notes/reflection/prayer fields, and journal metadata
written by other versions, which is preserved verbatim even when this build does
not understand it. Protected `.lwc` files carry the same content under a
password.

Repeat imports are safe. Importing the same file again adds nothing. A
*changed* version of an entry is kept as a separate copy rather than resolved by
clock, so the original is never overwritten silently — review the receipt before
removing anything.

## What is verified, and what is not

Verified on 14 October 2026, on this machine:

- `npm test` — **84 passed, 0 failed, 0 skipped**, including 8 new
  origin-to-origin migration cases in [tests/migration.test.mjs](../tests/migration.test.mjs):
  empty destination, destination that already holds writing, repeated import,
  changed-version conflict, malformed and empty input, protected `.lwc` round
  trip with a wrong-password rejection, and opaque metadata preservation. Each
  models the destination as a genuinely separate IndexedDB.
- `npm run test:browser` — the rendered-browser harness, **10 consecutive
  passes**, Chromium 153.0.8010.12, **0 axe violations** across all nine routes,
  plus reflow at 1280/390/320 CSS px. See
  [evidence/browser-qa-2026-10-14.json](evidence/browser-qa-2026-10-14.json).
- `npm run validate:artifact` — the artifact gate, including that `dist/CNAME`
  names `journal.prayersealed.org`. Proven to fail when the domain is wrong.

Not verified, and not claimed:

- **No GitHub Pages deployment has happened.** No Actions run, no artifact
  published, no certificate, no HTTPS at the new address. All blocked above.
- `https://journal.prayersealed.org/` currently returns GitHub's **404 over
  HTTP** and **fails TLS** — no site claims the hostname yet.
- No real-user journal has been migrated. The migration evidence is synthetic
  fictional journals in Node, plus the rendered harness's own import flows.
- Physical phone, assistive technology, printed QR, cold-offline relaunch and
  storage-full behaviour remain open, as
  [manual acceptance](manual-acceptance.md) records.
