import {HEADER, LEGACY_HEADER, fromRows, row} from './core.js';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
let token = null, expires = 0, scriptPromise;
export const authorized = () => !!token && Date.now() < expires;
export function disconnect() { token = null; expires = 0; }
export function loadGoogle() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
  if (!scriptPromise) scriptPromise = new Promise((resolve,reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    script.onload = resolve;
    script.onerror = () => { script.remove(); scriptPromise = null; reject(Error('Google authorization could not load. Check your connection or content blocker.')); };
    document.head.append(script);
  });
  return scriptPromise;
}
// Call from a fresh user gesture after loadGoogle has completed so popups are allowed.
export function authorize(clientId) {
  return new Promise((resolve,reject) => {
    google.accounts.oauth2.initTokenClient({client_id:clientId, scope:SCOPE, include_granted_scopes:false,
      callback: result => {
        if (result.error || !google.accounts.oauth2.hasGrantedAllScopes(result, SCOPE)) return reject(Error('Google did not grant file access. Your device records are unchanged.'));
        token = result.access_token; expires = Date.now() + Math.max(0, Number(result.expires_in) - 60) * 1000; resolve();
      }, error_callback: () => reject(Error('Google authorization was closed or blocked. Try again.'))
    }).requestAccessToken({prompt:'select_account'});
  });
}
async function api(path, {method = 'GET', body, base = 'https://sheets.googleapis.com/v4/spreadsheets'} = {}) {
  if (!authorized()) throw Error('Authorize Google again to sync. Your records are saved on this device.');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(base + path, {
      method, headers:{Authorization:'Bearer ' + token, ...(body ? {'Content-Type':'application/json'} : {})},
      ...(body ? {body:JSON.stringify(body)} : {}), signal:controller.signal, cache:'no-store'
    });
    if (response.status === 401) { disconnect(); throw Error('Google authorization expired. Authorize again to sync.'); }
    if (!response.ok) throw Error(`Google returned ${response.status}. Please reconnect or try again later. Your local records are safe.`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}
export async function findSpreadsheet(preferredId) {
  const query = "trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet' and (appProperties has { key='mypr' and value='v1' } or name = 'myPR' or name = 'PR Pocket')";
  const params=new URLSearchParams({q:query,fields:'files(id,name,appProperties),nextPageToken',orderBy:'createdTime',pageSize:'100'});
  let first;
  do {
    const data=await api('/files?'+params,{base:'https://www.googleapis.com/drive/v3'});
    first ||= data.files?.[0]?.id;
    const previous=data.files?.find(file=>file.id===preferredId);
    if(previous)return previous.id;
    if(!data.nextPageToken)return first||null;
    params.set('pageToken',data.nextPageToken);
  } while(true);
}
export async function createSpreadsheet() {
  const data = await api('', {method:'POST', body:{properties:{title:'myPR'}, sheets:[{properties:{title:'PRs'}}]}});
  // Tag the file for automatic discovery after sign-in on other devices.
  await api('/files/' + encodeURIComponent(data.spreadsheetId) + '?fields=id', {method:'PATCH',base:'https://www.googleapis.com/drive/v3',body:{appProperties:{mypr:'v1'}}});
  return data.spreadsheetId;
}
const range = encodeURIComponent("'PRs'!A:G");
export async function readSpreadsheet(id) {
  const data = await api('/' + encodeURIComponent(id) + '/values/' + range);
  if (!data.values?.length) {
    await api('/' + encodeURIComponent(id) + '/values/' + encodeURIComponent("'PRs'!A1:G1") + '?valueInputOption=RAW', {method:'PUT', body:{values:[HEADER]}});
    return [];
  }
  const records = fromRows(data.values);
  if (JSON.stringify(data.values[0]) === JSON.stringify(LEGACY_HEADER)) {
    await api('/' + encodeURIComponent(id) + '/values/' + encodeURIComponent("'PRs'!G1") + '?valueInputOption=RAW', {method:'PUT', body:{values:[['performed_on']]}});
  }
  return records;
}
export async function appendRecords(id, records) {
  if (!records.length) return;
  await api('/' + encodeURIComponent(id) + '/values/' + range + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS', {method:'POST', body:{values:records.map(row)}});
}
