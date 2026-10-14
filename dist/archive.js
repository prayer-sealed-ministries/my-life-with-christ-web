import {MAX_BYTES,parseJSON,validateJourney,sha256} from './core.js';
// The companion accepts the app's archive, with explicit expansion limits.
export async function readJournalFile(bytes){
 if(bytes.length>MAX_BYTES)throw Error('Choose a file smaller than 16 MB.');
 if(bytes[0]!==0x50||bytes[1]!==0x4b)return validateJourney(parseJSON(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
 try{return await readArchive(bytes);}catch(e){throw Error('This archive could not be verified. Nothing was imported. '+e.message);}
}
async function readArchive(bytes){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decoder=new TextDecoder('utf-8',{fatal:true});
 let end=-1;for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(v.getUint32(p,true)===0x06054b50&&p+22+v.getUint16(p+20,true)===bytes.length){end=p;break;}
 if(end<0)throw Error('Missing ZIP directory.');
 if(v.getUint16(end+4,true)||v.getUint16(end+6,true))throw Error('Split archives are not supported.');
 const count=v.getUint16(end+10,true),dirSize=v.getUint32(end+12,true);let pos=v.getUint32(end+16,true),total=0;
 if(count>5000||count===65535||pos+dirSize!==end)throw Error('The archive directory is unsupported.');
 const files=new Map();
 for(let i=0;i<count;i++){
  if(pos+46>end||v.getUint32(pos,true)!==0x02014b50)throw Error('Invalid archive directory.');
  const flags=v.getUint16(pos+8,true),method=v.getUint16(pos+10,true),size=v.getUint32(pos+24,true),packed=v.getUint32(pos+20,true),n=v.getUint16(pos+28,true),x=v.getUint16(pos+30,true),c=v.getUint16(pos+32,true),local=v.getUint32(pos+42,true);
  if(pos+46+n+x+c>end||local+30>bytes.length||v.getUint32(local,true)!==0x04034b50)throw Error('A file header is damaged.');
  const name=decoder.decode(bytes.subarray(pos+46,pos+46+n));
  if(files.has(name)||name.startsWith('/')||name.split('/').includes('..')||name.includes('\\'))throw Error('An archive path is invalid or repeated.');
  if(flags&1||![0,8].includes(method)||size>MAX_BYTES||total+size>64*1024*1024)throw Error('The archive exceeds the supported size or compression limits.');
  const start=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true);if(start+packed>pos)throw Error('Invalid file boundaries.');
  const data=bytes.subarray(start,start+packed);let output;
  if(method===0)output=data.slice();else{
   if(typeof DecompressionStream==='undefined')throw Error('This device cannot open ZIP files. Use data/journey.json from the archive.');
   const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();const parts=[];let length=0;
   try{for(;;){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>size||length>MAX_BYTES||total+length>64*1024*1024){await reader.cancel();throw Error('Expanded file is too large.');}parts.push(r.value);}}finally{reader.releaseLock();}
   output=new Uint8Array(length);let at=0;for(const part of parts){output.set(part,at);at+=part.length;}
  }
  if(output.length!==size)throw Error('A file size does not match its directory.');total+=output.length;
  if(!name.endsWith('/'))files.set(name,output);pos+=46+n+x+c;
 }
 for(const name of ['README.txt','MANIFEST.txt','data/journey.json','data/schema.json'])if(!files.has(name))throw Error('A required archive file is missing.');
 const claims=new Map();for(const line of decoder.decode(files.get('MANIFEST.txt')).split('\n')){const m=line.trim().match(/^([0-9a-f]{64})\s+(\d+)\s+(.*)$/);if(!m)continue;if(claims.has(m[3]))throw Error('Repeated manifest claim.');claims.set(m[3],{hash:m[1],size:Number(m[2])});}
 if(claims.size<4)throw Error('The manifest is incomplete.');
 for(const [name,data] of files){if(name==='MANIFEST.txt')continue;const claim=claims.get(name);if(!claim||claim.size!==data.length||claim.hash!==await sha256(data))throw Error('A file does not match its checksum.');}
 for(const name of claims.keys())if(!files.has(name))throw Error('A listed file is missing.');
 return validateJourney(parseJSON(decoder.decode(files.get('data/journey.json'))));
}
