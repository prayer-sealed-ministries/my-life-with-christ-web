import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB,IDBObjectStore} from 'fake-indexeddb';
import {clone,newEntry,entryDraft,draftEntry,makeJourney} from '../dist/core.js';
import * as storage from '../dist/storage.js';

globalThis.indexedDB=indexedDB;
const stores=['entries','drafts','packs','settings'];
beforeEach(async()=>{
 const db=await storage.openDB();
 await new Promise((resolve,reject)=>{const t=db.transaction(stores,'readwrite');for(const name of stores)t.objectStore(name).clear();t.oncomplete=resolve;t.onabort=()=>reject(t.error);});
});
const receipt=result=>Object.fromEntries(['entriesAdded','entriesSkipped','entryCopies','draftsAdded','draftsSkipped','draftCopies'].map(key=>[key,result[key]]));
const snapshot=async()=>Object.fromEntries(await Promise.all(stores.map(async name=>[name,await storage.all(name)])));

// All writing in these fixtures is deliberately fictional.
test('mixed imports report actual added, skipped and conflict-copy counts for entries and drafts',async()=>{
 const entry=newEntry('reflection'),duplicate=newEntry('prayer'),fresh=newEntry('reading');
 entry.notes='Original fictional note';
 const draft=entryDraft(entry),duplicateDraft=entryDraft(duplicate),freshDraft=entryDraft(fresh);
 draft.entryId=entry.id;
 for(const e of [entry,duplicate])await storage.put('entries',e);
 for(const d of [draft,duplicateDraft])await storage.putDraft(d,undefined);
 const incomingEntry={...clone(entry),notes:'Changed fictional note'};
 const incomingDraft={...clone(draft),form:{...clone(draft.form),notes:'Changed unfinished fictional note'},futureField:{nested:['keep',false,0]}};
 const journey=makeJourney([incomingEntry,duplicate,fresh],[incomingDraft,duplicateDraft,freshDraft]);
 journey.futureEnvelope={preserve:'fictional metadata'};
 let result=await storage.importJourney(journey);
 assert.deepEqual(receipt(result),{entriesAdded:2,entriesSkipped:1,entryCopies:1,draftsAdded:2,draftsSkipped:1,draftCopies:1});
 assert.equal(result.count,2);assert.equal(result.copies,1);assert.equal(result.drafts,2);
 const rows=await storage.all('drafts'),copy=rows.find(row=>row._unmigrated?.companionOriginalDraft);
 assert.deepEqual(rows.find(row=>row.id===draft.id),draft);
 assert.notEqual(copy.id,incomingDraft.id);
 assert.equal(Object.hasOwn(copy,'entryId'),false);
 assert.notEqual(draftEntry(copy).id,entry.id);
 assert.deepEqual(copy.futureField,incomingDraft.futureField);
 assert.deepEqual(copy._unmigrated.companionOriginalDraft,incomingDraft);
 assert.deepEqual((await storage.all('entries')).find(row=>row.id===entry.id),entry);
 result=await storage.importJourney(journey);
 assert.deepEqual(receipt(result),{entriesAdded:0,entriesSkipped:3,entryCopies:0,draftsAdded:0,draftsSkipped:3,draftCopies:0});
 assert.equal(result.drafts,0);
 assert.equal((await storage.all('drafts')).length,4);
 assert.equal((await storage.all('settings')).filter(row=>row.id==='journal-envelope-metadata').length,1);
});

test('conflict skipping applies to drafts and never replaces either original',async()=>{
 const original=newEntry('letter'),draft=entryDraft(original),fresh=entryDraft(newEntry('prayer'));
 await storage.put('entries',original);await storage.putDraft(draft,undefined);
 const changed={...clone(original),notes:'Incoming fictional change'},changedDraft={...clone(draft),form:{...clone(draft.form),notes:'Incoming draft change'}};
 const result=await storage.importJourney(makeJourney([changed],[changedDraft,fresh]),false);
 assert.deepEqual(receipt(result),{entriesAdded:0,entriesSkipped:1,entryCopies:0,draftsAdded:1,draftsSkipped:1,draftCopies:0});
 assert.deepEqual(await storage.all('entries'),[original]);
 assert.deepEqual((await storage.all('drafts')).find(row=>row.id===draft.id),draft);
});

