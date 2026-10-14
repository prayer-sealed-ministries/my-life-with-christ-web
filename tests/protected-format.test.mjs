import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {unprotect,protect,validateProtected,markdown,entryDraft,newEntry} from '../dist/core.js';
const read=async name=>JSON.parse(await readFile(new URL('./fixtures/'+name,import.meta.url),'utf8'));
const [protectedFile,journey,{password}]=await Promise.all(['protected-v1.lwc','protected-v1.journey.json','protected-v1.metadata.json'].map(read));
test('independent Node/OpenSSL known-answer fixture decrypts with browser Web Crypto and preserves unknown metadata and drafts',async()=>assert.deepEqual(await unprotect(protectedFile,password),journey));
test('protected metadata, salts, nonce, tag and noncanonical encodings are rejected',async()=>{
 for(const field of ['salt','iv','data']){const bytes=Buffer.from(protectedFile[field],'base64');bytes[0]^=1;await assert.rejects(unprotect({...protectedFile,[field]:bytes.toString('base64')},password));}
 for(const bad of [{version:2},{iterations:600001},{cipher:'AES-CBC'},{kdf:'PBKDF2-SHA1'},{salt:protectedFile.salt.replace(/=+$/,'')},{iv:'!'},{data:'AAAA'},{salt:'AAAAAAAAAAAAAAAAAAAAAB=='}])assert.throws(()=>validateProtected({...protectedFile,...bad}));
 await assert.rejects(unprotect(protectedFile,password.normalize('NFD')));await assert.rejects(unprotect(protectedFile,' '+password));
 assert.deepEqual(await unprotect(await protect(journey,'x'.repeat(1025)),'x'.repeat(1025)),journey);
});
test('readable sharing excludes reflection/prayer by default and explicit choices include only selected fields',()=>{const e=journey.entries[0];assert.ok(!markdown(e).includes(e.reflection));assert.ok(!markdown(e).includes(e.prayer));assert.ok(markdown(e,{reflection:true}).includes(e.reflection));assert.ok(!markdown(e,{reflection:true}).includes(e.prayer));assert.ok(markdown(e,{prayer:true}).includes(e.prayer));});
test('continuing a draft retains unknown draft-level metadata',()=>{const prior={...entryDraft(newEntry()),futureDraft:{keep:true}};prior.form.futureForm={keep:true};const updated=entryDraft(newEntry(),prior);assert.deepEqual(updated.futureDraft,{keep:true});assert.deepEqual(updated.form.futureForm,{keep:true});});
test('size limits reject oversized plaintext/envelopes and large canonical Base64 avoids regex stack overflow',async()=>{
 const large=structuredClone(journey);large.entries[0].notes='x'.repeat(11*1024*1024);await assert.rejects(protect(large,password),/11 MB/);
 const maxCipher=Buffer.alloc(11*1024*1024+16).toString('base64');assert.equal(validateProtected({...protectedFile,data:maxCipher}).data.length,11*1024*1024+16);
 assert.throws(()=>validateProtected({...protectedFile,data:maxCipher+'AAAA'}),/Invalid protected file/);assert.throws(()=>validateProtected({...protectedFile,padding:'x'.repeat(16*1024*1024)}),/16 MB/);
});
