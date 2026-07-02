let _googleData = null;
let _googleFilter = null;

function renderGoogleTable(filterCamp) {
  if (filterCamp !== undefined) _googleFilter = filterCamp;
  if (!_googleData) return;
  const { agg, cmpAgg, cmpMap, hasCmp } = _googleData;
  const filterVal   = _googleFilter;
  const filtered0   = filterVal ? agg.filter(r => r.campaign_name === filterVal) : agg;
  const cmpFiltered = filterVal ? cmpAgg.filter(r => r.campaign_name === filterVal) : cmpAgg;

  const st = getSort('google', 'spend', 'desc');
  const filtered = sortRows(filtered0, st.key, st.dir);

  const totSpend = sum(filtered,'spend'), totClicks=sum(filtered,'clicks'), totConv=sum(filtered,'conversions');
  const cTotSpend = cmpFiltered.length ? sum(cmpFiltered,'spend')       : undefined;
  const cTotClick = cmpFiltered.length ? sum(cmpFiltered,'clicks')      : undefined;
  const cTotConv  = cmpFiltered.length ? sum(cmpFiltered,'conversions') : undefined;

  document.getElementById('g-kpis').innerHTML =
    kpiCard('Investimento', totSpend, cTotSpend, fR, 'c-blue') +
    kpiCard('Cliques',      totClicks, cTotClick, fN, 'c-green') +
    kpiCard('Conversões',   totConv,   cTotConv,  fN, 'c-yellow') +
    kpiCard('CPA Médio', totConv>0?totSpend/totConv:null, (cTotConv&&cTotSpend&&cTotConv>0)?cTotSpend/cTotConv:undefined, fR, 'c-brand', true);

  document.getElementById('g-thead').innerHTML =
    `<th>#</th>${sortTh('google','Campanha','campaign_name','asc','')}
     ${sortTh('google','Gasto','spend')}${sortTh('google','Impressões','impressions')}
     ${sortTh('google','Cliques','clicks')}${sortTh('google','CTR','ctr')}
     ${sortTh('google','Sessões','sessions')}
     ${sortTh('google','Conv.','conversions')}${sortTh('google','CPA','cpa')}
     ${hasCmp?'<th class="r">Δ Gasto</th>':''}`;

  document.getElementById('g-tbody').innerHTML = filtered.length ? filtered.map((r,i) => {
    const cmp    = cmpMap[r.campaign_name];
    const cpaCls = r.cpa==null?'c-muted':r.cpa<100?'c-green':r.cpa<200?'c-yellow':'c-red';
    return `<tr>
      <td class="c-muted">${i+1}</td>
      <td><strong>${r.campaign_name}</strong></td>
      <td class="r c-brand">${fR(r.spend)}</td>
      <td class="r c-muted">${fN(r.impressions)}</td>
      <td class="r">${fN(r.clicks)}</td>
      <td class="r">${fP(r.ctr)}</td>
      <td class="r">${fN(r.sessions)}</td>
      <td class="r">${fN(r.conversions)}</td>
      <td class="r ${cpaCls}">${r.cpa?fR(r.cpa):'—'}</td>
      ${hasCmp?`<td class="r">${cmp?deltaHtml(r.spend,cmp.spend):'<span class="d-neu">novo</span>'}</td>`:''}
    </tr>`;
  }).join('') : emptyRow(hasCmp ? 10 : 9);
}

async function tabGoogle() {
  loading();
  const [campAgg, cmpCampAgg, ga4Camp, cmpGA4Camp] = await Promise.all([
    fetchCampAgg(S.start, S.end),
    S.compare && S.cmpStart ? fetchCampAgg(S.cmpStart, S.cmpEnd) : [],
    fetchGA4SessionsByCampaign(S.start, S.end),
    S.compare && S.cmpStart ? fetchGA4SessionsByCampaign(S.cmpStart, S.cmpEnd) : [],
  ]);

  const sessMap    = Object.fromEntries(ga4Camp.map(r => [(r.campaign||'').toLowerCase(), +r.sessions||0]));
  const cmpSessMap = Object.fromEntries(cmpGA4Camp.map(r => [(r.campaign||'').toLowerCase(), +r.sessions||0]));

  const addMetrics = (rows, sMap) => rows.map(r => ({...r,
    ctr: r.impressions>0 ? r.clicks/r.impressions*100 : 0,
    cpa: r.conversions>0 ? r.spend/r.conversions : null,
    sessions: sMap[(r.campaign_name||'').toLowerCase()] || 0,
  }));

  const agg    = addMetrics(campAgg.filter(r=>r.platform==='google_ads'), sessMap).sort((a,b)=>b.spend-a.spend);
  const cmpAgg = cmpCampAgg.length ? addMetrics(cmpCampAgg.filter(r=>r.platform==='google_ads'), cmpSessMap) : [];
  const cmpMap = Object.fromEntries(cmpAgg.map(r=>[r.campaign_name,r]));
  const hasCmp = S.compare && cmpAgg.length > 0;

  _googleData = { agg, cmpAgg, cmpMap, hasCmp };
  _googleFilter = null;
  registerSortRenderer('google', () => renderGoogleTable());

  const camps = agg.map(r => r.campaign_name);

  document.getElementById('content').innerHTML = `
  <div style="margin-bottom:16px;display:flex;align-items:center;gap:10px">
    <label style="font-size:12px;color:#8b949e;white-space:nowrap">Filtrar Campanha</label>
    <select id="googleCampFilter" onchange="renderGoogleTable(this.value||null)"
      style="background:#161b22;border:1px solid #30363d;color:#e6edf3;border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer;min-width:280px">
      <option value="">Todas as Campanhas</option>
      ${camps.map(c=>`<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('')}
    </select>
  </div>
  <div class="kpi-grid cols-4" id="g-kpis" style="margin-bottom:20px"></div>
  <div class="card">
    <div class="card-title">Google Ads — Campanhas (${disp(S.start)} → ${disp(S.end)})</div>
    <div class="table-wrap"><table>
      <thead><tr id="g-thead"></tr></thead>
      <tbody id="g-tbody"></tbody>
    </table></div>
  </div>`;

  renderGoogleTable(null);
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
