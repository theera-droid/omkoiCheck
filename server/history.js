// Keep availability episodes across polling rounds and deployments.
export function updateHistory(previous, snapshot) {
  const history=(previous?.history??[]).map(event=>({...event}));
  const open=new Map(history.filter(event=>!event.closedAt).map(event=>[event.date,event]));
  for(const row of snapshot.records??[]) {
    if(row.stale || !row.observedAt || snapshot.bookingOpen===false)continue;
    const event=open.get(row.date);
    if(row.available>0) {
      if(event) {event.available=row.available;event.lastSeenAt=row.observedAt;}
      else {
        const next={id:row.date+'@'+row.observedAt,date:row.date,openedAt:row.observedAt,lastSeenAt:row.observedAt,closedAt:null,available:row.available};
        history.push(next);open.set(row.date,next);
      }
    } else if(row.available===0 && event) {
      event.closedAt=row.observedAt;
      open.delete(row.date);
    }
  }
  return history.sort((a,b)=>Date.parse(b.openedAt)-Date.parse(a.openedAt)||a.date.localeCompare(b.date));
}
