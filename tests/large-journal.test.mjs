import {test} from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
import {newEntry,entryDraft,makeJourney,validateJourney,parseJSON,MAX_BYTES} from '../dist/core.js';
import * as db from '../dist/storage.js';
import {prepareJournalExport} from '../dist/transfer.js';
import {metadataFromSettings} from '../dist/envelope-metadata.js';
globalThis.indexedDB=indexedDB;
const pause=()=>new Promise(resolve=>setTimeout(resolve,50));
test('1,000 fictional entries retain import, search, selection and backup counts in source/DOM checks',async t=>{
 const records=Array.from({length:1000},(_,i)=>({...newEntry(i%2?'reflection':'sermon'),id:'fictional-large-'+i,title:i===999?'Fictional long title '+('long-word-'.repeat(90)):'Fictional entry '+i,notes:i===999?'unique fictional search needle':'Fictional notes '+i,date:i%2?'2026-10-11':'2026-10-12'}));
 const drafts=records.slice(0,30).map(entryDraft);const journal={...makeJourney(records,drafts),futureFictional:{keep:'whole journal only'}};
 let start=performance.now();let receipt=await db.importJourney(journal);const importMs=performance.now()-start;assert.equal(receipt.entriesAdded,1000);assert.equal(receipt.draftsAdded,30);receipt=await db.importJourney(journal);assert.equal(receipt.entriesSkipped,1000);assert.equal(receipt.draftsSkipped,30);
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8'),dom=new JSDOM(html,{url:'https://fictional-companion.example/#journal',pretendToBeVisual:true}),w=dom.window;
 for(const key of ['window','document','location','FormData','Event','CustomEvent','HTMLElement'])globalThis[key]=key==='window'?w:w[key];Object.defineProperty(globalThis,'navigator',{value:w.navigator,configurable:true});w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 start=performance.now();await import('../dist/app.js');await w.lwcReady;const listMs=performance.now()-start;assert.equal(document.querySelectorAll('.entry-card').length,1000);assert.match(document.querySelector('#search-status').textContent,/1000/);
 const search=document.querySelector('#search');start=performance.now();search.value='unique fictional search needle';search.dispatchEvent(new w.Event('input',{bubbles:true}));const searchMs=performance.now()-start;assert.equal(document.querySelectorAll('.entry-card').length,1);assert.ok(document.querySelector('.entry-card h2').textContent.length>800);
 w.location.hash='#transfer';await pause();await pause();assert.equal(document.querySelectorAll('[name="transfer-entry"]').length,1000);assert.equal(document.querySelectorAll('[name="transfer-draft"]').length,30);assert.equal(document.querySelectorAll('[name="transfer-draft"]:checked').length,0);
 document.querySelector('#transfer-from').value='2026-10-11';document.querySelector('#transfer-to').value='2026-10-11';document.querySelector('[data-action="select-dates"]').click();assert.equal(document.querySelectorAll('[name="transfer-entry"]:checked').length,500);
 const snapshot=await db.readSnapshot();start=performance.now();const backup=prepareJournalExport(snapshot.entries,snapshot.drafts,{metadata:metadataFromSettings(snapshot.settings)});const bytes=new TextEncoder().encode(JSON.stringify(backup));const backupMs=performance.now()-start;assert.equal(backup.entries.length,1000);assert.equal(backup.drafts.length,30);assert.deepEqual(backup.futureFictional,journal.futureFictional);assert.deepEqual(validateJourney(parseJSON(new TextDecoder().decode(bytes))),backup);assert.ok(bytes.length<MAX_BYTES);
 t.diagnostic(JSON.stringify({environment:'Node/jsdom/fake-indexeddb; not rendered/device performance',entries:1000,drafts:30,backupBytes:bytes.length,importMs:Math.round(importMs),listDOMMs:Math.round(listMs),searchDOMMs:Math.round(searchMs),backupMs:Math.round(backupMs)}));dom.window.close();
});
test('journal count and byte limits reject beyond supported boundaries',()=>{
 const e=newEntry();assert.throws(()=>validateJourney({format:'journey-export',version:1,entries:Array(5001).fill(e)}),/5,000/);assert.throws(()=>parseJSON(' '.repeat(MAX_BYTES+1)),/too large/);
});
