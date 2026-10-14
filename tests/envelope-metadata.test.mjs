import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
import {newEntry,makeJourney,clone,same} from '../dist/core.js';
import {importEnvelopeMetadata,exportEnvelopeMetadata,mergeEnvelopeMetadata,metadataFromSettings} from '../dist/envelope-metadata.js';
import {prepareJournalExport} from '../dist/transfer.js';
import * as db from '../dist/storage.js';
globalThis.indexedDB=indexedDB;
beforeEach(async()=>{const database=await db.openDB();await new Promise((resolve,reject)=>{const t=database.transaction(['entries','drafts','settings'],'readwrite');for(const name of ['entries','drafts','settings'])t.objectStore(name).clear();t.oncomplete=resolve;t.onabort=()=>reject(t.error);});});
const envelope=extras=>({...makeJourney([]),...extras});
test('source metadata keeps conflicting maps and prototype-looking literal keys without pollution',()=>{
 const a=JSON.parse('{"future":{"owner":"Fictional A"},"__proto__":{"polluted":true},"constructor":{"preserve":true}}'),b={future:{owner:'Fictional B'}};
 const maps=mergeEnvelopeMetadata(importEnvelopeMetadata(envelope(a)),importEnvelopeMetadata(envelope(b)));assert.equal(maps.length,2);assert.ok(maps.some(m=>same(m,a)));assert.equal({}.polluted,undefined);assert.deepEqual(importEnvelopeMetadata(envelope(exportEnvelopeMetadata(maps))),maps);
});
test('noncanonical, mixed, malformed and empty carrier-looking originals remain opaque and recoverable',()=>{
 const cases=[{_unmigrated:{companionSourceEnvelopes:[]}},{_unmigrated:{companionSourceEnvelopes:[{a:1},{a:1}]}},{_unmigrated:{companionSourceEnvelopes:[{z:1},{a:1}]}},{_unmigrated:{companionSourceEnvelopes:[{a:1}],another:'preserve'}},{_unmigrated:{companionSourceEnvelopes:[null]}},{_unmigrated:{companionSourceEnvelopes:[{a:1}]},another:'preserve'}];
 for(const raw of cases){const maps=importEnvelopeMetadata(envelope(raw));assert.deepEqual(maps,[raw]);assert.deepEqual(importEnvelopeMetadata(envelope(exportEnvelopeMetadata(maps))),maps);}
});
test('repeated metadata-only imports and full backup exports do not grow carriers or lose original data',async()=>{
 const raw=envelope({futureJournal:{title:'Fictional family journal',privateNote:'Opaque private test data'}});let result=await db.importJourney(raw);assert.equal(result.metadataMapsAdded,1);assert.equal(result.entriesAdded,0);
 const first=exportEnvelopeMetadata(metadataFromSettings(await db.all('settings')));
 for(let i=0;i<20;i++){const out=prepareJournalExport([],[],{metadata:metadataFromSettings(await db.all('settings')),allowEmpty:true});assert.deepEqual(importEnvelopeMetadata(out),importEnvelopeMetadata(first));assert.deepEqual(out.futureJournal,raw.futureJournal);result=await db.importJourney(out);assert.equal(result.metadataMapsAdded,0);}
 assert.equal((await db.all('settings')).length,1);assert.deepEqual(metadataFromSettings(await db.all('settings')),[{futureJournal:raw.futureJournal}]);
});
test('legacy stored source envelopes are retained verbatim inside the canonical carrier',async()=>{
 const legacy={format:'journey-export',version:1,exportedAt:'2026-10-07T00:00:00.000Z',futureField:{retain:'legacy'},_unmigrated:{companionSourceEnvelopes:[{nested:'leave opaque'}]}};
 await db.put('settings',{id:'import-envelope-legacy',value:legacy});const out=prepareJournalExport([],[],{metadata:metadataFromSettings(await db.all('settings')),allowEmpty:true});assert.deepEqual(out._unmigrated.companionSourceEnvelopes,[legacy]);await db.importJourney(out);assert.deepEqual(metadataFromSettings(await db.all('settings')),[legacy]);assert.equal((await db.all('settings')).length,1);
});
test('selected transfers omit unrelated journal metadata but preserve selected record metadata',()=>{
 const e={...newEntry(),_unmigrated:{entryPrivate:{retain:'selected only'}}},metadata=[{unselectedPrivate:'never leak this in selected output'}];
 const selected=prepareJournalExport([e],[],{totalEntries:2,totalDrafts:1,metadata});assert.ok(selected.filter);assert.equal(Object.hasOwn(selected,'_unmigrated'),false);assert.deepEqual(selected.entries[0]._unmigrated,e._unmigrated);
 const full=prepareJournalExport([e],[],{metadata});assert.deepEqual(importEnvelopeMetadata(full),metadata);assert.throws(()=>prepareJournalExport([],[],{totalEntries:2,metadata}),/Choose at least/);
});
test('a full fictional journal backup restores entries, drafts and metadata into an isolated test database',async()=>{
 const {readFile}=await import('node:fs/promises'),{IDBFactory}=await import('fake-indexeddb');const fixture=JSON.parse(await readFile(new URL('./fixtures/protected-v1.journey.json',import.meta.url),'utf8'));await db.importJourney(fixture);
 const savedEntries=await db.all('entries'),savedDrafts=await db.all('drafts'),metadata=metadataFromSettings(await db.all('settings'));const backup=prepareJournalExport(savedEntries,savedDrafts,{metadata,allowEmpty:true});const originalFactory=globalThis.indexedDB;globalThis.indexedDB=new IDBFactory();
 try{const restored=await import('../dist/storage.js?isolated-restore');const result=await restored.importJourney(backup);assert.equal(result.entriesAdded,1);assert.equal(result.draftsAdded,1);assert.deepEqual(await restored.all('entries'),savedEntries);assert.deepEqual(await restored.all('drafts'),savedDrafts);assert.deepEqual(metadataFromSettings(await restored.all('settings')),metadata);const repeat=await restored.importJourney(backup);assert.equal(repeat.entriesAdded,0);assert.equal(repeat.draftsAdded,0);assert.equal(repeat.metadataMapsAdded,0);}finally{globalThis.indexedDB=originalFactory;}
});
test('companion matches shared native metadata fixture exports and restores every source map',async()=>{
 const {readFile}=await import('node:fs/promises');const fixtures=JSON.parse(await readFile(new URL('./fixtures/envelope-metadata-v1.json',import.meta.url),'utf8'));
 for(const fixture of fixtures){assert.deepEqual(exportEnvelopeMetadata(fixture.sources),fixture.exported,fixture.name);const out=prepareJournalExport([],[],{metadata:fixture.sources,allowEmpty:true});assert.deepEqual(importEnvelopeMetadata(out),mergeEnvelopeMetadata(fixture.sources),fixture.name);assert.equal(Object.getPrototypeOf(out),Object.prototype);if(Object.hasOwn(fixture.exported,'__proto__'))assert.deepEqual(Object.getOwnPropertyDescriptor(out,'__proto__').value,fixture.exported.__proto__);}
 assert.equal({}.polluted,undefined);
});
