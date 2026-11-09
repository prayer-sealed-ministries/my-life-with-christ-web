import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {indexedDB,IDBObjectStore} from 'fake-indexeddb';
import {createRequire} from 'node:module';
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const dom=new JSDOM(html,{url:'https://companion.example/',pretendToBeVisual:true});const w=dom.window;
for(const k of ['window','document','location','FormData','Event','CustomEvent','HTMLElement'])globalThis[k]=k==='window'?w:w[k];
globalThis.indexedDB=indexedDB;
Object.defineProperty(globalThis,'navigator',{value:w.navigator,configurable:true});
w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.qrcode=createRequire(import.meta.url)('qrcode-generator');
const downloads=[];URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:local-test';};URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
await import('../dist/app.js');await w.lwcReady;
const db=await import('../dist/storage.js');
/*
 * Waiting here means waiting for a STATE, never for a number of milliseconds.
 *
 * This file used to pause 35 ms after a route change and 200 ms around a
 * 600,000-iteration PBKDF2, and pass. On a 10-core machine, where node runs
 * nine test files at once, the same pauses lost their race in six of six
 * full-suite runs. Nothing in the product had changed; the instrument had
 * simply been measuring the speed of the machine. Every wait now names the
 * state it is waiting for and fails with that name if it never arrives.
 */
const SETTLE_MS=5000;
async function waitFor(check,description){const end=Date.now()+SETTLE_MS;for(;;){const result=await check();if(result)return result;if(Date.now()>=end)assert.fail(`Timed out after ${SETTLE_MS}ms waiting for ${description}`);await new Promise(r=>setTimeout(r,10));}}
/** A short fixed pause, used ONLY before asserting that nothing happened. Polling cannot prove a negative. */
const breathe=()=>new Promise(r=>setTimeout(r,35));
const $=selector=>w.document.querySelector(selector);
const text=selector=>$(selector)?.textContent??'';
/** Navigate and wait until the route has rendered — or been refused, which puts the previous hash back and leaves the page standing. */
async function go(hash){
 let replaced=false;const observer=new w.MutationObserver(()=>{replaced=true;});observer.observe($('#main'),{childList:true});
 try{
  if(w.location.hash===hash)w.dispatchEvent(new w.HashChangeEvent('hashchange'));else w.location.hash=hash;
  await waitFor(()=>replaced||w.location.hash!==hash,`${hash} to render or be refused`);
  // The privacy page fills in its storage report after rendering.
  if(replaced&&$('#persistence-result'))await waitFor(()=>!text('#persistence-result').startsWith('Checking'),'the persistent-storage report');
 }finally{observer.disconnect();}
}
function input(id,value){const el=w.document.getElementById(id);assert.ok(el,'missing '+id);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));}
function click(selector){const el=$(selector);assert.ok(el,'missing '+selector);el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));}
/**
 * Submit a form and wait for its handler to finish.
 *
 * Every submit handler disables its button first and re-enables it in a
 * `finally` (or on failure), and a dialog that succeeds replaces its form. So
 * "re-enabled or detached" is the handler saying it is done, whatever the
 * outcome. Pass `until` when the test needs a later consequence — a route that
 * the handler only started.
 */
async function submit(id,until){const f=w.document.getElementById(id);assert.ok(f,'missing form '+id);const button=f.querySelector('[type="submit"]');f.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:button}));await waitFor(until||(()=>!button.isConnected||!button.disabled),until?`${id} to reach its outcome`:`the ${id} handler to finish`);}
/** Choose a file and wait for the app's answer: a review, a request for a password, or a refusal. */
async function chooseJSON(raw,name){const bytes=new TextEncoder().encode(JSON.stringify(raw));const picker=$('#file-picker');Object.defineProperty(picker,'files',{configurable:true,value:[{name,size:bytes.length,arrayBuffer:async()=>bytes.buffer}]});const error=$('#form-error');if(error)error.textContent='';picker.dispatchEvent(new w.Event('change',{bubbles:true}));await waitFor(()=>$('#import-review')||$('#unlock-form')||text('#form-error'),`${name} to be reviewed, asked for a password, or refused`);}
const lastExportAt=async()=>(await db.all('settings')).find(s=>s.id==='last-export')?.value.at;

