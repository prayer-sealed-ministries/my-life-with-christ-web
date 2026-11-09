// Main Scripture, reference notes and the sermon link, against the app's real
// importer.
//
// The rule being pinned: the companion may extend an entry only in ways the app
// carries verbatim and without complaint. Reference notes live under
// `_unmigrated.companionScripture`; the references themselves are mirrored into
// `scriptureRefs`, which every edition already shows. Pasted provided notes are
// named for what they are. All content here is fictional.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {
 newEntry,entryDraft,draftEntry,makeJourney,scriptureOf,withScripture,primaryLinkOf,withPrimaryLink,
 validLinkURL,safeHref,providedMaterial,packMaterial,PASTED_SOURCE_FILENAME,markdown,
} from '../dist/core.js';

// The app's actual importer, type-stripped the same way the other suites do it.
const tmp=new URL('../.test-tmp/scripture-contract/',import.meta.url);
await mkdir(tmp,{recursive:true});
for(const [src,out] of [['lib/entry-kinds.ts','entry-kinds.mjs'],['export/migrate.ts','migrate.mjs']]){
 const source=await readFile(new URL('../compat/src/'+src,import.meta.url),'utf8');
 await writeFile(new URL(out,tmp),stripTypeScriptTypes(source).replace("'../lib/entry-kinds'","'./entry-kinds.mjs'"));
}
const {migrateExport:appImport}=await import(new URL('migrate.mjs',tmp).href);
/** Over the wire the way a file travels: JSON and back. */
const wire=j=>JSON.parse(JSON.stringify(j));

function fictionalSermon(){
 const e=newEntry('sermon');e.title='FICTIONAL-COMPAT abide';e.notes='FICTIONAL-COMPAT my notes';
 withScripture(e,'John 15:1-8',[{reference:'Psalm 1',note:'FICTIONAL-COMPAT rooted'},{reference:'Romans 8:28',note:''}]);
 withPrimaryLink(e,'https://example.org/fictional-compat','FICTIONAL-COMPAT recording');
 return e;
}

test('an entry with a main Scripture, reference notes and a link crosses to the app with no warnings and comes back whole',()=>{
 const e=fictionalSermon();
 assert.deepEqual(e.scriptureRefs,['John 15:1-8','Psalm 1','Romans 8:28']);
 const into=appImport(wire(makeJourney([e])));
 assert.deepEqual(into.warnings,[],`the app warned: ${into.warnings.join(' | ')}`);
 const [a]=into.entries;
 assert.deepEqual(a.scriptureRefs,e.scriptureRefs);
 assert.deepEqual(a._unmigrated.companionScripture,e._unmigrated.companionScripture);
 assert.equal(a.links[0].url,'https://example.org/fictional-compat');
 assert.equal(a.links[0].capturedTitle,'FICTIONAL-COMPAT recording');
 assert.match(a.links[0].capturedAt,/^\d{4}-/);
 // The companion reads the app's copy back as the same rows.
 assert.deepEqual(scriptureOf(a),{main:'John 15:1-8',references:[{reference:'Psalm 1',note:'FICTIONAL-COMPAT rooted'},{reference:'Romans 8:28',note:''}]});
 // Two laps, because preservation bugs favour the second trip.
 const again=appImport(wire(makeJourney(into.entries)));
 assert.deepEqual(again.warnings,[]);assert.deepEqual(again.entries,into.entries);
});

test('a draft of such an entry keeps preserved data and provenance out of the form, so the app has nothing to warn about',()=>{
 const e=fictionalSermon();
 e.source={filename:'FICTIONAL-COMPAT.txt',format:'txt',importedAt:'2026-10-11T10:00:00.000Z',itemIndex:1,parserVersion:1};
 const d=entryDraft(e);
 assert.equal(Object.hasOwn(d.form,'_unmigrated'),false,'_unmigrated is entry-level');
 assert.equal(Object.hasOwn(d.form,'source'),false,'import provenance is entry-level');
 assert.deepEqual(d.form.scriptureRefs,e.scriptureRefs);
 const into=appImport(wire(makeJourney([],[d])));
 assert.deepEqual(into.warnings,[],`the app warned about a companion draft: ${into.warnings.join(' | ')}`);
 // Nothing was lost by holding the form to its contract: promoting the draft gives the whole entry back.
 const promoted=draftEntry(into.drafts[0]);
 assert.deepEqual(scriptureOf(promoted),scriptureOf(e));
 assert.deepEqual(promoted.source,e.source);
 assert.equal(promoted.links[0].url,e.links[0].url);
 // A draft an older companion wrote, with those fields in its form, is cleaned when continued.
 const stale=entryDraft(e);stale.form._unmigrated={companionScripture:{main:'stale',references:[]}};stale.form.source=e.source;
 const continued=entryDraft(e,stale);
 assert.equal(Object.hasOwn(continued.form,'_unmigrated'),false);assert.equal(Object.hasOwn(continued.form,'source'),false);
 assert.deepEqual(appImport(wire(makeJourney([],[continued]))).warnings,[]);
});

