const SURL = 'https://vglbmtbwyazgitjmxipv.supabase.co';
const SKEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnbGJtdGJ3eWF6Z2l0am14aXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NjkwNDcsImV4cCI6MjA5ODE0NTA0N30.GFhM9hQhCCU6NTICulU72QL1yQT-8Zn2yOSDsLTD_c0';

async function supa(path) {
  const r = await fetch(`${SURL}/rest/v1/${path}`, {
    headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, Range: '0-49999' }
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}
