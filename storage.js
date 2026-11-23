import {mergeRecords} from './core.js';
const KEY = 'pr-pocket.records.v1';
export function loadRecords() {
  const raw = localStorage.getItem(KEY);
  if (raw === null) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw Error('Device storage is damaged. Export the original browser data before clearing storage.');
  return mergeRecords(parsed);
}
export async function storeRecords(incoming) {
  const write = () => {
    const records = mergeRecords(loadRecords(), incoming);
    localStorage.setItem(KEY, JSON.stringify(records));
    return records;
  };
  // Web Locks prevents lost updates across tabs; older browsers should use one tab.
  return navigator.locks ? navigator.locks.request('pr-pocket-records', write) : write();
}
export function loadPreferences() {
  try { return JSON.parse(localStorage.getItem('pr-pocket.preferences.v1') || '{}'); } catch { return {}; }
}
export function storePreferences(prefs) { localStorage.setItem('pr-pocket.preferences.v1', JSON.stringify(prefs)); }
