let _metaData = null;
let _metaSubTab = 'campanhas';
let _metaCreativos = { topo: null, fundo: null };

function metaSubtabBtn(id, label) {
  const active = _metaSubTab === id;
  return `<button onclick="switchMetaSubTab('${id}')"
    style="background:${active ? '#d2992222' : '#161b22'};border:1px solid ${active ? '#d29922' : '#30363d'};
      color:${active ? '#d29922' : '#8b949e'};border-radius:6px;padding:7px 16px;font-size:13px;font-weight:600;
      cursor:pointer;transition:all .15s">${label}</button>`;
}

function renderMetaSubtabs() {
  return `<div style="display:flex;gap:8px;margin-bottom:20px">
    ${metaSubtabBtn('campanhas', 'Campanhas')}
    ${metaSubtabBtn('fundo', 'Criativos Fundo')}
    ${metaSubtabBtn('topo', 'Criativos Topo')}
  </div>`;
}

async function switchMetaSubTab(id) {
  _metaSubTab = id;
  document.getElementById('m-subtabs').innerHTML = renderMetaSubtabs();
  const body = document.getElementById('m-subtab-body');
  if (id === 'campanhas') { renderMetaCampanhas(); return; }

  body.innerHTML = `<div class="loading"><div class="spinner"></div>Carregando criativos…</div>`;
  const cached = _metaCreativos[id];
  if (cached && cached.start === S.start && cached.end === S.end) {
    body.innerHTML = cached.html;
    return;
  }

  const rows = await supa(`meta_creatives?select=*&date=gte.${S.start}&date=lte.${S.end}&campaign_name=ilike.*${id}*&order=date.asc`);
  const ads = aggMetaByAd(rows);
  const html = id === 'topo'
    ? metaTable(ads, '🟡 Meta · Criativos Topo (Branding)', null)
    : metaFundoTable(ads, '🟡 Meta · Criativos Fundo (Conversão)', null);

  _metaCreativos[id] = { start: S.start, end: S.end, html };
  if (_metaSubTab === id) body.innerHTML = html;
}

function renderMetaCampanhas() {
  if (!_metaData) return;
  const { agg, hasCmp } = _metaData;
  const camps = agg.map(r => r.campaign_name);

  document.getElementById('m-subtab-body').innerHTML = `
  <div style="margin-bottom:16px;display:flex;align-items:center;gap:10px">
    <label style="font-size:12px;color:#8b949e;white-space:nowrap">Filtrar Campanha</label>
    <select id="metaCampFilter" onchange="renderMetaTable(this.value||null)"
      style="background:#161b22;border:1px solid #30363d;color:#e6edf3;border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer;min-width:280px">
      <option value="">Todas as Campanhas</option>
      ${camps.map(c=>`<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('')}
    </select>
  </div>
  <div class="kpi-grid cols-4" id="m-kpis" style="margin-bottom:20px"></div>
  <div class="card">
    <div class="card-title">Meta Ads — Campanhas (${disp(S.start)} → ${disp(S.end)})</div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>#</th><th>Campanha</th><th class="r">Gasto</th>
        <th class="r">Cliques</th><th class="r">Impressões</th>
        <th class="r">CTR</th><th class="r">Conv.</th><th class="r">CPA</th>
        ${hasCmp?'<th class="r">Δ Gasto</th>':''}
      </tr></thead>
      <tbody id="m-tbody"></tbody>
    </table></div>
  </div>`;

  renderMetaTable(null);
}

function renderMetaTable(filterCamp) {
  if (!_metaData) return;
  const { agg, cmpAgg, cmpMap, hasCmp } = _metaData;
  const filtered    = filterCamp ? agg.filter(r => r.campaign_name === filterCamp) : agg;
  const cmpFiltered = filterCamp ? cmpAgg.filter(r => r.campaign_name === filterCamp) : cmpAgg;

  const totSpend = sum(filtered,'spend'), totClicks=sum(filtered,'clicks'), totConv=sum(filtered,'conversions');
  const cTotSpend = cmpFiltered.length ? sum(cmpFiltered,'spend')       : undefined;
  const cTotClick = cmpFiltered.length ? sum(cmpFiltered,'clicks')      : undefined;
  const cTotConv  = cmpFiltered.length ? sum(cmpFiltered,'conversions') : undefined;

  document.getElementById('m-kpis').innerHTML =
    kpiCard('Investimento', totSpend, cTotSpend, fR, 'c-yellow') +
    kpiCard('Cliques',      totClicks, cTotClick, fN, 'c-green') +
    kpiCard('Conversões',   totConv,   cTotConv,  fN, 'c-blue') +
    kpiCard('CPA Médio', totConv>0?totSpend/totConv:null, (cTotConv&&cTotSpend&&cTotConv>0)?cTotSpend/cTotConv:undefined, fR, 'c-brand', true);

  document.getElementById('m-tbody').innerHTML = filtered.length ? filtered.map((r,i) => {
    const cmp    = cmpMap[r.campaign_name];
    const cpaCls = r.cpa==null?'c-muted':r.cpa<60?'c-green':r.cpa<130?'c-yellow':'c-red';
    return `<tr>
      <td class="c-muted">${i+1}</td>
      <td><strong>${r.campaign_name}</strong></td>
      <td class="r c-brand">${fR(r.spend)}</td>
      <td class="r">${fN(r.clicks)}</td>
      <td class="r c-muted">${fN(r.impressions)}</td>
      <td class="r">${fP(r.ctr)}</td>
      <td class="r">${fN(r.conversions)}</td>
      <td class="r ${cpaCls}">${r.cpa?fR(r.cpa):'—'}</td>
      ${hasCmp?`<td class="r">${cmp?deltaHtml(r.spend,cmp.spend):'<span class="d-neu">novo</span>'}</td>`:''}
    </tr>`;
  }).join('') : emptyRow(hasCmp ? 9 : 8);
}

async function tabMeta() {
  loading();
  ensureCreativeModal();
  _metaSubTab = 'campanhas';
  _metaCreativos = { topo: null, fundo: null };

  const [campAgg, cmpCampAgg] = await Promise.all([
    fetchCampAgg(S.start, S.end),
    S.compare && S.cmpStart ? fetchCampAgg(S.cmpStart, S.cmpEnd) : [],
  ]);

  const addMetrics = rows => rows.map(r => ({...r,
    ctr: r.impressions>0 ? r.clicks/r.impressions*100 : 0,
    cpa: r.conversions>0 ? r.spend/r.conversions : null
  }));

  const agg    = addMetrics(campAgg.filter(r=>r.platform==='meta')).sort((a,b)=>b.spend-a.spend);
  const cmpAgg = cmpCampAgg.length ? addMetrics(cmpCampAgg.filter(r=>r.platform==='meta')) : [];
  const cmpMap = Object.fromEntries(cmpAgg.map(r=>[r.campaign_name,r]));
  const hasCmp = S.compare && cmpAgg.length > 0;

  _metaData = { agg, cmpAgg, cmpMap, hasCmp };

  document.getElementById('content').innerHTML = `
    <div id="m-subtabs">${renderMetaSubtabs()}</div>
    <div id="m-subtab-body"></div>`;

  renderMetaCampanhas();
}
