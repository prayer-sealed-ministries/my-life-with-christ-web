// The Bible, browsed: books, a book's titled passages, one passage with its
// King James text, and writing about it. Driven through the wired UI in
// jsdom; every wait polls for a named state. All content is fictional.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {indexedDB} from 'fake-indexeddb';
import {createRequire} from 'node:module';
import {loadSections,segmentTitle} from '../dist/scripture.js';
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
async function submit(id,until){const f=w.document.getElementById(id);assert.ok(f,'missing form '+id);const button=f.querySelector('[type="submit"]');f.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:button}));await waitFor(until||(()=>!button.isConnected||!button.disabled),until?`${id} to reach its outcome`:`the ${id} handler to finish`);}
const entryWhere=(predicate,description)=>waitFor(async()=>(await db.all('entries')).find(predicate),description);
const sections=await loadSections();
const ruth=sections.segmentsForBook('ruth');

test('the Bible page lists every book with counts and filters by name',async()=>{
 await go('#bible');
 assert.equal(document.querySelectorAll('main h1').length,1);
 assert.equal(document.querySelectorAll('.book-row').length,66);
 assert.equal(document.querySelectorAll('#books-OT ~ ul .book-row, section[aria-labelledby="books-OT"] .book-row').length,39);
 assert.equal(document.querySelectorAll('section[aria-labelledby="books-NT"] .book-row').length,27);
 assert.match(text('#books-status'),/Showing all 66 books/);
 assert.equal($('nav [aria-current="page"]')?.dataset.nav,'bible');
 const genesis=[...document.querySelectorAll('.book-row')].find(a=>/Genesis/.test(a.textContent));
 assert.match(genesis.textContent,/50 chapters, \d+ passages/);
 input('book-filter','1 sam');
 assert.deepEqual([...document.querySelectorAll('.book-row .book-name')].map(e=>e.textContent),['1 Samuel']);
 assert.match(text('#books-status'),/1 book matches “1 sam”/);
 input('book-filter','zzz');assert.match(text('#books-list'),/No book matches/);
 input('book-filter','');assert.equal(document.querySelectorAll('.book-row').length,66);
 assert.match(text('.attribution'),/Berean Standard Bible/);
});

test('a book page shows its introduction, its topics and every titled passage; a passage page shows the King James text',async()=>{
 await go('#bible/ruth');
 assert.match(text('main h1'),/^Ruth$/);
 assert.match(text('.intro-prose'),/Ruth is four chapters long/,'the introduction written for the app');
 assert.match(text('#book-topics'),/Topics in Ruth/);assert.ok($('a.chip[href="#topic/friendship"]'));
 assert.equal(document.querySelectorAll('.passage-row').length,ruth.length);
 assert.match(text('.passage-row .passage-title'),/Naomi Becomes a Widow/);
 assert.match(text('.passage-row .passage-ref'),/Ruth 1:1-5/);
 assert.match(text('#book-status'),/Nothing of yours in Ruth yet/);
 assert.match(text('#breadcrumbs'),/The Bible/);
 // Genesis has no introduction on purpose, and the page says nothing where there is nothing to say.
 await go('#bible/genesis');assert.equal($('.intro-prose'),null);assert.equal(document.querySelectorAll('.passage-row').length,sections.segmentsForBook('genesis').length);

 await go('#bible/ruth/ruth-1-1-5');
 assert.equal(text('main h1'),'Naomi Becomes a Widow');
 assert.equal(document.title,'Naomi Becomes a Widow · My Life With Christ');
 assert.match(text('.page-head .intro'),/Ruth 1:1-5/);
 assert.match(text('#text-heading'),/Ruth 1:1-5/);assert.match(text('#text-heading'),/King James Version/);
 await waitFor(()=>/5 verses\./.test(text('#passage-status')),'the King James text to load');
 assert.equal(document.querySelectorAll('#passage-verses p').length,5);
 assert.equal(text('#passage-verses sup'),'1');
 assert.match(text('#passage-verses'),/Bethlehemjudah/);
 assert.match(text('#breadcrumbs'),/The Bible.*Ruth.*Naomi Becomes a Widow/s);
 assert.ok(!$('.passage-nav a[rel="prev"]'),'the first passage has no previous');
 assert.match(text('.passage-nav a[rel="next"]'),/Next/);assert.equal($('.passage-nav a[rel="next"]').getAttribute('href'),'#bible/ruth/'+ruth[1].id);
 assert.match(text('.passage-nav a.middle'),/All of Ruth/);
 assert.match(text('#main'),/Nothing written on Ruth 1:1-5 yet/);
 assert.match(text('.attribution'),/King James Version/);assert.match(text('.attribution'),/Berean Standard Bible/);

 // A stale id offers the passage that contains it; a wrong book offers the list.
 await go('#bible/ruth/ruth-1-3-4');
 assert.match(text('main h1'),/not here/);assert.match(text('a.btn.primary'),/Read Naomi Becomes a Widow, which contains it/);
 await go('#bible/fictional-missing');assert.match(text('main h1'),/not here/);assert.ok($('a[href="#bible"]'));
});

