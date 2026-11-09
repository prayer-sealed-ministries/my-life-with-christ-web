export const KINDS = {sermon:'Sermon',reading:'Bible reading',prayer:'Prayer',reflection:'Reflection',letter:'Letter'};
export const SERMON_FORMAT = 'my-life-with-christ-sermon-notes';
export const MAX_BYTES = 16 * 1024 * 1024;
export const MAX_PROTECTED_BYTES = 11 * 1024 * 1024;
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', {fatal:true});
export const today = () => {const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
export const clone = value => JSON.parse(JSON.stringify(value));
export const isObject = value => value!==null && typeof value==='object' && !Array.isArray(value);
export const same = (a,b) => stable(a)===stable(b);
function stable(v){if(Array.isArray(v))return '['+v.map(stable).join(',')+']';if(isObject(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';return JSON.stringify(v);}
export function validDate(v){return typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;}
export function newEntry(kind='sermon') {const now=new Date().toISOString();return {id:crypto.randomUUID(),kind:Object.hasOwn(KINDS,kind)?kind:'sermon',title:'',date:today(),place:'',speaker:'',sermonSeries:'',anchors:[],scriptureRefs:[],notes:'',reflection:'',prayer:'',links:[],tags:[],forDescendants:false,visibility:'private',createdAt:now,updatedAt:now};}

// ---------------------------------------------------------------------------
// Main Scripture and reference notes
// ---------------------------------------------------------------------------
//
// An entry names one main passage and any number of further references, each
// with the reader's own note on it. `scriptureRefs` is the app's field for
// free-text references, so the main passage is its first item and every
// reference row's passage follows it: the phone app, the archive and the
// printed book all show the references without knowing anything new.
//
// The notes themselves have no field in the app's schema. They ride under
// `_unmigrated.companionScripture`, which is the slot the app preserves
// verbatim and the companion already uses for its own data (companionEntry,
// companionOriginalId). Nothing here moves the journey-export version.
const cleanRow=r=>({reference:isObject(r)&&typeof r.reference==='string'?r.reference.trim():'',note:isObject(r)&&typeof r.note==='string'?r.note:''});
/** The main passage and the reference rows an entry holds, reconciled against `scriptureRefs`. */
export function scriptureOf(entry){
 const refs=Array.isArray(entry.scriptureRefs)?entry.scriptureRefs.filter(s=>typeof s==='string'&&s):[];
 const ext=entry._unmigrated?.companionScripture;
 // Written by another edition, or before reference notes existed: first is main, the rest are references.
 if(!isObject(ext)||!Array.isArray(ext.references))return {main:refs[0]||'',references:refs.slice(1).map(reference=>({reference,note:''}))};
 const storedMain=typeof ext.main==='string'?ext.main.trim():'';
 const references=ext.references.map(cleanRow).filter(r=>r.reference||r.note.trim());
 const known=new Set([storedMain,...references.map(r=>r.reference)].filter(Boolean));
 // A reference another edition removed goes too — unless the reader's note on it would be lost with it.
 const rows=references.filter(r=>!r.reference||r.note.trim()||refs.includes(r.reference));
 const added=refs.filter(ref=>!known.has(ref));
 let main=storedMain&&refs.includes(storedMain)?storedMain:'';
 // The main passage was reworded elsewhere: the unfamiliar first reference is it.
 if(!main&&storedMain&&added.length&&refs[0]===added[0])main=added.shift();
 for(const reference of added)rows.push({reference,note:''});
 return {main,references:rows};
}
/** Write the main passage and reference rows back onto an entry. Empty rows are dropped; a row with a note but no reference is kept. */
export function withScripture(entry,main,references){
 main=String(main||'').trim();
 const rows=(references||[]).map(cleanRow).filter(r=>r.reference||r.note.trim());
 entry.scriptureRefs=[main,...rows.map(r=>r.reference)].filter(Boolean);
 const carried=entry._unmigrated;
 if(carried!==undefined&&!isObject(carried)){if(rows.length)throw Error('This entry carries preserved data in a shape this companion cannot add to, so reference notes cannot be kept on it.');return entry;}
 const meta={...(carried||{})};
 if(rows.length)meta.companionScripture={main,references:rows};else delete meta.companionScripture;
 if(Object.keys(meta).length)entry._unmigrated=meta;else delete entry._unmigrated;
 return entry;
}

// ---------------------------------------------------------------------------
// The sermon link
// ---------------------------------------------------------------------------
//
// The editor shows one link — the first — and leaves any others exactly as a
// saved entry carried them. `capturedTitle` is what the link pointed to when
// it was written down, so the entry still says something once the URL dies.
export function primaryLinkOf(entry){const link=Array.isArray(entry.links)?entry.links[0]:undefined;return isObject(link)&&typeof link.url==='string'?link:null;}
export function withPrimaryLink(entry,url,capturedTitle){
 url=String(url||'').trim();capturedTitle=String(capturedTitle||'').trim();
 const current=primaryLinkOf(entry),rest=current?entry.links.slice(1):(entry.links||[]);
 if(!url&&!capturedTitle){entry.links=rest;return entry;}
 const link={...(current||{}),url};
 if(capturedTitle){link.capturedTitle=capturedTitle;if(!(current&&current.capturedTitle===capturedTitle&&typeof current.capturedAt==='string'))link.capturedAt=new Date().toISOString();}
 else{delete link.capturedTitle;delete link.capturedAt;}
 entry.links=[link,...rest];return entry;
}
/** A web address a person can follow. Empty is fine; anything else must be http or https with no password in it. */
export function validLinkURL(value){
 value=String(value||'').trim();if(!value)return '';
 let u;try{u=new URL(value);}catch{throw Error('Enter the full web address for the link, starting with https://.');}
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Use an ordinary http or https web address for the link, without a password in it.');
 return value;
}
/** The same address, only if it is safe to render as a clickable link. */
export function safeHref(value){try{const u=new URL(String(value));return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}}

// ---------------------------------------------------------------------------
// Provided notes that did not arrive as a Sermon Pack
// ---------------------------------------------------------------------------
//
// Somebody else's words, kept beside the entry and never in `notes`. A text
// file is named for what it is; pasted text has no file, so its filename slot
// names the act instead — the same convention the app uses for a scanned page.
export const PASTED_SOURCE_FILENAME='Pasted notes';
export const MAX_PROVIDED_CHARS=200000;
export function textFormat(filename){return /\.(md|markdown)$/i.test(String(filename))?'markdown':'txt';}
/** Bytes to text, refusing what was plainly never text. Line endings are normalised so one handout reads the same from any computer. */
export function decodeText(bytes){
 let text;try{text=dec.decode(bytes);}catch{throw Error('That file is not readable text. It may be a different kind of file, or saved in an encoding this companion cannot read.');}
 if(text.includes('\0'))throw Error('That file is not readable text. It looks like a binary file.');
 return text.replace(/\r\n?/g,'\n');
}
export async function providedMaterial({body,filename,format,bytes,church,speaker,date,scripture}){
 if(typeof body!=='string'||!body.trim())throw Error('These notes are empty. Choose or paste notes with some text in them.');
 if(body.length>MAX_PROVIDED_CHARS)throw Error('Provided notes must be under 200,000 characters.');
 if(!['txt','markdown','sermon-notes-json'].includes(format))throw Error('This companion keeps provided notes from text, Markdown or Sermon Pack files.');
 const material={format,filename:String(filename).split(/[/\\]/).pop(),importedAt:new Date().toISOString(),sha256:await sha256(bytes??body),body,parserVersion:1};
 if(church)material.church=church;if(speaker)material.speaker=speaker;if(date)material.date=date;if(scripture)material.scripture=clone(scripture);
 return material;
}
/** A Sermon Pack as provided material, plus what it stated about itself to offer the entry's own fields. */
export async function packMaterial(raw,filename,bytes){
 validateSermon(raw);
 const material=await providedMaterial({body:raw.bodyMarkdown,filename,format:'sermon-notes-json',bytes,church:raw.church,speaker:raw.speaker,date:raw.date,scripture:raw.scripture});
 return {material,suggested:{title:raw.title||'',church:raw.church||'',speaker:raw.speaker||'',date:raw.date||'',scripture:[...(raw.scripture||[])]}};
}
export function parseJSON(text){if(enc.encode(text).length>MAX_BYTES)throw Error('This file is too large. Choose a file under 16 MB.');try{return JSON.parse(text);}catch{throw Error('This file is not valid JSON. Nothing was imported.');}}
const strings = v => Array.isArray(v)&&v.every(s=>typeof s==='string');
export function validateEntry(e){
 if(!isObject(e)||typeof e.id!=='string'||!e.id||e.id.length>200)throw Error('An entry has no valid identifier. Nothing was imported.');
 if(!Object.hasOwn(KINDS,e.kind))throw Error('This entry kind is not supported yet. Keep the original file.');
 for(const k of ['title','date','notes','reflection','createdAt','updatedAt'])if(typeof e[k]!=='string')throw Error('An entry is missing its '+k+' field. Nothing was imported.');
 if(!validDate(e.date)||!Number.isFinite(Date.parse(e.createdAt))||!Number.isFinite(Date.parse(e.updatedAt)))throw Error('An entry contains an invalid date. Nothing was imported.');
 if(!Array.isArray(e.anchors)||!Array.isArray(e.links)||!strings(e.tags)||!strings(e.scriptureRefs))throw Error('An entry contains invalid references, links, or tags.');
 for(const a of e.anchors){if(!isObject(a)||!['scripture','topic','book'].includes(a.kind))throw Error('An entry contains an unsupported anchor.');if(a.kind==='topic'&&typeof a.topicId!=='string')throw Error('Invalid topic anchor.');if(a.kind!=='topic'&&typeof a.book!=='string')throw Error('Invalid book anchor.');if(a.kind==='scripture'&&!['chapterStart','chapterEnd','verseStart','verseEnd'].every(k=>Number.isInteger(a[k])&&a[k]>0))throw Error('Invalid Scripture anchor.');}
 for(const l of e.links)if(!isObject(l)||typeof l.url!=='string')throw Error('An entry contains an invalid link.');
 for(const k of ['place','speaker','sermonSeries','prayer'])if(e[k]!==undefined&&typeof e[k]!=='string')throw Error('An entry contains an invalid '+k+' field.');
 if(e.sourceMaterial!==undefined){const m=e.sourceMaterial;if(!isObject(m)||typeof m.body!=='string'||typeof m.filename!=='string'||typeof m.importedAt!=='string'||!['txt','markdown','pdf','docx','sermon-notes-json'].includes(m.format))throw Error('Provided notes are malformed. Keep the original file.');}
 if(typeof e.forDescendants!=='boolean'||!['private','shared'].includes(e.visibility))throw Error('An entry contains invalid preferences.');
 return e;
}
export function validateDraft(d){if(!isObject(d)||typeof d.id!=='string'||!d.id||!isObject(d.form))throw Error('An unfinished draft is malformed. Keep the original file.');const f=d.form;for(const k of ['kind','title','date','place','speaker','sermonSeries','notes','reflection','prayer','tagsText'])if(typeof f[k]!=='string')throw Error('A draft is missing '+k+'. Nothing was imported.');if(!Object.hasOwn(KINDS,f.kind)||!Array.isArray(f.links)||!Array.isArray(f.anchors)||!strings(f.scriptureRefs))throw Error('A draft has an unsupported shape.');return d;}
export function validateJourney(raw){if(!isObject(raw)||raw.format!=='journey-export'||raw.version!==1||!Array.isArray(raw.entries))throw Error('Choose a My Life With Christ journal export (version 1).');if(raw.entries.length>5000)throw Error('Please export fewer than 5,000 entries at a time.');const ids=new Set();for(const e of raw.entries){validateEntry(e);if(ids.has(e.id))throw Error('This file repeats an entry identifier. Nothing was imported.');ids.add(e.id);}if(raw.drafts!==undefined&&!Array.isArray(raw.drafts))throw Error('The draft list is malformed.');const draftIds=new Set();if((raw.drafts||[]).length>5000)throw Error('Choose fewer than 5,000 drafts at a time.');for(const d of raw.drafts||[]){validateDraft(d);if(draftIds.has(d.id))throw Error('This file repeats a draft identifier. Nothing was imported.');draftIds.add(d.id);}return raw;}
export function makeJourney(entries,drafts=[],partial=false){const out={format:'journey-export',version:1,exportedAt:new Date().toISOString(),...(partial?{filter:{}}:{}),entries:clone(entries),...(drafts.length?{drafts:clone(drafts)}:{})};validateJourney(out);if(enc.encode(JSON.stringify(out)).length>MAX_BYTES)throw Error('Choose fewer entries for this transfer (16 MB maximum).');return out;}
export function validateSermon(raw){if(!isObject(raw)||raw.format!==SERMON_FORMAT||raw.version!==1)throw Error('Choose a sermon-notes file in version 1.');if(typeof raw.bodyMarkdown!=='string'||!raw.bodyMarkdown.trim())throw Error('Add the provided notes before downloading this pack.');if(raw.bodyMarkdown.length>200000)throw Error('Provided notes must be under 200,000 characters.');for(const k of ['title','church','speaker'])if(raw[k]!==undefined&&typeof raw[k]!=='string')throw Error('The '+k+' field must be text.');if(raw.date&&!validDate(raw.date))throw Error('Choose a real sermon date.');if(raw.scripture!==undefined&&!strings(raw.scripture))throw Error('Scripture references must be text.');if(raw.scripture&&(raw.scripture.length>25||raw.scripture.some(s=>s.length>200)))throw Error('Use at most 25 Scripture references, each under 200 characters, so the app can retain them all.');if(enc.encode(JSON.stringify(raw)).length>8*1024*1024)throw Error('A Sermon Pack must be under 8 MB.');return raw;}
export async function sermonEntry(raw,filename,bytes){const {material,suggested}=await packMaterial(raw,filename,bytes);const e=newEntry('sermon');e.title=suggested.title;e.date=suggested.date||e.date;e.place=suggested.church;e.speaker=suggested.speaker;e.scriptureRefs=suggested.scripture;e.sourceMaterial=material;return e;}
export function planImport(incoming,existing){const mine=new Map(existing.map(e=>[e.id,e]));return incoming.map(e=>{const hasCopy=existing.some(saved=>{if(saved._unmigrated?.companionOriginalId!==e.id)return false;const copy=clone(saved);copy.id=e.id;delete copy._unmigrated.companionOriginalId;if(!Object.keys(copy._unmigrated).length&&!e._unmigrated)delete copy._unmigrated;return same(e,copy);});return {entry:e,status:hasCopy?'duplicate':!mine.has(e.id)?'new':same(e,mine.get(e.id))?'duplicate':'conflict'};});}
/**
 * Fields that belong to an Entry and never inside a draft form.
 *
 * The native app's DraftForm carries `tagsText` — the raw string as typed, not
 * split into tags until a save asks for that — and has no `tags`, `visibility`
 * or `updatedAt`. Spreading a whole entry into `form` used to carry all three
 * across, which the app preserved into `_unmigrated.form` and then warned about
 * three times for every single draft transferred. The complete entry is still
 * kept verbatim in `_unmigrated.companionEntry`, so holding the form to its
 * contract loses nothing.
 *
 * Only these three are removed. Unknown fields are deliberately NOT filtered: a
 * form field written by a newer edition has to ride along, and a whitelist here
 * would destroy exactly the data the preservation contract promises to keep.
 */
/*
 * `_unmigrated` and `source` joined the list later, for the same reason. Both
 * are entry-level records — preserved data and import provenance — with no
 * place in the app's DraftForm, so a form carrying them drew a warning per
 * draft. Every conflict copy the companion makes has `_unmigrated`, and once
 * reference notes lived there every entry with one did too. The whole entry is
 * still kept verbatim in `_unmigrated.companionEntry`, which is where
 * `draftEntry` restores them from.
 */
const ENTRY_ONLY_FORM_FIELDS=['tags','visibility','updatedAt','_unmigrated','source'];
const formWithoutEntryFields=form=>{const out={...form};for(const key of ENTRY_ONLY_FORM_FIELDS)delete out[key];return out;};
export function entryDraft(entry,prior){const {id,createdAt,tags:_tags,visibility:_visibility,updatedAt:_updatedAt,_unmigrated:_unmigrated,source:_source,...rest}=entry;return {...(prior?clone(prior):{}),id:prior?.id||crypto.randomUUID(),...(prior?.entryId?{entryId:prior.entryId}:{}),createdAt:prior?.createdAt||createdAt,updatedAt:new Date().toISOString(),form:{...(prior?.form?formWithoutEntryFields(clone(prior.form)):{}),...rest,links:entry.links.map(link=>({...clone(link),label:typeof link.label==='string'?link.label:'',capturedTitle:typeof link.capturedTitle==='string'?link.capturedTitle:''})),tagsText:entry.tags.join(', '),sourceMaterial:entry.sourceMaterial||null},_unmigrated:{...(prior?._unmigrated||{}),companionEntry:clone(entry)}};}
export function draftEntry(d){validateDraft(d);const prior=d._unmigrated?.companionEntry;const e=prior&&isObject(prior)?clone(prior):newEntry(d.form.kind);for(const k of ['kind','title','date','place','speaker','sermonSeries','notes','reflection','prayer','anchors','scriptureRefs','links','forDescendants'])if(d.form[k]!==undefined)e[k]=clone(d.form[k]);e.tags=d.form.tagsText.split(',').map(s=>s.trim()).filter(Boolean);
 // The form is the newer statement. A null here means the reader removed the provided notes, so a copy kept on the carried entry must not bring them back.
 if(d.form.sourceMaterial)e.sourceMaterial=clone(d.form.sourceMaterial);else delete e.sourceMaterial;return e;}
export async function sha256(bytes){const b=typeof bytes==='string'?enc.encode(bytes):bytes;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');}
function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
function unb64(s,maxBytes){
 if(typeof s!=='string'||s.length>4*Math.ceil(maxBytes/3)||s.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw Error('Invalid protected file.');
 let bytes;try{bytes=Uint8Array.from(atob(s),c=>c.charCodeAt(0));}catch{throw Error('Invalid protected file.');}
 if(bytes.length>maxBytes||b64(bytes)!==s)throw Error('Invalid protected file.');return bytes;
}
const AAD=enc.encode('lwc-companion-protected:1:PBKDF2-SHA256:600000:AES-256-GCM');
function passwordBytes(pass){if(typeof pass!=='string')throw Error('Enter the file password.');return enc.encode(pass);}
async function key(pass,salt,usage){const material=await crypto.subtle.importKey('raw',passwordBytes(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:600000},material,{name:'AES-GCM',length:256},false,[usage]);}
export function validateProtected(raw){
 if(!isObject(raw)||raw.format!=='lwc-companion-protected'||raw.version!==1||raw.kdf!=='PBKDF2-SHA256'||raw.iterations!==600000||raw.cipher!=='AES-256-GCM')throw Error('This protected file version is not supported.');
 if(enc.encode(JSON.stringify(raw)).length>MAX_BYTES)throw Error('Choose a protected file smaller than 16 MB.');
 const salt=unb64(raw.salt,16),iv=unb64(raw.iv,12),data=unb64(raw.data,MAX_PROTECTED_BYTES+16);
 if(salt.length!==16||iv.length!==12||data.length<16)throw Error('Invalid protected file.');return {salt,iv,data};
}
export async function protect(journey,pass){
 if(typeof pass!=='string'||pass.length<12)throw Error('Use a password of at least 12 characters.');passwordBytes(pass);validateJourney(journey);
 const bytes=enc.encode(JSON.stringify(journey));if(bytes.length>MAX_PROTECTED_BYTES)throw Error('Choose fewer entries for this protected transfer (11 MB maximum).');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:AAD,tagLength:128},await key(pass,salt,'encrypt'),bytes));
 return {format:'lwc-companion-protected',version:1,kdf:'PBKDF2-SHA256',iterations:600000,cipher:'AES-256-GCM',salt:b64(salt),iv:b64(iv),data:b64(cipher)};
}
export async function unprotect(raw,pass){
 const {salt,iv,data}=validateProtected(raw);passwordBytes(pass);
 try{const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:AAD,tagLength:128},await key(pass,salt,'decrypt'),data);return validateJourney(parseJSON(dec.decode(plain)));}
 catch{throw Error('Could not unlock this file. Check the password and that the file is complete.');}
}
// Readable copies are for sharing. Private fields require an explicit inclusion choice.
export function markdown(entry,{reflection=false,prayer=false,provided=true}={}){
 const {main,references}=scriptureOf(entry);
 const parts=['# '+(entry.title||'Untitled entry'),'',entry.date+' · '+KINDS[entry.kind],''];
 if(main)parts.push('Main Scripture: '+main);
 for(const link of entry.links||[])if(isObject(link)&&typeof link.url==='string')parts.push('Link: '+link.url+(link.capturedTitle||link.label?' — '+(link.capturedTitle||link.label):''));
 if(main||(entry.links||[]).length)parts.push('');
 // Reference notes are the reader's own words about other passages, so they travel with My notes rather than behind a private-field choice.
 const referenceText=references.map(r=>'**'+(r.reference||'Reference')+'**'+(r.note?' — '+r.note:'')).join('\n\n');
 for(const [label,value] of [['Provided notes',provided&&entry.sourceMaterial?.body],['My notes',entry.notes],['Reference notes',referenceText],['My reflection',reflection&&entry.reflection],['My prayer',prayer&&entry.prayer]])if(value)parts.push('## '+label,'',value,'');return parts.join('\n');
}
export function safeURL(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.hash)throw Error();return u.href;}catch{throw Error('Use a public HTTPS link without a password or a fragment.');}}
// Recovery accepts unfinished public outlines but never bypasses publication validation.
export function readPackDraft(raw){
 if(!isObject(raw)||raw.format!==SERMON_FORMAT||raw.version!==1||typeof raw.bodyMarkdown!=='string')throw Error('Choose a version 1 church draft or Sermon Pack JSON file.');
 if(raw.bodyMarkdown.length>200000||enc.encode(JSON.stringify(raw)).length>8*1024*1024)throw Error('This church draft exceeds the supported file size.');
 validateSermon({...raw,bodyMarkdown:raw.bodyMarkdown.trim()?raw.bodyMarkdown:'Unfinished draft'});
 // Restore only the supported public fields. Unknown fields could contain private data.
 return {format:SERMON_FORMAT,version:1,title:raw.title||'',church:raw.church||'',speaker:raw.speaker||'',date:raw.date||'',scripture:clone(raw.scripture||[]),bodyMarkdown:raw.bodyMarkdown};
}
