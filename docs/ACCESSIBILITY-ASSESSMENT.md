# Companion accessibility assessment

> **Update, 14 October 2026.** The "Browser verification blocker" recorded below is resolved. `tests/browser-qa.mjs` has now run: 10 consecutive passes on Chromium 153.0.8010.12 with zero axe violations across nine routes, and it runs in CI on every push. Evidence: [evidence/browser-qa-2026-10-14.json](evidence/browser-qa-2026-10-14.json). The source/jsdom findings and the pending screen-reader, physical-device and other-browser rows below stand unchanged — a headless Chromium axe pass is not a conformance result.

Date: 13 October 2026. Scope: the browser-local companion on `improve/companion-integrity-transfer`, starting from `454bf37`, including the current companion implementation changes. The public deployment was not tested or changed.

**Result: 13 focused source/jsdom checks pass. Rendered-browser, keyboard-device, and assistive-technology checks remain pending. This is not a WCAG 2.2 AA conformance claim.**

## Evidence and method

Run from the repository root:

```sh
node --test tests/accessibility.test.mjs
```

Recorded environment: Node v24.19.0, repository jsdom 26.1.0 and fake-indexeddb 6.2.5. All writing, titles, URLs, and import files in these tests are fictional. The test has no server, no runtime page fetch, and no public-site interaction. No dependencies were added. An axe scan was not run.

The suite imports the actual application modules into jsdom, uses in-memory IndexedDB, and parses the actual stylesheet using jsdom's CSSOM. It checks these layers separately:

- DOM structure, explicit labels/references, status roles, and application focus handlers.
- CSS declarations for wrapping, target size, focus, scrolling, and reduced motion.
- Source contrast of identified opaque sRGB foreground/background pairs using the WCAG relative-luminance formula. Threshold comparisons use the unrounded result. The tests sanity-check black/white at 21:1 and equal colors at 1:1.

The naming helper intentionally covers this app's native controls and explicit ARIA labels. It is not a full accessible-name algorithm or accessibility-tree implementation. Dialog `showModal` and `close`, viewport scrolling, and element scrolling are stubbed. Media queries are parsed, not applied to a rendered viewport. No test uses jsdom geometry to infer a target size or absence of overflow.

The test was run against the assembled in-progress working tree, including the accompanying application semantic updates. Re-run it, then the aggregate suite, after integrating all companion commits. This focused run does not replace the integrity/transfer test suites.

### Browser verification blocker

