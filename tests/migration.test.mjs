// Origin-to-origin journal migration, for the move to journal.prayersealed.org.
//
// Browser storage is per-origin. A CNAME, a custom domain, or a redirect does
// not carry IndexedDB with it: a reader who opens the new address sees an empty
// journal until they import a file they exported from the old one. That is the
// whole reason the old origin stays alive, and these tests are the evidence
// that the documented procedure actually preserves a journal.
//
// A separate origin is modelled the way envelope-metadata.test.mjs already
// models an isolated database: a fresh `IDBFactory` plus a cache-busted import
// of the storage module, so the two origins share no state whatsoever.
//
// Everything here is fictional test content.
import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB,IDBFactory} from 'fake-indexeddb';
import {newEntry,entryDraft,makeJourney,protect,unprotect,validateJourney} from '../dist/core.js';
import {metadataFromSettings} from '../dist/envelope-metadata.js';
import {prepareJournalExport} from '../dist/transfer.js';
import * as oldOrigin from '../dist/storage.js';

globalThis.indexedDB=indexedDB;

beforeEach(async()=>{
 const database=await oldOrigin.openDB();
 await new Promise((resolve,reject)=>{
  const t=database.transaction(['entries','drafts','settings'],'readwrite');
  for(const name of ['entries','drafts','settings'])t.objectStore(name).clear();
  t.oncomplete=resolve;t.onabort=()=>reject(t.error);
 });
});

/**
 * Open a storage module bound to its own empty IndexedDB — a different origin.
 *
 * The query string is load-bearing: without it Node returns the already
 * evaluated module, which is still bound to the old origin's factory, and every
 * assertion below would pass while testing nothing.
 */
let originCount=0;
async function newOriginStorage(){
 const previous=globalThis.indexedDB;
 globalThis.indexedDB=new IDBFactory();
 try{
  const storage=await import(`../dist/storage.js?migration-origin-${originCount++}`);
  /*
   * Open it here, while the new factory is still installed.
   *
   * storage.js memoises one `dbPromise` per module instance and reads the
   * global `indexedDB` only at the first open. Returning before that open
   * happened bound the "new origin" to whichever factory was current when it
   * was first used — the old one — so the destination read the source's
   * journal and an assertion that the new site started empty failed while
   * every other assertion passed for the wrong reason.
   */
  await storage.openDB();
  return storage;
 }finally{
  globalThis.indexedDB=previous;
 }
}

/** Fictional writing at the old origin: two entries, one unfinished draft. */
async function writeFictionalJournal(){
 const sermon={...newEntry('sermon'),title:'Fictional Sunday gathering',notes:'Fictional personal notes',reflection:'Fictional private reflection',prayer:'Fictional private prayer'};
 const reading={...newEntry('reading'),title:'Fictional midweek reading',notes:'Fictional reading notes'};
 await oldOrigin.put('entries',sermon);
 await oldOrigin.put('entries',reading);
 // A draft is not an entry: it wraps one in a `form`. Built with the app's own
 // helper so the fixture is the shape the importer actually validates.
 const draft=entryDraft({...newEntry('prayer'),title:'Fictional unfinished prayer',notes:'Fictional draft text'});
 await oldOrigin.put('drafts',draft);
 return {sermon,reading,draft};
}

/** The file a reader downloads at the old origin. */
async function exportFromOldOrigin(){
 const entries=await oldOrigin.all('entries');
 const drafts=await oldOrigin.all('drafts');
 const metadata=metadataFromSettings(await oldOrigin.all('settings'));
 return prepareJournalExport(entries,drafts,{metadata,allowEmpty:true});
}

test('a full export at the old origin restores completely into an empty new origin',async()=>{
 const {sermon,reading,draft}=await writeFictionalJournal();
 const file=await exportFromOldOrigin();
 assert.equal(validateJourney(file).entries.length,2);

 const newSite=await newOriginStorage();
 // The state a reader actually meets at a new domain: nothing.
 assert.deepEqual(await newSite.all('entries'),[]);
 assert.deepEqual(await newSite.all('drafts'),[]);

 const result=await newSite.importJourney(file);
 assert.equal(result.entriesAdded,2);
 assert.equal(result.draftsAdded,1);

 const restored=await newSite.all('entries');
 assert.deepEqual(restored,await oldOrigin.all('entries'));
 assert.deepEqual(await newSite.all('drafts'),await oldOrigin.all('drafts'));

 // The separate fields are the product's core promise; check them by name
 // rather than trusting a whole-object comparison alone.
 const movedSermon=restored.find(e=>e.id===sermon.id);
 assert.equal(movedSermon.notes,'Fictional personal notes');
 assert.equal(movedSermon.reflection,'Fictional private reflection');
 assert.equal(movedSermon.prayer,'Fictional private prayer');
 assert.equal(restored.find(e=>e.id===reading.id).title,'Fictional midweek reading');
 assert.equal((await newSite.all('drafts'))[0].id,draft.id);

 // Nothing was moved away from the old origin. Migration is a copy; the old
 // site keeps its journal so a reader can retry or keep it as a backup.
 assert.equal((await oldOrigin.all('entries')).length,2);
 assert.equal((await oldOrigin.all('drafts')).length,1);
});

