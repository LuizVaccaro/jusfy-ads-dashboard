// Regra: GA4 → apenas sessões | conversões → Metabase (jusfy_conversions_daily) | spend → plataformas (campaign_daily)
let _diarioData = null;
let _diarioChannelFilter = null;
let _diarioCategoryFilter = null;

function spendByDate(campRows, channelFilter, categoryFilter) {
  const m = {};
  if (channelFilter === 'Orgânico') return m; // orgânico não tem spend de ads
  for (const r of campRows) {
    if (channelFilter === 'Google Ads' && r.platform !== 'google_ads') continue;
    if (channelFilter === 'Meta Ads'   && r.platform !== 'meta')       continue;
    if (categoryFilter && campaignCategory(r.campaign_name) !== categoryFilter) continue;
    if (!m[r.date]) m[r.date] = 0;
    m[r.date] += +r.spend || 0;
  }
  return m;
}

function convByDate(convRows, channelFilter, categoryFilter) {
  const m = {};
  for (const r of convRows) {
    const ch = classifyRealConversionChannel(r);
    if (channelFilter && ch !== channelFilter) continue;
    if (categoryFilter && (r.marketing_category||'') !== categoryFilter) continue;
    if (!m[r.date]) m[r.date] = 0;
    m[r.date] += +r.clientes_unicos || 0;
  }
  return m;
}

function sessionsByDate(rows) {
  const m = {};
  for (const r of rows) { if (!m[r.date]) m[r.date]=0; m[r.date] += +r.sessions||0; }
  return m;
}

function buildDiarioView(data, channelFilter, categoryFilter) {
  const { campsRaw, convDaily, ga4, cmpCampsRaw, cmpConvDaily, cmpGA4, hasCmpBase } = data;

  const spendMap    = spendByDate(campsRaw, channelFilter, categoryFilter);
  const convMap     = convByDate(convDaily, channelFilter, categoryFilter);
  const ga4Map      = sessionsByDate(ga4);
  const cmpSpendMap = spendByDate(cmpCampsRaw, channelFilter, categoryFilter);
  const cmpConvMap  = convByDate(cmpConvDaily, channelFilter, categoryFilter);
  const cmpGa4Map   = sessionsByDate(cmpGA4);

  const dates = [...new Set([...Object.keys(spendMap), ...Object.keys(ga4Map), ...Object.keys(convMap)])].sort().reverse();

  const totSpend = Object.values(spendMap).reduce((s,v)=>s+v, 0);
  const totSess  = Object.values(ga4Map).reduce((s,v)=>s+v, 0);
  const totConv  = Object.values(convMap).reduce((s,v)=>s+v, 0);
  const totCAC   = totConv > 0 ? totSpend / totConv : null;
  const totTX    = totSess > 0 ? totConv / totSess * 100 : 0;

  const cTotSpend = hasCmpBase ? Object.values(cmpSpendMap).reduce((s,v)=>s+v, 0) : undefined;
  const cTotSess  = hasCmpBase ? Object.values(cmpGa4Map).reduce((s,v)=>s+v, 0)   : undefined;
  const cTotConv  = hasCmpBase ? Object.values(cmpConvMap).reduce((s,v)=>s+v, 0)  : undefined;
  const cTotCAC   = (cTotConv && cTotSpend && cTotConv > 0) ? cTotSpend / cTotConv : undefined;

  const rows = dates.map(d => {
    const spend       = spendMap[d] || 0;
    const sessions    = ga4Map[d]   || 0;
    const conversions = convMap[d]  || 0;
    const cac = conversions > 0 ? spend / conversions : null;
    const tx  = sessions > 0 ? conversions / sessions * 100 : 0;

    let cmpRow = null;
    if (hasCmpBase) {
      const diffDays = Math.round((new Date(d) - new Date(S.start)) / 864e5);
      const cd  = fmt(addDays(new Date(S.cmpStart), diffDays));
      const cs  = cmpSpendMap[cd] || 0;
      const ccv = cmpConvMap[cd]  || 0;
      cmpRow = { spend: cs, conversions: ccv, cac: ccv > 0 ? cs / ccv : null };
    }

    return { date: d, spend, sessions, conversions, cac, tx, cmpRow };
  });

  return { rows, totSpend, totSess, totConv, totCAC, totTX, cTotSpend, cTotSess, cTotConv, cTotCAC, hasCmp: hasCmpBase };
}

