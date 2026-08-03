const SURL = 'https://vglbmtbwyazgitjmxipv.supabase.co';
const SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnbGJtdGJ3eWF6Z2l0am14aXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NjkwNDcsImV4cCI6MjA5ODE0NTA0N30.GFhM9hQhCCU6NTICulU72QL1yQT-8Zn2yOSDsLTD_c0';

// Autorização das chamadas: usa o access_token da sessão logada (ver js/auth.js) quando
// existe — as políticas de RLS exigem role "authenticated", a anon key sozinha não retorna nada.
function authBearer() {
  const s = typeof getSession === 'function' ? getSession() : null;
  return (s && s.access_token) ? s.access_token : SKEY;
}

async function supa(path) {
  const r = await fetch(`${SURL}/rest/v1/${path}`, {
    headers: { apikey: SKEY, Authorization: `Bearer ${authBearer()}`, Range: '0-49999' },
    cache: 'no-store', // respostas variam por sessão logada — não deixar o navegador cachear por URL
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

async function supaRpc(fn, params) {
  const r = await fetch(`${SURL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SKEY, Authorization: `Bearer ${authBearer()}`, 'Content-Type': 'application/json', Range: '0-49999' },
    body: JSON.stringify(params),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Supabase RPC ${fn} ${r.status}: ${await r.text()}`);
  return r.json();
}
