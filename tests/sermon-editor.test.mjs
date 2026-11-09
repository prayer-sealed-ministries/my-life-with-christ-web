// The sermon editor: the main Scripture, the sermon link, reference notes, and
// provided notes brought in from a file or from the clipboard.
//
// Driven through the wired UI in jsdom, the way tests/ui.test.mjs drives the
// rest of the editor, and checked against the real storage path. These are not
// rendered-browser tests. Every string here is fictional.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
import {createRequire} from 'node:module';
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const dom=new JSDOM(html,{url:'https://companion.example/',pretendToBeVisual:true});const w=dom.window;
for(const k of ['window','document','location','FormData','Event','CustomEvent','HTMLElement'])globalThis[k]=k==='window'?w:w[k];
globalThis.indexedDB=indexedDB;
Object.defineProperty(globalThis,'navigator',{value:w.navigator,configurable:true});
w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.qrcode=createRequire(import.meta.url)('qrcode-generator');
URL.createObjectURL=()=>'blob:local-test';URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
await import('../dist/app.js');await w.lwcReady;
const db=await import('../dist/storage.js');
/** A short fixed pause, used ONLY before asserting that nothing happened. Every other wait names the state it is waiting for. */
const breathe=()=>new Promise(r=>setTimeout(r,35));
const $=s=>w.document.querySelector(s);
const SETTLE_MS=5000;
async function waitFor(check,description){const end=Date.now()+SETTLE_MS;for(;;){const result=await check();if(result)return result;if(Date.now()>=end)assert.fail(`Timed out after ${SETTLE_MS}ms waiting for ${description}`);await new Promise(r=>setTimeout(r,10));}}
/** Navigate and wait until the route has rendered, or been refused and put the previous hash back. */
async function go(hash){let replaced=false;const observer=new w.MutationObserver(()=>{replaced=true;});observer.observe($('#main'),{childList:true});try{if(w.location.hash===hash)w.dispatchEvent(new w.HashChangeEvent('hashchange'));else w.location.hash=hash;await waitFor(()=>replaced||w.location.hash!==hash,`${hash} to render or be refused`);}finally{observer.disconnect();}}
const main=()=>$('#main').textContent;
function input(id,value){const el=w.document.getElementById(id);assert.ok(el,'missing '+id);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));}
function click(selector){const el=$(selector);assert.ok(el,'missing '+selector);el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));}
/** Submit and wait for the handler to finish (its button is re-enabled in a finally), or for `until` when a later consequence is what matters. */
async function submit(id,until){const f=w.document.getElementById(id);assert.ok(f,'missing form '+id);const button=f.querySelector('[type="submit"]');f.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:button}));await waitFor(until||(()=>!button.isConnected||!button.disabled),until?`${id} to reach its outcome`:`the ${id} handler to finish`);}
const entrySaved=()=>w.location.hash.startsWith('#entry/')&&$('article.writing-sheet');
/** Choose a file and wait for the outcome the caller expects. */
async function chooseFile(bytes,name,until,description){Object.defineProperty($('#file-picker'),'files',{configurable:true,value:[{name,size:bytes.length,arrayBuffer:async()=>bytes.buffer}]});const error=$('#form-error');if(error)error.textContent='';$('#file-picker').dispatchEvent(new w.Event('change',{bubbles:true}));await waitFor(until,description||name+' to be handled');}
const text=s=>new TextEncoder().encode(s);
// Storage is written through a serialised save queue, so a read right after typing can see the previous keystroke: wait for the row being asserted.
const draftWhere=(predicate,description)=>waitFor(async()=>(await db.all('drafts')).find(predicate),description);
const entryWhere=(predicate,description)=>waitFor(async()=>(await db.all('entries')).find(predicate),description);

