import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from './app.js';

async function serve(t,options){
  const app=createApp(options);
  const server=app.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(async()=>{await app.locals.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  return {app,url:`http://127.0.0.1:${server.address().port}`};
}
const result=previous=>({...previous,state:'ready',checkedAt:new Date().toISOString(),records:[],history:[]});

test('one shared poll runs without viewers and stops cleanly',async t=>{
  let calls=0,inFlight=0,maxInFlight=0;
  const {app}=await serve(t,{cachePath:null,pollMs:20,updateImpl:async({previous})=>{
    calls++;inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
    await new Promise(resolve=>setTimeout(resolve,10));inFlight--;
    return result(previous);
  }});
  await Promise.all([app.locals.warm(),app.locals.warm(),app.locals.warm()]);
  assert.equal(calls,1);
  const deadline=Date.now()+2000;
  while(calls<3&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(calls>=3);assert.equal(maxInFlight,1);
  await app.locals.close();const stopped=calls;
  await new Promise(resolve=>setTimeout(resolve,60));assert.equal(calls,stopped);
});

test('SSE delivers initial state and new snapshots with configured CORS',async t=>{
  const {url}=await serve(t,{cachePath:null,pollMs:60000,updateImpl:async({previous})=>result(previous)});
  const controller=new AbortController();t.after(()=>controller.abort());
  const response=await fetch(url+'/api/omkoi/events',{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(3000)])});
  assert.match(response.headers.get('content-type'),/text\/event-stream/);
  assert.equal(response.headers.get('access-control-allow-origin'),'https://theera-droid.github.io');
  const reader=response.body.getReader();let text='';
  while(!text.includes('"state":"ready"')){const chunk=await reader.read();assert.equal(chunk.done,false);text+=new TextDecoder().decode(chunk.value);}
  assert.match(text,/"state":"checking"/);assert.match(text,/retry: 3000/);
  await reader.cancel();controller.abort();
  const health=await fetch(url+'/api/health');assert.equal((await health.json()).status,'ok');
});

test('history persists and reloads after server restart',async t=>{
  const folder=await mkdtemp(join(tmpdir(),'omkoi-test-'));
  t.after(()=>rm(folder,{recursive:true,force:true}));
  const cachePath=join(folder,'availability.json');
  const history=[{id:'test',date:'2026-12-05',openedAt:'2026-11-04T03:00:00Z',closedAt:null,available:1}];
  const first=await serve(t,{cachePath,updateImpl:async({previous})=>({...result(previous),history})});
  await first.app.locals.warm();await first.app.locals.close();
  assert.deepEqual(JSON.parse(await readFile(cachePath,'utf8')).history,history);
  const second=await serve(t,{cachePath,updateImpl:async({previous})=>previous});
  const response=await fetch(second.url+'/api/omkoi');assert.deepEqual((await response.json()).history,history);
  await second.app.locals.close();
});
