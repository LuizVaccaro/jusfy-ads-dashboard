let _metaData = null;
let _metaSubTab = 'campanhas';
let _metaCreativos = { topo: null, fundo: null };

function metaSubtabBtn(id, label) {
  const active = _metaSubTab === id;
  return `<button onclick="switchMetaSubTab('${id}')"
    style="background:${active ? '#ed723e22' : '#ffffff'};border:1px solid ${active ? '#ed723e' : '#E7E8EC'};
      color:${active ? '#ed723e' : '#212121BF'};border-radius:6px;padding:7px 16px;font-size:13px;font-weight:600;
      cursor:pointer;transition:all .15s">${label}</button>`;
}

function renderMetaSubtabs() {
  return `<div style="display:flex;gap:8px;margin-bottom:20px">
    ${metaSubtabBtn('campanhas', 'Campanhas')}
    ${metaSubtabBtn('fundo', 'Criativos Fundo')}
    ${metaSubtabBtn('topo', 'Criativos Topo')}
  </div>`;
}

function renderMetaCreativeSubtab(id, ads) {
  const tableId = 'meta-' + id;
  registerSortRenderer(tableId, () => {
    if (_metaSubTab === id) document.getElementById('m-subtab-body').innerHTML = renderMetaCreativeSubtabHtml(id, ads);
  });
  return renderMetaCreativeSubtabHtml(id, ads);
}

function renderMetaCreativeSubtabHtml(id, ads) {
  const tableId = 'meta-' + id;
  return id === 'topo'
    ? metaTable(ads, '🟡 Meta · Criativos Topo (Branding)', null, tableId)
    : metaFundoTable(ads, '🟡 Meta · Criativos Fundo (Conversão)', null, tableId);
}

async function switchMetaSubTab(id) {
  _metaSubTab = id;
  document.getElementById('m-subtabs').innerHTML = renderMetaSubtabs();
  const body = document.getElementById('m-subtab-body');
  if (id === 'campanhas') { renderMetaCampanhas(); return; }

  body.innerHTML = `<div class="loading"><div class="spinner"></div>Carregando criativos…</div>`;
  const cached = _metaCreativos[id];
  let ads;
  if (cached && cached.start === S.start && cached.end === S.end) {
    ads = cached.ads;
  } else {
    const [rows, realRows] = await Promise.all([
      supa(`meta_creatives?select=*&date=gte.${S.start}&date=lte.${S.end}&campaign_name=ilike.*${id}*&order=date.asc`),
      fetchCreativeRealConversions(S.start, S.end),
    ]);
    const realMap = buildCreativeConversionsMap(realRows);
    ads = mergeCreativeRealConversions(aggMetaByAd(rows), realMap);
    _metaCreativos[id] = { start: S.start, end: S.end, ads };
  }

  const html = renderMetaCreativeSubtab(id, ads);
  if (_metaSubTab === id) body.innerHTML = html;
}

