# Current hosting: GitHub Pages at journal.prayersealed.org — 14 October 2026

**This is the current hosting instruction.** It supersedes the OpenAI Sites
arrangement described in [the source handoff](GITHUB-SOURCE-HANDOFF-2026-10-14.md)
and the preparatory plan in [the hosting transition](HOSTING-TRANSITION.md).
Those remain accurate records of what was true before today and are kept as
history, not as instructions.

**Status: LIVE.** The companion is deployed to GitHub Pages and served at
<https://journal.prayersealed.org/> over enforced HTTPS. The previous OpenAI
Sites origin is untouched and also still live, deliberately, so readers can
export journals from it.

## What changed

The companion's intended permanent address is `https://journal.prayersealed.org/`,
served by GitHub Pages from this repository's `dist/` directory, built and
published by [the Pages workflow](../.github/workflows/pages.yml) on every push
to `main` and on manual dispatch.

The repository was also renamed from `my-life-with-christ-web.` (with a trailing
period, which was accidental) to `my-life-with-christ-web`. Repository ID
`1418079428` is unchanged, so history, issues and visibility are unaffected, and
GitHub redirects the old name.

## How it was unblocked

Publication was initially refused. Both API routes returned:

```
POST /repos/prayer-sealed-ministries/my-life-with-christ-web/pages
422 Your current plan does not support GitHub Pages for this repository.
```

