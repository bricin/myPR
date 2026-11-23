import {estimate, rounded, liftKey, mergeRecords, parseBackup, validate} from './core.js';
import {loadRecords, storeRecords, loadPreferences, storePreferences} from './storage.js';
import * as sheets from './sheets.js';
const $ = id => document.getElementById(id);
let records = [], prefs = loadPreferences(), syncing = false, syncAgain = false, storageBroken = false;
const fmt = n => new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(n);
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error',error); }
function fail(error) { status(error.name === 'AbortError' ? 'Sync timed out. Saved locally; retry sync to check for uploaded records.' : error.message || 'Something went wrong. Try again.', true); }
function persistPrefs() { storePreferences(prefs); }
function element(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
function best(items, value) { const values = items.map(value).filter(n => n !== null); return values.length ? Math.max(...values) : null; }
function render() {
  const names = [...new Map(records.map(r=>[liftKey(r.lift),r.lift])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  for (const id of ['selected-lift','history-filter']) {
    const select = $(id), old = select.value || (id === 'selected-lift' ? prefs.selected : ''); select.replaceChildren();
    if (id === 'history-filter' || !names.length) select.append(new Option(id === 'history-filter' ? 'All lifts' : 'No lifts yet',''));
    names.forEach(([key,name]) => select.append(new Option(name,key)));
    if (names.some(([key])=>key===old)) select.value=old;
  }
  const defaults = ['Back squat','Bench press','Deadlift','Overhead press','Front squat'];
  $('lifts').replaceChildren(...[...new Set([...defaults,...names.map(n=>n[1])])].map(name=>new Option(name)));
  renderNumbers(); renderHistory();
  $('sheet-link').hidden = !prefs.sheetId;
  if (prefs.sheetId) $('sheet-link').href = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(prefs.sheetId);
}
function renderNumbers() {
  const items = records.filter(r=>liftKey(r.lift)===$('selected-lift').value);
  const formula = $('formula').value;
  const actual = best(items.filter(r=>r.reps===1),r=>r.weight);
  const estimated = best(items.filter(r=>r.reps>1),r=>estimate(r.weight,r.reps,formula));
  $('actual').textContent = actual === null ? '—' : fmt(actual);
  $('estimated').textContent = estimated === null ? '—' : fmt(estimated);
  const basis = $('basis').value==='actual' ? actual : estimated;
  $('basis-note').textContent = basis === null ? 'Log a qualifying lift to see percentages for this basis.' : `Based on ${fmt(basis)} lb · ${$('basis').value === 'actual' ? 'actual single' : formula === 'epley' ? 'Epley estimate' : 'Brzycki estimate'}`;
  $('percentages').replaceChildren(...[50,55,60,65,70,75,80,85,90,95,100,105].map(percent=>{
    const cell = element('div',undefined,'percentage'); cell.append(element('span',percent+'%'),element('strong',basis === null ? '—' : fmt(rounded(basis*percent/100,Number($('rounding').value))))); return cell;
  }));
}
function renderHistory() {
  const filter = $('history-filter').value, milestones = new Map(), running = new Map();
  for (const r of records) {
    const key = liftKey(r.lift), previous = running.get(key) || {actual:0,estimated:0}, badges=[];
    if(r.reps===1 && r.weight>previous.actual) {badges.push('Actual PR');previous.actual=r.weight;}
    const est = r.reps>1 ? estimate(r.weight,r.reps,$('formula').value) : null;
    if(est!==null && est>previous.estimated) {badges.push('Estimated PR');previous.estimated=est;}
    milestones.set(r.id,badges);running.set(key,previous);
  }
  const visible = [...records].reverse().filter(r=>!filter || liftKey(r.lift)===filter);
  $('history').replaceChildren();
  if(!visible.length) { $('history').append(element('div','Your first entry starts here. Save a lift and build your own record book.','empty')); return; }
  for(const r of visible) {
    const item=element('article',undefined,'history-row'), left=element('div'), right=element('div');
    left.append(element('h3',r.lift),element('p',new Date(r.createdAt).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})));
    milestones.get(r.id).forEach(b=>left.append(element('span',b,'badge')));
    right.append(element('div',`${fmt(r.weight)} lb · ${r.sets} × ${r.reps}`,'load'));
    const est=estimate(r.weight,r.reps,$('formula').value);
    right.append(element('p',r.reps===1 ? 'Actual 1RM' : est===null ? 'Estimate excluded: over 10 reps' : `Est. 1RM ${fmt(est)} lb`));
    item.append(left,right);$('history').append(item);
  }
}
function previewEntry() {
  const w=Number($('weight').value), reps=Number($('reps').value), value=estimate(w,reps,$('formula').value);
  $('entry-preview').textContent = w>0 && reps>0 ? reps===1 ? `Actual 1RM: ${fmt(w)} lb` : value===null ? 'Saved in history; estimates are limited to 2–10 reps.' : `Estimated 1RM: ${fmt(value)} lb · ${$('formula').value==='epley'?'Epley':'Brzycki'}` : 'One rep records an actual 1RM. Estimates use 2–10 reps.';
}
async function sync() {
  if(syncing) {syncAgain=true;return;}
  if(!navigator.onLine) return status('Offline · Records saved here. Sync when you’re connected.');
  if(!sheets.authorized()) return status('Records saved on this device. Authorize Google in Settings to sync.');
  syncing=true; $('sync').disabled=true; $('settings-form').querySelector('button').disabled=true;
  const run=async()=>{
  const target=prefs.sheetId;
  try {
    status('Syncing with Google Sheets…');
    if(!target) { prefs.sheetId=await sheets.createSpreadsheet();persistPrefs();$('sheet-id').value=prefs.sheetId;render(); }
    const remote=await sheets.readSpreadsheet(prefs.sheetId);
    records=await storeRecords(remote); render();
    const remoteIDs=new Set(remote.map(r=>r.id)), pending=records.filter(r=>!remoteIDs.has(r.id));
    const count=records.length;
    await sheets.appendRecords(prefs.sheetId,pending);
    status(`Synced ${count} entries · ${new Date().toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`);
  } catch(error) { fail(error); }
  };
  try {if(navigator.locks)await navigator.locks.request('pr-pocket-sync',run);else await run();}
  finally { syncing=false; $('sync').disabled=false; $('settings-form').querySelector('button').disabled=false;if(syncAgain){syncAgain=false;sync();} }
}
$('settings-toggle').onclick=()=>{
  $('settings').hidden=!$('settings').hidden;$('settings-toggle').setAttribute('aria-expanded',String(!$('settings').hidden));
  if(!$('settings').hidden && navigator.onLine) sheets.loadGoogle().catch(fail);
};
$('entry-form').onsubmit=async event=>{
  event.preventDefault();if(storageBroken) return status('Cannot save while device storage is unreadable. Restore browser data first.',true);
  try {
    const r=validate({id:crypto.randomUUID(),lift:$('lift').value,weight:Number($('weight').value),sets:Number($('sets').value),reps:Number($('reps').value),createdAt:new Date().toISOString()});
    records=await storeRecords([r]);prefs.selected=liftKey(r.lift);render();$('selected-lift').value=prefs.selected;renderNumbers();
    status(`Saved ${r.lift} · ${fmt(r.weight)} lb · ${r.sets} × ${r.reps} on this device.`);
    if(navigator.storage?.persist) navigator.storage.persist().catch(()=>{});
    if(sheets.authorized()) await sync();
  } catch(error) {fail(error);}
};
for(const id of ['weight','reps']) $(id).addEventListener('input',previewEntry);
for(const id of ['formula','rounding','basis','selected-lift']) $(id).onchange=()=>{
  prefs[id==='selected-lift'?'selected':id]=$(id).value;
  try{persistPrefs();}catch(error){fail(error);}renderNumbers();renderHistory();previewEntry();
};
$('history-filter').onchange=renderHistory;
$('settings-form').onsubmit=event=>{
  event.preventDefault();
  const clientId=$('client-id').value.trim(), sheetId=$('sheet-id').value.trim();
  if(clientId && !/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId)) return status('Enter a Google web OAuth client ID.',true);
  if(sheetId && !/^[\w-]{15,200}$/.test(sheetId)) return status('Enter only the spreadsheet ID, not its full URL.',true);
  const next={...prefs,clientId,sheetId};
  try{storePreferences(next);prefs=next;sheets.disconnect();render();status('Connection settings saved. Authorize Google to sync.');}catch(error){fail(error);}
};
$('connect').onclick=async()=>{
  if(!prefs.clientId) return status('Save your Google OAuth client ID in Settings first. Offline mode needs no setup.',true);
  if(syncing) return;
  if(!globalThis.google?.accounts?.oauth2) {
    try{await sheets.loadGoogle();status('Google is ready. Tap Authorize Google & sync again to open its account chooser.');}catch(error){fail(error);} return;
  }
  try{await sheets.authorize(prefs.clientId);await sync();}catch(error){fail(error);}
};
$('sync').onclick=sync;
$('disconnect').onclick=()=>{sheets.disconnect();status('Google disconnected on this device. Local records remain saved.');};
$('backup').onclick=async()=>{
  try {
    const backup={format:'pr-pocket',version:1,exportedAt:new Date().toISOString(),records:loadRecords()};
    const name=`pr-pocket-${new Date().toISOString().slice(0,10)}.json`, contents=JSON.stringify(backup,null,2);
    const file=new File([contents],name,{type:'application/json'});
    if(navigator.canShare?.({files:[file]})) {await navigator.share({files:[file],title:'PR Pocket backup'});status('Backup shared. In Files, choose iCloud Drive to keep it in iCloud.');}
    else if(window.showSaveFilePicker) {const handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'PR Pocket backup',accept:{'application/json':['.json']}}]});const writer=await handle.createWritable();await writer.write(contents);await writer.close();status('Backup file saved. Choose an iCloud Drive folder for iCloud backup.');}
    else {const url=URL.createObjectURL(file), a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);status('Backup download started. Move the JSON file to iCloud Drive using Files.');}
  }catch(error){if(error.name!=='AbortError')fail(error);}
};
$('restore').onchange=async()=>{
  try {
    const file=$('restore').files[0];if(!file)return;
    if(file.size>10*1024*1024)throw Error('Choose a backup smaller than 10 MB.');
    const imported=parseBackup(await file.text()); records=await storeRecords(imported);render();status(`Backup merged · ${records.length} entries now on this device.`);if(sheets.authorized())await sync();
  }catch(error){fail(error);}finally{$('restore').value='';}
};
window.addEventListener('online',()=>{if(sheets.authorized())sync();else status('Back online · Authorize Google to sync, or keep tracking locally.');});
window.addEventListener('offline',()=>status('Offline · Records save on this device.'));
window.addEventListener('storage',()=>{try{records=loadRecords();render();}catch(error){fail(error);}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden && sheets.authorized())sync();});
for(const key of ['formula','rounding','basis']) if([...$(key).options].some(o=>o.value===String(prefs[key]))) $(key).value=prefs[key];
$('client-id').value=prefs.clientId||'';$('sheet-id').value=prefs.sheetId||'';
try{records=loadRecords();render();}catch(error){storageBroken=true;fail(error);}
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>status('Offline installation is unavailable. Use HTTPS or localhost, then reload.',true));