function renderDiarioBody(filterChannel, filterCategory) {
  if (filterChannel !== undefined)  _diarioChannelFilter  = filterChannel;
  if (filterCategory !== undefined) _diarioCategoryFilter = filterCategory;
  if (!_diarioData) return;

  const view = buildDiarioView(_diarioData, _diarioChannelFilter, _diarioCategoryFilter);
  const { rows, totSpend, totSess, totConv, totCAC, totTX, cTotSpend, cTotSess, cTotConv, cTotCAC, hasCmp } = view;

  const st     = getSort('diario', 'date', 'desc');
  const sorted = sortRows(rows, st.key, st.dir);

  document.getElementById('content').innerHTML = `
  <div style="margin-bottom:16px;display:flex;align-items:center;gap:20px;flex-wrap:wrap">
    <div style="display:flex;align-items:center;gap:10px">
      <label style="font-size:12px;color:#8b949e;white-space:nowrap">Filtrar Canal</label>
      <select id="diarioChannelFilter" onchange="renderDiarioBody(this.value||null, undefined)"
        style="background:#161b22;border:1px solid #30363d;color:#e6edf3;border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer;min-width:180px">
        <option value="" ${!_diarioChannelFilter?'selected':''}>Todos os Canais</option>
        <option value="Orgânico"  ${_diarioChannelFilter==='Orgânico'?'selected':''}>Orgânico</option>
        <option value="Google Ads" ${_diarioChannelFilter==='Google Ads'?'selected':''}>Google Ads</option>
        <option value="Meta Ads"   ${_diarioChannelFilter==='Meta Ads'?'selected':''}>Meta Ads</option>
      </select>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <label style="font-size:12px;color:#8b949e;white-space:nowrap">Categoria</label>
      <select id="diarioCategoryFilter" onchange="renderDiarioBody(undefined, this.value||null)"
        style="background:#161b22;border:1px solid #30363d;color:#e6edf3;border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer;min-width:160px">
        <option value="" ${!_diarioCategoryFilter?'selected':''}>Todas as Categorias</option>
        <option value="Non brand" ${_diarioCategoryFilter==='Non brand'?'selected':''}>Non brand</option>
        <option value="Brand Search" ${_diarioCategoryFilter==='Brand Search'?'selected':''}>Brand Search</option>
      </select>
    </div>
  </div>

  <div class="kpi-grid cols-5" style="margin-bottom:20px">
    ${kpiCard('Investimento Total', totSpend, cTotSpend, fR, 'c-brand')}
    ${kpiCard('Sessões (GA4)',      totSess,  cTotSess,  fN, 'c-green')}
    ${kpiCard('Cadastros',          totConv,  cTotConv,  fN, 'c-blue')}
    ${kpiCard('TX. Conversão',      totTX,    undefined, fP, 'c-muted')}
    ${kpiCard('CAC Real',           totCAC,   cTotCAC,   fR, 'c-brand', true)}
  </div>

  <div class="card">
    <div class="card-title" style="margin-bottom:14px">
      Performance Diária — ${disp(S.start)} → ${disp(S.end)}
      <span style="font-size:11px;font-weight:400;color:#8b949e">${rows.length} dias</span>
    </div>
    <div class="table-wrap"><table>
      <thead><tr>
        ${sortTh('diario','Data','date','desc','')}
        ${sortTh('diario','Sessões','sessions')}
        ${sortTh('diario','Cadastros','conversions')}
        ${sortTh('diario','TX. Conversão','tx')}
        ${sortTh('diario','CAC Real','cac')}
        ${sortTh('diario','Investimento','spend')}
        ${hasCmp ? '<th class="r">Δ CAC</th><th class="r">Δ Invest.</th>' : ''}
      </tr></thead>
      <tbody>
        ${sorted.length ? sorted.map(r => {
          const cacCls = r.cac !== null && r.cac < 300 ? 'c-brand' : r.cac !== null && r.cac < 600 ? 'c-yellow' : 'c-red';
          const txCls  = r.tx > 0.5 ? 'c-green' : r.tx > 0.2 ? '' : 'c-muted';
          const noData = r.spend === 0 && r.sessions === 0;
          return `<tr style="${noData ? 'opacity:.45' : ''}">
            <td><strong>${disp(r.date)}</strong></td>
            <td class="r">${fN(r.sessions)}</td>
            <td class="r"><strong>${fN(Math.round(r.conversions))}</strong></td>
            <td class="r ${txCls}">${fP(r.tx)}</td>
            <td class="r"><strong class="${cacCls}">${r.cac !== null ? fR(r.cac) : '—'}</strong></td>
            <td class="r">${fR(r.spend)}</td>
            ${hasCmp && r.cmpRow ? `
              <td class="r">${r.cmpRow.cac !== null ? deltaHtml(r.cac, r.cmpRow.cac, true) || fR(r.cmpRow.cac) : '—'}</td>
              <td class="r">${deltaHtml(r.spend, r.cmpRow.spend) || fR(r.cmpRow.spend)}</td>
            ` : hasCmp ? '<td class="r c-muted">—</td><td class="r c-muted">—</td>' : ''}
          </tr>`;
        }).join('') : emptyRow(hasCmp ? 8 : 6)}
      </tbody>
      <tfoot>
        <tr style="border-top:2px solid #30363d;background:#161b22">
          <td><strong>Total</strong></td>
          <td class="r"><strong>${fN(totSess)}</strong></td>
          <td class="r"><strong>${fN(Math.round(totConv))}</strong></td>
          <td class="r"><strong>${fP(totTX)}</strong></td>
          <td class="r"><strong class="c-brand">${totCAC !== null ? fR(totCAC) : '—'}</strong></td>
          <td class="r"><strong class="c-brand">${fR(totSpend)}</strong></td>
          ${hasCmp ? '<td></td><td></td>' : ''}
        </tr>
      </tfoot>
    </table></div>
  </div>`;
}

async function tabDiario() {
  loading();
  const [campsRaw, ga4, cmpCampsRaw, cmpGA4, convDaily, cmpConvDaily] = await Promise.all([
    fetchCamps(S.start, S.end),
    fetchGA4DailyAgg(S.start, S.end),
    S.compare && S.cmpStart ? fetchCamps(S.cmpStart, S.cmpEnd) : [],
    S.compare && S.cmpStart ? fetchGA4DailyAgg(S.cmpStart, S.cmpEnd)  : [],
    fetchJusfyConversionsDailyAgg(S.start, S.end),
    S.compare && S.cmpStart ? fetchJusfyConversionsDailyAgg(S.cmpStart, S.cmpEnd) : [],
  ]);

  const hasCmpBase = S.compare && !!S.cmpStart && cmpCampsRaw.length > 0;

  _diarioData = { campsRaw, ga4, cmpCampsRaw, cmpGA4, convDaily, cmpConvDaily, hasCmpBase };
  _diarioChannelFilter = null;
  _diarioCategoryFilter = null;
  registerSortRenderer('diario', () => renderDiarioBody());
  renderDiarioBody();
}
