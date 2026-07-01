// ── Date utils ──
const fmt    = d => d.toISOString().slice(0,10);
const disp   = s => new Date(s+'T12:00:00').toLocaleDateString('pt-BR');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const today     = () => fmt(new Date());
const yesterday = () => fmt(addDays(new Date(), -1));

const PRESETS = {
  hoje:   () => { const t=today();     return {s:t,e:t}; },
  ontem:  () => { const y=yesterday(); return {s:y,e:y}; },
  '7d':   () => { const e=yesterday(); return {s:fmt(addDays(new Date(e),-6)),e}; },
  '14d':  () => { const e=yesterday(); return {s:fmt(addDays(new Date(e),-13)),e}; },
  '30d':  () => { const e=yesterday(); return {s:fmt(addDays(new Date(e),-29)),e}; },
  mes:    () => { const t=new Date(); const s=new Date(t.getFullYear(),t.getMonth(),1); const y=addDays(new Date(),-1); const e=y<s?today():fmt(y); return {s:fmt(s),e}; },
  mesant: () => { const t=new Date(); const s=new Date(t.getFullYear(),t.getMonth()-1,1); const e=new Date(t.getFullYear(),t.getMonth(),0); return {s:fmt(s),e:fmt(e)}; },
};

function calcCmp(mode, s, e) {
  const d1=new Date(s+'T12:00:00'), d2=new Date(e+'T12:00:00');
  const n=Math.round((d2-d1)/864e5);
  if (mode==='anterior') {
    const ce=new Date(d1); ce.setDate(ce.getDate()-1);
    const cs=new Date(ce); cs.setDate(cs.getDate()-n);
    return {s:fmt(cs),e:fmt(ce)};
  }
  if (mode==='mesant') {
    const cs=new Date(d1); cs.setMonth(cs.getMonth()-1);
    const ce=new Date(d2); ce.setMonth(ce.getMonth()-1);
    return {s:fmt(cs),e:fmt(ce)};
  }
  if (mode==='anoant') {
    const cs=new Date(d1); cs.setFullYear(cs.getFullYear()-1);
    const ce=new Date(d2); ce.setFullYear(ce.getFullYear()-1);
    return {s:fmt(cs),e:fmt(ce)};
  }
  return null;
}

// ── Format helpers ──
const fR = n => n!=null&&!isNaN(n) ? 'R$ '+Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
const fN = n => n!=null&&!isNaN(n) ? Number(n).toLocaleString('pt-BR') : '—';
const fP = n => n!=null&&!isNaN(n) ? Number(n).toFixed(2)+'%' : '—';

// ── Data helpers ──
const sum = (arr, k) => arr.reduce((s,r)=>s+(+r[k]||0), 0);

function aggCamps(rows) {
  const m = {};
  for (const r of rows) {
    const k = `${r.platform}||${r.campaign_name}`;
    if (!m[k]) m[k] = {platform:r.platform,campaign_name:r.campaign_name,spend:0,clicks:0,impressions:0,conversions:0};
    m[k].spend       += +r.spend||0;
    m[k].clicks      += +r.clicks||0;
    m[k].impressions += +r.impressions||0;
    m[k].conversions += +r.conversions||0;
  }
  return Object.values(m).map(r=>({...r,
    ctr: r.impressions>0 ? r.clicks/r.impressions*100 : 0,
    cpa: r.conversions>0 ? r.spend/r.conversions : null
  }));
}

function aggGA4(rows) {
  const m = {};
  for (const r of rows) {
    const k = `${r.channel}||${r.campaign}`;
    if (!m[k]) m[k] = {channel:r.channel,campaign:r.campaign,sessions:0,conversions:0,revenue:0};
    m[k].sessions    += +r.sessions||0;
    m[k].conversions += +r.conversions||0;
    m[k].revenue     += +r.revenue||0;
  }
  return Object.values(m).map(r=>({...r,
    conversion_rate: r.sessions>0 ? r.conversions/r.sessions*100 : 0
  }));
}

// ── Fetch helpers ──

// RPCs agregados (retornam poucos registros, muito mais rápido)
async function fetchCampAgg(s, e)              { return supaRpc('get_camp_agg',                  { p_start: s, p_end: e }); }
async function fetchCampDailyAgg(s, e)         { return supaRpc('get_camp_daily_agg',            { p_start: s, p_end: e }); }
async function fetchCampDailyByPlatform(s, e)  { return supaRpc('get_camp_daily_by_platform',    { p_start: s, p_end: e }); }
async function fetchGA4DailyAgg(s, e)          { return supaRpc('get_ga4_daily_agg',             { p_start: s, p_end: e }); }
async function fetchGA4ChannelsAgg(s, e)       { return supaRpc('get_ga4_channels_agg',          { p_start: s, p_end: e }); }
async function fetchLPAgg(s, e)                { return supaRpc('get_ga4_landing_pages_agg',     { p_start: s, p_end: e }); }
async function fetchGoogleLPAgg(s, e)          { return supaRpc('get_google_landing_pages_agg',  { p_start: s, p_end: e }); }

