// Topics on the companion, through the wired UI: the list, one topic with its
// King James text, filing an entry under a topic, and finding it again.
//
// jsdom, not a rendered browser. Every wait polls for a named state. All
// content is fictional.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
import {createRequire} from 'node:module';
import {topicsById} from '../dist/scripture.js';
import {newEntry} from '../dist/core.js';
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
const $=s=>w.document.querySelector(s);
const text=s=>$(s)?.textContent??'';
const SETTLE_MS=5000;
async function waitFor(check,description){const end=Date.now()+SETTLE_MS;for(;;){const result=await check();if(result)return result;if(Date.now()>=end)assert.fail(`Timed out after ${SETTLE_MS}ms waiting for ${description}`);await new Promise(r=>setTimeout(r,10));}}
async function go(hash){let replaced=false;const observer=new w.MutationObserver(()=>{replaced=true;});observer.observe($('#main'),{childList:true});try{if(w.location.hash===hash)w.dispatchEvent(new w.HashChangeEvent('hashchange'));else w.location.hash=hash;await waitFor(()=>replaced||w.location.hash!==hash,`${hash} to render or be refused`);}finally{observer.disconnect();}}
function input(id,value){const el=w.document.getElementById(id);assert.ok(el,'missing '+id);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));}
function click(selector){const el=$(selector);assert.ok(el,'missing '+selector);el.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}));}
async function submit(id,until){const f=w.document.getElementById(id);assert.ok(f,'missing form '+id);const button=f.querySelector('[type="submit"]');f.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:button}));await waitFor(until||(()=>!button.isConnected||!button.disabled),until?`${id} to reach its outcome`:`the ${id} handler to finish`);}
const entrySaved=()=>w.location.hash.startsWith('#entry/')&&$('article.writing-sheet');
const draftWhere=(predicate,description)=>waitFor(async()=>(await db.all('drafts')).find(predicate),description);
const entryWhere=(predicate,description)=>waitFor(async()=>(await db.all('entries')).find(predicate),description);

test('the topics page lists all 40, filters by alias, and a topic page shows its passages with the King James text',async()=>{
 await go('#topics');
 assert.equal(document.querySelectorAll('main h1').length,1);
 assert.equal(document.querySelectorAll('.topic-card').length,40);
 assert.match(text('#topics-status'),/Showing all 40 topics/);
 assert.equal($('nav [aria-current="page"]')?.dataset.nav,'topics');

 input('topic-filter','worry');
 assert.equal(document.querySelectorAll('.topic-card').length,1);
 assert.match(text('.topic-card h2'),/Anxiety/);
 assert.match(text('.topic-card small'),/also “worry”/);
 assert.match(text('#topics-status'),/1 of 40 topics match/);
 input('topic-filter','zzzz-nothing');assert.match(text('#topics-list'),/No topic matches/);
 input('topic-filter','');assert.equal(document.querySelectorAll('.topic-card').length,40);

 await go('#topic/marriage');
 assert.match(text('main h1'),/Marriage/);
 assert.equal(document.title,'Marriage · My Life With Christ');
 assert.equal($('nav [aria-current="page"]')?.dataset.nav,'topics','a topic page is part of Topics in the navigation');
 const marriage=topicsById.get('marriage');
 assert.equal(document.querySelectorAll('.passage-card').length,marriage.refs.length);
 assert.match(text('.passage-card h3'),/Genesis 2:18-25/);
 assert.match(text('.passage-card .why'),/founding text/);
 await waitFor(()=>/All \d+ passages loaded/.test(text('#passages-status')),'the King James text to load');
 assert.match(text('.passage-card .verses'),/It is not good that the man should be alone/);
 assert.equal(text('.passage-card .verses sup'),'18','verse numbers come from the reference, not from 1');
 assert.equal(document.querySelectorAll('.verses .unavailable').length,0,'every passage of this topic loaded');
 assert.match(text('.attribution'),/King James Version/);
 assert.match(text('#main'),/Nothing written under Marriage yet/);
 assert.ok($('a[href="#write/topic/marriage"]'));

 await go('#topic/not-a-topic');
 assert.match(text('main h1'),/not here/);assert.ok($('a[href="#topics"]'));
});

