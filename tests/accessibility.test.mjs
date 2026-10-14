// Deliberately source + jsdom checks. These do not measure layout, run axe,
// emulate native dialog focus trapping, or stand in for assistive technology.
import {test, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
import {newEntry, entryDraft, SERMON_FORMAT} from '../dist/core.js';

const [html, css] = await Promise.all([
  readFile(new URL('../dist/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../dist/style.css', import.meta.url), 'utf8'),
]);
const dom = new JSDOM(html, {url: 'https://companion.example/', pretendToBeVisual: true});
const w = dom.window;
for (const key of ['window', 'document', 'location', 'FormData', 'Event', 'CustomEvent', 'HTMLElement']) {
  globalThis[key] = key === 'window' ? w : w[key];
}
globalThis.indexedDB = indexedDB;
Object.defineProperty(globalThis, 'navigator', {value: w.navigator, configurable: true});
w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = () => {};
// Only exercise application handlers, not browser-provided dialog behavior.
w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
w.HTMLDialogElement.prototype.close = function () { this.open = false; };
w.qrcode = createRequire(import.meta.url)('qrcode-generator');
const style = w.document.createElement('style');
style.textContent = css;
w.document.head.append(style);
await import('../dist/app.js');
await w.lwcReady;
const db = await import('../dist/storage.js');

const longTitle = 'Fictional accessibility title ' + 'UnbrokenTitle'.repeat(40) + ' <img src=x onerror=alert(1)>';
const entry = {...newEntry('sermon'), title: longTitle, date: '2026-10-11', notes: 'Fictional personal note', reflection: 'Fictional reflection', prayer: 'Fictional prayer', sourceMaterial: {format: 'sermon-notes-json', filename: 'fictional-accessibility.json', importedAt: '2026-10-11T12:00:00.000Z', body: 'Fictional provided notes\n' + 'unbroken'.repeat(300), church: 'Fictional Example Church'}};
const draft = entryDraft({...newEntry('letter'), title: longTitle, notes: 'Fictional unfinished note'});
await db.put('entries', entry);
await db.put('drafts', draft);
await db.put('packs', {id: 'fictional-accessibility-pack', value: {format: SERMON_FORMAT, version: 1, title: longTitle, date: '2026-10-11', church: '', speaker: '', scripture: [], bodyMarkdown: 'Fictional provided outline'}, updatedAt: '2026-10-11T12:00:00.000Z'});

function node(selector, scope = document) {
  const result = scope.querySelector(selector);
  assert.ok(result, `Missing ${selector}`);
  return result;
}
function click(selector, scope = document) {
  node(selector, scope).dispatchEvent(new w.MouseEvent('click', {bubbles: true, cancelable: true}));
}
function input(selector, value) {
  const field = node(selector);
  field.value = value;
  field.dispatchEvent(new w.Event('input', {bubbles: true}));
}
async function waitFor(check, description) {
  const end = Date.now() + 3000;
  while (!await check()) {
    assert.ok(Date.now() < end, `Timed out waiting for ${description}`);
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
async function go(hash) {
  let replaced = false;
  const observer = new w.MutationObserver(() => { replaced = true; });
  observer.observe(node('#main'), {childList: true});
  try {
    if (w.location.hash === hash) w.dispatchEvent(new w.HashChangeEvent('hashchange'));
    else w.location.hash = hash;
    await waitFor(() => replaced, hash + ' route render');
  } finally { observer.disconnect(); }
}
function textWithoutDecoration(element) {
  const clone = element.cloneNode(true);
  clone.querySelectorAll('[aria-hidden="true"], [hidden]').forEach(child => child.remove());
  return clone.textContent.replace(/\s+/g, ' ').trim();
}
// A deliberately narrow naming check for this app's native controls, not a full
// implementation of the Accessible Name and Description Computation algorithm.
function declaredName(element) {
  if (element.hasAttribute('aria-labelledby')) return element.getAttribute('aria-labelledby').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
  if (element.hasAttribute('aria-label')) return element.getAttribute('aria-label').trim();
  if (element.labels?.length) return [...element.labels].map(textWithoutDecoration).join(' ');
  return textWithoutDecoration(element);
}
function checkSemantics(scope = node('#main')) {
  const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate DOM IDs');
  for (const control of scope.querySelectorAll('button, a[href], input:not([hidden]):not([type="hidden"]), select, textarea, summary')) {
    assert.ok(declaredName(control), `Unnamed ${control.outerHTML}`);
    assert.ok(!control.hasAttribute('tabindex') || Number(control.getAttribute('tabindex')) <= 0, 'No positive tabindex');
    if (control.matches('input, select, textarea')) {
      assert.ok(control.labels?.length, `Native control lacks an associated visible label: ${control.id || control.name}`);
    }
  }
  for (const hint of scope.querySelectorAll('.field .hint')) {
    assert.ok(hint.id, 'Every field hint has an ID');
    const control = hint.closest('.field').querySelector('input, textarea, select');
    assert.ok((control.getAttribute('aria-describedby') || '').split(/\s+/).includes(hint.id), `Hint is not connected to ${control.id}`);
  }
  for (const element of scope.querySelectorAll('[aria-labelledby], [aria-describedby]')) {
    for (const attribute of ['aria-labelledby', 'aria-describedby']) {
      for (const id of (element.getAttribute(attribute) || '').split(/\s+/).filter(Boolean)) {
        assert.ok(document.getElementById(id), `${attribute} references missing ${id}`);
      }
    }
  }
  let level = 0;
  for (const heading of scope.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    const next = Number(heading.tagName.slice(1));
    assert.ok(textWithoutDecoration(heading), 'Empty heading');
    assert.ok(!level || next <= level + 1, `Heading level jumps from ${level} to ${next}`);
    level = next;
  }
}
function assertPoliteStatus(element) {
  assert.equal(element.getAttribute('role'), 'status');
  // role=status has an implicit polite live setting; an explicit setting may
  // reinforce it, but must not disable announcements or make them assertive.
  assert.ok(!element.hasAttribute('aria-live') || element.getAttribute('aria-live') === 'polite');
}
async function chooseFile(value, name) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  Object.defineProperty(node('#file-picker'), 'files', {configurable: true, value: [{name, size: bytes.length, arrayBuffer: async () => bytes.buffer}]});
  node('#file-picker').dispatchEvent(new w.Event('change', {bubbles: true}));
}
function closeDialog() {
  node('#dialog').dispatchEvent(new w.Event('cancel', {cancelable: true}));
  assert.equal(node('#dialog').open, false, 'Application cancel handler closes dialog');
}

// Inspect parsed declarations directly. jsdom does not resolve media queries,
// custom-property colors, layout geometry, or rendered contrast reliably.
const topRules = [...style.sheet.cssRules];
function declared(selector, property, condition) {
  const rules = condition
    ? topRules.filter(rule => rule.type === 4 && rule.conditionText.replace(/\s+/g, '') === condition.replace(/\s+/g, '')).flatMap(rule => [...rule.cssRules])
    : topRules.filter(rule => rule.type === 1);
  let result;
  for (const rule of rules) {
    if (rule.selectorText?.split(',').map(value => value.trim()).includes(selector)) {
      const value = rule.style.getPropertyValue(property);
      if (value) result = value.trim();
    }
  }
  assert.ok(result, `No ${property} declaration for ${selector}${condition ? ' in ' + condition : ''}`);
  return result;
}
function color(value) {
  if (value.startsWith('var(')) return color(declared(':root', value.slice(4, -1).trim()));
  assert.match(value, /^#(?:[\da-f]{3}|[\da-f]{6})$/i, `Only opaque sRGB colors are supported in this source check: ${value}`);
  let hex = value.slice(1);
  if (hex.length === 3) hex = [...hex].map(x => x + x).join('');
  return hex.match(/../g).map(x => parseInt(x, 16) / 255);
}
function luminance(value) {
  const rgb = color(value).map(component => component <= 0.04045 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4);
  return rgb.reduce((sum, component, index) => sum + component * [0.2126, 0.7152, 0.0722][index], 0);
}
function contrast(foreground, background) {
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function assertContrast(name, foreground, background, minimum = 4.5) {
  const actual = contrast(foreground, background);
  assert.ok(actual >= minimum, `${name}: ${actual.toFixed(3)}:1 is below ${minimum}:1 (${foreground} / ${background})`);
}
const lightSurfaces = [
  ['page', 'var(--paper)'], ['sheet', 'var(--white)'],
  ['sidebar', declared('.sidebar', 'background')],
  ['soft panel', declared('.panel.soft', 'background')],
  ['aside', declared('.side-note', 'background')],
  ['draft banner', declared('.draft-banner', 'background')],
  ['notice', declared('.notice', 'background')],
  ['provided notes', declared('.provided', 'background')],
  ['quiet card', declared('.quiet-card', 'background')],
  ['dropzone', declared('.dropzone', 'background')],
  ['selected navigation', declared('.sidebar nav a[aria-current]', 'background')],
  ['hovered navigation', declared('.sidebar nav a:hover', 'background')],
];

test('route DOM has a language, title, main landmark, named navigation, ordered headings and labelled controls', async () => {
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(document.querySelectorAll('main').length, 1);
  assert.equal(node('main').id, node('.skip').getAttribute('href').slice(1));
  assert.equal(node('main').getAttribute('tabindex'), '-1');
  assert.ok(declaredName(node('nav')));
  assert.ok(node('header'));
  assert.ok(node('footer'));
  for (const route of ['home', 'journal', 'transfer', 'import', 'church', 'guide', 'privacy', 'format', ...['sermon', 'reading', 'prayer', 'reflection', 'letter'].map(kind => 'write/' + kind), 'write/draft/' + draft.id, 'write/edit/' + entry.id, 'entry/' + entry.id, 'entry/fictional-missing-entry']) {
    await go('#' + route);
    assert.equal(document.querySelectorAll('main h1').length, 1, route);
    assert.match(document.title, /.+ · My Life With Christ/, route);
    checkSemantics();
    assert.ok(document.querySelectorAll('nav [aria-current="page"]').length <= 1, route);
  }
  await go('#home');
  node('.skip').focus();
  click('.skip');
  assert.equal(document.activeElement, node('#main'), 'Skip link handler moves DOM focus to main');
});

test('editors expose save state, error alerts, labels and descriptions without changing field contents', async () => {
  await go('#write/reflection');
  assertPoliteStatus(node('#save-status'));
  assert.equal(node('#save-status').getAttribute('aria-atomic'), 'true');
  input('#title', 'Fictional accessibility autosave');
  await waitFor(() => node('#save-status').textContent.includes('saved on this device'), 'autosave status');
  assert.equal(node('#title').value, 'Fictional accessibility autosave');
  assertPoliteStatus(node('#toast'));
  await go('#church');
  assertPoliteStatus(node('#save-status'));
  input('#pack-body', '');
  await waitFor(() => node('#save-status').textContent.includes('saved on this device'), 'pack autosave');
  click('[data-action="preview-pack"]');
  const error = node('#form-error');
  assert.equal(error.getAttribute('role'), 'alert');
  assert.match(error.textContent, /Add the provided notes/);
  assert.equal(document.activeElement, error, 'Application error handler sets DOM focus');
  input('#pack-body', 'Fictional provided outline');
  await waitFor(() => node('#save-status').textContent.includes('saved on this device'), 'restored pack draft');
  checkSemantics();
  await go('#privacy');
  await waitFor(() => !node('#persistence-result').textContent.startsWith('Checking'), 'persistence report');
  assertPoliteStatus(node('#persistence-result'));
});

test('search count and QR creation update existing polite status nodes without moving DOM focus', async () => {
  await go('#journal');
  const search = node('#search');
  const status = node('#search-status');
  assertPoliteStatus(status);
  assert.equal(status.getAttribute('aria-atomic'), 'true');
  search.focus();
  input('#search', 'fictional-no-match-for-accessibility');
  assert.equal(node('#search-status'), status, 'Live node persists across result replacement');
  assert.equal(status.textContent, '0 saved entries found.');
  assert.equal(document.activeElement, search);
  input('#search', '');
  assert.equal(status.textContent, '1 saved entries found.');
  const kind = node('#kind-filter');
  kind.value = 'prayer';
  kind.dispatchEvent(new w.Event('change', {bubbles: true}));
  assert.equal(status.textContent, '0 saved entries found.');
  kind.value = 'all';
  kind.dispatchEvent(new w.Event('change', {bubbles: true}));
  await go('#church');
  const qrStatus = node('#qr-status');
  assertPoliteStatus(qrStatus);
  assert.equal(qrStatus.getAttribute('aria-atomic'), 'true');
  const trigger = node('[data-action="make-qr"]');
  input('#pack-url', 'https://church.example/fictional-accessibility.json');
  trigger.focus();
  click('[data-action="make-qr"]');
  assert.equal(node('#qr-status'), qrStatus);
  assert.match(qrStatus.textContent, /QR code prepared/);
  assert.equal(document.activeElement, trigger);
  assert.match(declaredName(node('#qr-result [role="img"]')), /QR code/);
  assert.ok(node('#qr-result').textContent.includes('https://church.example/fictional-accessibility.json'));
  checkSemantics();
});

test('page scroll groups expose a name and a keyboard focus target', async () => {
  await go('#transfer');
  const groups = [...document.querySelectorAll('main .selection-list')];
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map(declaredName), ['Saved entries', 'Unfinished drafts']);
  for (const group of groups) {
    assert.equal(group.getAttribute('tabindex'), '0');
    assert.equal(group.getAttribute('role'), 'group');
    assert.ok(declaredName(group));
    group.focus();
    assert.equal(document.activeElement, group, 'Scroll group can receive DOM focus');
  }
});

test('transfer, sharing, deletion, pastor preview and protected-import dialogs have names and reversible DOM focus', async () => {
  for (const action of ['export-app', 'export-protected', 'export-readable']) {
    await go('#transfer');
    const trigger = node(`[data-action="${action}"]`);
    trigger.focus();
    click(`[data-action="${action}"]`);
    const dialog = node('#dialog');
    assert.equal(dialog.open, true, node('#toast').textContent);
    assert.ok(declaredName(dialog));
    for (const list of dialog.querySelectorAll('.selection-list')) assert.equal(list.hasAttribute('tabindex'), false, 'Only the dialog owns scrolling');
    assert.ok(dialog.contains(document.activeElement), 'Application initial DOM focus stays in dialog');
    checkSemantics(dialog);
    if (action === 'export-protected') {
      assert.equal(node('#protect-password').type, 'password');
      assert.equal(node('#protect-error').getAttribute('role'), 'alert');
    }
    if (action === 'export-readable') {
      assert.equal(node('#share-reflection').checked, false);
      assert.equal(node('#share-prayer').checked, false);
      assert.ok(!node('#share-preview').textContent.includes(entry.prayer));
    }
    closeDialog();
    assert.equal(document.activeElement, trigger);
  }
  await go('#entry/' + entry.id);
  const deleteTrigger = node('[data-action="delete-entry"]');
  deleteTrigger.focus();
  click('[data-action="delete-entry"]');
  checkSemantics(node('#dialog'));
  assert.match(declaredName(node('#dialog')), /Delete this entry/);
  closeDialog();
  assert.equal(document.activeElement, deleteTrigger);
  assert.ok((await db.all('entries')).some(item => item.id === entry.id), 'Cancelling deletion preserves source');
  await go('#church');
  const previewTrigger = node('[data-action="preview-pack"]');
  previewTrigger.focus();
  click('[data-action="preview-pack"]');
  assert.equal(declaredName(node('#dialog')), longTitle);
  checkSemantics(node('#dialog'));
  closeDialog();
  assert.equal(document.activeElement, previewTrigger);
  await go('#import');
  const trigger = node('[data-action="pick-journal"]');
  trigger.focus();
  const protectedFile = JSON.parse(await readFile(new URL('./fixtures/protected-v1.lwc', import.meta.url), 'utf8'));
  await chooseFile(protectedFile, 'fictional-accessibility.lwc');
  await waitFor(() => document.querySelector('#unlock-form'), 'protected-file dialog');
  assert.equal(declaredName(node('#dialog')), 'Unlock your writing');
  assert.equal(node('#unlock-error').getAttribute('role'), 'alert');
  checkSemantics(node('#dialog'));
  closeDialog();
  assert.equal(document.activeElement, trigger);
});

test('import review and committed receipt remain structured and status-marked', async () => {
  await go('#import');
  click('[data-action="pick-journal"]');
  const journey = JSON.parse(await readFile(new URL('./fixtures/protected-v1.journey.json', import.meta.url), 'utf8'));
  await chooseFile(journey, 'fictional-accessibility.journey.json');
  await waitFor(() => document.querySelector('#import-review'), 'journal review');
  checkSemantics();
  click('[data-action="confirm-import"]');
  await waitFor(() => document.querySelector('section[role="status"]'), 'committed import receipt');
  const receipt = node('section[role="status"]');
  assertPoliteStatus(receipt);
  assert.match(receipt.textContent, /1 entries saved/);
  assert.match(receipt.textContent, /1 unfinished drafts saved/);
  checkSemantics();
});

test('sermon and changed-journal review, conflict choices and invalid-file errors retain labels and structure', async () => {
  await go('#import');
  const sermon = JSON.parse(await readFile(new URL('../dist/example-sermon-notes.json', import.meta.url), 'utf8'));
  await chooseFile(sermon, 'fictional-accessibility-sermon.json');
  await waitFor(() => document.querySelector('[data-action="confirm-sermon"]'), 'sermon review');
  checkSemantics();
  click('[data-action="cancel-import"]');
  await waitFor(() => !document.querySelector('#import-review'), 'sermon review cancellation');
  const journey = JSON.parse(await readFile(new URL('./fixtures/protected-v1.journey.json', import.meta.url), 'utf8'));
  journey.entries[0].notes = 'Changed fictional accessibility note';
  journey.drafts[0].form.notes = 'Changed fictional accessibility draft';
  await chooseFile(journey, 'fictional-accessibility-conflict.json');
  await waitFor(() => document.querySelector('#keep-copies'), 'conflict review');
  assert.equal(node('#keep-copies').checked, true);
  checkSemantics();
  for (const group of document.querySelectorAll('main .selection-list')) {
    assert.equal(group.getAttribute('tabindex'), '0');
    assert.ok(declaredName(group));
  }
  await chooseFile({format: 'journey-export', version: 99, entries: []}, 'fictional-invalid-version.json');
  await waitFor(() => node('#form-error').textContent.includes('version 1'), 'invalid file error');
  assert.equal(node('#form-error').getAttribute('role'), 'alert');
  assert.equal(document.activeElement, node('#form-error'));
  assert.equal(document.querySelector('#import-review'), null);
  checkSemantics();
});

test('long fictional titles are preserved as text across entry, draft, selection, preview and pack contexts', async () => {
  const checks = [
    ['#home', '.recent-row strong'], ['#journal', '.entry-card h2'],
    ['#entry/' + entry.id, 'h1'], ['#transfer', '.selection-row span'],
    ['#church', '.pack-row strong'],
  ];
  for (const [route, selector] of checks) {
    await go(route);
    assert.ok([...document.querySelectorAll(selector)].some(element => element.textContent.includes(longTitle)), route);
    assert.equal(document.querySelectorAll('main img').length, 0, 'Title markup remains text');
  }
  await go('#journal');
  assert.ok([...document.querySelectorAll('.draft-banner strong')].some(element => element.textContent === longTitle));
  await go('#entry/' + entry.id);
  click('[data-action="markdown"]');
  assert.ok(node('#share-preview').textContent.includes(longTitle));
  closeDialog();
});

test('known opaque text pairs meet WCAG AA source contrast without rounding up', () => {
  // Sanity-check the formula separately from application colors.
  assert.equal(contrast('#000', '#fff'), 21);
  assert.equal(contrast('#fff', '#fff'), 1);
  for (const [surface, background] of lightSurfaces) {
    for (const [name, foreground] of [['body', 'var(--body)'], ['heading', 'var(--ink)'], ['muted', 'var(--muted)'], ['eyebrow', declared('.eyebrow', 'color')], ['error', 'var(--error)']]) {
      assertContrast(`${name} on ${surface}`, foreground, background);
    }
  }
  for (const [name, foreground, background] of [
    ['primary button', declared('.btn.primary', 'color'), declared('.btn.primary', 'background')],
    ['primary hover', declared('.btn.primary', 'color'), declared('.btn.primary:hover', 'background')],
    ['toast', declared('.toast', 'color'), declared('.toast', 'background')],
    ['gold pill', declared('.pill.gold', 'color'), declared('.pill.gold', 'background')],
    ['green pill', declared('.pill', 'color'), declared('.pill', 'background')],
    ['quiet attribution', declared('.quiet-card small', 'color'), declared('.quiet-card', 'background')],
    ['quiet quotation', declared('.quiet-card blockquote', 'color'), declared('.quiet-card', 'background')],
    ['side note', declared('.side-note p', 'color'), declared('.side-note', 'background')],
    ['prose', declared('.prose p', 'color'), 'var(--white)'],
    ['save status', declared('.save-status', 'color'), 'var(--white)'],
    ['error notice', declared('.notice.error', 'color'), declared('.notice.error', 'background')],
    ['placeholder', declared('.field input::placeholder', 'color'), '#fffefb'],
    ['selected navigation', declared('.sidebar nav a[aria-current]', 'color'), declared('.sidebar nav a[aria-current]', 'background')],
    ['navigation count', declared('.nav-count', 'color'), declared('.sidebar nav a[aria-current]', 'background')],
  ]) assertContrast(name, foreground, background);
  // The emphasized hero text is large (37px or larger in the supplied rules).
  assertContrast('large hero emphasis', declared('.hero h1 em', 'color'), 'var(--paper)', 3);
});

test('source focus and form-boundary colors contrast with the known surrounding surfaces', () => {
  const focus = declared('button:focus-visible', 'outline');
  assert.equal(focus, '3px solid var(--focus)');
  for (const selector of ['a:focus-visible', 'input:focus-visible', 'textarea:focus-visible', 'select:focus-visible', 'summary:focus-visible', '[tabindex]:focus-visible']) {
    assert.equal(declared(selector, 'outline'), focus, selector);
    assert.equal(declared(selector, 'outline-offset'), '4px', selector);
  }
  for (const [name, background] of lightSurfaces) {
    assertContrast(`focus on ${name}`, 'var(--focus)', background, 3);
    assertContrast(`control boundary on ${name}`, 'var(--control-border)', background, 3);
  }
  for (const selector of ['.field input', '.field select', '.field textarea', '.search-input', '.toolbar button']) {
    assert.equal(declared(selector, 'border-color'), 'var(--control-border)', selector);
  }
  assertContrast('input boundary on input fill', 'var(--control-border)', '#fffefb', 3);
  assert.equal(declared('[tabindex]:focus-visible', 'outline-color', '(forced-colors: active)'), 'Highlight');
});

test('standalone targets declare at least 44px dimensions; checkbox labels form the target', () => {
  assert.equal(declared('.btn', 'min-height'), '44px');
  assert.equal(declared('.btn', 'min-width'), '44px');
  assert.equal(declared('.btn.small', 'min-height'), '44px');
  for (const property of ['min-width', 'min-height']) assert.equal(declared('.toolbar button', property), '44px');
  for (const selector of ['.field input', '.field select', '.search-input', 'summary', '.check']) {
    assert.equal(declared(selector, 'min-height'), '44px', selector);
  }
  for (const selector of ['.tabs a', '.breadcrumb a', '.section-heading a', '.sidebar-bottom a', '.side-note > a', '.writing-aside .small-note > a', '.entry-card h2 a', '.footer a']) {
    for (const property of ['min-width', 'min-height']) assert.equal(declared(selector, property), '44px', selector);
  }
  assert.ok(parseFloat(declared('.sidebar nav a', 'min-height')) >= 44);
  assert.equal(declared('.brand', 'min-height'), '44px');
  // The native checkbox stays visually compact; its enclosing label is clickable.
  assert.equal(declared('.check input', 'width'), '20px');
  assert.equal(declared('.field input::placeholder', 'opacity'), '1');
});

test('source reflow safeguards wrap long content and avoid nested dialog/pre scroll layers', () => {
  assert.equal(declared('body', 'overflow-wrap'), 'anywhere');
  for (const selector of ['h1', 'h2', 'h3', '.draft-banner strong', '.selection-row span', '.pack-row strong', '.breadcrumb', '.toast']) {
    assert.equal(declared(selector, 'overflow-wrap'), 'anywhere', selector);
  }
  for (const selector of ['.page-head > *', '.hero > *', '.home-bottom > *', '.two-col > *', '.writing-layout > *', '.draft-banner > *', '.pack-row > *', '.check > span']) {
    assert.equal(declared(selector, 'min-width'), '0', selector);
  }
  assert.equal(declared('.toolbar', 'flex-wrap'), 'wrap');
  assert.equal(declared('.tabs', 'flex-wrap'), 'wrap');
  assert.equal(declared('.btn', 'max-width'), '100%');
  assert.equal(declared('.btn', 'white-space'), 'normal');
  assert.equal(declared('.topbar', 'height'), 'auto');
  for (const selector of ['.provided pre', '.review-card pre', 'dialog .selection-list']) {
    assert.equal(declared(selector, 'max-height'), 'none', selector);
    assert.equal(declared(selector, 'overflow'), 'visible', selector);
  }
  assert.equal(declared('.sidebar', 'overflow-y'), 'auto');
  assert.equal(declared('dialog', 'max-height'), '90dvh');
  assert.equal(declared('.hero', 'grid-template-columns', '(max-width:650px)'), '1fr');
  assert.equal(declared('.field-grid', 'grid-template-columns', '(max-width:480px)'), '1fr');
});

test('reduced-motion declarations cover pseudo-elements, transitions, animations and hover displacement', () => {
  for (const selector of ['*', '*::before', '*::after']) {
    assert.equal(declared(selector, 'transition', '(prefers-reduced-motion:reduce)'), 'none');
    assert.equal(declared(selector, 'animation', '(prefers-reduced-motion:reduce)'), 'none');
    assert.equal(declared(selector, 'scroll-behavior', '(prefers-reduced-motion:reduce)'), 'auto');
  }
  assert.equal(declared('.start-card:hover', 'transform', '(prefers-reduced-motion:reduce)'), 'none');
});

after(() => w.close());
