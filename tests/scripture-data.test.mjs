// The Scripture the companion ships, checked against itself and against the app.
//
// The King James text, the canon, the verse counts and the topics are generated
// from the app by scripts/sync-app-data.mjs. These tests hold the generated
// modules to the same facts the app holds its own data to: 66 books, 1,189
// chapters, 31,102 verses, every topic passage resolving to real verses, and
// references formatted exactly as the app formats them. Topic anchors are the
// app's own field, so they must cross its importer with no warnings.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {
 books,versification,topics,topicsById,refToString,passageLength,loadBook,loadPassage,
 searchTopics,normalize,topicIdsOf,withTopics,anchorLabel,topicSearchText,KJV_ATTRIBUTION,
} from '../dist/scripture.js';
import {newEntry,makeJourney,entryDraft,draftEntry} from '../dist/core.js';

test('the canon is 66 books in order, and every book of text matches its verse counts',async()=>{
 assert.equal(books.length,66);
 assert.deepEqual(books.map(b=>b.order),Array.from({length:66},(_,i)=>i+1));
 assert.equal(books.filter(b=>b.testament==='OT').length,39);
 assert.equal(books.filter(b=>b.testament==='NT').length,27);
 assert.equal(Object.keys(versification).length,66);
 let chapters=0,verses=0;
 for(const book of books){
  const text=await loadBook(book.id);
  assert.equal(text.id,book.id);assert.equal(text.name,book.name);
  const counts=versification[book.id];assert.ok(counts,book.id);
  assert.equal(text.chapters.length,counts.length,`${book.id}: chapter count`);
  text.chapters.forEach((chapter,i)=>{
   assert.equal(chapter.length,counts[i],`${book.id} ${i+1}: verse count`);
   for(const verse of chapter)assert.ok(typeof verse==='string'&&verse.trim(),`${book.id} ${i+1} holds an empty verse`);
  });
  chapters+=counts.length;verses+=counts.reduce((a,b)=>a+b,0);
 }
 assert.equal(chapters,1189);
 assert.equal(verses,31102,'the canonical King James verse count');
 assert.equal((await loadBook('genesis')).chapters[0][0],'In the beginning God created the heaven and the earth.');
 // Only a canonical id is ever turned into a module path.
 await assert.rejects(()=>loadBook('../storage'),/no book of Scripture/);
 assert.ok(topicsById.has('marriage'));
});

test('every topic passage names real verses, every topic has a description and aliases, and ids are unique',()=>{
 assert.equal(topics.length,40);
 assert.equal(new Set(topics.map(t=>t.id)).size,40);
 let refs=0;
 for(const topic of topics){
  assert.ok(topic.name&&topic.description,topic.id);
  assert.ok(Array.isArray(topic.aliases)&&topic.aliases.length,`${topic.id}: aliases`);
  assert.ok(topic.refs.length,`${topic.id}: refs`);
  for(const ref of topic.refs){
   refs++;
   assert.ok(versification[ref.book],`${topic.id}: unknown book ${ref.book}`);
   assert.ok(passageLength(ref)>0,`${topic.id}: ${JSON.stringify(ref)} does not resolve to verses`);
   assert.ok(typeof ref.note==='string'&&ref.note,`${topic.id}: ${ref.book} ${ref.chapterStart}:${ref.verseStart} has no note`);
  }
 }
 assert.equal(refs,344);
});

test('references read exactly as the app formats them',()=>{
 assert.equal(refToString({book:'genesis',chapterStart:2,verseStart:18,chapterEnd:2,verseEnd:25}),'Genesis 2:18-25');
 assert.equal(refToString({book:'psalms',chapterStart:23,verseStart:1,chapterEnd:23,verseEnd:6}),'Psalms 23');
 assert.equal(refToString({book:'john',chapterStart:3,verseStart:16,chapterEnd:3,verseEnd:16}),'John 3:16');
 assert.equal(refToString({book:'genesis',chapterStart:1,verseStart:1,chapterEnd:2,verseEnd:3}),'Genesis 1:1-2:3');
 assert.equal(refToString({book:'genesis',chapterStart:1,verseStart:1,chapterEnd:2,verseEnd:25}),'Genesis 1-2');
 assert.equal(refToString({book:'1-samuel',chapterStart:17,verseStart:45,chapterEnd:17,verseEnd:47}),'1 Samuel 17:45-47');
 // An impossible reference falls back to the book's name rather than inventing one.
 assert.equal(refToString({book:'genesis',chapterStart:99,verseStart:1,chapterEnd:99,verseEnd:1}),'Genesis');
 assert.equal(refToString({book:'nothing',chapterStart:1,verseStart:1,chapterEnd:1,verseEnd:1}),'nothing');
});