test('wired UI writes and reloads drafts, saves separate fields, exports and creates a QR without network calls',async()=>{
 assert.match(text('h1'),/A little space/);assert.equal(document.querySelectorAll('h1').length,1);
 await go('#write/sermon');input('title','Remembering Sunday');input('notes','Notes kept separate <img src=x onerror=alert(1)>');input('reflection','My private reflection');input('prayer','My private prayer');input('mainScripture','John 15:1-8');
 const ds=await waitFor(async()=>{const rows=await db.all('drafts');return rows.length===1&&rows[0].form.prayer==='My private prayer'&&rows[0].form.scriptureRefs[0]==='John 15:1-8'?rows:null;},'the draft to hold everything typed');
 assert.equal(ds.length,1);assert.equal(ds[0].form.prayer,'My private prayer');
 await go('#journal');assert.match(text('#main'),/Continue a draft/);await go('#write/draft/'+ds[0].id);assert.equal($('#reflection').value,'My private reflection');
 await submit('entry-form');const es=await db.all('entries');assert.equal(es.length,1);assert.equal(es[0].notes,'Notes kept separate <img src=x onerror=alert(1)>');assert.equal(es[0].reflection,'My private reflection');assert.equal(es[0].prayer,'My private prayer');assert.equal((await db.all('drafts')).length,0);assert.equal(document.querySelectorAll('img').length,0);
 await go('#transfer');click('[data-action="export-app"]');assert.ok($('#dialog').open);let before=downloads.length;click('#download-confirm');await waitFor(()=>downloads.length>before,'the journal download');let out=JSON.parse(await downloads.at(-1).text());assert.equal(out.format,'journey-export');assert.equal(out.entries[0].prayer,'My private prayer');
 await go('#church');assert.ok($('#pack-form').contains($('[type="submit"]')));input('pack-title','Abide');input('pack-church','A church');input('pack-speaker','A pastor');input('pack-scripture','John 15:1-8');input('pack-body','## Outline\n\n1. Read\n2. Reflect');before=downloads.length;await submit('pack-form');assert.ok(downloads.length>before,'the pack was downloaded');out=JSON.parse(await downloads.at(-1).text());assert.equal(out.format,'my-life-with-christ-sermon-notes');assert.equal(out.bodyMarkdown,'## Outline\n\n1. Read\n2. Reflect');assert.ok(!('prayer' in out));
 input('pack-url','https://church.example/sermon.json');click('[data-action="make-qr"]');assert.ok($('#qr-result svg'));assert.match(text('#qr-result'),/church.example/);
 for(const hash of ['#home','#journal','#transfer','#import','#church','#guide','#privacy','#format']){await go(hash);assert.equal(document.querySelectorAll('h1').length,1,hash);for(const control of document.querySelectorAll('main input:not([type=checkbox]),main textarea,main select'))assert.ok($('label[for="'+control.id+'"]'),'unlabelled '+control.id);}
 assert.match($('meta[http-equiv="Content-Security-Policy"]').content,/connect-src 'none'/);assert.ok([...document.querySelectorAll('script[src],link[rel=stylesheet]')].every(e=>!/^https?:/.test(e.getAttribute('src')||e.getAttribute('href'))));
});

