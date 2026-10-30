import test from 'node:test';
import assert from 'node:assert/strict';
import {updateOmkoi,parseOmkoiCalendar,parseOmkoiQuantity} from './omkoi.js';
const calendar=end=>`minDate:(0,o.f)(new Date,7),maxDate:new Date("${end}"),tileDisabled:({activeStartDate:e,date:t,view:l})=>3===t.getDay()&&!c(t,new Date(2025,11,31))&&!c(t,new Date(2025,11,10))||c(t,new Date(2025,10,10))}) omkoi/reservation/check-qty-people`;
const before=Date.parse('2026-11-02T18:00:00Z'); // 3 Nov, 01:00 Bangkok
test('Omkoi uses qty_reserve as remaining seats, not qty_people',()=>{
  assert.equal(parseOmkoiQuantity({status:'success',data:{qty:230,qty_people:164,qty_reserve:66}},'2026-11-10',new Date().toISOString()).available,66);
  assert.throws(()=>parseOmkoiQuantity({status:'success',data:{qty:230,qty_reserve:null}},'2026-11-10',''));
});
test('old calendar and unknown calendar rules are never treated as a new season',()=>{
  assert.equal(parseOmkoiCalendar(calendar('2026-02-15'),'2026-11-03'),null);
  assert.deepEqual(parseOmkoiCalendar(calendar('2026-11-12'),'2026-11-03').dates,['2026-11-10','2026-11-12']);
  assert.throws(()=>parseOmkoiCalendar('new unknown calendar','2026-11-03'));
});
test('before announced date and when closed, only checks opening status',async()=>{
  for(const [time,open] of [[Date.parse('2026-10-30T00:00:00Z'),true],[before,false]]){
    const urls=[];const result=await updateOmkoi({now:()=>time,fetchImpl:async url=>{urls.push(url);return Response.json({data:{open}});}});
    assert.equal(result.state,'waiting');assert.equal(result.records.length,0);assert.equal(urls.length,1);
  }
});
test('automatically reads new-season dates after opening and blocks old-season counts',async()=>{
  for(const end of ['2026-02-15','2026-11-12']){
    const requests=[];
    const result=await updateOmkoi({now:()=>before,pause:async()=>{},fetchImpl:async url=>{
      requests.push(url);
      if(url.endsWith('/open'))return Response.json({data:{open:true,time_open:'2026-11-03 00:00:00'}});
      if(url.endsWith('/reservation'))return new Response('<script src="/_next/static/chunks/1205-test.js"></script>');
      if(url.endsWith('.js'))return new Response(calendar(end));
      return Response.json({status:'success',data:{qty:230,qty_people:164,qty_reserve:66}});
    }});
    if(end==='2026-02-15'){assert.equal(result.state,'waiting');assert(!requests.some(url=>url.includes('start_date')));}
    else{assert.equal(result.state,'ready');assert.equal(result.records.length,2);assert(result.records.every(row=>row.available===66&&!row.stale));}
  }
});
test('outage retains a verified new-season count with its original time',async()=>{
  const row={date:'2026-11-10',available:66,capacity:230,observedAt:'2026-11-03T01:00:00Z'};
  const result=await updateOmkoi({now:()=>before,previous:{records:[row]},fetchImpl:async()=>{throw new Error('offline');}});
  assert.equal(result.state,'unavailable');assert.equal(result.records[0].available,66);assert.equal(result.records[0].observedAt,row.observedAt);assert.equal(result.records[0].stale,true);
});