// Raw — mantidos para compatibilidade (criativos ainda precisam de linha por linha)
async function fetchCamps(s, e) {
  return supa(`campaign_daily?select=*&date=gte.${s}&date=lte.${e}&order=date.asc`);
}
async function fetchGA4(s, e) {
  return supa(`ga4_conversions?select=*&date=gte.${s}&date=lte.${e}&order=date.asc`);
}
async function fetchLogs() {
  return supa(`sync_logs?select=*&order=finished_at.desc&limit=20`);
}
async function fetchMetaCreatives(s, e) {
  return supa(`meta_creatives?select=*&date=gte.${s}&date=lte.${e}&order=date.asc`);
}
async function fetchGoogleCreatives(s, e) {
  return supa(`google_creatives?select=*&date=gte.${s}&date=lte.${e}&order=date.asc`);
}

// ── UI helpers ──
function deltaHtml(curr, prev, invert=false) {
  if (prev==null||prev===0||!S.compare) return '';
  const d=(curr-prev)/Math.abs(prev);
  const pct=(d*100).toFixed(1);
  const pos=invert ? d<0 : d>0;
  const cls=pos?'d-up':d===0?'d-neu':'d-down';
  const arrow=d>0?'↑':d<0?'↓':'→';
  return `<span class="${cls}">${arrow} ${d>0?'+':''}${pct}%</span>`;
}

function kpiCard(label, val, cmpVal, fFn=fR, cls='c-brand', invert=false) {
  const cmpHtml = S.compare && cmpVal!==undefined
    ? `<div class="kpi-cmp">${fFn(cmpVal)} ${deltaHtml(val,cmpVal,invert)}</div>`
    : (S.compare ? `<div class="kpi-cmp d-neu">Sem comp.</div>` : '');
  return `<div class="card">
    <div class="kpi-label">${label}</div>
    <div class="kpi-value ${cls}">${fFn(val)}</div>
    ${cmpHtml}
  </div>`;
}

function loading() {
  document.getElementById('content').innerHTML = `<div class="loading"><div class="spinner"></div>Carregando dados…</div>`;
}

function emptyRow(cols, msg='Sem dados para o período selecionado') {
  return `<tr><td colspan="${cols}" class="c-muted" style="text-align:center;padding:28px">${msg}</td></tr>`;
}

// ── Generic sortable tables ──
// Cada tabela ordenável tem um id próprio: sort state e função de re-render ficam
// registrados aqui, para que o clique no <th> funcione sem re-buscar os dados.
const _sortState    = {};
const _sortRenderers = {};

function registerSortRenderer(tableId, renderFn) {
  _sortRenderers[tableId] = renderFn;
}

function getSort(tableId, fallbackKey, fallbackDir='desc') {
  if (!_sortState[tableId]) _sortState[tableId] = { key: fallbackKey, dir: fallbackDir };
  return _sortState[tableId];
}

function onSortClick(tableId, key, defaultDir) {
  const cur = _sortState[tableId];
  if (cur && cur.key === key) cur.dir = cur.dir === 'asc' ? 'desc' : 'asc';
  else _sortState[tableId] = { key, dir: defaultDir };
  const fn = _sortRenderers[tableId];
  if (fn) fn();
}

function sortRows(rows, key, dir) {
  return rows.slice().sort((a, b) => {
    let va = a[key], vb = b[key];
    const bothNumeric = (typeof va === 'number' || va == null) && (typeof vb === 'number' || vb == null);
    if (bothNumeric) {
      va = va == null ? -Infinity : va;
      vb = vb == null ? -Infinity : vb;
    } else {
      va = String(va ?? '').toLowerCase();
      vb = String(vb ?? '').toLowerCase();
    }
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

function sortTh(tableId, label, key, defaultDir='desc', align='r') {
  const st = getSort(tableId, null, defaultDir);
  const active = st.key === key;
  const arrow = active ? (st.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return `<th class="${align} th-sort${active?' active':''}" onclick="onSortClick('${tableId}','${key}','${defaultDir}')">${label}${arrow}</th>`;
}