test('an entry written by the app, with references but no notes, reads as a main passage and plain reference rows',()=>{
 const e=newEntry('sermon');e.scriptureRefs=['John 3:16','Romans 10:9-10'];
 assert.deepEqual(scriptureOf(e),{main:'John 3:16',references:[{reference:'Romans 10:9-10',note:''}]});
 // Saving it back untouched records the rows and nothing the app would mind.
 const {main,references}=scriptureOf(e);withScripture(e,main,references);
 assert.deepEqual(e.scriptureRefs,['John 3:16','Romans 10:9-10']);
 assert.deepEqual(appImport(wire(makeJourney([e]))).warnings,[]);
 // With no references at all, nothing is written under _unmigrated.
 const bare=newEntry('reading');withScripture(bare,'Psalm 23',[]);
 assert.deepEqual(bare.scriptureRefs,['Psalm 23']);assert.equal(Object.hasOwn(bare,'_unmigrated'),false);
 // Other preserved data is left exactly where it was, whether rows come or go.
 const copy=newEntry();copy._unmigrated={companionOriginalId:'FICTIONAL-COMPAT original'};
 withScripture(copy,'',[{reference:'Psalm 1',note:'FICTIONAL-COMPAT'}]);
 assert.equal(copy._unmigrated.companionOriginalId,'FICTIONAL-COMPAT original');
 withScripture(copy,'',[]);
 assert.deepEqual(copy._unmigrated,{companionOriginalId:'FICTIONAL-COMPAT original'});
 // Empty rows are dropped; a note with no reference is kept, because it is writing.
 const notes=newEntry();withScripture(notes,'Psalm 23',[{reference:'',note:''},{reference:'',note:'FICTIONAL-COMPAT a thought'}]);
 assert.deepEqual(notes.scriptureRefs,['Psalm 23']);
 assert.deepEqual(notes._unmigrated.companionScripture.references,[{reference:'',note:'FICTIONAL-COMPAT a thought'}]);
});

test('references changed by another edition are reconciled without losing a note',()=>{
 const e=fictionalSermon();
 // Another edition removed Romans and added Hebrews: Romans (no note) goes, Hebrews arrives as a plain row.
 e.scriptureRefs=['John 15:1-8','Psalm 1','Hebrews 11:1'];
 assert.deepEqual(scriptureOf(e),{main:'John 15:1-8',references:[{reference:'Psalm 1',note:'FICTIONAL-COMPAT rooted'},{reference:'Hebrews 11:1',note:''}]});
 // A reference with a note on it is kept even when the reference itself was dropped elsewhere.
 e.scriptureRefs=['John 15:1-8'];
 assert.deepEqual(scriptureOf(e),{main:'John 15:1-8',references:[{reference:'Psalm 1',note:'FICTIONAL-COMPAT rooted'}]});
 // The main passage reworded elsewhere is still the main passage.
 e.scriptureRefs=['John 15','Psalm 1','Romans 8:28'];
 assert.equal(scriptureOf(e).main,'John 15');
 // No main but reference rows: nothing is promoted to main on reload.
 const r=newEntry();withScripture(r,'',[{reference:'Psalm 1',note:'a'},{reference:'Psalm 2',note:''}]);
 assert.deepEqual(r.scriptureRefs,['Psalm 1','Psalm 2']);
 assert.deepEqual(scriptureOf(r),{main:'',references:[{reference:'Psalm 1',note:'a'},{reference:'Psalm 2',note:''}]});
 // Malformed preserved data is read as absent, never thrown over.
 const m=newEntry();m.scriptureRefs=['Psalm 1'];m._unmigrated={companionScripture:'not an object'};
 assert.deepEqual(scriptureOf(m),{main:'Psalm 1',references:[]});
 // Preserved data of a shape this companion cannot add to is left alone, and refuses rows rather than destroying it.
 const odd=newEntry();odd._unmigrated='opaque';withScripture(odd,'Psalm 1',[]);assert.equal(odd._unmigrated,'opaque');
 assert.throws(()=>withScripture(odd,'Psalm 1',[{reference:'Psalm 2',note:''}]),/cannot be kept/);
});

