/**
 * Scripture, as the companion knows it: the canon, verse counts, the King
 * James text, and the life topics that point into it.
 *
 * A port of the app's verse-index and reference formatting, so a reference
 * reads identically on both editions: "Genesis 2:18-25", "Psalms 23" for a
 * whole chapter, "Genesis 1:1-2:3" across a boundary. Book text is one module
 * per book, imported on demand and cached for the session; nothing here makes
 * a network request, and the data modules themselves are generated from the
 * app by scripts/sync-app-data.mjs.
 */
import books from './kjv/books.js';
import versification from './kjv/versification.js';
import topics from './topics.js';

export { books, versification, topics };
export const booksById = new Map(books.map((book) => [book.id, book]));
export const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
export const bookName = (id) => booksById.get(id)?.name || id;

/** Shown wherever the King James text is. Crediting the text does not answer the permission question; kjv/SOURCE.md does. */
export const KJV_ATTRIBUTION = 'Scripture quotations are from the King James Version, which is in the public domain in the United States. In the United Kingdom the KJV remains under perpetual Crown letters patent.';
export const TOPICS_ATTRIBUTION = 'The topic collections were written for My Life With Christ, drawing on plain historical fact and public-domain reference works.';

// --- the verse index -------------------------------------------------------
// Chapter/verse pairs collapse to one ordinal within a book, so a passage that
// crosses a chapter boundary is a range like any other.
export function buildIndex(verseCounts) {
  const offsets = [0];
  for (const count of verseCounts) offsets.push(offsets[offsets.length - 1] + count);
  return { verseCounts, offsets, total: offsets[offsets.length - 1] };
}
export const toOrdinal = (index, chapter, verse) => index.offsets[chapter - 1] + verse;
export function fromOrdinal(index, ordinal) {
  let chapter = 1;
  while (chapter < index.verseCounts.length && ordinal > index.offsets[chapter]) chapter += 1;
  return { chapter, verse: ordinal - index.offsets[chapter - 1] };
}
/** The verse range a reference claims, or null when it names something the book does not have. */
export function referenceSpan(index, reference) {
  const { chapterStart, chapterEnd, verseStart, verseEnd } = reference;
  const chapterCount = index.verseCounts.length;
  if (!chapterStart || chapterStart < 1 || chapterStart > chapterCount) return null;
  const lastChapter = chapterEnd ?? chapterStart;
  if (lastChapter < 1 || lastChapter > chapterCount || lastChapter < chapterStart) return null;
  if (verseStart === undefined || verseEnd === undefined) {
    return { start: toOrdinal(index, chapterStart, 1), end: toOrdinal(index, lastChapter, index.verseCounts[lastChapter - 1]) };
  }
  if (verseStart < 1 || verseStart > index.verseCounts[chapterStart - 1]) return null;
  if (verseEnd < 1 || verseEnd > index.verseCounts[lastChapter - 1]) return null;
  const start = toOrdinal(index, chapterStart, verseStart);
  const end = toOrdinal(index, lastChapter, verseEnd);
  return end < start ? null : { start, end };
}
export function formatSpan(index, name, start, end) {
  const from = fromOrdinal(index, start);
  const to = fromOrdinal(index, end);
  const endsChapter = to.verse === index.verseCounts[to.chapter - 1];
  if (from.chapter === to.chapter) {
    if (from.verse === 1 && endsChapter) return `${name} ${from.chapter}`;
    if (from.verse === to.verse) return `${name} ${from.chapter}:${from.verse}`;
    return `${name} ${from.chapter}:${from.verse}-${to.verse}`;
  }
  if (from.verse === 1 && endsChapter) return `${name} ${from.chapter}-${to.chapter}`;
  return `${name} ${from.chapter}:${from.verse}-${to.chapter}:${to.verse}`;
}
/** A reference for display, e.g. "Genesis 2:18-25". A book this edition has no counts for reads as its name alone. */
export function refToString(ref) {
  const counts = versification[ref.book];
  const name = bookName(ref.book);
  if (!counts) return name;
  const index = buildIndex(counts);
  const span = referenceSpan(index, ref);
  return span ? formatSpan(index, name, span.start, span.end) : name;
}
export function passageLength(ref) {
  const counts = versification[ref.book];
  if (!counts) return 0;
  const span = referenceSpan(buildIndex(counts), ref);
  return span ? span.end - span.start + 1 : 0;
}