test('the editor names the main Scripture, keeps the sermon link, and carries reference notes into the saved entry and back',async()=>{
 await go('#write/sermon');
 assert.equal($('label[for="link"]').textContent,'Sermon link');
 input('title','Fictional: Abide');input('notes','Fictional main point');
 input('mainScripture','John 15:1-8');
 input('link','https://example.org/sermons/fictional-abide');input('linkTitle','Fictional Sunday recording');
 assert.match(main(),/No reference notes yet/);
 click('[data-action="add-reference"]');
 assert.equal(w.document.activeElement.id,'ref-0-reference','a new row receives focus');
 input('ref-0-reference','Psalm 1');input('ref-0-note','Fictional: rooted by streams');
 click('[data-action="add-reference"]');
 assert.equal($('#ref-0-reference').value,'Psalm 1','adding a second row keeps the first');
 input('ref-1-reference','Romans 8:28');

 const d=await draftWhere(x=>x.form.scriptureRefs.length===3,'the draft to hold three references');
 assert.equal((await db.all('drafts')).length,1);
 assert.deepEqual(d.form.scriptureRefs,['John 15:1-8','Psalm 1','Romans 8:28'],'main first, then every reference, where the app reads them');
 assert.equal(Object.hasOwn(d.form,'_unmigrated'),false,'preserved data is entry-level and must not be in the form');
 assert.deepEqual(d._unmigrated.companionEntry._unmigrated.companionScripture,{main:'John 15:1-8',references:[{reference:'Psalm 1',note:'Fictional: rooted by streams'},{reference:'Romans 8:28',note:''}]});
 assert.equal(d.form.links[0].url,'https://example.org/sermons/fictional-abide');
 assert.equal(d.form.links[0].capturedTitle,'Fictional Sunday recording');
 assert.match(d.form.links[0].capturedAt,/^\d{4}-\d{2}-\d{2}T/);

 // Reopening the draft puts every row back.
 await go('#journal');await go('#write/draft/'+d.id);
 assert.equal($('#mainScripture').value,'John 15:1-8');
 assert.equal($('#link').value,'https://example.org/sermons/fictional-abide');
 assert.equal($('#linkTitle').value,'Fictional Sunday recording');
 assert.equal(w.document.querySelectorAll('[data-reference-row]').length,2);
 assert.equal($('#ref-0-note').value,'Fictional: rooted by streams');
 assert.equal($('#ref-1-reference').value,'Romans 8:28');

 // Removing the second row leaves the first, renumbered from zero, with focus somewhere real.
 click('[data-action="remove-reference"][data-index="1"]');
 assert.equal(w.document.querySelectorAll('[data-reference-row]').length,1);
 assert.equal($('#ref-0-reference').value,'Psalm 1');
 assert.equal(w.document.activeElement.id,'ref-0-reference');

 await submit('entry-form',entrySaved);
 const e=await entryWhere(x=>x.title==='Fictional: Abide','the saved entry');
 assert.equal((await db.all('entries')).length,1);
 assert.deepEqual(e.scriptureRefs,['John 15:1-8','Psalm 1']);
 assert.deepEqual(e._unmigrated.companionScripture,{main:'John 15:1-8',references:[{reference:'Psalm 1',note:'Fictional: rooted by streams'}]});
 assert.equal(e.links.length,1);assert.equal(e.links[0].url,'https://example.org/sermons/fictional-abide');assert.equal(e.links[0].capturedTitle,'Fictional Sunday recording');
 assert.equal((await db.all('drafts')).length,0);

 // The read view shows all three, and the link can be followed.
 assert.equal(w.location.hash,'#entry/'+e.id);
 assert.match(main(),/Main Scripture/);assert.match(main(),/John 15:1-8/);
 assert.match(main(),/Reference notes/);assert.match(main(),/rooted by streams/);
 assert.ok($('a[href="https://example.org/sermons/fictional-abide"]'),'a safe link is clickable');

 // Search finds a reference note.
 await go('#journal');input('search','rooted by streams');assert.equal($('#search-status').textContent,'1 saved entries found.');input('search','');

 // The readable copy carries them with the reader's notes, not behind the private-field choices.
 await go('#entry/'+e.id);click('[data-action="markdown"]');const preview=$('#share-preview').textContent;
 assert.match(preview,/Main Scripture: John 15:1-8/);
 assert.match(preview,/## Reference notes/);
 assert.match(preview,/\*\*Psalm 1\*\* — Fictional: rooted by streams/);
 assert.match(preview,/Link: https:\/\/example\.org\/sermons\/fictional-abide — Fictional Sunday recording/);
 click('[data-dialog="cancel"]');

 // Editing the saved entry restores the rows; clearing the link removes it and only it.
 await go('#write/edit/'+e.id);assert.equal($('#ref-0-reference').value,'Psalm 1');
 input('link','');input('linkTitle','');await submit('entry-form',entrySaved);
 const saved=await entryWhere(x=>x.id===e.id&&x.links.length===0,'the entry saved without its link');
 assert.deepEqual(saved.scriptureRefs,['John 15:1-8','Psalm 1']);
});

test('pasted sermon notes become provided notes, kept apart from the reader’s own words, and can be replaced or removed',async()=>{
 await go('#write/sermon');input('notes','Fictional: my own words');
 assert.match(main(),/Sermon notes from your church or the preacher\?/);assert.equal($('#paste-panel').hidden,true);
 click('[data-action="paste-provided"]');assert.equal($('#paste-panel').hidden,false);assert.equal(w.document.activeElement.id,'pasted-notes');
 click('[data-action="use-pasted"]');await waitFor(()=>$('#form-error').textContent,'the empty-paste refusal');assert.match($('#form-error').textContent,/empty/);

 input('pasted-notes','## Outline\r\n\r\n1. Abide\r\n2. Bear fruit');input('pasted-source','Fictional Example Chapel');
 click('[data-action="use-pasted"]');await waitFor(()=>/Fictional Example Chapel/.test($('.provided')?.textContent||''),'the pasted notes to appear as provided notes');
 assert.match($('.provided').textContent,/Provided notes · Fictional Example Chapel/);
 assert.match($('.provided').textContent,/Pasted in/);
 assert.match($('.provided pre').textContent,/Bear fruit/);
 assert.equal($('#notes').value,'Fictional: my own words','the reader’s own notes are untouched');
 assert.equal($('#paste-panel').hidden,true);
 assert.equal(w.document.activeElement.id,'provided-heading');

 const d=await draftWhere(x=>x.form.notes==='Fictional: my own words'&&x.form.sourceMaterial,'the draft to carry the pasted notes');
 const m=d.form.sourceMaterial;
 assert.equal(m.format,'txt');assert.equal(m.filename,'Pasted notes');assert.equal(m.church,'Fictional Example Chapel');
 assert.equal(m.body,'## Outline\n\n1. Abide\n2. Bear fruit','line endings are normalised, nothing else is touched');
 assert.match(m.sha256,/^[a-f0-9]{64}$/);assert.equal(m.parserVersion,1);

 // Replacing asks first.
 click('[data-action="paste-provided"]');input('pasted-notes','Fictional replacement outline');click('[data-action="use-pasted"]');await waitFor(()=>$('#dialog').open,'the replace confirmation');
 assert.ok($('#dialog').open);assert.match($('#dialog-heading').textContent,/Replace the provided notes/);
 click('[data-dialog="confirm"]');await waitFor(()=>/Fictional replacement outline/.test($('.provided pre')?.textContent||''),'the replacement to appear');
 assert.match($('.provided pre').textContent,/Fictional replacement outline/);
 assert.ok(!$('.provided').textContent.includes('Example Chapel'),'the earlier provenance does not outlive the text it described');

 // Removing asks first, and leaves the reader’s writing alone.
 click('[data-action="remove-provided"]');assert.ok($('#dialog').open);assert.match($('#dialog-heading').textContent,/Remove the provided notes/);
 click('[data-dialog="confirm"]');await waitFor(()=>!$('.provided'),'the provided notes to be removed');
 assert.ok(!$('.provided'));assert.match(main(),/Sermon notes from your church or the preacher\?/);
 assert.equal($('#notes').value,'Fictional: my own words');
 const after=await draftWhere(x=>x.id===d.id&&x.form.sourceMaterial===null,'the draft without provided notes');
 assert.equal(after.form.notes,'Fictional: my own words');

 await submit('entry-form',entrySaved);
 const e=await entryWhere(x=>x.notes==='Fictional: my own words','the saved entry');
 assert.equal(Object.hasOwn(e,'sourceMaterial'),false,'removed means gone from the saved entry, not an empty block');
});

test('a file chosen inside the editor becomes provided notes, and a Sermon Pack seeds only the fields still empty',async()=>{
 await go('#write/sermon');input('title','Fictional: my own title');input('notes','Fictional notes');
 click('[data-action="pick-provided"]');assert.match($('#file-picker').accept,/\.txt/);
 await chooseFile(text('# Fictional handout\n\nFrom a Markdown file.'),'fictional-handout.md',()=>/fictional-handout\.md/.test($('.provided')?.textContent||''),'the Markdown file to become provided notes');
 assert.match($('.provided').textContent,/Imported from fictional-handout\.md/);
 assert.equal($('#title').value,'Fictional: my own title');
 let d=await draftWhere(x=>x.form.title==='Fictional: my own title'&&x.form.sourceMaterial,'the draft to carry the imported file');
 assert.equal(d.form.sourceMaterial.format,'markdown');assert.equal(d.form.sourceMaterial.filename,'fictional-handout.md');
 assert.equal(d.form.sourceMaterial.body,'# Fictional handout\n\nFrom a Markdown file.');

 // A Sermon Pack replaces it after confirmation, and offers its facts to empty fields only.
 const pack=JSON.parse(await readFile(new URL('../dist/example-sermon-notes.json',import.meta.url),'utf8'));
 click('[data-action="pick-provided"]');await chooseFile(text(JSON.stringify(pack)),'fictional-pack.json',()=>$('#dialog').open,'the replace confirmation');
 assert.ok($('#dialog').open);assert.match($('#dialog-heading').textContent,/Replace the provided notes/);
 click('[data-dialog="confirm"]');await waitFor(()=>/Example church/.test($('.provided')?.textContent||''),'the Sermon Pack to replace the file');
 assert.match($('.provided').textContent,/Provided notes · Example church/);
 assert.equal($('#title').value,'Fictional: my own title','a title already written is not overwritten');
 assert.equal($('#speaker').value,'Example speaker');assert.equal($('#place').value,'Example church');
 assert.equal($('#date').value,'2026-10-07');assert.equal($('#mainScripture').value,'John 15:1-8');
 assert.equal($('#notes').value,'Fictional notes');assert.equal($('#reflection').value,'');assert.equal($('#prayer').value,'');
 d=await draftWhere(x=>x.id===d.id&&x.form.sourceMaterial?.format==='sermon-notes-json','the draft to carry the Sermon Pack');
 assert.equal(d.form.sourceMaterial.format,'sermon-notes-json');assert.equal(d.form.sourceMaterial.church,'Example church');
 assert.deepEqual(d.form.scriptureRefs,['John 15:1-8']);

 // The wrong kind of file is refused with a sentence, and the entry is unchanged.
 click('[data-action="pick-provided"]');await chooseFile(text('{"format":"journey-export","version":1,"entries":[]}'),'journal.json',()=>$('#form-error').textContent,'the wrong kind of file to be refused');
 assert.match($('#form-error').textContent,/Sermon Pack \(\.json\), or a \.txt or \.md file/);
 assert.match($('.provided').textContent,/Example church/);
});

test('“Import church notes” on the import page accepts a plain text file as provided notes for a new entry',async()=>{
 await go('#import');click('[data-action="pick-sermon"]');assert.match($('#file-picker').accept,/\.md/);
 await chooseFile(text('Fictional printed outline\n\n1. Read\n2. Pray'),'fictional-bulletin.txt',()=>$('[data-action="confirm-provided"]'),'the text file to be reviewed as provided notes');
 assert.ok($('[data-action="confirm-provided"]'));
 assert.match($('#import-review').textContent,/fictional-bulletin\.txt/);assert.match($('#import-review').textContent,/Fictional printed outline/);
 click('[data-action="confirm-provided"]');await waitFor(()=>/^#write\/draft\//.test(w.location.hash)&&$('.provided'),'the new draft to open with its provided notes');
 assert.match(w.location.hash,/^#write\/draft\//);
 assert.match($('.provided').textContent,/Imported from fictional-bulletin\.txt/);
 assert.equal($('#notes').value,'');assert.equal($('#kind').value,'sermon');
 const d=await draftWhere(x=>x.form.sourceMaterial?.filename==='fictional-bulletin.txt','the new draft');
 assert.equal(d.form.sourceMaterial.format,'txt');assert.equal(Object.hasOwn(d.form,'source'),false);
});

test('a link that is not a web address blocks the save with a sentence that says what to do',async()=>{
 await go('#write/reading');assert.equal($('label[for="link"]').textContent,'Link');
 input('notes','Fictional reading');input('link','example.org/no-scheme');
 const before=(await db.all('entries')).length;
 await submit('entry-form');assert.match($('#form-error').textContent,/starting with https:\/\//);
 assert.equal((await db.all('entries')).length,before);
 input('link','javascript:alert(1)');await submit('entry-form');assert.match($('#form-error').textContent,/http or https/);
 assert.equal((await db.all('entries')).length,before);
 // Changing the kind renames the field without losing its value.
 const kind=$('#kind');kind.value='sermon';kind.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.equal($('label[for="link"]').textContent,'Sermon link');
 input('link','https://example.org/fictional-reading');await submit('entry-form',entrySaved);
 await entryWhere(x=>x.links[0]?.url==='https://example.org/fictional-reading','the saved reading');
 assert.equal((await db.all('entries')).length,before+1);
});

test('Enter in a reference moves to its note instead of saving the entry',async()=>{
 await go('#write/sermon');input('notes','Fictional notes');click('[data-action="add-reference"]');
 const before=(await db.all('entries')).length;
 const ref=$('#ref-0-reference');ref.focus();
 const event=new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});ref.dispatchEvent(event);
 assert.equal(event.defaultPrevented,true);assert.equal(w.document.activeElement.id,'ref-0-note');
 await breathe();assert.equal((await db.all('entries')).length,before);
});
