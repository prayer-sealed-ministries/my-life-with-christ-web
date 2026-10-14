import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSaveQueue} from '../dist/save-queue.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
test('an older completed snapshot does not announce saved while newer text is pending',async()=>{
 const states=[],first=deferred(),second=deferred(),q=createSaveQueue(state=>states.push(state));q.enqueue(()=>first.promise);q.enqueue(()=>second.promise);first.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();assert.ok(states.every(s=>s.pending>0));second.resolve();await q.settle();assert.deepEqual(states.at(-1),{pending:0,failed:false});assert.ok(states.slice(0,-1).every(s=>s.pending>0));
});
test('settle drains snapshots added while navigation is waiting',async()=>{
 const first=deferred(),second=deferred(),q=createSaveQueue(()=>{});let left=false;q.enqueue(()=>first.promise);const navigation=q.settle().then(()=>left=true);q.enqueue(()=>second.promise);first.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();assert.equal(left,false);second.resolve();await navigation;assert.equal(left,true);
});
test('failure remains truthful and a complete later snapshot can recover without blocking the queue',async()=>{
 const states=[],errors=[],q=createSaveQueue(s=>states.push(s),e=>errors.push(e.message));q.enqueue(()=>Promise.reject(Error('Full storage')));await q.settle();assert.deepEqual(states.at(-1),{pending:0,failed:true});assert.deepEqual(errors,['Full storage']);q.enqueue(()=>Promise.resolve());await q.settle();assert.deepEqual(states.at(-1),{pending:0,failed:false});
});
test('navigation re-reads storage when typing queues a save during an asynchronous refresh',async()=>{
 const reading=deferred(),saving=deferred(),q=createSaveQueue(()=>{});let reads=0,stored='old',result;
 const navigation=q.settledRead(async()=>{reads++;const snapshot=stored;if(reads===1)await reading.promise;return snapshot;}).then(value=>result=value);
 await Promise.resolve();await Promise.resolve();q.enqueue(async()=>{await saving.promise;stored='latest';});reading.resolve();await Promise.resolve();assert.equal(result,undefined);saving.resolve();await navigation;assert.equal(result,'latest');assert.equal(reads,2);
});