test('importing into a destination that already has writing merges without losing either side',async()=>{
 await writeFictionalJournal();
 const file=await exportFromOldOrigin();

 const newSite=await newOriginStorage();
 const alreadyThere={...newEntry('reflection'),title:'Fictional entry written at the new address',notes:'Fictional notes typed here first'};
 await newSite.put('entries',alreadyThere);

 const result=await newSite.importJourney(file);
 assert.equal(result.entriesAdded,2);

 const merged=await newSite.all('entries');
 assert.equal(merged.length,3);
 // The entry typed at the new origin survives the import untouched.
 assert.deepEqual(merged.find(e=>e.id===alreadyThere.id),alreadyThere);
});

test('importing the same file again adds nothing and keeps one copy of each record',async()=>{
 await writeFictionalJournal();
 const file=await exportFromOldOrigin();

 const newSite=await newOriginStorage();
 const first=await newSite.importJourney(file);
 assert.equal(first.entriesAdded,2);
 assert.equal(first.draftsAdded,1);

 // A reader who is unsure whether the import worked will do it again. That has
 // to be safe, and it must not silently multiply their journal.
 for(let attempt=0;attempt<3;attempt++){
  const repeat=await newSite.importJourney(file);
  assert.equal(repeat.entriesAdded,0);
  assert.equal(repeat.draftsAdded,0);
  assert.equal(repeat.metadataMapsAdded,0);
 }
 assert.equal((await newSite.all('entries')).length,2);
 assert.equal((await newSite.all('drafts')).length,1);
});

test('a changed version of the same entry is kept as a separate copy, never resolved by clock',async()=>{
 const {sermon}=await writeFictionalJournal();
 const file=await exportFromOldOrigin();

 const newSite=await newOriginStorage();
 await newSite.importJourney(file);

 // The same entry, edited at the old origin after the first export.
 const edited={...sermon,notes:'Fictional notes, revised at the old address'};
 await oldOrigin.put('entries',edited);
 const second=await exportFromOldOrigin();

 const result=await newSite.importJourney(second);
 const after=await newSite.all('entries');
 // Documented behaviour: both readings are preserved for the reader to compare.
 // The original text must still be findable afterwards.
 assert.ok(after.some(e=>e.notes==='Fictional personal notes'),'original version retained');
 assert.ok(after.some(e=>e.notes==='Fictional notes, revised at the old address'),'changed version retained');
 assert.ok(result.entriesAdded>=1,'the changed version was committed as its own copy');
});

test('malformed and empty input is refused, and the destination journal is unchanged',async()=>{
 await writeFictionalJournal();
 const file=await exportFromOldOrigin();

 const newSite=await newOriginStorage();
 await newSite.importJourney(file);
 const before=await newSite.all('entries');
 const beforeDrafts=await newSite.all('drafts');

 const bad=[
  'not json at all',
  '{"format":"journey-export"',
  JSON.stringify({}),
  JSON.stringify({format:'something-else',version:1,entries:[]}),
  JSON.stringify({format:'journey-export',version:1,entries:'not an array'}),
  JSON.stringify({format:'journey-export',version:99,entries:[]}),
  JSON.stringify(null),
 ];
 for(const text of bad){
  let parsed=null;
  try{parsed=JSON.parse(text);}catch{parsed=undefined;}
  // Either parsing refuses it or validateJourney does. Nothing malformed may
  // reach storage, and nothing may be written on the way to finding out.
  assert.throws(()=>validateJourney(parsed),undefined,`accepted malformed input: ${text.slice(0,40)}`);
 }

 assert.deepEqual(await newSite.all('entries'),before);
 assert.deepEqual(await newSite.all('drafts'),beforeDrafts);
});

test('a protected export carries the journal across origins, and a wrong password cannot',async()=>{
 await writeFictionalJournal();
 const file=await exportFromOldOrigin();
 const password='fictional transfer password 1234';
 const sealed=await protect(file,password);

 // The sealed file must not carry the writing in the clear.
 assert.ok(!JSON.stringify(sealed).includes('Fictional private reflection'));

 const newSite=await newOriginStorage();
 await assert.rejects(unprotect(sealed,'the wrong fictional password'));
 assert.deepEqual(await newSite.all('entries'),[],'a failed unlock writes nothing');

 const opened=await unprotect(sealed,password);
 const result=await newSite.importJourney(opened);
 assert.equal(result.entriesAdded,2);
 assert.equal(result.draftsAdded,1);
 assert.deepEqual(await newSite.all('entries'),await oldOrigin.all('entries'));
});

test('an empty journal still exports and imports, so a cautious reader is not stuck',async()=>{
 const file=await exportFromOldOrigin();
 assert.deepEqual(validateJourney(file).entries,[]);

 const newSite=await newOriginStorage();
 const result=await newSite.importJourney(file);
 assert.equal(result.entriesAdded,0);
 assert.equal(result.draftsAdded,0);
 assert.deepEqual(await newSite.all('entries'),[]);
});

test('opaque journal metadata written by another version survives the move', async()=>{
 // A reader may have used a newer or older edition that stored fields this
 // build does not understand. Those must cross the origin boundary intact.
 const raw={...makeJourney([]),futureJournal:{owner:'Fictional reader',privateNote:'Opaque fictional metadata'}};
 const added=await oldOrigin.importJourney(raw);
 assert.equal(added.metadataMapsAdded,1);

 const file=await exportFromOldOrigin();
 const newSite=await newOriginStorage();
 await newSite.importJourney(file);

 assert.deepEqual(
  metadataFromSettings(await newSite.all('settings')),
  metadataFromSettings(await oldOrigin.all('settings')),
 );
});