test('readable sharing requires explicit private-field choices and restores dialog focus',async()=>{
 const e=(await db.all('entries'))[0];await go('#entry/'+e.id);const trigger=$('[data-action="markdown"]');trigger.focus();click('[data-action="markdown"]');
 assert.equal($('#share-reflection').checked,false);assert.equal($('#share-prayer').checked,false);assert.ok(!text('#share-preview').includes(e.prayer));assert.ok(!text('#share-preview').includes(e.reflection));
 assert.equal($('#dialog').getAttribute('aria-labelledby'),'dialog-heading');const check=$('#share-reflection');check.checked=true;check.dispatchEvent(new w.Event('change',{bubbles:true}));assert.ok(text('#share-preview').includes(e.reflection));assert.ok(!text('#share-preview').includes(e.prayer));click('#share-download');assert.ok((await downloads.at(-1).text()).includes(e.reflection));assert.ok(!(await downloads.at(-1).text()).includes(e.prayer));assert.equal(document.activeElement,trigger);
});
test('guided transfer selects drafts independently and records only a browser handoff',async()=>{
 // The route waits for the save queue before it renders, so the draft is on disk by the time the transfer page is on screen.
 await go('#write/letter');input('title','Fictional unfinished letter');input('notes','Unfinished  ');await go('#transfer');const ds=await db.all('drafts');assert.equal(ds.length,1);assert.equal($('[name="transfer-draft"]').checked,false);
 $('#select-all').checked=false;$('#select-all').dispatchEvent(new w.Event('change',{bubbles:true}));$('[name="transfer-draft"]').checked=true;click('[data-action="export-app"]');assert.match(text('#dialog-body'),/0 saved entries · 1 unfinished drafts/);const before=downloads.length;click('#download-confirm');await waitFor(()=>downloads.length>before&&/app has not confirmed receipt/.test(text('#toast')),'the draft download and its receipt toast');const out=JSON.parse(await downloads.at(-1).text());assert.equal(out.entries.length,0);assert.equal(out.drafts.length,1);assert.equal(out.drafts[0].id,ds[0].id);assert.equal(out.drafts[0].form.notes,'Unfinished  ');assert.equal((await db.all('settings')).find(s=>s.id==='last-export').value.stage,'offered-to-browser');assert.match(text('#toast'),/app has not confirmed receipt/);
 input('transfer-from','2100-01-01');input('transfer-to','2100-12-31');click('[data-action="select-dates"]');assert.equal(document.querySelectorAll('[name="transfer-entry"]:checked').length,0);assert.equal(document.querySelectorAll('[name="transfer-draft"]:checked').length,1);
 await go('#privacy');assert.match(text('#main'),/Browser storage is not a backup/);assert.match(text('#persistence-result'),/cannot report/);assert.match(text('#main'),/restoring an external copy have not been verified/);
});
test('pastor templates are independent reusable copies and invalid outlines have actionable errors',async()=>{
 await go('#church');input('pack-title','Fictional reusable outline');input('pack-body','## Welcome\n\nA fictional outline.');
 click('[data-action="save-template"]');const template=await waitFor(async()=>(await db.all('packs')).find(p=>p.template),'the template to be saved');assert.ok(template);
 await waitFor(()=>$('[data-action="use-template"]'),'the template to be listed');
 click('[data-action="use-template"]');await waitFor(()=>/A new draft was created/.test(text('#toast'))&&$('#pack-title'),'the new draft made from the template');
 input('pack-title','Fictional next Sunday');await waitFor(async()=>(await db.all('packs')).some(p=>!p.template&&p.value.title==='Fictional next Sunday'),'the renamed draft to be saved');
 const saved=(await db.all('packs')).find(p=>p.template);assert.equal(saved.value.title,'Fictional reusable outline');
 input('pack-body','');click('[data-action="preview-pack"]');assert.match(text('#form-error'),/Add the provided notes/);assert.equal(document.activeElement.id,'form-error');click('[data-action="download-pack-draft"]');const raw=JSON.parse(await downloads.at(-1).text());assert.equal(raw.title,'Fictional next Sunday');assert.equal(raw.bodyMarkdown,'');assert.match(text('#toast'),/incomplete draft/);
});
test('fictional Sunday import previews church material, saves separate writing, and reports repeat/conflict receipts',async()=>{
 const pack=JSON.parse(await readFile(new URL('../dist/example-sermon-notes.json',import.meta.url),'utf8'));await go('#import');click('[data-action="pick-sermon"]');await chooseJSON(pack,'fictional-sermon.json');assert.match(text('#import-review'),/not verified identities/);
 click('[data-action="confirm-sermon"]');await waitFor(()=>w.location.hash.startsWith('#write/draft/')&&$('#notes'),'the new draft to open');
 assert.equal($('#notes').value,'');assert.equal($('#reflection').value,'');assert.equal($('#prayer').value,'');assert.match(text('.provided'),/Provided notes/);input('notes','Fictional Sunday notes');input('reflection','Fictional private reflection');input('prayer','Fictional private prayer');await submit('entry-form');
 const plain=JSON.parse(await readFile(new URL('./fixtures/protected-v1.journey.json',import.meta.url),'utf8'));await go('#import');click('[data-action="pick-journal"]');await chooseJSON(plain,'fictional-journey.json');click('[data-action="confirm-import"]');await waitFor(()=>w.location.hash==='#journal'&&/1 entries saved/.test(text('#main')),'the first import receipt');assert.match(text('#main'),/1 entries saved/);assert.match(text('#main'),/1 unfinished drafts saved/);
 await go('#import');await chooseJSON(plain,'fictional-journey.json');click('[data-action="confirm-import"]');await waitFor(()=>w.location.hash==='#journal'&&/0 entries saved/.test(text('#main')),'the repeat import receipt');assert.match(text('#main'),/0 entries saved/);assert.match(text('#main'),/1 entries skipped/);assert.match(text('#main'),/1 drafts skipped/);
 const changed=structuredClone(plain);changed.entries[0].notes='Fictional changed incoming notes';changed.drafts[0].form.notes='Fictional changed draft';await go('#import');await chooseJSON(changed,'fictional-changed.json');assert.ok($('#keep-copies').checked);assert.match(text('#import-review'),/changed entries and drafts/);click('[data-action="confirm-import"]');await waitFor(()=>w.location.hash==='#journal'&&/1 entries saved \(1 separate copies\)/.test(text('#main')),'the conflict import receipt');assert.match(text('#main'),/1 entries saved \(1 separate copies\)/);assert.match(text('#main'),/1 unfinished drafts saved \(1 separate copies\)/);assert.equal((await db.all('entries')).find(e=>e.id===plain.entries[0].id).notes,plain.entries[0].notes);
});
test('storage reports granted, denied and failed persistence checks without promising a backup',async()=>{
 let granted=false;Object.defineProperty(w.navigator,'storage',{configurable:true,value:{persisted:async()=>granted,persist:async()=>granted}});await go('#privacy');assert.match(text('#persistence-result'),/not granted/);
 click('[data-action="request-persistence"]');const request=await waitFor(async()=>(await db.all('settings')).find(s=>s.id==='persistence-request'),'the persistence request to be recorded');assert.equal(request.value.granted,false);
 granted=true;click('[data-action="request-persistence"]');await waitFor(()=>/is granted/.test(text('#persistence-result')),'the granted report');assert.match(text('#persistence-result'),/is granted/);assert.match(text('#persistence-result'),/not an external backup/);
 w.navigator.storage.persisted=async()=>{throw Error('test storage status error');};await go('#home');await go('#privacy');assert.match(text('#persistence-result'),/check failed/);
});
test('protected import rejects wrong passwords before review and malformed replacement clears an old review',async()=>{
 const protectedFile=JSON.parse(await readFile(new URL('./fixtures/protected-v1.lwc',import.meta.url),'utf8'));const {password}=JSON.parse(await readFile(new URL('./fixtures/protected-v1.metadata.json',import.meta.url),'utf8'));await go('#import');await chooseJSON(protectedFile,'fictional-protected.lwc');assert.ok($('#unlock-form'));
 // 600,000 PBKDF2 iterations take as long as they take; the handler re-enables its button when it has an answer.
 input('unlock-password','incorrect password');await submit('unlock-form');assert.match(text('#unlock-error'),/Could not unlock/);assert.ok(!$('[data-action="confirm-import"]'));
 input('unlock-password',password);await submit('unlock-form',()=>$('[data-action="confirm-import"]'));assert.ok($('[data-action="confirm-import"]'));
 await chooseJSON({format:'journey-export',version:99,entries:[]},'unsupported.json');assert.ok(!$('[data-action="confirm-import"]'));assert.match(text('#form-error'),/version 1/);
});
test('cancelled protection cannot download or close a replacement dialog after crypto finishes',async()=>{
 await go('#transfer');click('[data-action="export-protected"]');input('protect-password','Fictional long test password');input('protect-again','Fictional long test password');
 const original=crypto.subtle.encrypt;let release,startedResolve;const started=new Promise(r=>startedResolve=r);crypto.subtle.encrypt=function(...args){return new Promise((resolve,reject)=>{release=()=>original.apply(this,args).then(resolve,reject);startedResolve();});};const before=downloads.length;
 try{const pendingSubmit=submit('protect-form');await started;click('[data-dialog="cancel"]');click('[data-action="export-protected"]');const replacement=$('#protect-form');await release();await pendingSubmit;await breathe();assert.equal(downloads.length,before);assert.equal($('#protect-form'),replacement);assert.ok($('#dialog').open);assert.equal(text('#protect-error'),'');click('[data-dialog="cancel"]');}finally{crypto.subtle.encrypt=original;}
});
test('cancelled unlock cannot preview its old file or touch a replacement dialog',async()=>{
 const protectedFile=JSON.parse(await readFile(new URL('./fixtures/protected-v1.lwc',import.meta.url),'utf8'));const {password}=JSON.parse(await readFile(new URL('./fixtures/protected-v1.metadata.json',import.meta.url),'utf8'));await go('#import');await chooseJSON(protectedFile,'old-file.lwc');input('unlock-password',password);
 const original=crypto.subtle.decrypt;let release,startedResolve;const started=new Promise(r=>startedResolve=r);crypto.subtle.decrypt=function(...args){return new Promise((resolve,reject)=>{release=()=>original.apply(this,args).then(resolve,reject);startedResolve();});};
 try{const pendingSubmit=submit('unlock-form');await started;click('[data-dialog="cancel"]');await chooseJSON(protectedFile,'replacement-file.lwc');const replacement=$('#unlock-form');await release();await pendingSubmit;await breathe();assert.equal($('#unlock-form'),replacement);assert.ok($('#dialog').open);assert.ok(!$('[data-action="confirm-import"]'));assert.equal(text('#unlock-error'),'');click('[data-dialog="cancel"]');}finally{crypto.subtle.decrypt=original;}
});
test('partial transfer excludes opaque journal metadata and full backup reviews it',async()=>{
 await db.put('settings',{id:'journal-envelope-metadata',value:[{fictionalPrivateMetadata:'UNSELECTED PRIVATE TEST METADATA'}]});await go('#transfer');const boxes=[...document.querySelectorAll('[name="transfer-entry"]')];for(const box of boxes)box.checked=false;boxes[0].checked=true;click('[data-action="export-app"]');assert.match(text('#dialog-body'),/excludes journal-wide metadata/);assert.ok(!text('#dialog-body').includes('UNSELECTED PRIVATE TEST METADATA'));const before=downloads.length;click('#download-confirm');await waitFor(()=>downloads.length>before,'the selected download');const selected=JSON.parse(await downloads.at(-1).text());assert.equal(Object.hasOwn(selected,'_unmigrated'),false);
 await go('#privacy');click('[data-action="backup-all"]');await waitFor(()=>/Review all journal-wide metadata/.test(text('#dialog-body')),'the full backup review');assert.ok(text('#dialog-body').includes('UNSELECTED PRIVATE TEST METADATA'));click('[data-dialog="cancel"]');
});
test('a superseded asynchronous file read cannot replace a newer review or report an old error',async()=>{
 await go('#import');const valid=JSON.parse(await readFile(new URL('./fixtures/protected-v1.journey.json',import.meta.url),'utf8'));let finishOld;const oldRead=new Promise(resolve=>finishOld=resolve);const picker=$('#file-picker');Object.defineProperty(picker,'files',{configurable:true,value:[{name:'older.json',size:10,arrayBuffer:()=>oldRead}]});picker.dispatchEvent(new w.Event('change',{bubbles:true}));const newer=structuredClone(valid);newer.entries[0].title='Newest fictional file';await chooseJSON(newer,'newer.json');assert.match(text('#import-review'),/Newest fictional file/);
 // What follows must NOT happen, so a short pause is the only honest wait.
 finishOld(new TextEncoder().encode('invalid old JSON').buffer);await breathe();assert.match(text('#import-review'),/Newest fictional file/);assert.equal(text('#form-error'),'');
 let finishNavigation;const pendingRead=new Promise(resolve=>finishNavigation=resolve);Object.defineProperty(picker,'files',{configurable:true,value:[{name:'cancelled-by-navigation.json',size:10,arrayBuffer:()=>pendingRead}]});picker.dispatchEvent(new w.Event('change',{bubbles:true}));await go('#home');finishNavigation(new TextEncoder().encode(JSON.stringify(valid)).buffer);await breathe();assert.equal(location.hash,'#home');assert.ok(!$('#import-review'));
});
test('an incomplete pastor recovery file restores a separate builder draft without publication',async()=>{
 await go('#church');click('[data-action="pick-pack-draft"]');const oldPacks=await db.all('packs'),oldJournal=await db.all('entries');await chooseJSON({format:'my-life-with-christ-sermon-notes',version:1,title:'Recovered fictional unfinished outline',church:'Fictional church',scripture:['John 15'],bodyMarkdown:'  ',futurePrivateField:'excluded fictional secret'},'unfinished-outline.json');assert.match(text('#import-review'),/Restore this church draft/);assert.ok(!text('#import-review').includes('excluded fictional secret'));
 click('[data-action="confirm-pack-draft"]');await waitFor(()=>w.location.hash==='#church'&&$('#pack-title')?.value==='Recovered fictional unfinished outline','the restored church draft to open');
 assert.equal($('#pack-body').value,'  ');assert.equal((await db.all('packs')).length,oldPacks.length+1);assert.deepEqual(await db.all('entries'),oldJournal);click('[data-action="preview-pack"]');assert.match(text('#form-error'),/Add the provided notes/);input('pack-body','A restored fictional outline.');click('[data-action="preview-pack"]');assert.ok($('#dialog').open);assert.equal(document.activeElement.id,'dialog-heading');click('[data-dialog="cancel"]');await go('#import');click('[data-action="pick-journal"]');
});
test('committed pastor drafts and offered downloads update visible lists without navigation',async()=>{
 await go('#church');const form=$('#pack-form'),title=$('#pack-title');title.focus();input('pack-title','Fictional live-list regression');await waitFor(()=>/Fictional live-list regression/.test(text('#pack-list')),'the pack list to show the new title');assert.equal($('#pack-form'),form);assert.equal(document.activeElement,title);assert.ok(!text('#pack-list').includes('No saved pack drafts yet'));
 await go('#transfer');click('[data-action="export-app"]');const previous=await lastExportAt();click('#download-confirm');await waitFor(async()=>(await lastExportAt())!==previous,'the export record to be written');assert.match(text('#last-export'),/Last download offered:/);assert.match(text('#last-export'),/have not been verified/);
 const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='settings'&&value?.id==='last-export')throw Error('Fictional export-history storage failure');return original.call(this,value,...args);};try{click('[data-action="export-app"]');click('#download-confirm');await waitFor(()=>/download record could not be saved/.test(text('#toast')),'the failed-record toast');assert.match(text('#toast'),/download record could not be saved/);}finally{IDBObjectStore.prototype.put=original;}
});
test('autosave failure retains the current editor and offers its unsaved recovery draft',async()=>{
 await go('#write/reflection');input('title','Fictional recovery test');input('notes','Earlier safe text');const draft=await waitFor(async()=>(await db.all('drafts')).find(d=>d.form.title==='Fictional recovery test'&&d.form.notes==='Earlier safe text'),'the draft to be saved');await db.put('drafts',{...draft,form:{...draft.form,notes:'Saved in another tab'}});input('notes','Unsaved words still here');await waitFor(()=>/Not saved/.test(text('#save-status')),'the failed-save status');assert.match(text('#save-status'),/Not saved/);assert.equal($('#save-status').getAttribute('role'),'status');
 // Navigation is refused while a save has failed: the editor must still be standing.
 await go('#home');assert.ok($('#entry-form'));assert.equal($('#notes').value,'Unsaved words still here');click('[data-action="download-draft"]');const recovery=JSON.parse(await downloads.at(-1).text());assert.equal(recovery.drafts[0].form.notes,'Unsaved words still here');assert.equal((await db.all('drafts')).find(d=>d.id===draft.id).form.notes,'Saved in another tab');
});
