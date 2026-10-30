import express from 'express';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {updateOmkoi} from './omkoi.js';
export function createApp({fetchImpl=fetch,cachePath=fileURLToPath(new URL('../.cache/availability.json',import.meta.url))}={}){
  const app=express();
  let snapshot={site:'omkoi',state:'checking',records:[],message:'กำลังตรวจสถานะต้นทาง',expectedOpening:'2026-11-03'},pending=null,next=0,closed=false;
  const ready=(async()=>{if(cachePath)try{const data=JSON.parse(await readFile(cachePath,'utf8'));if(data.site==='omkoi')snapshot={...data,records:(data.records??[]).map(row=>({...row,stale:true}))};}catch{}})();
  function refresh(){
    if(closed||pending||Date.now()<next)return pending;
    pending=(async()=>{
      await ready;
      snapshot=await updateOmkoi({previous:snapshot,fetchImpl});
      if(cachePath)try{await mkdir(dirname(cachePath),{recursive:true});await writeFile(cachePath,JSON.stringify(snapshot));}catch{console.warn('Could not save local cache');}
    })().finally(()=>{pending=null;next=Date.now()+60000;});
    return pending;
  }
  app.get('/api/omkoi',async(_req,res)=>{await ready;refresh();res.set('Cache-Control','no-store').json(snapshot);});
  app.use('/api',(_req,res)=>res.status(404).json({error:'Not found'}));
  app.use(express.static(fileURLToPath(new URL('../dist/',import.meta.url))));
  app.locals.warm=refresh;
  app.locals.close=()=>{closed=true;};
  return app;
}
