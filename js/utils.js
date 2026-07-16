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

// Categoria da campanha (Non brand / Brand Search), derivada do nome — segue a mesma convenção
// de nomenclatura já usada (google_brandsearch_vendas_search_... vs google_nonbrand_vendas_...).
function campaignCategory(campaignName) {
  return (campaignName||'').toLowerCase().includes('brandsearch') ? 'Brand Search' : 'Non brand';
}

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
async function fetchCheckoutAgg(s, e)          { return supaRpc('get_ga4_checkout_pages_agg',    { p_start: s, p_end: e }); }
async function fetchGA4SessionsByCampaign(s, e) { return supaRpc('get_ga4_sessions_by_campaign', { p_start: s, p_end: e }); }
async function fetchJusfyConversionsByCampaign(s, e) { return supaRpc('get_jusfy_conversions_by_campaign', { p_start: s, p_end: e }); }
async function fetchJusfyConversionsTotals(s, e) { return supaRpc('get_jusfy_conversions_totals', { p_start: s, p_end: e }); }
async function fetchJusfyConversionsDailyAgg(s, e) { return supaRpc('get_jusfy_conversions_daily_agg', { p_start: s, p_end: e }); }
async function fetchInstagramMediaAgg(s, e)        { return supaRpc('get_instagram_media_agg',        { p_start: s, p_end: e }); }
async function fetchInstagramAccountDailyAgg(s, e) { return supaRpc('get_instagram_account_daily_agg', { p_start: s, p_end: e }); }
async function fetchCreativeRealConversions(s, e)  { return supaRpc('get_creative_real_conversions',   { p_start: s, p_end: e }); }
async function fetchKeywordPerformance(s, e, aliases) { return supaRpc('get_keyword_performance', { p_start: s, p_end: e, p_aliases: aliases || {} }); }

// ── Match de conversões reais (Metabase) — ver js/conversions-match.js ──

// ── Gráfico combinado (barras empilhadas + linha), usado em Geral/Google/Meta/Bing ──
function fAxisCompact(n) {
  if (n == null || isNaN(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n/1e6).toFixed(1).replace(/\.0$/,'').replace('.', ',') + 'M';
  if (abs >= 1e3) return (n/1e3).toFixed(1).replace(/\.0$/,'').replace('.', ',') + 'k';
  return String(Math.round(n));
}

const _comboCharts = {};

// barDatasets: [{label, data, backgroundColor}] — sempre em R$, eixo y (esquerda).
// lineDatasets: [{label, data, borderColor, yAxisID}] — yAxisID 'y' (R$, ex: CAC) ou 'y1' (contagem, ex: Cadastros Reais).
function renderComboChart(canvasId, labels, barDatasets, lineDatasets) {
  const canvas = document.getElementById(canvasId);
  if (_comboCharts[canvasId]) { _comboCharts[canvasId].destroy(); delete _comboCharts[canvasId]; }
  if (!canvas || !labels.length) return;

  const y1Line  = lineDatasets.find(d => (d.yAxisID||'y1') === 'y1') || lineDatasets[0];
  const y1Color = (y1Line && y1Line.borderColor) || '#02A378';
  const y1Label = (y1Line && y1Line.label) || 'Cadastros';

  // Chart.js desenha em ordem crescente de "order" — quem desenha por último fica na frente.
  // As barras precisam de order menor (fundo) e as linhas de order maior (frente).
  const datasets = [
    ...barDatasets.map(d => ({ type:'bar', borderRadius:4, borderWidth:0, stack:'spend', yAxisID:'y', order:1, ...d })),
    ...lineDatasets.map(d => ({ type:'line', borderWidth:3, pointBorderWidth:2, pointRadius:3,
      tension:.3, fill:false, backgroundColor:'#ffffff', yAxisID:'y1', order:2, pointBackgroundColor:d.borderColor, ...d })),
  ];

  _comboCharts[canvasId] = new Chart(canvas.getContext('2d'), {
    data: { labels, datasets },
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index', intersect:false},
      scales:{
        x:{ stacked:true, grid:{display:false}, ticks:{color:'#212121BF', font:{size:10}} },
        y:{ stacked:true, position:'left', grid:{color:'#FAFAFA'},
            ticks:{color:'#212121BF', font:{size:10}, callback:v=>'R$ '+fAxisCompact(v)},
            title:{display:true, text:'Investimento / CAC (R$)', color:'#212121BF', font:{size:10,weight:'600'}} },
        y1:{ position:'right', grid:{drawOnChartArea:false},
             ticks:{color:y1Color, font:{size:10}, callback:v=>fAxisCompact(v)},
             title:{display:true, text:y1Label, color:y1Color, font:{size:10,weight:'600'}} },
      },
      plugins:{
        legend:{display:true, position:'top', align:'end', labels:{color:'#212121', boxWidth:10, usePointStyle:true, font:{size:11}}},
        tooltip:{
          backgroundColor:'#212121', titleColor:'#fff', bodyColor:'#fff', padding:10, cornerRadius:8,
          callbacks:{ label: ctx => (ctx.dataset.type==='bar' || ctx.dataset.yAxisID==='y')
            ? `${ctx.dataset.label}: ${fR(ctx.parsed.y)}` : `${ctx.dataset.label}: ${fN(ctx.parsed.y)}` },
        },
      },
    },
  });
}

// Agrupa saída de get_jusfy_conversions_daily_agg em {data: {canal: clientes_unicos}}, usando a mesma
// classificação por campanha/referral do resto do app (ver classifyRealConversionChannel).
function aggregateDailyRealConversionsByChannel(rows, campaignLookup) {
  const byDate = {};
  for (const r of rows||[]) {
    const ch = classifyRealConversionChannel(r, campaignLookup);
    if (!byDate[r.date]) byDate[r.date] = {};
    byDate[r.date][ch] = (byDate[r.date][ch]||0) + (+r.clientes_unicos||0);
  }
  return byDate;
}

// Constrói labels (dia ou mês, dependendo do range) e arrays alinhados de gasto+conversões,
// pra alimentar renderComboChart. platformSpendMap: {date: valor}. channelConvMap: {date:{canal:qtd}}.
function buildComboChartSeries(start, end, platformSpendMap, channelConvMap, channelLabel) {
  const days = Object.keys(platformSpendMap).sort();
  const diffDays = (new Date(end) - new Date(start)) / 864e5;

  const cacOf = (spend, conv) => conv > 0 ? spend / conv : null;

  if (diffDays <= 45) {
    const spend = days.map(d => platformSpendMap[d] || 0);
    const conv  = days.map(d => (channelConvMap[d] && channelConvMap[d][channelLabel]) || 0);
    return {
      labels: days.map(d => d.slice(5).split('-').reverse().join('/')),
      spend, conv,
      cac: spend.map((s,i) => cacOf(s, conv[i])),
    };
  }
  const mMap = {};
  for (const d of days) {
    const mon = d.slice(0,7);
    if (!mMap[mon]) mMap[mon] = { spend:0, conv:0 };
    mMap[mon].spend += (platformSpendMap[d] || 0);
    mMap[mon].conv  += (channelConvMap[d] && channelConvMap[d][channelLabel]) || 0;
  }
  const months = Object.keys(mMap).sort();
  const spend = months.map(mon => mMap[mon].spend);
  const conv  = months.map(mon => mMap[mon].conv);
  return {
    labels: months.map(mon => new Date(mon+'-15').toLocaleDateString('pt-BR',{month:'short',year:'2-digit'})),
    spend, conv,
    cac: spend.map((s,i) => cacOf(s, conv[i])),
  };
}

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