function renderMetaCampanhas() {
  if (!_metaData) return;
  const { agg, dailyChart } = _metaData;
  const camps = agg.map(r => r.campaign_name);
  _metaFilter = null;
  registerSortRenderer('meta', () => renderMetaTable());

  document.getElementById('m-subtab-body').innerHTML = `
  <div style="margin-bottom:16px;display:flex;align-items:center;gap:10px">
    <label style="font-size:12px;color:#212121BF;white-space:nowrap">Filtrar Campanha</label>
    <select id="metaCampFilter" onchange="renderMetaTable(this.value||null)"
      style="background:#ffffff;border:1px solid #E7E8EC;color:#212121;border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer;min-width:280px">
      <option value="">Todas as Campanhas</option>
      ${camps.map(c=>`<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('')}
    </select>
  </div>
  <div class="kpi-grid cols-4" id="m-kpis" style="margin-bottom:20px"></div>
  <div class="card" style="margin-bottom:16px">
    <div class="card-title">Investimento Diário × Cadastros Reais</div>
    <div style="height:300px;position:relative">
      ${dailyChart.labels.length===0 ? '<div class="c-muted" style="text-align:center;padding:40px;font-size:13px">Sem dados</div>' : '<canvas id="metaChart"></canvas>'}
    </div>
  </div>
  <div class="card">
    <div class="card-title">Meta Ads — Campanhas (${disp(S.start)} → ${disp(S.end)})</div>
    <div class="table-wrap"><table>
      <thead><tr id="m-thead"></tr></thead>
      <tbody id="m-tbody"></tbody>
    </table></div>
  </div>`;

  renderMetaTable(null);
  renderComboChart('metaChart', dailyChart.labels, [{ label:'Meta Ads', data:dailyChart.spend, backgroundColor:'#017858' }], [
    { label:'Cadastros Reais', data:dailyChart.conv, borderColor:'#41C78F', yAxisID:'y1' },
    { label:'CAC', data:dailyChart.cac, borderColor:'#e05a69', yAxisID:'y', borderDash:[5,3] },
  ]);
}

let _metaFilter = null;

function renderMetaTable(filterCamp) {
  if (filterCamp !== undefined) _metaFilter = filterCamp;
  if (!_metaData) return;
  const { agg, cmpAgg, cmpMap, hasCmp } = _metaData;
  const filterVal   = _metaFilter;
  const filtered0   = filterVal ? agg.filter(r => r.campaign_name === filterVal) : agg;
  const cmpFiltered = filterVal ? cmpAgg.filter(r => r.campaign_name === filterVal) : cmpAgg;

  const st = getSort('meta', 'spend', 'desc');
  const filtered = sortRows(filtered0, st.key, st.dir);

  const totSpend = sum(filtered,'spend'), totClicks=sum(filtered,'clicks'), totConv=sum(filtered,'conversions');
  const cTotSpend = cmpFiltered.length ? sum(cmpFiltered,'spend')       : undefined;
  const cTotClick = cmpFiltered.length ? sum(cmpFiltered,'clicks')      : undefined;
  const cTotConv  = cmpFiltered.length ? sum(cmpFiltered,'conversions') : undefined;

  document.getElementById('m-kpis').innerHTML =
    kpiCard('Investimento', totSpend, cTotSpend, fR, 'c-yellow') +
    kpiCard('Cliques',      totClicks, cTotClick, fN, 'c-green') +
    kpiCard('Cadastros Reais', totConv, cTotConv, fN, 'c-blue') +
    kpiCard('CAC Real Médio', totConv>0?totSpend/totConv:null, (cTotConv&&cTotSpend&&cTotConv>0)?cTotSpend/cTotConv:undefined, fR, 'c-brand', true);

  document.getElementById('m-thead').innerHTML =
    `<th>#</th>${sortTh('meta','Campanha','campaign_name','asc','')}
     ${sortTh('meta','Gasto','spend')}${sortTh('meta','Impressões','impressions')}
     ${sortTh('meta','Cliques','clicks')}${sortTh('meta','Sessões','sessions')}
     ${sortTh('meta','CTR','ctr')}${sortTh('meta','Tx Conversão','txConv')}
     ${sortTh('meta','Cadastros','conversions')}${sortTh('meta','CAC Real','cpa')}
     ${hasCmp?'<th class="r">Δ Gasto</th>':''}`;

  document.getElementById('m-tbody').innerHTML = filtered.length ? filtered.map((r,i) => {
    const cmp    = cmpMap[r.campaign_name];
    const cpaCls = r.cpa==null?'c-muted':r.cpa<60?'c-green':r.cpa<130?'c-yellow':'c-red';
    return `<tr>
      <td class="c-muted">${i+1}</td>
      <td><strong>${r.campaign_name}</strong></td>
      <td class="r c-brand">${fR(r.spend)}</td>
      <td class="r c-muted">${fN(r.impressions)}</td>
      <td class="r">${fN(r.clicks)}</td>
      <td class="r">${fN(r.sessions)}</td>
      <td class="r">${fP(r.ctr)}</td>
      <td class="r">${fP(r.txConv)}</td>
      <td class="r">${fN(r.conversions)}</td>
      <td class="r ${cpaCls}">${r.cpa?fR(r.cpa):'—'}</td>
      ${hasCmp?`<td class="r">${cmp?deltaHtml(r.spend,cmp.spend):'<span class="d-neu">novo</span>'}</td>`:''}
    </tr>`;
  }).join('') : emptyRow(hasCmp ? 11 : 10);
}

async function tabMeta() {
  loading();
  ensureCreativeModal();
  _metaSubTab = 'campanhas';
  _metaCreativos = { topo: null, fundo: null };

  const [campAgg, cmpCampAgg, ga4Camp, cmpGA4Camp, convRows, cmpConvRows, dailyByPlatform, convDaily, campsRaw] = await Promise.all([
    fetchCampAgg(S.start, S.end),
    S.compare && S.cmpStart ? fetchCampAgg(S.cmpStart, S.cmpEnd) : [],
    fetchGA4SessionsByCampaign(S.start, S.end),
    S.compare && S.cmpStart ? fetchGA4SessionsByCampaign(S.cmpStart, S.cmpEnd) : [],
    fetchJusfyConversionsByCampaign(S.start, S.end),
    S.compare && S.cmpStart ? fetchJusfyConversionsByCampaign(S.cmpStart, S.cmpEnd) : [],
    fetchCampDailyByPlatform(S.start, S.end),
    fetchJusfyConversionsDailyAgg(S.start, S.end),
    fetchCamps(S.start, S.end),
  ]);

  const sessMap    = Object.fromEntries(ga4Camp.map(r => [(r.campaign||'').toLowerCase(), +r.sessions||0]));
  const cmpSessMap = Object.fromEntries(cmpGA4Camp.map(r => [(r.campaign||'').toLowerCase(), +r.sessions||0]));

  const addMetrics = (rows, sMap) => rows.map(r => {
    const sessions = sMap[(r.campaign_name||'').toLowerCase()] || 0;
    return {...r,
      ctr: r.impressions>0 ? r.clicks/r.impressions*100 : 0,
      cpa: r.conversions>0 ? r.spend/r.conversions : null,
      sessions,
      txConv: sessions>0 ? r.conversions/sessions*100 : 0,
    };
  });

  const aggRaw    = addMetrics(campAgg.filter(r=>r.platform==='meta'), sessMap);
  const cmpAggRaw = cmpCampAgg.length ? addMetrics(cmpCampAgg.filter(r=>r.platform==='meta'), cmpSessMap) : [];

  // Substitui conversões/CPA de plataforma pelas conversões reais do Metabase (jusfy_conversions_daily)
  const agg    = mergeRealConversions(aggRaw, convRows, 'meta');
  const cmpAgg = cmpAggRaw.length ? mergeRealConversions(cmpAggRaw, cmpConvRows, 'meta') : [];
  const cmpMap = Object.fromEntries(cmpAgg.map(r=>[r.campaign_name,r]));
  const hasCmp = S.compare && cmpAgg.length > 0;

  const spendByDate = {};
  for (const r of dailyByPlatform) if (r.platform === 'meta') spendByDate[r.date] = (spendByDate[r.date]||0) + (+r.spend||0);
  const campaignLookup = buildCampaignLookup(campsRaw);
  const channelConvMap = aggregateDailyRealConversionsByChannel(convDaily, campaignLookup);
  const dailyChart = buildComboChartSeries(S.start, S.end, spendByDate, channelConvMap, 'Meta Ads');

  _metaData = { agg, cmpAgg, cmpMap, hasCmp, dailyChart };

  document.getElementById('content').innerHTML = `
    <div id="m-subtabs">${renderMetaSubtabs()}</div>
    <div id="m-subtab-body"></div>`;

  renderMetaCampanhas();
}
