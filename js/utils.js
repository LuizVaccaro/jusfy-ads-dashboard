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

// ── Match de conversões reais (Metabase) contra campanhas de ads ──
// referral no Metabase é um valor solto por canal (Google/Meta/Bing/Affiliate/Others/OAB/ChatGPT/TikTok,
// nunca em branco) — tudo que não bate nesses padrões é tráfego orgânico/não pago e fica de fora por definição.
const PLATFORM_REFERRAL_PATTERNS = {
  google_ads: /google|adwords/i,
  meta:       /meta|fb|facebook|v4facebookads/i,
  bing_ads:   /bing/i,
};

// Vocabulário de features conhecidas nos nomes de campanha (ex: google_nonbrand_vendas_search_<feature>).
// Usado quando o utm_campaign do Metabase não bate com o nome exato da campanha (DSA/PMax/JusFinder
// e nomes de anúncio entre colchetes só carregam a feature, não o nome completo da campanha).
// "institucional" fica por último de propósito: nomes como "[ONGOING]...Jusprocessos (Institucional)"
// contêm as duas palavras, e a feature específica (jusprocessos) deve ganhar da genérica (institucional).
const FEATURE_KEYWORDS = [
  'jusfinder','dsa','pmax','jusgpt','jusprocessos','jusrevisional',
  'risprudencia','justrabalhista','juscalc','oabsp','oabmg','oabrj','oabrs',
  'institucional',
];

// Categorias "de conteúdo" que o Metabase já marca via marketing_category — não são plataforma de
// ads, então não fazem sentido cair em "Outros" quando existe um rótulo mais específico.
const CONTENT_CATEGORIES = ['Social', 'Comunidade', 'CRM', 'ChatGPT'];

// Monta um índice (por plataforma) de nomes de campanha + campaign_id, a partir de linhas cruas de
// campaign_daily (com campaign_id — get_camp_agg não tem esse campo, por isso pedimos fetchCamps).
// Usado pra corrigir casos em que o Metabase gravou o referral errado (Affiliate/Others) mas o
// utm_campaign é claramente uma campanha paga (nome completo ou o próprio campaign_id numérico).
function buildCampaignLookup(campaignRows) {
  const lookup = {
    google_ads: { names: new Set(), ids: new Set() },
    meta:       { names: new Set(), ids: new Set() },
    bing_ads:   { names: new Set(), ids: new Set() },
  };
  for (const r of campaignRows||[]) {
    const bucket = lookup[r.platform];
    if (!bucket) continue;
    if (r.campaign_name) bucket.names.add(r.campaign_name.toLowerCase());
    if (r.campaign_id != null) bucket.ids.add(String(r.campaign_id));
  }
  return lookup;
}

// Resolve um utm_campaign pra 'Google Ads'/'Meta Ads'/'Bing Ads' usando o lookup acima — por nome
// exato, campaign_id exato, ou feature keyword compartilhada com alguma campanha real daquela
// plataforma. Retorna null se não achar nada (aí quem chamou decide o fallback).
function resolveAdPlatformForUtm(utm, lookup) {
  if (!lookup) return null;
  const val = (utm||'').trim().toLowerCase();
  if (!val) return null;
  if (lookup.google_ads.names.has(val) || lookup.google_ads.ids.has(val)) return 'Google Ads';
  if (lookup.meta.names.has(val)       || lookup.meta.ids.has(val))       return 'Meta Ads';
  if (lookup.bing_ads.names.has(val)   || lookup.bing_ads.ids.has(val))   return 'Bing Ads';
  // Bing usa a mesma convenção de nomes (bing_nonbrand_vendas_search_<feature>) — não tenta casar
  // por keyword nos buckets Google/Meta nesse caso, senão "bing_..._jusfinder" seria roubado.
  if (val.startsWith('bing_') || PLATFORM_REFERRAL_PATTERNS.bing_ads.test(val)) return null;
  for (const kw of FEATURE_KEYWORDS) {
    if (!val.includes(kw)) continue;
    if ([...lookup.google_ads.names].some(n => n.includes(kw))) return 'Google Ads';
    if ([...lookup.meta.names].some(n => n.includes(kw)))       return 'Meta Ads';
  }
  return null;
}

// Classifica uma linha de jusfy_conversions_daily em um canal de alto nível, pra bater com o
// controle manual. `campaignLookup` (opcional, de buildCampaignLookup) tem prioridade — um
// utm_campaign que bate com nome/ID de campanha real vale mais que o referral, que às vezes vem
// errado (Affiliate/Others em cadastros que na verdade vieram de uma campanha paga). Sem lookup,
// cai no referral; o que sobrar vira Orgânico, uma categoria de conteúdo conhecida, ou Outros.
function classifyRealConversionChannel(row, campaignLookup) {
  const resolved = resolveAdPlatformForUtm(row.utm_campaign, campaignLookup);
  if (resolved) return resolved;

  const tipo = (row.tipo_de_trafego||'').toLowerCase();
  if (tipo.startsWith('org')) return 'Orgânico';
  const referral = row.referral || '';
  if (PLATFORM_REFERRAL_PATTERNS.google_ads.test(referral)) return 'Google Ads';
  if (PLATFORM_REFERRAL_PATTERNS.meta.test(referral))       return 'Meta Ads';
  if (PLATFORM_REFERRAL_PATTERNS.bing_ads.test(referral))   return 'Bing Ads';
  if (CONTENT_CATEGORIES.includes(row.marketing_category))  return row.marketing_category;
  return 'Outros';
}

