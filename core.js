export function localDate(now = new Date()) {
  return `${now.getFullYear().toString().padStart(4,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function liftDate(value, now = new Date()) {
  if (value !== undefined && typeof value !== 'string') throw Error('Choose a valid lift date.');
  const date = value || localDate(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000') || !Number.isFinite(Date.parse(date+'T00:00:00Z')) || new Date(date+'T00:00:00Z').toISOString().slice(0,10) !== date) throw Error('Choose a valid lift date.');
  return date;
}
export const recordDay = record => record.performedOn || localDate(new Date(record.createdAt));
export function validate(record) {
  if (!record || typeof record.id !== 'string' || !/^[\w-]{8,80}$/.test(record.id)) throw Error('Invalid record ID.');
  if (typeof record.lift !== 'string' || !record.lift.trim() || record.lift.length > 60) throw Error('Lift must be 1–60 characters.');
  if (!Number.isFinite(record.weight) || record.weight <= 0 || record.weight > 10000) throw Error('Weight must be greater than 0 and at most 10,000 lb.');
  if (!Number.isInteger(record.sets) || record.sets < 1 || record.sets > 100) throw Error('Sets must be 1–100.');
  if (!Number.isInteger(record.reps) || record.reps < 1 || record.reps > 100) throw Error('Reps must be 1–100.');
  if (typeof record.createdAt !== 'string' || !Number.isFinite(Date.parse(record.createdAt))) throw Error('Invalid record date.');
  const date = record.performedOn === undefined || record.performedOn === '' ? {} : {performedOn:liftDate(record.performedOn)};
  return {id: record.id, lift: record.lift.trim().normalize('NFC'), weight: record.weight, sets: record.sets, reps: record.reps, createdAt: new Date(record.createdAt).toISOString(), ...date};
}
export const liftKey = lift => lift.trim().normalize('NFC').toLocaleLowerCase('en-US');
export function estimate(weight, reps, formula = 'epley') {
  if (reps === 1) return weight;
  // Estimates outside 2–10 reps are deliberately excluded from PRs and percentages.
  if (reps < 2 || reps > 10) return null;
  return formula === 'brzycki' ? weight * 36 / (37 - reps) : weight * (1 + reps / 30);
}
export const rounded = (value, increment) => Math.round(value / increment) * increment;
export function mergeRecords(...groups) {
  const byId = new Map();
  for (const group of groups) for (const input of group) {
    const r = validate(input), old = byId.get(r.id);
    if (old && JSON.stringify(old) !== JSON.stringify(r)) throw Error('Conflicting data for record ' + r.id + '. Restore a separate backup or resolve the conflicting backup record.');
    byId.set(r.id, r);
  }
  return [...byId.values()].sort((a,b) => recordDay(a).localeCompare(recordDay(b)) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
export function parseBackup(text) {
  const data = JSON.parse(text);
  if (data?.format !== 'pr-pocket' || data.version !== 1 || !Array.isArray(data.records)) throw Error('Choose a myPR v1 JSON backup.');
  return mergeRecords(data.records);
}

export const DEFAULT_RECENT_DAYS = 365;
export function recentDays(value) {
  const days=Number(value);
  if(!Number.isInteger(days)||days<1||days>3650)throw Error('Recent window must be a whole number from 1 to 3,650 days.');
  return days;
}
export function recentRecords(records, days=DEFAULT_RECENT_DAYS, now=new Date()) {
  recentDays(days);
  // Compare calendar days in UTC after deriving the device's local today.
  // This avoids daylight-saving changes creating 23/25-hour boundary errors.
  const today=localDate(now), end=Date.parse(today+'T00:00:00Z');
  const start=end-(days-1)*86400000;
  return records.filter(record=>{
    const date=Date.parse(recordDay(record)+'T00:00:00Z');
    return date>=start && date<=end;
  });
}
export function recentSummary(records, {days=DEFAULT_RECENT_DAYS,formula='epley',reps=1,now=new Date()}={}) {
  const recent=recentRecords(records,days,now);
  let oneRM=null,pr=null;
  for(const record of recent) {
    const value=estimate(record.weight,record.reps,formula);
    if(value!==null && (!oneRM||value>oneRM.value||(value===oneRM.value&&recordDay(record)>recordDay(oneRM.record))))oneRM={value,record};
    if(record.reps===reps && (!pr||record.weight>pr.weight||(record.weight===pr.weight&&recordDay(record)>recordDay(pr))))pr=record;
  }
  return {oneRM,pr,records:recent};
}
