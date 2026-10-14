import {makeJourney,parseJSON} from './core.js';
import {exportEnvelopeMetadata} from './envelope-metadata.js';
export function prepareJournalExport(entries,drafts,{totalEntries=entries.length,totalDrafts=drafts.length,metadata=[],allowEmpty=false}={}){
 if(!entries.length&&!drafts.length&&!allowEmpty)throw Error('Choose at least one entry or unfinished draft.');
 const partial=entries.length!==totalEntries||drafts.length!==totalDrafts;
 let out=makeJourney(entries,drafts,partial);
 // Opaque root fields may contain other people's or unselected private writing.
 // Keep them in full backups only; never silently add them to a selection.
 if(!partial)out={...out,...exportEnvelopeMetadata(metadata)};
 parseJSON(JSON.stringify(out));return out;
}