test('“Write about” files a new entry under the topic; topics can be added and removed; the entry shows them and is found by them',async()=>{
 await go('#write/topic/marriage');
 assert.ok($('#entry-form'));
 assert.match(text('#topic-chips'),/Marriage/);
 assert.ok($('details[open]'),'the details panel opens when a topic is already attached');
 input('title','Fictional: on marriage');input('notes','Fictional notes');

 click('[data-action="add-topic"]');
 await waitFor(()=>text('#form-error'),'the choose-a-topic refusal');
 assert.match(text('#form-error'),/Choose a topic/);

 $('#topic-choice').value='forgiveness';click('[data-action="add-topic"]');
 assert.deepEqual([...document.querySelectorAll('#topic-chips .chip')].map(c=>c.textContent.replace('✕','').trim()),['Marriage','Forgiveness']);
 assert.equal($('#topic-choice').value,'','the chooser is ready for the next topic');
 const d=await draftWhere(x=>x.form.title==='Fictional: on marriage'&&x.form.anchors.length===2,'the draft to hold two topics');
 assert.deepEqual(d.form.anchors,[{kind:'topic',topicId:'marriage'},{kind:'topic',topicId:'forgiveness'}]);

 click('[data-action="remove-topic"][data-id="forgiveness"]');
 assert.equal(document.querySelectorAll('#topic-chips .chip').length,1);
 assert.equal(w.document.activeElement.id,'topic-choice','focus lands on the chooser, not on <body>');
 await draftWhere(x=>x.id===d.id&&x.form.anchors.length===1,'the draft to hold one topic');

 await submit('entry-form',entrySaved);
 const e=await entryWhere(x=>x.title==='Fictional: on marriage','the saved entry');
 assert.deepEqual(e.anchors,[{kind:'topic',topicId:'marriage'}]);
 assert.ok($('a.chip[href="#topic/marriage"]'));
 assert.match(text('a.chip[href="#topic/marriage"]'),/Topic: Marriage/);

 await go('#topic/marriage');
 assert.match(text('#main'),/Fictional: on marriage/);
 assert.ok(!/Nothing written under/.test(text('#main')));
 await go('#topics');
 assert.match([...document.querySelectorAll('.topic-card')].find(c=>/Marriage/.test(c.textContent)).textContent,/1 of your entries/);
 await go('#journal');
 input('search','husband');assert.equal(text('#search-status'),'1 saved entries found.','an alias finds the entry');
 assert.match(text('.entry-card .entry-topics'),/Marriage/);
 input('search','');

 // An anchor the app wrote stays exactly where it was while topics change here.
 const other=newEntry('reading');other.title='Fictional: anchored by the app';other.notes='Fictional reading';
 other.anchors=[{kind:'scripture',book:'psalms',chapterStart:23,verseStart:1,chapterEnd:23,verseEnd:6}];
 await db.put('entries',other);
 await go('#write/edit/'+other.id);
 assert.match(text('.writing-aside'),/Existing Scripture and book anchors are preserved/);
 $('#topic-choice').value='rest';click('[data-action="add-topic"]');
 await submit('entry-form',()=>w.location.hash==='#entry/'+other.id&&$('article.writing-sheet'));
 const saved=await entryWhere(x=>x.id===other.id&&x.anchors.length===2,'the entry with the app’s anchor and a topic');
 assert.deepEqual(saved.anchors,[other.anchors[0],{kind:'topic',topicId:'rest'}]);
 assert.deepEqual([...document.querySelectorAll('.chip')].map(c=>c.textContent),['Psalms 23','Topic: Rest']);
});
