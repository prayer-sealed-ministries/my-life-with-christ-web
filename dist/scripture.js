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

// --- the divisions: every book broken into titled passages ------------------
//
// Berean Standard Bible section headings, public domain since 30 April 2023,
// with the book introductions written for the app. About a megabyte, so it is
// imported only when the Bible is browsed and never on the writing path.
export const BSB_ATTRIBUTION = 'The Holy Bible, Berean Standard Bible, BSB is produced in cooperation with Bible Hub, Discovery Bible, OpenBible.com, and the Berean Bible Translation Committee. This text of God’s Word has been dedicated to the public domain. Section headings are used here with gratitude; attribution is not required.';
/** How an uncovered span is described: the headings leave a few verses untitled, and a reader can still write there. */
export const UNCOVERED_NOTE = 'No section heading — read it and add your own note';

/** A stable, collision-free id for a span the headings leave untitled, as the app forms it. */
export function spanId(bookId, from, to) {
  if (from.chapter === to.chapter) return `${bookId}-${from.chapter}-${from.verse}-${to.verse}`;
  return `${bookId}-${from.chapter}-${from.verse}-${to.chapter}-${to.verse}`;
}
/**
 * Divide a book into a gapless run of segments: the titled passages in order,
 * with an `uncovered` segment wherever the headings leave a hole, so that every
 * verse belongs to exactly one segment and every segment can be written about.
 * Overlapping headings are kept whole rather than truncated. A port of the
 * app's buildSegments.
 */
export function buildSegments(book, verseCounts) {
  const index = buildIndex(verseCounts);
  const placed = [];
  for (const entry of book.entries) { const span = referenceSpan(index, entry); if (span) placed.push({ entry, span }); }
  placed.sort((a, b) => a.span.start - b.span.start || a.span.end - b.span.end);
  const segments = [];
  let cursor = 1;
  const addUncovered = (start, end) => {
    const from = fromOrdinal(index, start), to = fromOrdinal(index, end);
    segments.push({ kind: 'uncovered', id: spanId(book.id, from, to), ref: formatSpan(index, book.name, start, end), chapterStart: from.chapter, verseStart: from.verse, chapterEnd: to.chapter, verseEnd: to.verse });
  };
  for (const { entry, span } of placed) {
    if (span.start > cursor) addUncovered(cursor, span.start - 1);
    const from = fromOrdinal(index, span.start), to = fromOrdinal(index, span.end);
    segments.push({ kind: 'outline', id: entry.id, ref: entry.ref, entry, chapterStart: from.chapter, verseStart: from.verse, chapterEnd: to.chapter, verseEnd: to.verse });
    cursor = Math.max(cursor, span.end + 1);
  }
  if (cursor <= index.total) addUncovered(cursor, index.total);
  return segments;
}
/** The portable reference a segment anchors to. */
export const segmentRef = (segment, bookId) => ({ book: bookId, chapterStart: segment.chapterStart, verseStart: segment.verseStart, chapterEnd: segment.chapterEnd, verseEnd: segment.verseEnd });
/** The title to show for a segment: the heading's display wording, or the reference for an untitled span. */
export const segmentTitle = (segment) => segment.kind === 'outline' ? (segment.entry.displayTitle || segment.entry.title || segment.ref) : segment.ref;

let sectionsPromise = null;
/**
 * The divisions, built once: the books with their headings and introductions,
 * and the questions that can only be answered once they are here.
 */
