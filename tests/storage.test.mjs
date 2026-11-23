import test from 'node:test';
import assert from 'node:assert/strict';
import {loadRecords,storeRecords} from '../storage.js';
const data=new Map();
globalThis.localStorage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
Object.defineProperty(globalThis,'navigator',{value:{locks:{request:async(name,fn)=>fn()}},configurable:true});
const r={id:'test-storage-1',lift:'Bench',weight:100,sets:1,reps:1,createdAt:'2026-11-23T12:00:00.000Z'};
test('writes merge latest durable data rather than stale UI state',async()=>{
  data.clear();await storeRecords([r]);await storeRecords([{...r,id:'test-storage-2'}]);assert.equal(loadRecords().length,2);
});
test('corrupt storage is never silently overwritten',async()=>{
  data.set('pr-pocket.records.v1','broken');await assert.rejects(storeRecords([r]));assert.equal(data.get('pr-pocket.records.v1'),'broken');data.clear();
});
test('quota failures leave prior history intact',async()=>{
  await storeRecords([r]);const original=localStorage.setItem;localStorage.setItem=()=>{throw Error('Quota exceeded');};
  try{await assert.rejects(storeRecords([{...r,id:'test-storage-3'}]),/Quota/);assert.equal(loadRecords().length,1);}finally{localStorage.setItem=original;}
});