// --- the text ----------------------------------------------------------------
const cache = new Map();
/** One book of the King James text, cached for the session. Only a canonical id is ever turned into a module path. */
export async function loadBook(id) {
  if (!booksById.has(id)) throw Error(`There is no book of Scripture called "${id}" in this edition.`);
  if (!cache.has(id)) cache.set(id, import(`./kjv/${id}.js`).then((module) => module.default));
  try { return await cache.get(id); } catch (error) { cache.delete(id); throw error; }
}
/** The verses a reference names, in order, across chapter boundaries. Empty for a reference that does not resolve. */
export async function loadPassage(ref) {
  const counts = versification[ref.book];
  if (!counts) return [];
  const index = buildIndex(counts);
  const span = referenceSpan(index, ref);
  if (!span) return [];
  const book = await loadBook(ref.book);
  const out = [];
  for (let ordinal = span.start; ordinal <= span.end; ordinal += 1) {
    const { chapter, verse } = fromOrdinal(index, ordinal);
    const text = book.chapters[chapter - 1]?.[verse - 1];
    if (text !== undefined) out.push({ chapter, number: verse, text });
  }
  return out;
}

// --- topics --------------------------------------------------------------------
/** The app's normalisation for names and aliases: case, a few punctuation marks and runs of space do not count. */
export const normalize = (value) => String(value).toLowerCase().replace(/[.'’,]/g, '').replace(/\s+/g, ' ').trim();
/**
 * Topics matching a query, as the app ranks them: an exact name first, then an
 * alias ("worry" finds Anxiety), then a loose match on the description and the
 * notes beside each passage. An alias hit says which alias matched.
 */
export function searchTopics(query, limit = topics.length) {
  const needle = normalize(query);
  if (!needle) return topics.map((topic) => ({ topic }));
  const exact = [], aliased = [], loose = [];
  for (const topic of topics) {
    const name = normalize(topic.name);
    if (name === needle || name.includes(needle)) { exact.push({ topic }); continue; }
    const alias = (topic.aliases || []).find((value) => normalize(value) === needle || normalize(value).includes(needle));
    if (alias) { aliased.push({ topic, matchedAlias: alias }); continue; }
    const haystack = [topic.description, ...topic.refs.map((ref) => ref.note || '')].join(' ').toLowerCase();
    if (haystack.includes(needle)) loose.push({ topic });
  }
  return [...exact, ...aliased, ...loose].slice(0, limit);
}
/** The topic ids an entry is filed under, in order, without duplicates. Unknown ids are kept: they are the app's data, not ours to drop. */
export function topicIdsOf(entry) {
  const seen = new Set();
  for (const anchor of entry.anchors || []) if (anchor && anchor.kind === 'topic' && typeof anchor.topicId === 'string' && !seen.has(anchor.topicId)) seen.add(anchor.topicId);
  return [...seen];
}
/** Replace the topic anchors on an entry, leaving every other anchor exactly where it was. */
export function withTopics(entry, topicIds) {
  const others = (entry.anchors || []).filter((anchor) => !(anchor && anchor.kind === 'topic'));
  const unique = [...new Set(topicIds.filter((id) => typeof id === 'string' && id))];
  entry.anchors = [...others, ...unique.map((topicId) => ({ kind: 'topic', topicId }))];
  return entry;
}
/** How an anchor is named on screen: a topic by its name, a passage by its reference, a book by its name. */
export function anchorLabel(anchor) {
  if (!anchor || typeof anchor !== 'object') return '';
  if (anchor.kind === 'topic') return `Topic: ${topicsById.get(anchor.topicId)?.name || anchor.topicId}`;
  if (anchor.kind === 'book') return bookName(anchor.book);
  if (anchor.kind === 'scripture') return refToString(anchor);
  return '';
}
/** Words that find an entry through its topics: their names and aliases, so "husband" finds an entry filed under Marriage. */
export function topicSearchText(entry) {
  return topicIdsOf(entry).flatMap((id) => { const topic = topicsById.get(id); return topic ? [topic.name, ...(topic.aliases || [])] : [id]; }).join(' ');
}
