<script setup>
import { computed,onMounted,onUnmounted,ref } from 'vue';
const pagesMode=import.meta.env.VITE_PAGES==='true';
const payload=ref(null),error=ref(''),busy=ref(false),month=ref(''),selected=ref(''),clock=ref(Date.now());
const view=ref('log');
const history=computed(()=>payload.value?.history??[]);
const latest=computed(()=>history.value[0]);
const thaiDate=value=>new Date(value+'T12:00:00+07:00').toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'});
const time=value=>value?new Date(value).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'})+' น.':'—';
const observedDate=value=>new Date(value).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Bangkok'});
function duration(start,end=clock.value){
  const minutes=Math.max(0,Math.floor((new Date(end).getTime()-Date.parse(start))/60000));
  if(minutes<1)return 'ไม่ถึง 1 นาที';
  const days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),rest=minutes%60;
  return [days?days+' วัน':'',hours?hours+' ชม.':'',rest?rest+' นาที':''].filter(Boolean).join(' ');
}
function confirmed(event){const row=rows.value.get(event.date);return !event.closedAt&&payload.value?.bookingOpen===true&&row?.available>0&&!old(row);}
function eventStatus(event){return event.closedAt?'ปิดแล้ว '+time(event.closedAt):confirmed(event)?'ยังว่าง':'รอตรวจยืนยัน';}
function eventDuration(event){return duration(event.openedAt,event.closedAt??(confirmed(event)?clock.value:event.lastSeenAt));}
function showDate(date){month.value=date.slice(0,7);selected.value=date;view.value='calendar';}
let timer,tick,controller,disposed=false;
const rows=computed(()=>new Map((payload.value?.records??[]).map(row=>[row.date,row])));
const months=computed(()=>[...new Set((payload.value?.calendar?.dates??[]).map(date=>date.slice(0,7)))]);
const allowed=computed(()=>new Set(payload.value?.calendar?.dates??[]));
const active=computed(()=>rows.value.get(selected.value));
const monthLabel=computed(()=>month.value?new Date(month.value+'-01T12:00:00').toLocaleDateString('th-TH',{month:'long',year:'numeric'}):'');
const offset=computed(()=>month.value?(new Date(month.value+'-01T12:00:00').getDay()+6)%7:0);
const days=computed(()=>{
  if(!month.value)return [];
  const [y,m]=month.value.split('-').map(Number);
  return Array.from({length:new Date(y,m,0).getDate()},(_,i)=>{
    const date=month.value+'-'+String(i+1).padStart(2,'0');
    return rows.value.get(date)??{date,available:null,status:allowed.value.has(date)?'unknown':'closed'};
  });
});
const stamp=value=>value?new Date(value).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}):'ยังไม่มีข้อมูล';
const old=row=>Boolean(row?.observedAt&&(row.stale||clock.value-Date.parse(row.observedAt)>(pagesMode?600000:60000)));
function label(row){return row.status==='closed'?'ไม่เปิด':old(row)?'ยอดเก่า: '+row.available:row.available===null?'ยังไม่ทราบยอด':row.available===0?'เต็มแล้ว':'เหลือ '+row.available+' ที่';}
function changeMonth(delta){const index=months.value.indexOf(month.value)+delta;if(months.value[index]){month.value=months.value[index];selected.value=payload.value.calendar.dates.find(date=>date.startsWith(month.value));}}
async function load(){
  if(disposed)return;busy.value=true;controller=new AbortController();
  try{
    const url=pagesMode?import.meta.env.BASE_URL+'data/availability.json?t='+Date.now():'/api/omkoi';
    const response=await fetch(url,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
    if(!response.ok)throw new Error('ยังเชื่อมต่อข้อมูลไม่ได้');
    const next=await response.json();
    if(!next||next.site!=='omkoi')throw new Error('กำลังรอชุดข้อมูลอมก๋อยจากระบบ');
    if(disposed)return;
    payload.value=next;error.value='';clock.value=Date.now();
    if(!months.value.includes(month.value))month.value=months.value[0]??'';
    if(!allowed.value.has(selected.value))selected.value=next.calendar?.dates?.[0]??'';
  }catch(e){if(!disposed)error.value=e.message+' · ไม่ใช้ศูนย์แทนยอดที่อ่านไม่ได้';}
  finally{busy.value=false;if(!disposed)timer=setTimeout(load,pagesMode?30000:5000);}
}
onMounted(()=>{load();tick=setInterval(()=>clock.value=Date.now(),1000);});
onUnmounted(()=>{disposed=true;controller?.abort();clearTimeout(timer);clearInterval(tick);});
</script>
<template>
<header v-if="view==='log'" class="log-header"><button class="log-back" aria-label="ดูปฏิทิน" @click="view='calendar'">←</button><div><div class="log-eyebrow">▤ log ติดตามวันว่าง</div><h1>อมก๋อย</h1></div><span class="log-updated">ข้อมูล ณ {{time(payload?.checkedAt)}}</span></header>
<header v-else><div class="brand"><span aria-hidden="true">△</span> OMKOI</div><button class="view-switch" @click="view='log'">ดู log วันว่าง →</button></header>
<main v-if="view==='log'" class="log-main">
  <p v-if="error" class="omkoi-alert" role="alert">{{error}}</p>
  <p v-if="payload && payload.state!=='ready'" class="omkoi-alert">{{payload.message}}</p>
  <section class="log-card latest-card">
    <div class="log-label">ล่าสุดที่ว่าง</div>
    <template v-if="latest"><h2>{{thaiDate(latest.date)}}</h2><div class="log-stats">
      <div><span>ว่างตั้งแต่</span><strong>{{time(latest.openedAt)}}</strong><small>{{observedDate(latest.openedAt)}}</small></div>
      <div><span>ผ่านมานานแล้ว</span><strong>{{duration(latest.openedAt)}}</strong></div>
      <div><span>สถานะ</span><strong :class="{ 'is-open':confirmed(latest) }">{{eventStatus(latest)}}</strong></div>
      <div><span>ว่างนาน</span><strong>{{eventDuration(latest)}}</strong></div>
      <div><span>ที่ว่าง</span><strong>{{latest.available}} ที่</strong></div>
    </div></template>
    <div v-else class="log-empty"><h2>{{payload?'ยังไม่พบประวัติวันว่าง':'กำลังโหลดประวัติวันว่าง…'}}</h2><p>ระบบจะบันทึกเมื่ออ่านพบที่ว่างจากต้นทาง เริ่มเก็บประวัติตั้งแต่เปิดใช้ log</p></div>
  </section>
  <section class="log-card history-card"><h2>ทุกครั้งที่ว่าง <span>({{history.length}} ครั้ง)</span></h2>
    <div v-if="history.length" class="log-table-scroll" tabindex="0" role="region" aria-label="ประวัติวันว่าง เลื่อนตารางในแนวนอนได้"><table class="log-table"><thead><tr><th>วันที่เข้า</th><th>ว่างตั้งแต่</th><th>ผ่านมานานแล้ว</th><th>สถานะ</th><th>ว่างนาน</th><th>ที่ว่าง</th></tr></thead><tbody>
      <tr v-for="event in history" :key="event.id"><td><button class="date-link" @click="showDate(event.date)">{{thaiDate(event.date)}}</button></td><td><b>{{time(event.openedAt)}}</b><small>{{stamp(event.openedAt).split(' ')[0]}}</small></td><td>{{duration(event.openedAt)}}</td><td :class="{ 'is-open':confirmed(event) }" :title="event.closedAt?stamp(event.closedAt):'ตรวจพบล่าสุด '+stamp(event.lastSeenAt)">{{eventStatus(event)}}</td><td>{{eventDuration(event)}}</td><td>{{event.available}}</td></tr>
    </tbody></table></div><p v-else class="log-empty">ยังไม่มีรายการวันว่างที่บันทึกไว้</p>
  </section>
  <p class="log-note">เวลาเป็นเวลาที่ระบบตรวจพบในประเทศไทย · ที่ว่างคือยอดล่าสุดในช่วงที่พบว่าว่าง · หากอ่านข้อมูลไม่ได้จะรอตรวจยืนยัน ไม่ถือว่าเต็มแล้ว</p>
  <p class="log-note">ตรวจเป็นรอบ จึงอาจไม่พบช่วงที่ว่างระหว่างรอบตรวจ และไม่สามารถเรียกประวัติก่อนเริ่มบันทึกได้</p>
  <footer>เว็บไซต์อิสระ ไม่ใช่เว็บไซต์ของเขตรักษาพันธุ์สัตว์ป่าอมก๋อย · ไม่รับจอง</footer>
</main>
<main v-else>
  <section class="hero"><div class="hero-copy"><div class="eyebrow">OMKOI · NATURE TRAIL</div><h1>วางแผนวันเดินป่าอมก๋อย</h1><p>ปฏิทินวันว่างจากระบบจองทางการ<br>อ่านยอดจริงและแสดงเวลาที่ตรวจได้</p></div></section>
  <div class="notice"><b>◌ เชื่อมระบบแล้ว</b><span>ตรวจอัตโนมัติเป็นรอบประมาณ 5 นาทีหรือมากกว่า · ไม่รับจอง</span></div>
  <p v-if="error" class="omkoi-alert" role="alert">{{error}}</p>
  <section v-if="!payload?.calendar" class="calendar waiting" aria-live="polite">
    <div class="eyebrow">{{payload?.state==='unavailable'?'WAITING FOR SOURCE':'RESERVATIONS OPEN SOON'}}</div>
    <h2>รอเปิดจอง 3 พฤศจิกายน 2569</h2>
    <p>กำหนดเปิดจองตามข้อมูลที่แจ้ง · ต้องรอระบบทางการเปิดรับจองจริง</p>
    <p><b>{{payload?.message??'กำลังตรวจสถานะระบบอมก๋อย…'}}</b></p>
    <p>เมื่อระบบเปิดและตรวจพบปฏิทินฤดูกาลใหม่ จะอ่านยอดและแสดงวันว่างให้เอง</p>
    <p class="fine">ยังไม่แสดงตัวเลขของฤดูกาลเก่าเป็นยอดของรอบใหม่</p>
    <p class="source">ตรวจสถานะล่าสุด: {{stamp(payload?.checkedAt)}}</p>
  </section>
  <template v-else>
    <p v-if="payload.bookingOpen!==true || payload.state!=='ready'" class="omkoi-alert">{{payload.message}} <span v-if="payload.bookingOpen===false">· ต้นทางปิดรับจองอยู่ ยอดที่เหลือไม่ได้แปลว่าจองได้</span></p>
    <div class="layout"><section class="calendar">
      <div class="toolbar"><div class="month-nav"><button class="arrow" aria-label="เดือนก่อนหน้า" :disabled="months.indexOf(month)<=0" @click="changeMonth(-1)">‹</button><h2>{{monthLabel}}</h2><button class="arrow" aria-label="เดือนถัดไป" :disabled="months.indexOf(month)>=months.length-1" @click="changeMonth(1)">›</button></div><span class="fine">ยอดแต่ละวันมีเวลาตรวจแยกกัน</span></div>
      <div class="week"><span v-for="day in ['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.']" :key="day">{{day}}</span></div>
      <div class="days"><div v-for="n in offset" :key="'gap'+n" class="empty"></div><button v-for="row in days" :key="row.date" class="day" :class="[row.status,{selected:selected===row.date,stale:old(row)}]" :aria-label="row.date+' '+label(row)" :aria-pressed="selected===row.date" @click="selected=row.date"><strong>{{Number(row.date.slice(-2))}}</strong><small>{{label(row)}}</small></button></div>
      <div class="legend"><span><i class="dot"></i>มีที่ว่าง ณ เวลาตรวจ</span><span><i class="dot red"></i>เต็มแล้ว</span><span><i class="dot gray"></i>ไม่เปิด / ยังไม่ทราบยอด</span></div>
    </section><aside class="detail"><div class="kicker">วันที่เลือก</div><h2>{{selected?new Date(selected+'T12:00:00').toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'}):'เลือกวันที่'}}</h2><div class="availability"><div class="state">{{old(active)?'ยอดเก่า · ไม่ยืนยันยอดปัจจุบัน':'จำนวนที่เหลือ ณ เวลาตรวจ'}}</div><div class="count">{{active?.available??'—'}}<span v-if="active?.available!=null" class="unit">ที่</span></div><div class="fine">{{active?.capacity!=null?'โควตา '+active.capacity+' ที่':'ยังไม่มีข้อมูลยอดของวันนี้'}}</div></div><p class="source">ตรวจยอดเมื่อ {{stamp(active?.observedAt)}}</p></aside></div>
  </template>
  <a class="external omkoi-link" href="https://wildlifesanctuaryfca16.com/omkoi/reservation" target="_blank" rel="noopener noreferrer">เปิดเว็บไซต์จองอมก๋อยทางการ ↗</a>
  <footer>เว็บไซต์อิสระ ไม่ใช่เว็บไซต์ของเขตรักษาพันธุ์สัตว์ป่าอมก๋อย · ไม่รับจอง</footer>
</main>
</template>
<style scoped>
.waiting{padding:36px;text-align:center}.waiting h2{font-size:28px}.omkoi-alert{background:#fff3dc;color:#806124;padding:16px;border-radius:12px;margin-bottom:20px}.omkoi-link{max-width:350px;margin:24px auto}.day.unknown{background:#f5f5f0;color:#73796f}.day.stale{border-style:dashed;background:#f8f4ea;color:#84775e}
</style>