test('conflict provenance retains existing reserved and non-object unknown metadata',async()=>{
 for(const metadata of [{companionOriginalId:'prior-source',companionOriginalEntry:{unknown:'older provenance'},custom:{value:42}},null,['future','shape']]){
  const original=newEntry(),incoming={...clone(original),notes:'A changed fictional note',_unmigrated:clone(metadata)};
  await storage.put('entries',original);
  const journey=makeJourney([incoming]);
  assert.equal((await storage.importJourney(journey)).entryCopies,1);
  const copy=(await storage.all('entries')).find(row=>row._unmigrated?.companionOriginalId===original.id);
  assert.deepEqual(copy._unmigrated.companionOriginalEntry,incoming);
  assert.equal((await storage.importJourney(journey)).entriesAdded,0);
 }
 const draft=entryDraft(newEntry());draft._unmigrated.companionOriginalDraft={prior:'retain this too'};
 await storage.putDraft(draft,undefined);
 const incoming={...clone(draft),form:{...clone(draft.form),notes:'A changed fictional draft'}};
 const journey=makeJourney([],[incoming]);
 await storage.importJourney(journey);
 const copy=(await storage.all('drafts')).find(row=>row.id!==draft.id);
 assert.deepEqual(copy._unmigrated.companionOriginalDraft,incoming);
 assert.equal((await storage.importJourney(journey)).draftsAdded,0);
});

test('editing an imported conflict copy does not cause a later import to silently skip lost source content',async()=>{
 const draft=entryDraft(newEntry());await storage.putDraft(draft,undefined);
 const incoming={...clone(draft),form:{...clone(draft.form),notes:'Incoming fictional note'}};
 const journey=makeJourney([],[incoming]);await storage.importJourney(journey);
 const copy=(await storage.all('drafts')).find(row=>row.id!==draft.id);
 await storage.putDraft({...clone(copy),form:{...clone(copy.form),notes:'Edited on this device'}},copy);
 const result=await storage.importJourney(journey);
 assert.equal(result.draftCopies,1);assert.equal((await storage.all('drafts')).length,3);
});

test('an aborted multi-store import leaves entries, drafts and envelope metadata untouched',async()=>{
 const original=newEntry();await storage.put('entries',original);
 await storage.put('settings',{id:'existing-setting',value:'keep'});
 const before=await snapshot(),journey=makeJourney([{...clone(original),notes:'Incoming change'}],[entryDraft(newEntry())]);
 journey.futureEnvelope={preserve:true};const originalPut=IDBObjectStore.prototype.put;
 IDBObjectStore.prototype.put=function(...args){const request=originalPut.apply(this,args);if(this.name==='settings')this.transaction.abort();return request;};
 try{await assert.rejects(()=>storage.importJourney(journey),/Nothing was imported/);}finally{IDBObjectStore.prototype.put=originalPut;}
 assert.deepEqual(await snapshot(),before);
});

test('entry save verifies both snapshots and atomically retains the draft on failure',async()=>{
 const original=newEntry(),draft=entryDraft(original);draft.entryId=original.id;
 await storage.put('entries',original);await storage.putDraft(draft,undefined);
 const changedDraft={...clone(draft),form:{...clone(draft.form),notes:'Newer fictional draft'}};
 await storage.putDraft(changedDraft,draft);
 await assert.rejects(()=>storage.saveEntry({...clone(original),notes:'Stale save'},draft.id,original,draft),/draft changed in another tab/);
 await assert.rejects(()=>storage.saveEntry({...clone(original),notes:'Missing snapshot'},draft.id,original),/draft changed in another tab/);
 assert.deepEqual(await storage.all('entries'),[original]);
 assert.deepEqual(await storage.all('drafts'),[changedDraft]);
 const newerEntry={...clone(original),notes:'Another tab saved the entry'};
 await storage.put('entries',newerEntry);
 await assert.rejects(()=>storage.saveEntry(original,draft.id,original,changedDraft),/entry changed in another tab/);
 assert.deepEqual(await storage.all('drafts'),[changedDraft]);
 const updated={...clone(newerEntry),notes:'Final fictional writing'};
 await storage.saveEntry(updated,draft.id,newerEntry,changedDraft);
 assert.deepEqual(await storage.all('entries'),[updated]);assert.deepEqual(await storage.all('drafts'),[]);
});

