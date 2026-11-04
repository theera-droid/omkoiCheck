import express from 'express';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {updateOmkoi} from './omkoi.js';
export function createApp({fetchImpl=fetch,cachePath=process.env.CACHE_PATH||fileURLToPath(new URL('../.cache/availability.json',import.meta.url)),pollMs=30000,allowedOrigin=process.env.ALLOWED_ORIGIN||'https://theera-droid.github.io',updateImpl=updateOmkoi}={}){
  const app=express();
  const clients=new Set();
  let snapshot={site:'omkoi',state:'checking',records:[],message:'กำลังตรวจสถานะต้นทาง',expectedOpening:'2026-11-04'},pending=null,next=0,closed=false,timer;
  app.use('/api',(_req,res,nextHandler)=>{
    res.set({'Access-Control-Allow-Origin':allowedOrigin,'Cache-Control':'no-store'});
    nextHandler();
  });
  const ready=(async()=>{if(cachePath)try{const data=JSON.parse(await readFile(cachePath,'utf8'));if(data.site==='omkoi')snapshot={...data,records:(data.records??[]).map(row=>({...row,stale:true}))};}catch{}})();
  const message=()=>`data: ${JSON.stringify(snapshot)}\n\n`;
  function publish(){for(const client of clients)if(!client.write(message()))client.destroy();}
  function refresh(){
    if(closed||pending||Date.now()<next)return pending;
    clearTimeout(timer);
    pending=(async()=>{
      await ready;
      snapshot=await updateImpl({previous:snapshot,fetchImpl,onProgress:partial=>{snapshot=partial;publish();}});
      if(cachePath)try{await mkdir(dirname(cachePath),{recursive:true});await writeFile(cachePath+'.tmp',JSON.stringify(snapshot));await rename(cachePath+'.tmp',cachePath);}catch{console.warn('Could not save local cache');}
      publish();
    })().catch(()=>{
      snapshot={...snapshot,state:'unavailable',message:'ตรวจข้อมูลไม่สำเร็จ กำลังรอลองใหม่',records:snapshot.records.map(row=>({...row,stale:true}))};
      publish();
    }).finally(()=>{
      pending=null;next=Date.now()+pollMs;
      if(!closed){timer=setTimeout(()=>{next=0;refresh();},pollMs);timer.unref();}
    });
    return pending;
  }
  app.get('/api/omkoi',async(_req,res)=>{await ready;refresh();res.set('Cache-Control','no-store').json(snapshot);});
  app.get('/api/omkoi/events',async(req,res)=>{
    await ready;
    if(closed)return res.sendStatus(503);
    res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    res.flushHeaders();
    res.write('retry: 3000\n\n'+message());
    clients.add(res);
    const heartbeat=setInterval(()=>{if(!res.write(': heartbeat\n\n'))res.destroy();},15000);
    heartbeat.unref();
    res.on('close',()=>{clearInterval(heartbeat);clients.delete(res);});
    refresh();
  });
  app.get('/api/health',(_req,res)=>res.json({status:closed?'stopping':'ok',site:'omkoi'}));
  app.use('/api',(_req,res)=>res.status(404).json({error:'Not found'}));
  app.use(express.static(fileURLToPath(new URL('../dist/',import.meta.url))));
  app.locals.warm=refresh;
  app.locals.close=async()=>{closed=true;clearTimeout(timer);for(const client of clients)client.end();clients.clear();await pending;};
  return app;
}