export function loadSections() {
  if (!sectionsPromise) {
    sectionsPromise = Promise.all([import('./sections.js'), import('./intros.js')]).then(([sections, intros]) => {
      const introsById = intros.default;
      const outlineBooks = sections.default.map((book) => ({ ...book, intro: typeof introsById[book.id] === 'string' ? introsById[book.id] : '' }));
      const outlineBooksById = new Map(outlineBooks.map((book) => [book.id, book]));
      const cache = new Map();
      const segmentsForBook = (bookId) => {
        if (cache.has(bookId)) return cache.get(bookId);
        const counts = versification[bookId];
        if (!counts) return [];
        const book = outlineBooksById.get(bookId);
        const segments = buildSegments({ id: bookId, name: bookName(bookId), entries: book ? book.entries : [] }, counts);
        cache.set(bookId, segments);
        return segments;
      };
      const segmentContaining = (bookId, chapter, verse = 1) => segmentsForBook(bookId).find((s) => (chapter > s.chapterStart || (chapter === s.chapterStart && verse >= s.verseStart)) && (chapter < s.chapterEnd || (chapter === s.chapterEnd && verse <= s.verseEnd)));
      const findSegment = (bookId, segmentId) => segmentsForBook(bookId).find((s) => s.id === segmentId);
      /**
       * Where a segment id this edition does not have was pointing. Ids are
       * `<book>-<numbers>`: the first number is the start chapter, and the
       * second is the start verse only when there are three or more numbers.
       * Enough to offer the passage a stale link was reaching for.
       */
      const nearestTo = (bookId, segmentId) => {
        if (!segmentId.startsWith(`${bookId}-`)) return undefined;
        const parts = segmentId.slice(bookId.length + 1).split('-');
        if (!parts.length || !parts.every((part) => /^\d+$/.test(part))) return undefined;
        const numbers = parts.map(Number);
        return segmentContaining(bookId, numbers[0], parts.length >= 3 ? numbers[1] : 1);
      };
      return { outlineBooks, outlineBooksById, entryCountFor: (bookId) => outlineBooksById.get(bookId)?.entries.length ?? 0, introFor: (bookId) => outlineBooksById.get(bookId)?.intro ?? '', segmentsForBook, segmentContaining, findSegment, nearestTo };
    }).catch((error) => { sectionsPromise = null; throw error; });
  }
  return sectionsPromise;
}

// --- the reverse index: which topics touch a passage ---------------------------
// Built once from the topics and the verse counts, on first use. Indexed by
// verse span, so it answers for a BSB heading, an untitled span or a whole
// chapter alike. A port of the app's topic-index.
let touchesByBook = null;
function touches() {
  if (touchesByBook) return touchesByBook;
  touchesByBook = new Map();
  for (const topic of topics) for (const ref of topic.refs) {
    const counts = versification[ref.book]; if (!counts) continue;
    const span = referenceSpan(buildIndex(counts), ref); if (!span) continue;
    if (!touchesByBook.has(ref.book)) touchesByBook.set(ref.book, []);
    touchesByBook.get(ref.book).push({ topic, ref, span });
  }
  return touchesByBook;
}
/** Topics whose passages overlap a range, the one that claims most of it first. */
export function topicsForSpan(book, chapterStart, verseStart, chapterEnd, verseEnd) {
  const counts = versification[book], rows = touches().get(book);
  if (!counts || !rows) return [];
  const target = referenceSpan(buildIndex(counts), { chapterStart, verseStart, chapterEnd, verseEnd });
  if (!target) return [];
  const best = new Map();
  for (const row of rows) {
    const start = Math.max(row.span.start, target.start), end = Math.min(row.span.end, target.end);
    if (start > end) continue;
    const overlap = end - start + 1, existing = best.get(row.topic.id);
    if (!existing || overlap > existing.overlap) best.set(row.topic.id, { touch: { topic: row.topic, ref: row.ref }, overlap });
  }
  return [...best.values()].sort((a, b) => b.overlap - a.overlap || a.touch.topic.name.localeCompare(b.touch.topic.name)).map((row) => row.touch);
}
/** Every topic that touches any part of a book, with how many of its passages are here. */
export function topicsForBook(book) {
  const rows = touches().get(book);
  if (!rows) return [];
  const counts = new Map();
  for (const row of rows) { const existing = counts.get(row.topic.id); if (existing) existing.passages += 1; else counts.set(row.topic.id, { topic: row.topic, passages: 1, firstRef: row.ref }); }
  return [...counts.values()].sort((a, b) => b.passages - a.passages || a.topic.name.localeCompare(b.topic.name));
}

// --- entries on a passage ----------------------------------------------------------
/** Does a scripture anchor share at least one verse with a reference? Flat (chapter, verse) positions, so a range across chapters needs no special case. */
export function anchorOverlaps(anchor, ref) {
  if (!anchor || anchor.kind !== 'scripture' || anchor.book !== ref.book) return false;
  const at = (c, v) => c * 1000 + v;
  return at(anchor.chapterStart, anchor.verseStart) <= at(ref.chapterEnd, ref.verseEnd) && at(ref.chapterStart, ref.verseStart) <= at(anchor.chapterEnd, anchor.verseEnd);
}
/** Every saved entry anchored to a passage, oldest first: the app's passage-history order. */
export function entriesAnchoredTo(entries, ref) {
  return entries.filter((entry) => (entry.anchors || []).some((anchor) => anchorOverlaps(anchor, ref))).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}
