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

test('legacy Sheets header adds only G1 without rewriting old records',async()=>{
  const {LEGACY_HEADER}=await import('../core.js');
  await sheets.authorize('test-client');const calls=[];
  globalThis.fetch=async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>opts.method==='GET'?{values:[LEGACY_HEADER,row(r).slice(0,6)]}:{}};};
  assert.deepEqual(await sheets.readSpreadsheet('example-id'),[r]);
  assert.equal(calls.length,2);assert.equal(calls[1].opts.method,'PUT');
  assert.match(decodeURIComponent(calls[1].url),/PRs'!G1/);
  assert.deepEqual(JSON.parse(calls[1].opts.body),{values:[['performed_on']]});
});

test('Google connection discovers an existing app sheet and prefers the known one',async()=>{
  await sheets.authorize('test-client');
  globalThis.fetch=async(url)=>{
    assert.match(url,/googleapis.com\/drive\/v3\/files/);
    assert.match(decodeURIComponent(url),/mypr/);
    return {ok:true,json:async()=>({files:[{id:'oldest'},{id:'previous'}]})};
  };
  assert.equal(await sheets.findSpreadsheet(),'oldest');
  assert.equal(await sheets.findSpreadsheet('previous'),'previous');
  globalThis.fetch=async()=>({ok:true,json:async()=>({files:[]})});
  assert.equal(await sheets.findSpreadsheet(),null);
});
test('new spreadsheets are tagged for cross-device discovery',async()=>{
  await sheets.authorize('test-client');const calls=[];
  globalThis.fetch=async(url,opts)=>{calls.push({url,opts});return {ok:true,json:async()=>({spreadsheetId:'new-sheet'})};};
  assert.equal(await sheets.createSpreadsheet(),'new-sheet');
  assert.match(calls[1].url,/drive\/v3\/files\/new-sheet/);
  assert.deepEqual(JSON.parse(calls[1].opts.body),{appProperties:{mypr:'v1'}});
});
