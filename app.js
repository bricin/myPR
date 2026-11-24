import {estimate, rounded, liftKey, parseBackup, validate, liftDate, localDate, DEFAULT_RECENT_DAYS, recentDays, recentRecords, recentSummary} from './core.js';
import {loadRecords, storeRecords, loadPreferences, storePreferences} from './storage.js';
const $ = id => document.getElementById(id);
let records = [], prefs = loadPreferences(), storageBroken = false;
try{prefs.recentDays=recentDays(prefs.recentDays ?? DEFAULT_RECENT_DAYS);}catch{prefs.recentDays=DEFAULT_RECENT_DAYS;}
const formatRecordDate = r => new Date(r.performedOn ? r.performedOn+'T12:00:00' : r.createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const fmt = n => new Intl.NumberFormat(undefined,{maximumFractionDigits:1}).format(n);
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error',error); }
function fail(error) { status(error.message || 'Something went wrong. Try again.', true); }
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
}
function renderNumbers() {
  const items = records.filter(r=>liftKey(r.lift)===$('selected-lift').value);
  const formula = $('formula').value;
  const actual = best(items.filter(r=>r.reps===1),r=>r.weight);
  const estimated = best(items.filter(r=>r.reps>1),r=>estimate(r.weight,r.reps,formula));
  $('actual').textContent = actual === null ? '—' : fmt(actual);
  $('estimated').textContent = estimated === null ? '—' : fmt(estimated);
  const recent=recentSummary(items,{days:prefs.recentDays,formula}).oneRM;
  const basis = $('basis').value==='recent' ? recent?.value ?? null : $('basis').value==='actual' ? actual : estimated;
  $('basis-note').textContent = basis === null ? ($('basis').value==='recent' ? `No qualifying lift in the last ${prefs.recentDays} ${prefs.recentDays===1?'day':'days'}.` : 'Log a qualifying lift to see percentages for this basis.') : $('basis').value==='recent' ? `Based on recent ${recent.record.reps===1?'actual':'estimated'} 1RM: ${fmt(basis)} lb · ${formatRecordDate(recent.record)}` : `Based on ${fmt(basis)} lb · ${$('basis').value === 'actual' ? 'all-time actual single' : formula === 'epley' ? 'all-time Epley estimate' : 'all-time Brzycki estimate'}`;
  $('percentages').replaceChildren(...[50,55,60,65,70,75,80,85,90,95,100,105].map(percent=>{
    const cell = element('div',undefined,'percentage'); cell.append(element('span',percent+'%'),element('strong',basis === null ? '—' : fmt(rounded(basis*percent/100,Number($('rounding').value))))); return cell;
  }));
}
function renderHistory() {
  renderRecentRecords();
  const filter = $('history-filter').value, milestones = new Map(), running = new Map();
  for (const r of records) {
    const key = liftKey(r.lift), previous = running.get(key) || {actual:0,estimated:0}, badges=[];
    if(r.reps===1 && r.weight>previous.actual) {badges.push('All-time actual PR');previous.actual=r.weight;}
    const est = r.reps>1 ? estimate(r.weight,r.reps,$('formula').value) : null;
    if(est!==null && est>previous.estimated) {badges.push('All-time estimated PR');previous.estimated=est;}
    milestones.set(r.id,badges);running.set(key,previous);
  }
  const visible = [...records].reverse().filter(r=>!filter || liftKey(r.lift)===filter);
  $('history').replaceChildren();
  if(!visible.length) { $('history').append(element('div','Your first entry starts here. Save a lift and build your own record book.','empty')); return; }
  for(const r of visible) {
    const item=element('article',undefined,'history-row'), left=element('div'), right=element('div');
    left.append(element('h3',r.lift),element('p',formatRecordDate(r)));
    milestones.get(r.id).forEach(b=>left.append(element('span',b,'badge')));
    right.append(element('div',`${fmt(r.weight)} lb · ${r.sets} × ${r.reps}`,'load'));
    const est=estimate(r.weight,r.reps,$('formula').value);
    right.append(element('p',r.reps===1 ? 'Actual 1RM' : est===null ? 'Estimate excluded: over 10 reps' : `Est. 1RM ${fmt(est)} lb`));
    item.append(left,right);$('history').append(item);
  }
}
function renderRecentRecords() {
  const filter=$('history-filter').value, formula=$('formula').value;
  const names=new Map(records.filter(r=>!filter||liftKey(r.lift)===filter).map(r=>[liftKey(r.lift),r.lift]));
  $('recent-window-note').textContent=`Recent records · Last ${prefs.recentDays} ${prefs.recentDays===1?'day':'days'}, including today. All-time records remain in the history below.`;
  $('recent-records').replaceChildren();
  for(const [key,name] of [...names].sort((a,b)=>a[1].localeCompare(b[1]))) {
    const items=records.filter(r=>liftKey(r.lift)===key);
    const available=[...new Set(recentRecords(items,prefs.recentDays).map(r=>r.reps))].sort((a,b)=>a-b);
    const reps=Number(prefs.recentReps?.[key]) || available[0] || 1;
    const {oneRM,pr}=recentSummary(items,{days:prefs.recentDays,formula,reps});
    const card=element('article',undefined,'recent-card');card.append(element('h3',name));
    const metrics=element('div',undefined,'recent-metrics'),rm=element('div'),performance=element('div');
    rm.append(element('h4','Recent 1RM'),element('strong',oneRM?`${fmt(oneRM.value)} lb`:'—'));
    rm.append(element('p',oneRM ? `${oneRM.record.reps===1?'Actual single':formula==='epley'?'Epley estimate':'Brzycki estimate'} · ${fmt(oneRM.record.weight)} lb × ${oneRM.record.reps} ${oneRM.record.reps===1?'rep':'reps'} · ${formatRecordDate(oneRM.record)}` : 'No recent estimate. Log a single or a 2–10 rep effort.','hint'));
    const label=element('label','Recent PR'),select=element('select');select.setAttribute('aria-label',`Recent PR rep count for ${name}`);
    for(const count of [...new Set([...available,reps])].sort((a,b)=>a-b))select.append(new Option(`${count} ${count===1?'rep':'reps'}`,String(count)));
    select.value=String(reps);
    select.onchange=()=>{
      prefs.recentReps={...prefs.recentReps,[key]:Number(select.value)};
      try{persistPrefs();}catch(error){fail(error);}renderRecentRecords();
    };
    label.append(select);performance.append(label,element('strong',pr?`${fmt(pr.weight)} lb × ${pr.reps}`:'—'));
    performance.append(element('p',pr?`Performed · ${formatRecordDate(pr)}`:'No recent record at this rep count.','hint'));
    metrics.append(rm,performance);card.append(metrics);$('recent-records').append(card);
  }
}
function previewEntry() {
  const w=Number($('weight').value), reps=Number($('reps').value), value=estimate(w,reps,$('formula').value);
  $('entry-preview').textContent = w>0 && reps>0 ? reps===1 ? `Actual 1RM: ${fmt(w)} lb` : value===null ? 'Saved in history; estimates are limited to 2–10 reps.' : `Estimated 1RM: ${fmt(value)} lb · ${$('formula').value==='epley'?'Epley':'Brzycki'}` : 'One rep records an actual 1RM. Estimates use 2–10 reps.';
}
const ANNOUNCEMENT = 'welcome-v1';
$('announcement').hidden = prefs.dismissedAnnouncement === ANNOUNCEMENT;
$('dismiss-announcement').onclick=()=>{
  prefs.dismissedAnnouncement=ANNOUNCEMENT;
  $('announcement').hidden=true;
  $('lift').focus();
  try{persistPrefs();}catch(error){fail(error);}
};
function renderRoute() {
  const settings = location.hash === '#settings';
  $('settings').hidden=!settings;
  $('tracker-view').hidden=settings;
  $('settings-toggle').hidden=settings;
  window.scrollTo(0,0);
  if(settings) {
    $('settings-title').focus();
  }
}
$('settings-toggle').onclick=()=>{location.hash='settings';};
$('settings-back').onclick=()=>{location.hash='';};
window.addEventListener('hashchange',renderRoute);
renderRoute();
$('entry-form').onsubmit=async event=>{
  event.preventDefault();if(storageBroken) return status('Cannot save while device storage is unreadable. Restore browser data first.',true);
  try {
    const r=validate({id:crypto.randomUUID(),lift:$('lift').value,weight:Number($('weight').value),sets:Number($('sets').value),reps:Number($('reps').value),createdAt:new Date().toISOString(),performedOn:liftDate($('lift-date').value)});
    records=await storeRecords([r]);prefs.selected=liftKey(r.lift);render();$('selected-lift').value=prefs.selected;renderNumbers();
    status(`Saved ${r.lift} · ${fmt(r.weight)} lb · ${r.sets} × ${r.reps} on this device.`);
    if(navigator.storage?.persist) navigator.storage.persist().catch(()=>{});
  } catch(error) {fail(error);}
};
for(const id of ['weight','reps']) $(id).addEventListener('input',previewEntry);
for(const id of ['formula','rounding','basis','selected-lift']) $(id).onchange=()=>{
  prefs[id==='selected-lift'?'selected':id]=$(id).value;
  try{persistPrefs();}catch(error){fail(error);}renderNumbers();renderHistory();previewEntry();
};
$('history-filter').onchange=renderHistory;
$('recent-days').value=String(prefs.recentDays);
$('recent-settings-form').onsubmit=event=>{
  event.preventDefault();
  try {
    const next={...prefs,recentDays:recentDays($('recent-days').value)};
    storePreferences(next);prefs=next;renderNumbers();renderHistory();
    status(`Recent window saved: ${prefs.recentDays} ${prefs.recentDays===1?'day':'days'}.`);
  }catch(error){fail(error);}
};
$('backup').onclick=async()=>{
  try {
    const backup={format:'pr-pocket',version:1,exportedAt:new Date().toISOString(),records:loadRecords()};
    const name=`myPR-${new Date().toISOString().slice(0,10)}.json`, contents=JSON.stringify(backup,null,2);
    const file=new File([contents],name,{type:'application/json'});
    if(navigator.canShare?.({files:[file]})) {await navigator.share({files:[file],title:'myPR backup'});status('Backup shared. In Files, choose iCloud Drive to keep it in iCloud.');}
    else if(window.showSaveFilePicker) {const handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'myPR backup',accept:{'application/json':['.json']}}]});const writer=await handle.createWritable();await writer.write(contents);await writer.close();status('Backup file saved. Choose an iCloud Drive folder for iCloud backup.');}
    else {const url=URL.createObjectURL(file), a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);status('Backup download started. Move the JSON file to iCloud Drive using Files.');}
  }catch(error){if(error.name!=='AbortError')fail(error);}
};
$('restore').onchange=async()=>{
  try {
    const file=$('restore').files[0];if(!file)return;
    if(file.size>10*1024*1024)throw Error('Choose a backup smaller than 10 MB.');
    const imported=parseBackup(await file.text()); records=await storeRecords(imported);render();status(`Backup merged · ${records.length} entries now on this device.`);
  }catch(error){fail(error);}finally{$('restore').value='';}
};
window.addEventListener('online',()=>status('Saved on this device.'));
window.addEventListener('offline',()=>status('Offline · Records save on this device.'));
window.addEventListener('storage',()=>{try{records=loadRecords();render();}catch(error){fail(error);}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){renderNumbers();renderHistory();}});
let renderedDay=localDate();
setInterval(()=>{const today=localDate();if(!document.hidden&&today!==renderedDay){renderedDay=today;renderNumbers();renderHistory();}},60000);
for(const key of ['formula','rounding','basis']) if([...$(key).options].some(o=>o.value===String(prefs[key]))) $(key).value=prefs[key];
try{records=loadRecords();render();}catch(error){storageBroken=true;fail(error);}
$('reload-app').onclick=()=>location.reload();
let checkForAppUpdate=()=>{};
if('serviceWorker' in navigator && !['localhost','127.0.0.1','[::1]'].includes(location.hostname)) {
  const alreadyControlled=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(alreadyControlled)$('app-update').hidden=false;
  });
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(registration=>{
    let lastCheck=Date.now();
    checkForAppUpdate=()=>{
      if(navigator.onLine&&Date.now()-lastCheck>60000){lastCheck=Date.now();registration.update().catch(()=>{});}
    };
  }).catch(()=>status('Offline installation is unavailable. Use HTTPS, then reload.',true));
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkForAppUpdate();});