The existing [browser QA record](../README.md#optional-rendered-browser-qa) documents Chromium's required Unix socket being denied and the supported cloud browser being unable to reach the preview across environments. This assessment did not retry Chromium, local forwarding, tunnels, or the public site. The prepared `tests/browser-qa.mjs` harness remains a future rendered-environment check; its existence is not evidence of a pass.

## Source issues corrected

These were measurable authored-style problems, not findings inferred from screenshots.

| Authored pair | Before | After | Change |
| --- | ---: | ---: | --- |
| Muted text on draft banner `#eeedde` | 4.35:1 | 4.92:1 | Muted token changed from `#677067` to `#5e685e` |
| Muted text on soft panel `#eef0e7` | 4.46:1 | 5.05:1 | Same token correction |
| Gold pill text on `#f2ebdc` | 4.35:1 | 5.18:1 | Pill text changed from `#856934` to `#795d2d` |
| Focus ring on selected-navigation surface `#dfe7d9` | 2.63:1 | 4.85:1 | Ring changed from `#b28539` to `#795d2d` |
| Input border against input fill `#fffefb` | 1.55:1 | 3.95:1 | Interactive boundary changed from `#cbd1c5` to `#778370` |

Normal text is checked against 4.5:1; the large hero emphasis is checked against 3:1. Required control/focus cues use 3:1. These thresholds and their exceptions come from W3C's [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) guidance. Decorative separators are not presented as interactive-boundary failures, and disabled controls are not counted as passing active-control contrast tests.

Additional safeguards now present in CSS:

- Explicit placeholder color and full opacity, avoiding browser-dependent faded placeholder text.
- A 3px focus outline with a 4px offset for buttons, links, native fields, summaries, and elements with `tabindex`; forced-colors mode uses system colors.
- At least 44px declared heights for standalone buttons, fields, summaries, checkbox labels, and navigation/action links. Compact native checkbox glyphs retain full clickable labels. The brand target also has a 44px minimum height.
- Long headings, draft titles, selection text, pack names, breadcrumbs, and feedback can wrap. Flex/grid children can shrink; toolbars/tabs can wrap; buttons have bounded widths. The top bar may grow instead of clipping wrapped content.
- A vertically scrollable desktop sidebar for short windows. Mobile navigation gets padding for its focus outline.
- Provided/review text has no independently capped inner scroll area. Page selection groups remain scrollable and focusable; inside a dialog, only the dialog scrolls. This avoids requiring a separate keyboard target for each nested `pre`.
- Reduced-motion declarations cover animations, transitions, pseudo-elements, scrolling, and hover displacement.

44px is the project's stronger standalone-control target. WCAG 2.2 AA's [Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) is 24 CSS pixels with defined exceptions. The stylesheet checks do not establish either a rendered 44px result or blanket AA target-size conformance; inline text links need their appropriate contextual assessment.

## Checked versus pending matrix

“Passed subset” below means the stated automated evidence passed. It does not mean every requirement of the associated criterion passed.

| Area and WCAG reference | Actually checked | Result | Still required |
| --- | --- | --- | --- |
| Language, title, bypass and landmarks: 3.1.1, 2.4.1, 2.4.2, 1.3.1 | English document language; nonempty route title; one main; named navigation; header/footer; skip-link target and application DOM-focus handler | Passed subset | Screen-reader landmark/skip-link navigation in supported browsers |
| Headings and control names: 1.3.1, 2.4.6, 3.3.2, 4.1.2 | One main `h1`; nonempty headings without downward level skips; labelled native fields/checkboxes; named links/buttons/summaries; unique IDs; existing ARIA references; hints associated by `aria-describedby` | Passed subset | Accessibility-tree names, semantic usefulness, reading order, field hints and native control behavior with AT |
| Writing and errors: 3.3.1, 3.3.3, 4.1.3 | Editor and pastor save statuses; error alert text; invalid-pack/invalid-import application focus; persistence-status role and completed text | Passed subset | Actual announcement timing, error recovery while typing, focus visibility and no duplicate/lost speech |
| Search and QR feedback: 4.1.3, 1.1.1 | Persistent polite search-count node changes after text/kind filters; persistent QR status node; application focus stays on trigger; QR image has an explicit name and its destination is visible text | Passed subset | Actual live announcements; usable accessible QR alternative and visible output at zoom |
| Import review and receipt: 1.3.1, 3.3.2, 4.1.3 | Sermon, journal, changed-entry/draft review; labelled keep-copy choice; malformed replacement removes old review; committed entry/draft counts in a status-marked receipt | Passed subset | Reading order, new-review discoverability and receipt announcements with AT |
| Dialogs: 2.1.1, 2.1.2, 2.4.3, 4.1.2 | Plain transfer, protected transfer, readable copy, delete confirmation, pastor preview and protected import have names; application initial/cancel focus handlers work; cancellation preserves the tested source entry | Passed subset | Native modal focus containment, Escape, Tab/Shift+Tab, backdrop/inert behavior, dismissal and focus after removal/navigation |
| Scrollable content: 2.1.1, 2.1.2, 2.4.7 | Page selection groups have names and can receive DOM focus; no capped nested `pre` scroll layer; dialog list cap removed; focus declaration covers tabindex targets | Passed subset | Keyboard scrolling with arrows/Page Down/Home/End; reaching all long content and leaving groups without a trap |
| Text contrast: 1.4.3 | Known opaque authored text pairs across page, sheet, sidebar, tinted panels, notice, provided notes, selected/hovered nav; primary buttons/hover, pills, quotation, prose, save status, errors, placeholders and large hero text | Passed subset | Rendered cascade/states, browser-default controls, any newly introduced colors; no unsupported dark-theme claim |
| Non-text contrast/focus: 1.4.11, 2.4.7 | Authored input/control boundaries and focus token against known light surfaces; outline declarations; forced-colors declaration | Passed subset | Native checked/unchecked/disabled states, actual focus ring visibility and clipping, operating-system high-contrast presentation |
| Targets: 2.5.8 | Source min-size declarations for standalone controls and associated checkbox labels | Passed subset | Actual CSS-pixel hit rectangles, non-overlap, label activation, pointer/touch use and inline-link exceptions |
| Reflow, resize and spacing: 1.4.4, 1.4.10, 1.4.12 | Long fictional titles remain intact as escaped text across home, journal, entry, transfer, draft, sharing preview and pastor list; wrap/shrink/breakpoint declarations; flexible toolbar and topbar | Passed subset | 320 CSS px width, 200%/400% zoom, text-spacing overrides, mobile landscape, long URLs and large provided notes without lost content/actions |
| Reduced motion: supportive preference behavior | Motion/transition/pseudo-element/scroll declarations and no hover displacement under reduced motion | Passed source subset | Actual OS preference application in the browser; this alone is not an AA conformance result |
| Focus not obscured: 2.4.11 | Sidebar scrolling and focus padding reduce identified source risks | Pending rendered check | Ensure focused controls are not hidden by toast, mobile navigation, dialog edges or scrolling surfaces |
| Pointer, reading order and predictability: 1.3.2, 1.3.4, 2.5.1–2.5.4, 2.5.7, 3.2.1–3.2.4 | Native controls and explicit actions inspected; no gesture-only or drag-only workflow identified in this implementation | Pending interaction check | Keyboard, touch, orientation changes, DOM/visual order, focus/input behavior and consistency across complete flows |
| Other applicable A/AA requirements | This focused suite does not claim complete coverage of all criteria | Not established by this suite | Complete the broader WCAG review before declaring conformance, including help, instructions, redundant entry and any file-unlock authentication interpretation |

No audio/video media, CAPTCHA, account sign-in, payment form, or time-limited session is present in the current companion source. Requirements specific to those absent features were not run as fabricated passing tests. Protected-file password entry remains in the assessment scope; an actual screen-reader/password-manager/paste workflow still needs checking.

## Concrete automated coverage

The route check visits 17 variants:

- Home, My writing, transfer, import, Sermon Pack builder, guide, privacy/storage, and format.
- New sermon, reading, prayer, reflection, and letter editors.
- Existing unfinished draft, existing-entry editor, saved-entry detail, and missing-entry detail.

Additional exercised states: saved/unsaved editor status, invalid pastor preview, storage report, no-match and match search counts, kind filter, generated QR, six dialog types, imported sermon review, journal import, committed receipt, changed entry/draft review, and invalid replacement-file error.

The test's long-title fixture contains a long unbroken token and literal HTML-like text. The tests confirm text retention and escaping; CSS tests confirm wrap/shrink safeguards. Neither check measures actual line breaks, scrolling, truncation, or overlap.

## Required rendered and AT acceptance

Use the [manual acceptance checklist](manual-acceptance.md#accessibility-and-layout), with fictional content and isolated profiles. Record the exact companion commit, browser/version, operating system, device, zoom, input method, AT/version, pass/fail/blocked result, and sanitized evidence.

1. Run the prepared browser harness in a working rendered environment. Inspect its actual results; do not treat harness availability as completion. Extend it to the new search/QR, long-title, selection-group and error states when recording a release result.
2. On desktop Chromium, Firefox, and supported Safari, traverse writing, imported provided notes, search, transfer review, password dialogs, cancellation, deletion, church preview and QR with keyboard only. Test Tab/Shift+Tab, Enter/Space, Escape, page scrolling, and Back/Forward. Verify every needed action remains reachable and focus visibly returns to useful content.
3. Measure contrast and target rectangles in the resulting render, including custom/native states and forced colors. Check focused controls while a toast is visible. Source contrast calculations do not establish [focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).
4. Exercise 320 CSS px width, 200% and 400% zoom, large text, text-spacing overrides, portrait/landscape, long titles/URLs and full provided notes. Apply W3C's [reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html); avoid treating a horizontally scrollable data table as permission for the whole page to overflow.
5. With VoiceOver/Safari and TalkBack/Chrome, plus a desktop screen-reader/browser pair where available, verify labels, hints, field values, expandable sections, dialog names, reading order, search/QR/save/import/error speech, and focus restoration. DOM live roles alone do not establish [status-message announcements](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).
6. Verify reduced motion and high-contrast settings on the real platform, and check practical touch targets on physical iPhone/Android devices. Record platform limitations instead of assigning passing results.

The unchecked rows are required verification, not feature deferrals or reasons to claim the interface complete. Any failed supported-user workflow needs correction and a rerun before the affected accessibility/release claim is made. No publication, deployment, domain change, backend, or real-user data migration is part of this assessment.
