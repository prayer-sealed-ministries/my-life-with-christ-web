import {clone,same,isObject,validateJourney} from './core.js';
import {importEnvelopeMetadata,mergeEnvelopeMetadata,metadataFromSettings} from './envelope-metadata.js';
let dbPromise;
export function openDB(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('lwc-web-companion',1);r.onupgradeneeded=()=>{for(const name of ['entries','drafts','packs','settings'])r.result.createObjectStore(name,{keyPath:'id'});};r.onerror=()=>reject(Error('Storage could not open on this device. Download your writing before closing this page.'));r.onblocked=()=>reject(Error('Close other companion tabs, then reload to open storage.'));r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};});return dbPromise;}
export async function all(store){const db=await openDB();return new Promise((resolve,reject)=>{const t=db.transaction(store);const r=t.objectStore(store).getAll();t.oncomplete=()=>resolve(r.result);t.onabort=()=>reject(t.error||Error('Storage could not be read.'));t.onerror=()=>{};});}
// A single readonly transaction gives backups a consistent view across related stores.
export async function readSnapshot(){const db=await openDB();return new Promise((resolve,reject)=>{const names=['entries','drafts','packs','settings'],t=db.transaction(names),requests=Object.fromEntries(names.map(name=>[name,t.objectStore(name).getAll()]));t.oncomplete=()=>resolve(Object.fromEntries(names.map(name=>[name,requests[name].result])));t.onabort=()=>reject(t.error||Error('Storage could not be read.'));t.onerror=()=>{};});}
export async function put(store,value){const snapshot=clone(value),db=await openDB();return new Promise((resolve,reject)=>{const t=db.transaction(store,'readwrite');t.objectStore(store).put(snapshot);t.oncomplete=()=>resolve();t.onabort=()=>reject(t.error||Error('The save did not finish.'));t.onerror=()=>{};});}
export async function remove(store,id){const db=await openDB();return new Promise((resolve,reject)=>{const t=db.transaction(store,'readwrite');t.objectStore(store).delete(id);t.oncomplete=()=>resolve();t.onabort=()=>reject(t.error||Error('The removal did not finish.'));t.onerror=()=>{};});}
const snapshot=value=>value===undefined?undefined:clone(value);
async function compareAndPut(store,value,expected,label){
 const next=clone(value),base=snapshot(expected),db=await openDB();
 return new Promise((resolve,reject)=>{
  const t=db.transaction(store,'readwrite'),s=t.objectStore(store),r=s.get(next.id);let conflict=false;
  r.onsuccess=()=>{if(!same(snapshot(r.result),base)){conflict=true;t.abort();return;}s.put(next);};
  t.oncomplete=()=>resolve();t.onabort=()=>reject(Error(conflict?`This ${label} changed in another tab. Download it to preserve your current writing.`:`This ${label} could not be saved.`));t.onerror=()=>{};
 });
}
export function putDraft(value,expected){return compareAndPut('drafts',value,expected,'draft');}
export function putPack(value,expected){return compareAndPut('packs',value,expected,'Sermon Pack draft');}
export async function saveEntry(entry,draftId,expected,expectedDraft){
 const next=clone(entry),base=snapshot(expected),draftBase=snapshot(expectedDraft),db=await openDB();
 return new Promise((resolve,reject)=>{
  const t=db.transaction(['entries','drafts'],'readwrite'),s=t.objectStore('entries'),ds=t.objectStore('drafts');let message;
  const r=s.get(next.id);
  r.onsuccess=()=>{
   if(!same(snapshot(r.result),base)){message='This entry changed in another tab. Your draft has been kept; reopen the entry before saving.';t.abort();return;}
   if(!draftId){s.put(next);return;}
   const d=ds.get(draftId);
   d.onsuccess=()=>{
    // A missing snapshot must never authorize deleting another tab's draft.
    if(!same(snapshot(d.result),draftBase)){message='This draft changed in another tab. Download your current writing before reopening it.';t.abort();return;}
    s.put(next);ds.delete(draftId);
   };
  };
  t.oncomplete=()=>resolve();t.onabort=()=>reject(Error(message||'Could not save. Your draft has been kept.'));t.onerror=()=>{};
 });
}
function entryCopy(source,id){
 const copy=clone(source),meta=isObject(copy._unmigrated)?copy._unmigrated:{};
 // Keep the legacy marker for ordinary entries, but archive any value it would replace.
 if(source._unmigrated!==undefined&&(!isObject(source._unmigrated)||Object.hasOwn(source._unmigrated,'companionOriginalId')))meta.companionOriginalEntry=clone(source);
 copy.id=id;copy._unmigrated={...meta,companionOriginalId:source.id};return copy;
}
function draftCopy(source,id,entryId){
 const copy=clone(source),meta=isObject(copy._unmigrated)?copy._unmigrated:{};
 copy.id=id;delete copy.entryId;
 if(isObject(meta.companionEntry))meta.companionEntry={...meta.companionEntry,id:entryId};
 // The full original retains unknown fields, prior provenance, and the detached entry link.
 meta.companionOriginalDraft=clone(source);copy._unmigrated=meta;return copy;
}
function identicalCopy(source,saved,store){
 if(saved.id===source.id)return false;
 if(store==='entries')return saved._unmigrated?.companionOriginalId===source.id&&same(saved,entryCopy(source,saved.id));
 const original=saved._unmigrated?.companionOriginalDraft;
 if(original?.id!==source.id||!same(original,source))return false;
 return same(saved,draftCopy(source,saved.id,saved._unmigrated?.companionEntry?.id));
}
export function planStoredImport(incoming,existing,store='entries'){
 if(!['entries','drafts'].includes(store))throw Error('Choose entries or drafts for import review.');
 const saved=existing.map(clone),byId=new Map(saved.map(row=>[row.id,row]));
 return incoming.map(entry=>{
  const source=clone(entry),current=byId.get(source.id);
  const duplicate=same(current,source)||saved.some(row=>identicalCopy(source,row,store));
  return {entry,status:duplicate?'duplicate':current?'conflict':'new'};
 });
}
function freshId(used,prefix=''){for(let attempt=0;attempt<16;attempt++){const id=prefix+crypto.randomUUID();if(!used.has(id)){used.add(id);return id;}}throw Error('Could not create a separate import copy.');}
export async function importJourney(journey,keepCopies=true){
 const incoming=validateJourney(clone(journey)),db=await openDB();
 return new Promise((resolve,reject)=>{
  const t=db.transaction(['entries','drafts','settings'],'readwrite');
  const requests=Object.fromEntries(['entries','drafts','settings'].map(name=>[name,t.objectStore(name).getAll()]));
  const receipt={entriesAdded:0,entriesSkipped:0,entryCopies:0,draftsAdded:0,draftsSkipped:0,draftCopies:0,metadataMapsAdded:0};let pending=3;
  const ready=()=>{
   if(--pending)return;
   try{
    const usedEntryIds=new Set([...requests.entries.result,...incoming.entries].map(row=>row.id));
    for(const draft of [...requests.drafts.result,...(incoming.drafts||[])]){if(draft.entryId)usedEntryIds.add(draft.entryId);if(draft._unmigrated?.companionEntry?.id)usedEntryIds.add(draft._unmigrated.companionEntry.id);}
    for(const store of ['entries','drafts']){
     const existing=requests[store].result,rows=incoming[store]||[],used=new Set([...existing,...rows].map(row=>row.id));
     const added=store==='entries'?'entriesAdded':'draftsAdded',skipped=store==='entries'?'entriesSkipped':'draftsSkipped',copies=store==='entries'?'entryCopies':'draftCopies';
     for(const {entry:source,status} of planStoredImport(rows,existing,store)){
      if(status==='duplicate'||(status==='conflict'&&!keepCopies)){receipt[skipped]++;continue;}
      let row=clone(source);
      if(status==='conflict'){row=store==='entries'?entryCopy(source,freshId(usedEntryIds)):draftCopy(source,freshId(used),freshId(usedEntryIds));receipt[copies]++;}
      // add() also prevents an unexpected identifier collision from overwriting any writing.
      t.objectStore(store).add(row);receipt[added]++;
     }
    }
    const settings=requests.settings.result,existing=metadataFromSettings(settings),metadata=mergeEnvelopeMetadata(existing,importEnvelopeMetadata(incoming));
    receipt.metadataMapsAdded=metadata.length-existing.length;
    if(!same(metadata,existing))t.objectStore('settings').put({id:'journal-envelope-metadata',value:clone(metadata)});

   }catch{t.abort();}
  };
  for(const r of Object.values(requests))r.onsuccess=ready;
  t.oncomplete=()=>resolve({...receipt,count:receipt.entriesAdded,copies:receipt.entryCopies,drafts:receipt.draftsAdded});
  t.onabort=()=>reject(Error('Nothing was imported because the save did not finish.'));t.onerror=()=>{};
 });
}
