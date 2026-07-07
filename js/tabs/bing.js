let _bingData = null;
let _bingFilter = null;
let _bingCategoryFilter = null;

function renderBingTable(filterCamp, filterCategory) {
  if (filterCamp !== undefined) _bingFilter = filterCamp;
  if (filterCategory !== undefined) _bingCategoryFilter = filterCategory;
  if (!_bingData) return;
  const { agg, cmpAgg, cmpMap, hasCmp } = _bingData;
  const filterVal  = _bingFilter;
  const catVal     = _bingCategoryFilter;
  const matches    = r => (!filterVal || r.campaign_name === filterVal) && (!catVal || campaignCategory(r.campaign_name) === catVal);
  const filtered0   = agg.filter(matches);
  const cmpFiltered = cmpAgg.filter(matches);

  const st = getSort('bing', 'spend', 'desc');
  const filtered = sortRows(filtered0, st.key, st.dir);

  const totSpend = sum(filtered,'spend'), totClicks=sum(filtered,'clicks'), totConv=sum(filtered,'conversions');
  const cTotSpend = cmpFiltered.length ? sum(cmpFiltered,'spend')       : undefined;
  const cTotClick = cmpFiltered.length ? sum(cmpFiltered,'clicks')      : undefined;
  const cTotConv  = cmpFiltered.length ? sum(cmpFiltered,'conversions') : undefined;

  document.getElementById('bi-kpis').innerHTML =
    kpiCard('Investimento', totSpend, cTotSpend, fR, 'c-blue') +
    kpiCard('Cliques',      totClicks, cTotClick, fN, 'c-green') +
    kpiCard('Cadastros Reais', totConv, cTotConv, fN, 'c-yellow') +
    kpiCard('CAC Real Médio', totConv>0?totSpend/totConv:null, (cTotConv&&cTotSpend&&cTotConv>0)?cTotSpend/cTotConv:undefined, fR, 'c-brand', true);

  document.getElementById('bi-thead').innerHTML =
    `<th>#</th>${sortTh('bing','Campanha','campaign_name','asc','')}
     ${sortTh('bing','Gasto','spend')}${sortTh('bing','Impressões','impressions')}
     ${sortTh('bing','Cliques','clicks')}${sortTh('bing','Sessões','sessions')}
     ${sortTh('bing','CTR','ctr')}${sortTh('bing','Tx Conversão','txConv')}
     ${sortTh('bing','Cadastros','conversions')}${sortTh('bing','CAC Real','cpa')}
     ${hasCmp?'<th class="r">Δ Gasto</th>':''}`;

  document.getElementById('bi-tbody').innerHTML = filtered.length ? filtered.map((r,i) => {
    const cmp    = cmpMap[r.campaign_name];
    const cpaCls = r.cpa==null?'c-muted':r.cpa<100?'c-green':r.cpa<200?'c-yellow':'c-red';
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

async function tabBing() {
  loading();
  const [campAgg, cmpCampAgg, ga4Camp, cmpGA4Camp, convRows, cmpConvRows] = await Promise.all([
    fetchCampAgg(S.start, S.end),
    S.compare && S.cmpStart ? fetchCampAgg(S.cmpStart, S.cmpEnd) : [],
    fetchGA4SessionsByCampaign(S.start, S.end),
    S.compare && S.cmpStart ? fetchGA4SessionsByCampaign(S.cmpStart, S.cmpEnd) : [],
    fetchJusfyConversionsByCampaign(S.start, S.end),
    S.compare && S.cmpStart ? fetchJusfyConversionsByCampaign(S.cmpStart, S.cmpEnd) : [],
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

  const aggRaw    = addMetrics(campAgg.filter(r=>r.platform==='bing_ads'), sessMap);
  const cmpAggRaw = cmpCampAgg.length ? addMetrics(cmpCampAgg.filter(r=>r.platform==='bing_ads'), cmpSessMap) : [];

  // Substitui conversões/CPA de plataforma pelas conversões reais do Metabase (jusfy_conversions_daily)
  const agg    = mergeRealConversions(aggRaw, convRows, 'bing_ads');
  const cmpAgg = cmpAggRaw.length ? mergeRealConversions(cmpAggRaw, cmpConvRows, 'bing_ads') : [];
  const cmpMap = Object.fromEntries(cmpAgg.map(r=>[r.campaign_name,r]));
  const hasCmp = S.compare && cmpAgg.length > 0;

  _bingData = { agg, cmpAgg, cmpMap, hasCmp };
  _bingFilter = null;
  _bingCategoryFilter = null;
  registerSortRenderer('bing', () => renderBingTable());

  const camps = agg.map(r => r.campaign_name);

  document.getElementById('content').innerHTML = `
  <div style="margin-bottom:16px;display:flex;align-items:center;gap:20px;flex-wrap:wrap">
    <div style="display:flex;align-items:center;gap:10px">
      <label style="font-size:12px;color:#8b949e;white-space:nowrap">Filtrar Campanha</label>
      <select id="bingCampFilter" onchange="renderBingTable(this.value||null, undefined)"
        style="background:#161b22;border:1px solid #30363d;color:#e6edf3;border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer;min-width:280px">
        <option value="">Todas as Campanhas</option>
        ${camps.map(c=>`<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <label style="font-size:12px;color:#8b949e;white-space:nowrap">Categoria</label>
      <select id="bingCategoryFilter" onchange="renderBingTable(undefined, this.value||null)"
        style="background:#161b22;border:1px solid #30363d;color:#e6edf3;border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer;min-width:160px">
        <option value="">Todas as Categorias</option>
        <option value="Non brand">Non brand</option>
        <option value="Brand Search">Brand Search</option>
      </select>
    </div>
  </div>
  <div class="kpi-grid cols-4" id="bi-kpis" style="margin-bottom:20px"></div>
  <div class="card">
    <div class="card-title">Bing Ads — Campanhas (${disp(S.start)} → ${disp(S.end)})</div>
    <div class="table-wrap"><table>
      <thead><tr id="bi-thead"></tr></thead>
      <tbody id="bi-tbody"></tbody>
    </table></div>
  </div>`;

  renderBingTable(null);
}
