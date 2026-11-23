import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate,rounded,validate,mergeRecords,parseBackup,HEADER,fromRows,row,liftKey} from '../core.js';
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
test('Sheets rows roundtrip; unexpected headers and corrupt rows fail closed',()=>{
  assert.deepEqual(fromRows([HEADER,row(r),row(r)]),[r]);
  assert.throws(()=>fromRows([['name'],row(r)]),/header/);
  assert.throws(()=>fromRows([HEADER,[r.id,'Squat','bad',1,1,r.createdAt]]));
  assert.equal(liftKey('  BACK squat  '),'back squat');
});