test('the sermon link edits the first link only and stamps when its description was written',()=>{
 const e=newEntry('sermon');e.links=[{url:'https://example.org/fictional-other',label:'FICTIONAL-COMPAT other'}];
 withPrimaryLink(e,'https://example.org/fictional-sermon','FICTIONAL-COMPAT recording');
 assert.equal(e.links.length,1,'the first link is the one edited');
 assert.equal(e.links[0].label,'FICTIONAL-COMPAT other','what was already on the row stays');
 assert.equal(primaryLinkOf(e).url,'https://example.org/fictional-sermon');
 const stamp=e.links[0].capturedAt;assert.match(stamp,/^\d{4}-/);
 withPrimaryLink(e,'https://example.org/fictional-sermon','FICTIONAL-COMPAT recording');
 assert.equal(e.links[0].capturedAt,stamp,'an unchanged description keeps its stamp');
 withPrimaryLink(e,'https://example.org/fictional-sermon','');
 assert.equal(Object.hasOwn(e.links[0],'capturedAt'),false,'a stamp with no description is a claim about nothing');
 e.links.push({url:'https://example.org/fictional-second'});
 withPrimaryLink(e,'','');
 assert.deepEqual(e.links,[{url:'https://example.org/fictional-second'}],'clearing removes the first link and leaves the rest');
 assert.deepEqual(appImport(wire(makeJourney([e]))).warnings,[]);
 for(const bad of ['example.org/path','javascript:alert(1)','https://user:pw@example.org/','ftp://example.org/'])assert.throws(()=>validLinkURL(bad),undefined,bad);
 assert.equal(validLinkURL('  https://example.org/ok '),'https://example.org/ok');
 assert.equal(validLinkURL(''),'');
 assert.equal(safeHref('javascript:alert(1)'),null);
 assert.equal(safeHref('https://example.org/x'),'https://example.org/x');
});

test('pasted and text-file provided notes are named for what they are and accepted by the app',async()=>{
 const pasted=await providedMaterial({body:'FICTIONAL-COMPAT pasted outline',filename:PASTED_SOURCE_FILENAME,format:'txt',church:'FICTIONAL-COMPAT chapel'});
 assert.equal(pasted.filename,'Pasted notes');assert.equal(pasted.format,'txt');
 assert.equal(pasted.church,'FICTIONAL-COMPAT chapel');assert.match(pasted.sha256,/^[a-f0-9]{64}$/);assert.equal(pasted.parserVersion,1);
 const e=newEntry('sermon');e.sourceMaterial=pasted;
 const into=appImport(wire(makeJourney([e])));
 assert.deepEqual(into.warnings,[]);assert.deepEqual(into.entries[0].sourceMaterial,pasted);
 assert.equal(into.entries[0].notes,'','somebody else’s words never become the reader’s own');
 await assert.rejects(()=>providedMaterial({body:'   ',filename:PASTED_SOURCE_FILENAME,format:'txt'}),/empty/);
 await assert.rejects(()=>providedMaterial({body:'x'.repeat(200001),filename:PASTED_SOURCE_FILENAME,format:'txt'}),/200,000/);
 await assert.rejects(()=>providedMaterial({body:'x',filename:'a.pdf',format:'pdf'}));
 const pack=JSON.parse(await readFile(new URL('../dist/example-sermon-notes.json',import.meta.url),'utf8'));
 const {material,suggested}=await packMaterial(pack,'fictional.json',new TextEncoder().encode(JSON.stringify(pack)));
 assert.equal(material.format,'sermon-notes-json');assert.equal(material.body,pack.bodyMarkdown);
 assert.deepEqual(suggested.scripture,['John 15:1-8']);assert.equal(suggested.church,'Example church');
 // The readable copy carries reference notes with the reader's notes, not behind a private-field choice.
 const shared=markdown(fictionalSermon());
 assert.match(shared,/Main Scripture: John 15:1-8/);assert.match(shared,/## Reference notes/);
 assert.match(shared,/\*\*Psalm 1\*\* — FICTIONAL-COMPAT rooted/);
 assert.match(shared,/Link: https:\/\/example\.org\/fictional-compat — FICTIONAL-COMPAT recording/);
 assert.ok(!markdown({...fictionalSermon(),prayer:'FICTIONAL-COMPAT prayer'}).includes('FICTIONAL-COMPAT prayer'),'prayer still needs its own choice');
});
