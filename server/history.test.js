import {test} from 'node:test';
import assert from 'node:assert/strict';
import {updateHistory} from './history.js';
const row=(available,observedAt,stale=false)=>({date:'2026-12-05',available,observedAt,stale});
const snapshot=(records,bookingOpen=true)=>({records,bookingOpen});
test('records an episode, updates counts, closes it and records reopening without mutating prior history',()=>{
  const first=updateHistory(null,snapshot([row(3,'2026-11-04T03:00:00Z')]));
  const updated=updateHistory({history:first},snapshot([row(1,'2026-11-04T03:05:00Z')]));
  assert.equal(updated.length,1);assert.equal(updated[0].available,1);assert.equal(first[0].available,3);
  const closed=updateHistory({history:updated},snapshot([row(0,'2026-11-04T03:10:00Z')]));
  assert.equal(closed[0].closedAt,'2026-11-04T03:10:00Z');
  const reopened=updateHistory({history:closed},snapshot([row(2,'2026-11-04T03:15:00Z')]));
  assert.equal(reopened.length,2);assert.equal(reopened[0].closedAt,null);assert.equal(reopened[1].available,1);
});
test('outages, stale counts, missing dates and global closure do not imply full capacity',()=>{
  const history=updateHistory(null,snapshot([row(1,'2026-11-04T03:00:00Z')]));
  for(const next of [snapshot([]),snapshot([row(0,'2026-11-04T03:05:00Z',true)]),snapshot([row(0,'2026-11-04T03:05:00Z')],false)]) {
    assert.deepEqual(updateHistory({history},next),history);
  }
  assert.deepEqual(updateHistory(null,snapshot([row(0,'2026-11-04T03:00:00Z')])),[]);
});