test('“Write about this passage” files an entry under the passage, and the passage, book and entry pages all show it',async()=>{
 await go('#bible/ruth/ruth-1-1-5');
 const button=$('.page-head a.btn.primary');assert.equal(button.getAttribute('href'),'#write/passage/ruth/ruth-1-1-5');
 await go('#write/passage/ruth/ruth-1-1-5');
 assert.ok($('#entry-form'));
 assert.equal($('#mainScripture').value,'Ruth 1:1-5','Main Scripture is seeded from the passage');
 assert.match(text('.filed-under'),/Filed under Ruth 1:1-5/);
 input('title','Fictional: on Naomi');input('notes','Fictional notes on Ruth');
 await submit('entry-form',()=>w.location.hash.startsWith('#entry/')&&$('article.writing-sheet'));
 const e=await entryWhere(x=>x.title==='Fictional: on Naomi','the saved entry');
 assert.deepEqual(e.anchors,[{kind:'scripture',book:'ruth',chapterStart:1,verseStart:1,chapterEnd:1,verseEnd:5,outlineEntryId:'ruth-1-1-5'}],'the app’s own anchor, with the heading id as an enhancement');
 assert.deepEqual(e.scriptureRefs,['Ruth 1:1-5']);
 assert.equal($('a.chip[href="#bible/ruth/ruth-1-1-5"]')?.textContent,'Ruth 1:1-5','the entry’s passage chip opens the passage');

 await go('#bible/ruth/ruth-1-1-5');
 assert.match(text('#main'),/Fictional: on Naomi/);assert.ok(!/Nothing written on/.test(text('#main')));
 await go('#bible/ruth');
 assert.match(text('#book-status'),/1 entry of yours in Ruth/);
 assert.match($('.passage-row').textContent,/1 entry/);
 // An entry anchored by the app to a verse inside a passage is listed under that passage, not only an exact match.
 const inside={...JSON.parse(JSON.stringify(e)),id:'fictional-inside',title:'Fictional: verse 3 only',scriptureRefs:[],anchors:[{kind:'scripture',book:'ruth',chapterStart:1,verseStart:3,chapterEnd:1,verseEnd:3}]};
 await db.put('entries',inside);
 await go('#bible/ruth/ruth-1-1-5');assert.match(text('#main'),/Fictional: verse 3 only/);
 await go('#journal');input('search','Naomi Becomes');assert.equal(text('#search-status'),'0 saved entries found.','a heading title is not the entry’s own words');
 input('search','Ruth 1:1-5');assert.equal(text('#search-status'),'1 saved entries found.','the passage reference finds the entry');input('search','');
 assert.equal(segmentTitle(ruth[0]),'Naomi Becomes a Widow');
});
