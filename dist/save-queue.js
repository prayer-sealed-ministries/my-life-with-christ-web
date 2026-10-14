// Serialize local snapshots. A completed older write never announces that newer text is saved.
export function createSaveQueue(onState,onError=()=>{}){
 let tail=Promise.resolve(),pending=0,failed=false,revision=0;
 const emit=()=>onState({pending,failed});
 function enqueue(task){
  pending++;revision++;emit();
  tail=tail.then(task).then(()=>{failed=false;},error=>{failed=true;onError(error);}).finally(()=>{pending--;emit();});
  return tail;
 }
 async function settle(){let observed;do{observed=tail;await observed;}while(observed!==tail);}
 async function settledRead(read){for(;;){await settle();const observed=revision;const result=await read();if(observed===revision)return result;}}
 return {enqueue,settle,settledRead};
}