test('a passage loads across a chapter boundary, in order, with chapter and verse numbers',async()=>{
 const verses=await loadPassage({book:'genesis',chapterStart:1,verseStart:31,chapterEnd:2,verseEnd:2});
 assert.deepEqual(verses.map(v=>[v.chapter,v.number]),[[1,31],[2,1],[2,2]]);
 assert.match(verses[1].text,/^Thus the heavens and the earth were finished/);
 assert.deepEqual(await loadPassage({book:'genesis',chapterStart:99,verseStart:1,chapterEnd:99,verseEnd:1}),[]);
 assert.deepEqual(await loadPassage({book:'nothing',chapterStart:1,verseStart:1,chapterEnd:1,verseEnd:1}),[]);
});

test('topics are found by name, by alias and by the notes beside their passages, ranked in that order',()=>{
 assert.equal(normalize("  Song of Solomon's,  "),'song of solomons');
 const worry=searchTopics('worry');
 assert.equal(worry[0].topic.id,'anxiety');assert.equal(worry[0].matchedAlias,'worry');
 const grief=searchTopics('grief');
 assert.equal(grief[0].topic.id,'grief');assert.equal(grief[0].matchedAlias,undefined);
 assert.equal(searchTopics('').length,40);
 assert.equal(searchTopics('zzzz-nothing-here').length,0);
 assert.ok(searchTopics('tithing').length>0,'a word people actually type reaches a topic');
 assert.equal(searchTopics('GRIEF  ')[0].topic.id,'grief','case and spacing do not count');
});

test('topic anchors are the app’s own field: they cross its importer with no warnings, in entries and in drafts',async()=>{
 const tmp=new URL('../.test-tmp/scripture-data/',import.meta.url);await mkdir(tmp,{recursive:true});
 for(const [src,out] of [['lib/entry-kinds.ts','entry-kinds.mjs'],['export/migrate.ts','migrate.mjs']]){
  const source=await readFile(new URL('../compat/src/'+src,import.meta.url),'utf8');
  await writeFile(new URL(out,tmp),stripTypeScriptTypes(source).replace("'../lib/entry-kinds'","'./entry-kinds.mjs'"));
 }
 const {migrateExport}=await import(new URL('migrate.mjs',tmp).href);
 const wire=j=>JSON.parse(JSON.stringify(j));

 const e=newEntry('sermon');e.title='FICTIONAL-COMPAT topics';
 e.anchors=[{kind:'scripture',book:'genesis',chapterStart:2,verseStart:18,chapterEnd:2,verseEnd:25},{kind:'book',book:'psalms'}];
 withTopics(e,['marriage','grief','marriage']);
 assert.deepEqual(topicIdsOf(e),['marriage','grief'],'duplicates collapse');
 assert.deepEqual(e.anchors.map(anchorLabel),['Genesis 2:18-25','Psalms','Topic: Marriage','Topic: Grief'],'the app’s own anchors stay first and untouched');
 assert.match(topicSearchText(e),/husband/,'an alias finds the entry');

 const into=migrateExport(wire(makeJourney([e],[entryDraft(e)])));
 assert.deepEqual(into.warnings,[],`the app warned: ${into.warnings.join(' | ')}`);
 assert.deepEqual(into.entries[0].anchors,e.anchors);
 assert.deepEqual(into.drafts[0].form.anchors,e.anchors);

 withTopics(e,[]);
 assert.deepEqual(e.anchors.map(a=>a.kind),['scripture','book'],'removing every topic leaves the rest');

 // A topic the app may add later is carried and named by its id, never dropped.
 const unknown=newEntry();unknown.anchors=[{kind:'topic',topicId:'a-topic-the-app-may-add-later'}];
 assert.deepEqual(topicIdsOf(unknown),['a-topic-the-app-may-add-later']);
 assert.equal(anchorLabel(unknown.anchors[0]),'Topic: a-topic-the-app-may-add-later');
 assert.deepEqual(draftEntry(entryDraft(unknown)).anchors,unknown.anchors);
 assert.match(KJV_ATTRIBUTION,/King James Version/);
});
