import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {newEntry,clone,makeJourney,validateJourney,validateSermon,sermonEntry,protect,unprotect,planImport,entryDraft,draftEntry,markdown,safeURL,parseJSON} from '../dist/core.js';
import {readJournalFile} from '../dist/archive.js';
import {indexedDB} from 'fake-indexeddb';
globalThis.indexedDB=indexedDB;
const db=await import('../dist/storage.js');
await mkdir(new URL('../.test-tmp',import.meta.url),{recursive:true});
for(const [src,out] of [['lib/entry-kinds.ts','entry-kinds.mjs'],['export/migrate.ts','migrate.mjs'],['export/fixtures.ts','fixtures.mjs']]){
 const source=await readFile(new URL('../compat/src/'+src,import.meta.url),'utf8');
 await writeFile(new URL('../.test-tmp/'+out,import.meta.url),stripTypeScriptTypes(source).replace("'../lib/entry-kinds'","'./entry-kinds.mjs'"));
}
const {migrateExport}=await import('../.test-tmp/migrate.mjs');
const {ALL_ENTRIES}=await import('../.test-tmp/fixtures.mjs');
test('the real app importer accepts all five upstream fixtures without changing their fields',()=>{
 assert.equal(ALL_ENTRIES.length,5);const j=makeJourney(ALL_ENTRIES);const parsed=migrateExport(JSON.parse(JSON.stringify(j)));assert.deepEqual(parsed.entries,ALL_ENTRIES);assert.deepEqual(parsed.warnings,[]);
});
test('provided church material and personal fields survive transfer independently',async()=>{
 const p=JSON.parse(await readFile(new URL('../dist/example-sermon-notes.json',import.meta.url),'utf8'));
 const e=await sermonEntry(p,'outline.json',new TextEncoder().encode(JSON.stringify(p)));assert.equal(e.notes,'');assert.equal(e.reflection,'');assert.equal(e.prayer,'');assert.equal(e.sourceMaterial.body,p.bodyMarkdown);assert.match(e.sourceMaterial.sha256,/^[a-f0-9]{64}$/);
 e.notes='My observations';e.reflection='My own response';e.prayer='My own prayer';const result=migrateExport(makeJourney([e]));assert.deepEqual(result.entries,[e]);assert.equal(result.entries[0].sourceMaterial.body,p.bodyMarkdown);assert.ok(markdown(e).includes('## Provided notes'));
});
test('drafts are distinct from saved entries and preserve unfinished writing',()=>{const e=newEntry('letter');e.title='For my family';e.notes='An unfinished sentence  ';const d=entryDraft(e);const j=makeJourney([],[d]);assert.equal(j.entries.length,0);assert.equal(migrateExport(j).drafts[0].form.notes,e.notes);assert.equal(draftEntry(d).notes,e.notes);});
test('strict inputs reject future versions, empty packs, duplicate IDs and invalid dates',()=>{const e=newEntry();assert.throws(()=>validateJourney({...makeJourney([e]),version:2}));assert.throws(()=>makeJourney([e,e]));assert.throws(()=>makeJourney([{...e,date:'2026-02-30'}]));assert.throws(()=>validateSermon({format:'my-life-with-christ-sermon-notes',version:1,bodyMarkdown:' '}));assert.throws(()=>parseJSON('null invalid'));assert.throws(()=>safeURL('javascript:alert(1)'));assert.throws(()=>safeURL('https://user:password@example.org'));assert.throws(()=>safeURL('https://example.org/#my-private-data'));});
test('unknown entry fields and malicious object keys stay data',()=>{const e=JSON.parse(JSON.stringify(newEntry()).slice(0,-1)+',"__proto__":{"polluted":true},"futureField":{"private":"retain me"}}');const j=makeJourney([e]);assert.equal({}.polluted,undefined);assert.deepEqual(j.entries[0].futureField,{private:'retain me'});assert.deepEqual(migrateExport(j).entries[0]._unmigrated.futureField,e.futureField);});
test('protected files round-trip, use fresh random salts/IVs and reject wrong passwords and tampering',async()=>{const e=newEntry('prayer');e.notes='秘密 — prayer';e.reflection='A reflection';e.prayer='My prayer';const j=makeJourney([e]);const pass='A long test password 2026';const a=await protect(j,pass),b=await protect(j,pass);assert.notEqual(a.salt,b.salt);assert.notEqual(a.iv,b.iv);assert.ok(!JSON.stringify(a).includes(e.notes));assert.deepEqual(await unprotect(a,pass),j);await assert.rejects(()=>unprotect(a,'not the right password'));const bytes=Buffer.from(a.data,'base64');bytes[0]^=1;await assert.rejects(()=>unprotect({...a,data:bytes.toString('base64')},pass));await assert.rejects(()=>unprotect({...a,iterations:1},pass));await assert.rejects(()=>protect(j,'short'));});
test('imports preserve both changed versions and repeated imports do not make more copies',async()=>{const e=newEntry();e.title='Sunday';e.notes='original';await db.put('entries',e);const incoming={...e,notes:'edited on phone',updatedAt:'2026-10-08T12:00:00Z'};let result=await db.importJourney(makeJourney([incoming]));assert.equal(result.count,1);assert.equal(result.copies,1);let rows=await db.all('entries');assert.equal(rows.find(r=>r.id===e.id).notes,'original');assert.ok(rows.some(r=>r.notes==='edited on phone'));assert.equal(planImport([incoming],rows)[0].status,'duplicate');result=await db.importJourney(makeJourney([incoming]));assert.equal(result.count,0);});
test('saved entry updates and draft saves reject concurrent edits',async()=>{const e=newEntry();e.notes='starting';await db.put('entries',e);const newer={...e,notes:'another tab'};await db.put('entries',newer);await assert.rejects(()=>db.saveEntry({...e,notes:'stale write'},undefined,e),/another tab/);assert.equal((await db.all('entries')).find(r=>r.id===e.id).notes,'another tab');const d=entryDraft(e);await db.putDraft(d,undefined);const newerDraft={...d,updatedAt:'2026-10-09T12:00:00Z',form:{...d.form,notes:'other draft'}};await db.putDraft(newerDraft,d);await assert.rejects(()=>db.putDraft({...d,form:{...d.form,notes:'stale draft'}},d),/another tab/);assert.equal((await db.all('drafts')).find(r=>r.id===d.id).form.notes,'other draft');});
test('journal JSON bytes are accepted and missing/invalid archives fail closed',async()=>{const j=makeJourney([newEntry()]);assert.deepEqual(await readJournalFile(new TextEncoder().encode(JSON.stringify(j))),j);await assert.rejects(()=>readJournalFile(new Uint8Array([80,75,3,4,0,0])));});
test('real deflated ZIP imports only after every manifest claim passes; a changed member is refused',async()=>{
 const j=makeJourney([newEntry('reflection')]);
 const code=`import io,sys,json,zipfile,hashlib,base64
p=json.load(sys.stdin)
files={'README.txt':b'Companion compatibility fixture','data/journey.json':json.dumps(p['journal']).encode(),'data/schema.json':b'{}','notes/entry.md':b'# An entry'}
manifest='\\n'.join(hashlib.sha256(v).hexdigest()+'  '+str(len(v))+'  '+k for k,v in files.items())
files['MANIFEST.txt']=manifest.encode()
if p['tamper']: files['notes/entry.md']=b'changed'
buf=io.BytesIO()
with zipfile.ZipFile(buf,'w',zipfile.ZIP_DEFLATED) as z:
 for k,v in files.items(): z.writestr(k,v)
sys.stdout.buffer.write(buf.getvalue())`;
 const zip=tamper=>new Uint8Array(execFileSync('python3',['-c',code],{input:JSON.stringify({journal:j,tamper})}));
 assert.deepEqual(await readJournalFile(zip(false)),j);await assert.rejects(()=>readJournalFile(zip(true)),/checksum/);
});
test('minimal optional EntryLink fields become valid draft rows accepted by the app importer',()=>{
 const e=newEntry();e.links=[{url:'https://example.org/fictional-resource',futureLink:{keep:true}}];const d=entryDraft(e);assert.equal(d.form.links[0].label,'');assert.equal(d.form.links[0].capturedTitle,'');assert.deepEqual(d.form.links[0].futureLink,{keep:true});assert.deepEqual(d._unmigrated.companionEntry.links,e.links);const result=migrateExport(makeJourney([],[d]));assert.equal(result.drafts.length,1);assert.equal(result.drafts[0].form.links[0].url,e.links[0].url);assert.equal(result.warnings.length,0);
 const existing={...d,form:{...d.form,links:[{url:'https://example.org/fictional-existing',label:'Existing',capturedTitle:'Captured',futureLink:{keep:true}}]}};assert.deepEqual(entryDraft(draftEntry(existing),existing).form.links,existing.form.links);
});

test('pastor recovery permits unfinished outlines but validates all other public fields',async()=>{
 const {readPackDraft,validateSermon}=await import('../dist/core.js');const raw={format:'my-life-with-christ-sermon-notes',version:1,title:'Fictional unfinished',bodyMarkdown:'  ',scripture:['John 15'],privateUnknown:'never publish'};const restored=readPackDraft(raw);assert.equal(restored.bodyMarkdown,'  ');assert.equal(Object.hasOwn(restored,'privateUnknown'),false);assert.throws(()=>validateSermon(restored));assert.throws(()=>readPackDraft({...raw,scripture:[5]}));assert.throws(()=>readPackDraft({...raw,version:2}));assert.throws(()=>readPackDraft({...raw,bodyMarkdown:'x'.repeat(200001)}));
});
