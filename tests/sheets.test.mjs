import test from 'node:test';
import assert from 'node:assert/strict';
import * as sheets from '../sheets.js';
import {HEADER,row} from '../core.js';
globalThis.google={accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:config=>({requestAccessToken:()=>config.callback({access_token:'session-only-test',expires_in:3600})})}}};
const r={id:'test-sheets-1',lift:'=1+1',weight:100,sets:1,reps:1,createdAt:'2026-11-23T12:00:00.000Z'};
test('Sheets uses session authorization and RAW writes; duplicate remote IDs collapse',async()=>{
  await sheets.authorize('test-client');const calls=[];
  globalThis.fetch=async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>opts.method==='GET'?{values:[HEADER,row(r),row(r)]}:{}};};
  assert.deepEqual(await sheets.readSpreadsheet('example-id'),[r]);await sheets.appendRecords('example-id',[r]);
  assert.match(calls[1].url,/valueInputOption=RAW/);assert.equal(JSON.parse(calls[1].opts.body).values[0][1],'=1+1');
  assert.equal(calls[1].opts.headers.Authorization,'Bearer session-only-test');
  sheets.disconnect();await assert.rejects(sheets.readSpreadsheet('example-id'),/Authorize/);
});
test('expired credentials disconnect without swallowing errors',async()=>{
  await sheets.authorize('test-client');globalThis.fetch=async()=>({status:401,ok:false});
  await assert.rejects(sheets.readSpreadsheet('example-id'),/expired/);assert.equal(sheets.authorized(),false);
});