// Agrega saída de get_jusfy_conversions_totals em totais por canal.
function aggregateRealConversionsByChannel(rows, campaignLookup) {
  const byChannel = {};
  for (const r of rows||[]) {
    const ch = classifyRealConversionChannel(r, campaignLookup);
    if (!byChannel[ch]) byChannel[ch] = { clientes_unicos: 0 };
    byChannel[ch].clientes_unicos += +r.clientes_unicos || 0;
  }
  return byChannel;
}

// Junta campanhas (campaignRows, já com spend/clicks/impressions/sessions) com as conversões reais
// (conversionRows, saída crua de get_jusfy_conversions_by_campaign) para o platformKey dado
// ('google_ads' ou 'meta'). Quando várias campanhas compartilham a mesma feature (ex: jusfinder,
// jusfinder_oabrj e a variante de teste) e o Metabase só consegue diferenciar por essa feature,
// elas são mescladas em 1 linha só — não dá pra inventar um split que o Metabase não fornece.
function mergeRealConversions(campaignRows, conversionRows, platformKey) {
  // Nome exato de campanha vale independente do referral (o Metabase às vezes grava errado —
  // Affiliate/Others — em cadastros que vieram de campanha paga de verdade). Já o fallback por
  // keyword PRECISA checar o referral: Bing usa a mesma convenção de nomes que o Google
  // (bing_..._jusfinder), então um utm genérico "JusFinder" do Google não pode ser atribuído
  // ao Bing só porque a palavra bate — sem essa checagem, cada mergeRealConversions(plataforma)
  // "rouba" cadastros genéricos de outras plataformas que a mesma feature.
  const pattern = PLATFORM_REFERRAL_PATTERNS[platformKey];
  const convs = conversionRows||[];

  const nameLower  = c => (c.campaign_name||'').toLowerCase();
  const keywordsOf = c => FEATURE_KEYWORDS.filter(k => nameLower(c).includes(k));

  // keyword -> campanhas (do período atual) cujo nome contém essa keyword
  const keywordToCampaigns = {};
  campaignRows.forEach(c => keywordsOf(c).forEach(k => {
    (keywordToCampaigns[k] = keywordToCampaigns[k] || []).push(c);
  }));

  // Uma keyword só vira "bucket" de verdade se cobrir mais de 1 campanha do período atual —
  // isso já cobre o caso de hoje (jusfinder x3) e se auto-ajusta se surgir uma 2ª campanha DSA/PMax.
  const groupIdOf = c => {
    const shared = keywordsOf(c).filter(k => keywordToCampaigns[k].length > 1);
    return shared.length ? shared[0] : `campaign:${nameLower(c)}`;
  };

  const groups = {}; // groupId -> campaignRow[]
  campaignRows.forEach(c => {
    const g = groupIdOf(c);
    (groups[g] = groups[g] || []).push(c);
  });

  // Resolve o groupId de um utm_campaign do Metabase SEMPRE via groupIdOf de uma campanha real,
  // nunca retornando a keyword crua — senão o id não bate com a chave usada em `groups`.
  const resolveGroupId = (utm, referral) => {
    const lower = (utm||'').trim().toLowerCase();
    if (!lower) return null;
    const exact = campaignRows.find(c => nameLower(c) === lower);
    if (exact) return groupIdOf(exact);
    if (!pattern.test(referral||'')) return null;
    const candidates = FEATURE_KEYWORDS.filter(k => lower.includes(k) && keywordToCampaigns[k]);
    if (candidates.length > 1) {
      console.warn(`[realConv] utm_campaign "${utm}" ambíguo entre features: ${candidates.join(', ')} — usando "${candidates[0]}"`);
    }
    if (!candidates.length) return null;
    return groupIdOf(keywordToCampaigns[candidates[0]][0]);
  };

  const realByGroup = {}; // groupId -> {clientes}
  convs.forEach(r => {
    const gid = resolveGroupId(r.utm_campaign, r.referral);
    if (!gid) {
      console.warn(`[realConv][${platformKey}] utm_campaign sem campanha correspondente: "${r.utm_campaign}" (referral="${r.referral}")`);
      return;
    }
    if (!realByGroup[gid]) realByGroup[gid] = { clientes: 0 };
    realByGroup[gid].clientes += +r.clientes_unicos || 0;
  });

  const out = [];
  for (const gid in groups) {
    const members = groups[gid];
    const real = realByGroup[gid] || { clientes: 0 };
    const base = members.length === 1
      ? { ...members[0] }
      : {
          campaign_name: `🔗 ${gid} (${members.length} campanhas agregadas)`,
          spend:       sum(members, 'spend'),
          clicks:      sum(members, 'clicks'),
          impressions: sum(members, 'impressions'),
          sessions:    sum(members, 'sessions'),
        };
    base.conversions = real.clientes;
    base.cpa = real.clientes > 0 ? base.spend / real.clientes : null;
    base.ctr = base.impressions > 0 ? base.clicks / base.impressions * 100 : 0;
    base.txConv = base.sessions > 0 ? real.clientes / base.sessions * 100 : 0;
    out.push(base);
  }
  return out.sort((a,b) => b.spend - a.spend);
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
