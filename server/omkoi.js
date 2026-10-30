export const OMKOI_URL = 'https://wildlifesanctuaryfca16.com/omkoi/reservation';
const ROOT = 'https://wildlifesanctuaryfca16.com';
const EXPECTED = '2026-11-03';
const asDate = (y,m,d) => new Date(Date.UTC(y,m,d)).toISOString().slice(0,10);
export function bangkokDate(now) { return new Date(now+7*3600000).toISOString().slice(0,10); }

// Parse only the calendar rule structure actually observed on the source page.
// A changed/unknown structure is not treated as an open day.
export function parseOmkoiCalendar(js, today) {
  const range=js.match(/minDate:\(0,[\w$]+\.[\w$]+\)\(new Date,(\d+)\),maxDate:new Date\("(\d{4}-\d{2}-\d{2})"\)/);
  const rule=js.match(/tileDisabled:\(\{[^}]*date:([\w$]+)[^}]*\}\)=>([^}]+)/);
  if(!range || !rule || Number(range[1])>60) throw new Error('ต้นทางเปลี่ยนรูปแบบปฏิทิน ต้องตรวจการเชื่อมต่อก่อนอ่านยอด');
  const prefix=`3===${rule[1]}.getDay()`;
  if(!rule[2].startsWith(prefix))throw new Error('ยังอ่านเงื่อนไขวันปิดจากต้นทางไม่ได้');
  let tail=rule[2].slice(prefix.length);
  const allowed=[], blocked=[];
  while(tail) {
    const token=tail.match(/^(\&\&!|\|\|)[\w$]+\(([\w$]+),new Date\((\d{4}),(\d{1,2}),(\d{1,2})\)\)/);
    if(!token || token[2]!==rule[1])throw new Error('เงื่อนไขวันเปิดปิดเปลี่ยนไป ต้องตรวจสอบก่อน');
    (token[1]==='&&!'?allowed:blocked).push(asDate(+token[3],+token[4],+token[5]));
    tail=tail.slice(token[0].length);
  }
  const [year,month,day]=today.split('-').map(Number);
  const start=asDate(year,month-1,day+Number(range[1]));
  const end=range[2];
  if(end<EXPECTED || end<start)return null;
  if(Date.parse(end)-Date.parse(start)>200*86400000)throw new Error('ช่วงวันที่จากต้นทางยาวผิดปกติ');
  const dates=[];
  for(let date=new Date(start+'T00:00:00Z');date<=new Date(end+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+1)) {
    const key=date.toISOString().slice(0,10);
    if((date.getUTCDay()!==3 || allowed.includes(key)) && !blocked.includes(key))dates.push(key);
  }
  return {start,end,dates};
}
export function parseOmkoiQuantity(body,date,checkedAt) {
  const d=body?.data;
  if(body?.status!=='success' || !Number.isInteger(d?.qty) || !Number.isInteger(d?.qty_reserve) || d.qty<0 || d.qty_reserve<0 || d.qty_reserve>d.qty)throw new Error('รูปแบบยอดอมก๋อยไม่ตรงกับที่ตรวจไว้');
  return {date,available:d.qty_reserve,capacity:d.qty,status:d.qty_reserve===0?'full':d.qty_reserve<=10?'low':'available',observedAt:checkedAt,stale:false};
}
export async function updateOmkoi({previous=null,fetchImpl=fetch,now=Date.now,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
  const checkedAt=new Date(now()).toISOString();
  const priorRows=(previous?.records??[]).filter(row=>row?.date>=EXPECTED && Number.isInteger(row.available) && row.available>=0 && Number.isInteger(row.capacity) && row.capacity>=row.available && Number.isFinite(Date.parse(row.observedAt))).map(row=>({...row,stale:true}));
  const base={version:1,site:'omkoi',sourceUrl:OMKOI_URL,expectedOpening:EXPECTED,checkedAt,bookingOpen:null,records:priorRows,calendar:previous?.calendar??null};
  const get=async(url,json=true)=>{
    const r=await fetchImpl(url,{signal:AbortSignal.timeout(10000),redirect:'error'});
    if(!r.ok)throw Object.assign(new Error(`ต้นทางตอบ HTTP ${r.status}`),{status:r.status});
    return json?r.json():r.text();
  };
  try {
    const opening=await get(ROOT+'/api/omkoi/open');
    if(typeof opening?.data?.open!=='boolean')throw new Error('ยังอ่านสถานะเปิดรับจองไม่ได้');
    base.bookingOpen=opening.data.open;
    base.sourceOpening=opening.data.time_open??null;
    const today=bangkokDate(now());
    if(today<EXPECTED || !base.bookingOpen)return {...base,state:'waiting',message:today<EXPECTED?'รอเปิดจอง 3 พฤศจิกายน 2569 ตามกำหนดที่แจ้ง':'ต้นทางยังปิดรับจอง ระบบจะตรวจซ้ำอัตโนมัติ'};
    const html=await get(OMKOI_URL,false);
    const paths=[...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]).filter(p=>/^\/_next\/static\/chunks\/(?:\d+-|app\/omkoi\/reservation\/page-)/.test(p));
    let calendar=null,found=false;
    for(const path of [...new Set(paths)].slice(0,20)) {
      const js=await get(ROOT+path,false);
      if(js.includes('omkoi/reservation/check-qty-people') && js.includes('maxDate:new Date')) {found=true;calendar=parseOmkoiCalendar(js,today);break;}
    }
    if(!found)throw new Error('ยังไม่พบปฏิทินฤดูกาลใหม่ในหน้าเว็บต้นทาง');
    if(!calendar)return {...base,state:'waiting',message:'ต้นทางยังแสดงฤดูกาลเดิม รอข้อมูลฤดูกาลใหม่โดยไม่ใช้ยอดเก่าแทน'};
    base.calendar=calendar;
    const records=new Map(priorRows.filter(row=>calendar.dates.includes(row.date)).map(row=>[row.date,row]));
    let failures=0,stop=false;
    for(let i=0;i<calendar.dates.length && !stop;i+=3) {
      const batch=calendar.dates.slice(i,i+3);
      const results=await Promise.allSettled(batch.map(async date=>parseOmkoiQuantity(await get(ROOT+'/api/omkoi/reservation/check-qty-people?start_date='+date),date,new Date(now()).toISOString())));
      results.forEach((r,j)=>{
        if(r.status==='fulfilled'){records.set(batch[j],r.value);failures=0;}
        else {failures++;if([401,403,429].includes(r.reason.status))stop=true;}
      });
      if(failures>=3)stop=true;
      if(i+3<calendar.dates.length && !stop)await pause(1250);
    }
    base.records=[...records.values()];
    const complete=base.records.length===calendar.dates.length && base.records.every(row=>!row.stale);
    return {...base,state:complete?'ready':'partial',message:complete?'ยอดจากระบบอมก๋อย ณ เวลาที่ระบุ':'อ่านยอดได้ไม่ครบ ยอดเก่ามีป้ายกำกับและจะลองใหม่รอบถัดไป'};
  } catch(error) {return {...base,state:'unavailable',message:error.message+' · จะตรวจใหม่อัตโนมัติ ไม่ใช้ศูนย์แทนยอดที่อ่านไม่ได้'};}
}
