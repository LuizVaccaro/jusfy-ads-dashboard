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
  mes:    () => { const t=new Date(); const s=new Date(t.getFullYear(),t.getMonth(),1); return {s:fmt(s),e:yesterday()}; },
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
async function fetchCamps(s, e) {
  return supa(`campaign_daily?select=*&date=gte.${s}&date=lte.${e}&order=date.asc`);
}
async function fetchGA4(s, e) {
  return supa(`ga4_conversions?select=*&date=gte.${s}&date=lte.${e}&order=date.asc`);
}
async function fetchLogs() {
  return supa(`sync_logs?select=*&order=finished_at.desc&limit=20`);
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