and the workflow failed the same way at `actions/configure-pages@v5`
(`HttpError: Not Found`) on run
[38562261022](https://github.com/prayer-sealed-ministries/my-life-with-christ-web/actions/runs/38562261022),
with every check passing first. GitHub Pages is not available for *private*
repositories on an organization's free plan.

The owner resolved it on 14 October 2026 by making this repository **public**.
Pages was then enabled with **GitHub Actions** as the source, and the first
successful publication is run
[38657366363](https://github.com/prayer-sealed-ministries/my-life-with-christ-web/actions/runs/38657366363)
— `checks`, `package` and `deploy` all green.

The repository holds no journals and no real personal writing: its fixtures and
the bundled Sermon Pack are explicitly fictional, and the shipped pages carry no
Bible corpus or licensed outlines. Readers' journals live in their own browsers
and were never in this repository.

## DNS — no change required

The registrar is GoDaddy (`ns77.domaincontrol.com`, `ns78.domaincontrol.com`).

`journal.prayersealed.org` is a CNAME to `systemslibrarian.github.io`, and
**that works as it stands.** An earlier draft of this document called for
repointing it at `prayer-sealed-ministries.github.io`; that was wrong, and the
record was left alone. GitHub accepts a CNAME to any `*.github.io` host and
routes a custom domain by which Pages site claims it, not by the CNAME target.
Its own health check for this hostname reports:

| Field | Value |
| --- | --- |
| `is_valid` | `true` |
| `reason` | `null` |
| `should_be_a_record` | `false` — a CNAME is correct for a subdomain |
| `is_cname_to_github_user_domain` | `true` |
| `is_served_by_pages` | `true` |
| `responds_to_https`, `enforces_https`, `is_https_eligible` | `true` |
| `caa_error` | `null` |

Records on `prayersealed.org`, all unchanged by this work:

| Host | Type | Value | Note |
| --- | --- | --- | --- |
| `journal` | CNAME | `systemslibrarian.github.io` | serves this companion |
| `@` | A | `185.199.108.153`, `.109`, `.110`, `.111` | the public `prayersealed.org` site |
| `www` | CNAME | `prayersealed.org` | unchanged |

Pointing `journal` at `prayer-sealed-ministries.github.io` would match GitHub's
documented convention and is tidier, but it is cosmetic: nothing depends on it,
and changing a working record carries more risk than leaving it.

**Domain verification (optional).** Verifying the domain for the organization
guards against another account later claiming the hostname. It needs a TXT
record `_github-pages-challenge-prayer-sealed-ministries` whose value **GitHub
generates** — read it from *Organization settings → Pages → Add a domain*. No
such record exists today and the token is deliberately not guessed here. The
site works without it.

## How publication works now

Pages is enabled with GitHub Actions as the source, custom domain
`journal.prayersealed.org`, certificate issued by Let's Encrypt and **Enforce
HTTPS on**. `http://` 301-redirects to `https://`.

[The workflow](../.github/workflows/pages.yml) publishes on every push to `main`
and on manual dispatch, in three jobs: `checks` (suite, rendered-browser
harness, artifact validator), `package` (validate again, configure Pages, upload
`dist/`), then `deploy`. A failed check cannot reach the site.

`dist/CNAME` is still required and still checked. With an Actions source GitHub
does **not** apply the artifact's CNAME automatically — the custom domain is
repository configuration — but the file is what keeps the artifact and the
configured domain in agreement, and `npm run validate:artifact` fails if it is
missing or names the wrong host.

## The old site, and why no migration was needed

**No journals existed at the Sites origin at the time of this move.** The owner
confirmed that on 14 October 2026. So nothing had to be carried across, and no
reader is stranded by the change of address. This is the owner's statement about
their own deployment, not something this repository can verify — browser storage
is private to each visitor's browser and is not observable from here.

`https://my-life-with-christ.systemslibrarian.chatgpt.site/` is nevertheless
**still live, not redirected, not disabled, not retired, and its storage is
untouched.** Retiring it is now a free choice rather than a constraint, and it
remains the owner's decision; nothing here depends on it any more.

Had there been journals, the old origin could not have been retired or
redirected. Browser storage is per-origin: IndexedDB at the Sites address is
invisible to `journal.prayersealed.org`, and a CNAME, a custom domain or a
redirect does not move it. That constraint did not apply this time. It will
apply to any **future** origin change, which is what the procedure below is for.

Updating the old site's own wording — to point visitors at the new address, say
— needs the OpenAI Sites tooling for project
`appgprj_6ac621170d0081918c34b68a6fe97f90`, which is not available here. A
GitHub Pages deployment does **not** update that site.

## Moving a journal between origins

Not required for this move — there were no journals to move. Recorded because
it **will** be required by any future change of address, and because the
behaviour it depends on is under test.

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

Verified on 14 October 2026:

- **The live site is this repository's artifact.** All 12 runtime files —
  `index.html`, the seven modules, `style.css`, `icon.svg`, `vendor/qrcode.js`
  and `CNAME` — are byte-identical (SHA-256) between `dist/` and
  <https://journal.prayersealed.org/>. Nothing is injected at the edge.
- **Live accessibility and layout, against the real address**: all nine routes
  render exactly one `main h1`, **0 axe violations** under
  `wcag2a/wcag2aa/wcag21aa/wcag22aa` (17–25 passing checks per route), no
  horizontal overflow at 1280/390/320 CSS px, **0 page or console errors**, and
  **no request to any host other than `journal.prayersealed.org`** — the CSP
  holds in the deployed site.
- `npm test` — **84 passed, 0 failed, 0 skipped**, including the 8
  origin-to-origin migration cases.
- `npm run test:browser` — 10 consecutive local passes plus a pass on Linux in
  CI, Chromium 153.0.8010.12, 0 axe violations.
- `npm run validate:artifact` — PASS, and proven to fail on a wrong CNAME.
- HTTPS enforced; `http://` returns 301 to `https://`.

Not verified, and not claimed:

- **No journal has been migrated, because there were none to migrate** (see
  above). The migration tests run against synthetic fictional journals, which is
  evidence that the format and the importer behave, not evidence of a real
  move.
- The old Sites origin carries no notice pointing visitors here, and does not
  need one now that no journals are held there. Changing its wording would need
  the Sites tooling for project
  `appgprj_6ac621170d0081918c34b68a6fe97f90`, which this work does not have. A
  GitHub deployment does not update that site.
- Headless Chromium only. Firefox, Safari/WebKit, real screen readers, physical
  phones, printed QR, OS high-contrast and cold-offline relaunch remain open —
  see [manual acceptance](manual-acceptance.md).
- The domain is not verified for the organization (see DNS above).