test('failure after the entry write rolls back both the entry and draft deletion',async()=>{
 const entry=newEntry(),draft=entryDraft(entry);await storage.putDraft(draft,undefined);
 const originalDelete=IDBObjectStore.prototype.delete;
 IDBObjectStore.prototype.delete=function(...args){const request=originalDelete.apply(this,args);if(this.name==='drafts')this.transaction.abort();return request;};
 try{await assert.rejects(()=>storage.saveEntry(entry,draft.id,undefined,draft),/draft has been kept/);}finally{IDBObjectStore.prototype.delete=originalDelete;}
 assert.deepEqual(await storage.all('entries'),[]);assert.deepEqual(await storage.all('drafts'),[draft]);
});

test('draft and church pack writes reject stale updates and stale creates',async()=>{
 for(const [store,save,initial] of [['drafts',storage.putDraft,entryDraft(newEntry())],['packs',storage.putPack,{id:crypto.randomUUID(),value:{bodyMarkdown:'Fictional outline'},futureField:['preserve']}]] ){
  await save(initial,undefined);
  await assert.rejects(()=>save(initial,undefined),/another tab/);
  const next={...clone(initial),updatedAt:'2026-10-13T12:00:00Z'};
  await save(next,initial);
  await assert.rejects(()=>save({...clone(initial),updatedAt:'2026-10-13T11:00:00Z'},initial),/another tab/);
  assert.deepEqual(await storage.all(store),[next]);
 }
});

test('concurrent imports serialize and create at most one conflict copy of each kind',async()=>{
 const entry=newEntry(),draft=entryDraft(entry);await storage.put('entries',entry);await storage.putDraft(draft,undefined);
 const journey=makeJourney([{...clone(entry),notes:'Changed note'}],[{...clone(draft),form:{...clone(draft.form),notes:'Changed draft'}}]);
 const results=await Promise.all([storage.importJourney(journey),storage.importJourney(journey)]);
 assert.equal(results.reduce((sum,r)=>sum+r.entryCopies,0),1);
 assert.equal(results.reduce((sum,r)=>sum+r.draftCopies,0),1);
 assert.equal((await storage.all('entries')).length,2);assert.equal((await storage.all('drafts')).length,2);
 assert.equal((await storage.all('settings')).length,0);
});

test('storage takes immutable snapshots before yielding to concurrent callers',async()=>{
 const draft=entryDraft(newEntry());const expected=clone(draft);
 const pending=storage.putDraft(draft,undefined);draft.form.notes='Caller mutated the object';await pending;
 assert.deepEqual(await storage.all('drafts'),[expected]);
 const journey=makeJourney([newEntry()]),copy=clone(journey);
 const importing=storage.importJourney(journey);journey.entries[0].notes='Mutation after import started';await importing;
 assert.deepEqual(await storage.all('entries'),copy.entries);
});

test('invalid input aborts before any store changes',async()=>{
 const entry=newEntry();await storage.put('entries',entry);const before=await snapshot();
 await assert.rejects(()=>storage.importJourney({format:'journey-export',version:1,entries:[newEntry()],drafts:[{id:'invalid'}]}),/draft is malformed/);
 assert.deepEqual(await snapshot(),before);
});

test('legacy stored undefined fields compare like their JSON export instead of blocking recovery',async()=>{
 const draft=entryDraft(newEntry()),db=await storage.openDB();
 await new Promise((resolve,reject)=>{const t=db.transaction('drafts','readwrite');t.objectStore('drafts').put({...draft,entryId:undefined});t.oncomplete=resolve;t.onabort=()=>reject(t.error);});
 assert.equal((await storage.importJourney(makeJourney([],[draft]))).draftsSkipped,1);
 const updated={...clone(draft),form:{...clone(draft.form),notes:'Recovered fictional writing'}};
 await storage.putDraft(updated,clone(draft));
 assert.deepEqual(await storage.all('drafts'),[updated]);
});

test('generated identifiers cannot overwrite originals or another incoming entry',async t=>{
 const original=newEntry(),another=newEntry();await storage.put('entries',original);
 const nextIds=[another.id,original.id,'fictional-safe-copy-id','fictional-safe-envelope-id'];
 t.mock.method(crypto,'randomUUID',()=>nextIds.shift()||'fictional-spare-id');
 const result=await storage.importJourney(makeJourney([{...clone(original),notes:'Changed fictional entry'},another]));
 assert.equal(result.entriesAdded,2);
 const entries=await storage.all('entries');assert.equal(entries.length,3);
 assert.deepEqual(entries.find(row=>row.id===original.id),original);
 assert.deepEqual(entries.find(row=>row.id===another.id),another);
 assert.equal(entries.find(row=>row.id==='fictional-safe-copy-id').notes,'Changed fictional entry');
});

