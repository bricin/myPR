import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../sw.js',import.meta.url),'utf8');
function worker(keys=[]) {
  const handlers={},calls={requests:[],deleted:[],navigated:[],skipped:false,claimed:false};
  const context={URL,Request,Set,Promise,fetch:async()=>{throw Error('offline');},
    caches:{open:async()=>({addAll:async requests=>{calls.requests=requests;},match:async()=>({cached:true})}),keys:async()=>keys,delete:async key=>{calls.deleted.push(key);}},
    self:{location:{origin:'https://example.com'},registration:{scope:'https://example.com/myPR/'},addEventListener:(name,handler)=>{handlers[name]=handler;},skipWaiting:async()=>{calls.skipped=true;},clients:{claim:async()=>{calls.claimed=true;},matchAll:async()=>[{url:'https://example.com/myPR/#settings',navigate:async url=>{calls.navigated.push(url);}},{url:'https://example.com/other/',navigate:async url=>{calls.navigated.push(url);}}]}}};
  vm.runInNewContext(source,context);
  return {calls,async run(event){let pending;handlers[event]({waitUntil:promise=>{pending=promise;}});await pending;},handlers};
}
test('updates refresh HTTP cache and activate without waiting for every tab to close',async()=>{
  const w=worker();await w.run('install');assert.equal(w.calls.skipped,true);
  assert.ok(w.calls.requests.length>5);assert.ok(w.calls.requests.every(request=>request.cache==='reload'));
});
test('legacy upgrade refreshes only myPR pages and preserves unrelated caches',async()=>{
  const w=worker(['pr-pocket-v3','pr-pocket-v5','pr-pocket-v6','another-app']);await w.run('activate');
  assert.equal(w.calls.claimed,true);assert.deepEqual(w.calls.deleted,['pr-pocket-v3','pr-pocket-v5']);
  assert.deepEqual(w.calls.navigated,['https://example.com/myPR/#settings']);
});
test('modern updates do not interrupt an unfinished entry with a forced refresh',async()=>{
  const w=worker(['pr-pocket-v6']);await w.run('activate');assert.deepEqual(w.calls.navigated,[]);
});
test('offline navigation still serves the cached app shell',async()=>{
  const w=worker();let response;
  w.handlers.fetch({request:{url:'https://example.com/myPR/',method:'GET',mode:'navigate'},respondWith:promise=>{response=promise;}});
  assert.deepEqual(await response,{cached:true});
});
