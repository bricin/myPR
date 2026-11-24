import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate,rounded,validate,mergeRecords,parseBackup,liftKey} from '../core.js';
const r={id:'test-record-01',lift:'Back squat',weight:225,sets:3,reps:5,createdAt:'2026-11-23T12:00:00.000Z'};
test('actual singles stay exact; Epley and Brzycki differ at five reps',()=>{
  assert.equal(estimate(225,1),225);assert.equal(estimate(225,1,'brzycki'),225);
  assert.equal(estimate(225,5),262.5);assert.equal(estimate(225,5,'brzycki'),253.125);
  assert.equal(estimate(225,11),null);assert.equal(estimate(225,37,'brzycki'),null);
});
test('round total weight to nearest supported increment; ties go up',()=>{
  assert.equal(rounded(253.125*.8,2.5),202.5);assert.equal(rounded(202.5,5),205);assert.equal(rounded(225,10),230);
});
test('invalid inputs rejected before writing',()=>{
  for(const change of [{weight:0},{weight:NaN},{weight:10001},{sets:0},{sets:1.5},{reps:0},{reps:101},{createdAt:'bad'},{lift:''},{id:'bad'}]) assert.throws(()=>validate({...r,...change}));
  assert.equal(validate({...r,reps:100}).reps,100);
});
test('merge is idempotent and preserves concurrent additions',()=>{
  const second={...r,id:'test-record-02',weight:250};
  assert.deepEqual(mergeRecords([r],[r,second],[second]),[r,second]);
  assert.throws(()=>mergeRecords([r],[{...r,weight:300}]),/Conflicting/);
});
test('backup roundtrip validates version and prevents partial imports',()=>{
  const text=JSON.stringify({format:'pr-pocket',version:1,records:[r,r]});
  assert.deepEqual(parseBackup(text),[r]);
  assert.throws(()=>parseBackup(JSON.stringify({format:'pr-pocket',version:2,records:[r]})));
  assert.throws(()=>parseBackup(JSON.stringify({format:'pr-pocket',version:1,records:[r,{...r,id:'test-record-02',weight:-1}]})));
});
test('lift names normalize without changing saved display spelling',()=>{assert.equal(liftKey('  BACK squat  '),'back squat');});

test('lift dates default to local today and reject invalid calendar dates',async()=>{
  const {liftDate,localDate}=await import('../core.js');
  const now=new Date(2026,10,23,23,30);
  assert.equal(localDate(now),'2026-11-23');assert.equal(liftDate('',now),'2026-11-23');assert.equal(liftDate(undefined,now),'2026-11-23');
  assert.equal(liftDate('2024-02-29'),'2024-02-29');
  for(const date of ['2026-02-29','2026-02-30','2026-13-01','11/23/2026',null,123])assert.throws(()=>liftDate(date));
});
test('backdated entries sort by lift day and dates survive backup roundtrips',async()=>{
  const backdated={...r,id:'backdated-record',performedOn:'2020-01-01',createdAt:'2026-11-24T12:00:00.000Z'};
  assert.deepEqual(mergeRecords([r,backdated]),[backdated,r]);
  assert.deepEqual(parseBackup(JSON.stringify({format:'pr-pocket',version:1,records:[backdated,r]})),[backdated,r]);
});

test('recent window includes exactly 365 local calendar days and excludes future lifts',async()=>{
  const {recentRecords}=await import('../core.js');const now=new Date(2026,10,23,23,30);
  const dated=(id,day)=>({...r,id,performedOn:day});
  const today=dated('today-record','2026-11-23'),edge=dated('edge-record','2025-11-24'),old=dated('old-record','2025-11-23'),future=dated('future-record','2026-11-24');
  assert.deepEqual(recentRecords([old,edge,today,future],365,now),[edge,today]);
  assert.deepEqual(recentRecords([edge,today],1,now),[today]);
  // DST does not affect comparisons of local calendar days.
  assert.equal(recentRecords([dated('dst-record','2026-03-07')],3,new Date(2026,2,9,0,5)).length,1);
});
test('recent estimates and rep PRs are distinct; old all-time records do not leak in',async()=>{
  const {recentSummary}=await import('../core.js');const now=new Date(2026,10,23);
  const old={...r,id:'old-single',weight:315,reps:1,performedOn:'2019-01-01'};
  const recent={...r,id:'recent-five',weight:245,reps:5,performedOn:'2026-11-01'};
  const single={...r,id:'recent-single',weight:280,reps:1,performedOn:'2026-10-01'};
  const high={...r,id:'high-reps',weight:300,reps:12,performedOn:'2026-11-02'};
  const result=recentSummary([old,recent,single,high],{reps:5,now});
  assert.equal(result.oneRM.record.id,recent.id);assert.ok(Math.abs(result.oneRM.value-285.833333)<.001);assert.equal(result.pr.id,recent.id);
  assert.equal(recentSummary([old,recent,single],{formula:'brzycki',now}).oneRM.record.id,single.id);
  assert.equal(recentSummary([old],{now}).oneRM,null);assert.equal(recentSummary([recent],{reps:1,now}).pr,null);
  assert.equal(recentSummary([high],{reps:12,now}).pr.id,high.id);assert.equal(recentSummary([high],{now}).oneRM,null);
});
test('window setting validates and tied recent performances use the later lift',async()=>{
  const {recentDays,recentSummary}=await import('../core.js');assert.equal(recentDays('365'),365);
  for(const days of ['',0,-1,1.5,3651,'bad'])assert.throws(()=>recentDays(days));
  const a={...r,id:'tie-early',performedOn:'2026-11-01'},b={...r,id:'tie-later',performedOn:'2026-11-02'};
  const summary=recentSummary([b,a],{reps:5,now:new Date(2026,10,23)});assert.equal(summary.oneRM.record.id,b.id);assert.equal(summary.pr.id,b.id);
});
