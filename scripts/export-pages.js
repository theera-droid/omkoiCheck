import {mkdir,writeFile} from 'node:fs/promises';
import {updateOmkoi} from '../server/omkoi.js';
let previous=null;
if(process.env.PAGES_PREVIOUS_URL){
  const response=await fetch(process.env.PAGES_PREVIOUS_URL,{signal:AbortSignal.timeout(20000),cache:'no-store'});
  if(response.ok){previous=await response.json();if(previous.site!=='omkoi')throw new Error('Previous data is not Omkoi');}
  else if(response.status!==404)throw new Error(`Previous data HTTP ${response.status}; keeping previous deployment`);
}
const snapshot=await updateOmkoi({previous});
await mkdir(new URL('../public/data/',import.meta.url),{recursive:true});
await writeFile(new URL('../public/data/availability.json',import.meta.url),JSON.stringify(snapshot));
console.log(`Omkoi: ${snapshot.state}; last-known counts: ${snapshot.records.length}`);