test('exhausted identifier generation aborts earlier queued writes without a partial import',async t=>{
 const original=newEntry(),fresh=newEntry();await storage.put('entries',original);const before=await snapshot();
 const journey=makeJourney([fresh,{...clone(original),notes:'Changed fictional entry'}]);
 t.mock.method(crypto,'randomUUID',()=>original.id);
 await assert.rejects(()=>storage.importJourney(journey),/Nothing was imported/);
 assert.deepEqual(await snapshot(),before);
});

test('aborted reads reject instead of leaving recovery waiting indefinitely',async()=>{
 const originalGetAll=IDBObjectStore.prototype.getAll;
 IDBObjectStore.prototype.getAll=function(...args){const request=originalGetAll.apply(this,args);this.transaction.abort();return request;};
 try{await assert.rejects(()=>storage.all('entries'),/Storage could not be read/);}finally{IDBObjectStore.prototype.getAll=originalGetAll;}
});

test('storage review and import share classification, including changed conflict copies',async()=>{
 for(const store of ['entries','drafts']){
  const entry=newEntry(),original=store==='entries'?entry:entryDraft(entry);
  await storage.put(store,original);
  const incoming=store==='entries'?{...clone(original),notes:'Incoming fictional content'}:{...clone(original),form:{...clone(original.form),notes:'Incoming fictional content'}};
  const journey=makeJourney(store==='entries'?[incoming]:[],store==='drafts'?[incoming]:[]);
  assert.equal(storage.planStoredImport([incoming],await storage.all(store),store)[0].status,'conflict');
  await storage.importJourney(journey);
  let saved=await storage.all(store);
  assert.equal(storage.planStoredImport([incoming],saved,store)[0].status,'duplicate');
  const copy=saved.find(row=>row.id!==original.id);
  const changed=store==='entries'?{...clone(copy),notes:'Edited since import'}:{...clone(copy),form:{...clone(copy.form),notes:'Edited since import'}};
  await storage.put(store,changed);saved=await storage.all(store);
  assert.equal(storage.planStoredImport([incoming],saved,store)[0].status,'conflict');
  const result=await storage.importJourney(journey);
  assert.equal(result[store==='entries'?'entryCopies':'draftCopies'],1);
 }
});

test('review detects existing separate copies even when their original ID is absent',async()=>{
 const entry=newEntry(),draft=entryDraft(entry);await storage.put('entries',entry);await storage.putDraft(draft,undefined);
 const incomingEntry={...clone(entry),notes:'Incoming entry'},incomingDraft={...clone(draft),form:{...clone(draft.form),notes:'Incoming draft'}};
 const journey=makeJourney([incomingEntry],[incomingDraft]);await storage.importJourney(journey);
 await storage.remove('entries',entry.id);await storage.remove('drafts',draft.id);
 assert.equal(storage.planStoredImport([incomingEntry],await storage.all('entries'))[0].status,'duplicate');
 assert.equal(storage.planStoredImport([incomingDraft],await storage.all('drafts'),'drafts')[0].status,'duplicate');
 const result=await storage.importJourney(journey);assert.equal(result.entriesAdded,0);assert.equal(result.draftsAdded,0);
});

test('a single export keeps distinct input IDs even when it contains an original and its copy',async()=>{
 const original=newEntry(),copy={...clone(original),id:crypto.randomUUID(),_unmigrated:{companionOriginalId:original.id}};
 const journey=makeJourney([copy,original]);
 assert.deepEqual(storage.planStoredImport(journey.entries,[]).map(row=>row.status),['new','new']);
 const result=await storage.importJourney(journey);assert.equal(result.entriesAdded,2);
 assert.equal((await storage.all('entries')).length,2);
});

test('a snapshot transaction cannot combine an old draft with its newly saved entry',async()=>{
 const e=newEntry('reflection'),d=entryDraft(e);await storage.putDraft(d,undefined);const original=IDBObjectStore.prototype.getAll;let write;let triggered=false;
 IDBObjectStore.prototype.getAll=function(...args){const result=original.apply(this,args);if(!triggered&&this.name==='entries'){triggered=true;write=storage.saveEntry(e,d.id,undefined,d);}return result;};
 let snapshot;try{snapshot=await storage.readSnapshot();}finally{IDBObjectStore.prototype.getAll=original;}await write;assert.equal(snapshot.entries.length,0);assert.equal(snapshot.drafts.length,1);const after=await storage.readSnapshot();assert.equal(after.entries.length,1);assert.equal(after.drafts.length,0);
});
